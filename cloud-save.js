var AFNextCloudCore=(()=>{
  const VERSION='3.6.42',APP='alshkafone-fishing',MANIFEST='af_bf_manifest_v1',CHUNK=3000,MAX_PARTS=128,MAX_BYTES=1048576;
  class CloudError extends Error{
    constructor(code,message,status=0,extra={}){super(message);this.name='CloudError';this.code=code;this.status=status;Object.assign(this,extra);}
  }
  function timeout(promise,ms=8000,label='Облако не ответило вовремя.'){
    return new Promise((resolve,reject)=>{const id=setTimeout(()=>reject(new CloudError('TIMEOUT',label)),ms);Promise.resolve(promise).then(value=>{clearTimeout(id);resolve(value);},error=>{clearTimeout(id);reject(error);});});
  }
  function validState(s){return !!s&&typeof s==='object'&&!Array.isArray(s)&&Number.isFinite(s.level)&&s.level>=1&&Number.isFinite(s.coins)&&s.coins>=0&&s.profile&&typeof s.profile==='object'&&typeof s.profile.name==='string';}
  function validateVersion(v){const match=/^3\.6\.(\d+)$/.exec(v||'');if(!match||Number(match[1])<10||Number(match[1])>42)throw new CloudError('VERSION','Эта облачная копия создана другой версией игры. Она не изменена.');}
  function progressDigest(state){
    const value=JSON.parse(JSON.stringify(state));
    delete value.release;delete value.worldMinutes;
    if(value.next)delete value.next.meta;
    const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
    let h=2166136261;const text=JSON.stringify(stable(value));
    for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
    return (h>>>0).toString(16).padStart(8,'0');
  }
  async function sha256(value){
    if(!globalThis.crypto?.subtle)throw new CloudError('CRYPTO','Браузер не поддерживает проверку целостности облачной копии.');
    const bytes=typeof value==='string'?new TextEncoder().encode(value):value;
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  }
  function encode64(bytes){let s='';for(let n=0;n<bytes.length;n+=16384)s+=String.fromCharCode(...bytes.subarray(n,n+16384));return btoa(s);}
  function decode64(s){if(typeof s!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw new CloudError('CORRUPT','Облачная копия повреждена.');try{return Uint8Array.from(atob(s),x=>x.charCodeAt(0));}catch(_){throw new CloudError('CORRUPT','Облачная копия повреждена.');}}
  function aborted(signal){if(signal?.aborted)throw signal.reason instanceof Error?signal.reason:new CloudError('CANCELLED','Ожидание остановлено. Локальный прогресс сохранён.');}
  async function readLimited(stream,max=MAX_BYTES,signal){
    const reader=stream.getReader(),chunks=[];let length=0;
    const stop=()=>{void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',stop,{once:true});
    try{aborted(signal);for(;;){const {done,value}=await reader.read();aborted(signal);if(done)break;length+=value.length;if(length>max){await reader.cancel();throw new CloudError('SIZE','Размер сохранения превышает безопасный предел.');}chunks.push(value);}}finally{signal?.removeEventListener('abort',stop);reader.releaseLock();}
    const out=new Uint8Array(length);let at=0;for(const part of chunks){out.set(part,at);at+=part.length;}return out;
  }
  async function pack(state,compress=true,signal){
    aborted(signal);
    if(!validState(state))throw new CloudError('STATE','Не удалось подготовить игровое сохранение.');
    const bytes=new TextEncoder().encode(JSON.stringify({app:APP,version:VERSION,state}));
    if(bytes.length>MAX_BYTES)throw new CloudError('SIZE','Сохранение слишком большое для облака. Скачай резервную копию JSON.');
    let encoding='utf8-base64',payload=bytes;
    if(compress&&typeof CompressionStream==='function'){try{payload=await readLimited(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),MAX_BYTES,signal);encoding='gzip-base64';}catch(e){aborted(signal);if(e.code==='SIZE')throw e;}}
    aborted(signal);
    const data=encode64(payload),parts=[];for(let n=0;n<data.length;n+=CHUNK)parts.push(data.slice(n,n+CHUNK));
    if(parts.length>MAX_PARTS)throw new CloudError('SIZE','Копия не помещается в хранилище VK. Скачай JSON для переноса; локальная игра сохранена.');
    return {parts,encoding,sha256:await sha256(data),bytes:bytes.length};
  }
  function descriptor(raw){
    if(!raw||typeof raw!=='object'||raw.app!==APP||raw.schema!==1||!Number.isInteger(raw.count)||raw.count<1||raw.count>MAX_PARTS||!Number.isInteger(raw.bytes)||raw.bytes<1||raw.bytes>MAX_BYTES||!['gzip-base64','utf8-base64'].includes(raw.encoding)||!/^[-a-z0-9_]{8,60}$/.test(raw.generation||'')||!/^[a-f0-9]{64}$/.test(raw.sha256||''))throw new CloudError('CORRUPT','Не удалось прочитать описание облачной копии. Существующие данные сохранены.');
    validateVersion(raw.version);
    return {app:APP,schema:1,version:raw.version,generation:raw.generation,count:raw.count,bytes:raw.bytes,encoding:raw.encoding,sha256:raw.sha256,updatedAt:Number.isFinite(raw.updatedAt)?raw.updatedAt:0};
  }
  async function unpack(meta,parts,signal){
    aborted(signal);
    const d=descriptor(meta);
    if(parts.length!==d.count||parts.some(p=>typeof p!=='string'||!p.length||p.length>CHUNK))throw new CloudError('CORRUPT','Не все части сохранения получены. Предыдущая копия не изменена.');
    const data=parts.join('');if(await sha256(data)!==d.sha256)throw new CloudError('INTEGRITY','Проверка целостности облачной копии не прошла. Она не будет загружена.');
    let bytes=decode64(data);
    if(d.encoding==='gzip-base64'){
      if(typeof DecompressionStream!=='function'&&typeof globalThis.pako?.ungzip!=='function')throw new CloudError('COMPRESSION','Этот браузер не может открыть сжатую копию. Используй актуальный браузер или JSON-экспорт.');
      try{bytes=typeof DecompressionStream==='function'?await readLimited(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),MAX_BYTES,signal):new Uint8Array(globalThis.pako.ungzip(bytes));if(bytes.length>MAX_BYTES)throw new CloudError('SIZE','Сохранение превышает безопасный предел.');}catch(e){aborted(signal);if(e instanceof CloudError)throw e;throw new CloudError('CORRUPT','Не удалось распаковать облачное сохранение.');}
    }
    if(bytes.length!==d.bytes)throw new CloudError('INTEGRITY','Размер облачной копии не совпадает с сохранённым.');
    let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch(_){throw new CloudError('CORRUPT','Облачная копия содержит неполные данные.');}
    if(!value||typeof value!=='object')throw new CloudError('STATE','В облачной копии не найден игровой персонаж.');
    validateVersion(value.version);if(value.app!==APP||!validState(value.state))throw new CloudError('STATE','В облачной копии не найден игровой персонаж.');
    return value.state;
  }
  // A timeout belongs to the complete transaction, not only to one bridge call.
  // Every awaited continuation checks the same abort signal before it may write.
  function operationRunner(options={}){
    let active=null;
    const duration=Math.max(10,Number(options.operationTimeout)||35000);
    function run(kind,work){
      if(active){if(kind==='read'&&active.kind==='read')return active.promise;return Promise.reject(new CloudError('BUSY','Сохранение уже выполняется. Дождись результата.'));}
      const controller=new AbortController(),job={kind,controller,promise:null,commitStarted:false},started=Date.now();
      const failure=(cancelled=false)=>new CloudError(job.commitStarted?'UNCERTAIN':cancelled?'CANCELLED':'TIMEOUT',job.commitStarted?'Облако могло завершить запись, но подтверждение не получено. Нажми «Повторить проверку». Локальный прогресс и предыдущая копия сохранены.':cancelled?'Ожидание остановлено. Локальный прогресс сохранён. Можно повторить проверку.':'Облако не завершило операцию вовремя. Локальный прогресс сохранён. Повтори проверку.');
      const ctx={signal:controller.signal,check:()=>aborted(controller.signal),remaining:()=>Math.max(1,duration-(Date.now()-started)),commit:()=>{job.commitStarted=true;},progress:(stage,done=0,total=0)=>{aborted(controller.signal);try{options.onProgress?.({stage,done,total,kind});}catch(_){}},wait:async value=>{const result=await value;aborted(controller.signal);return result;}};
      let rejectDeadline;
      const deadline=new Promise((_,reject)=>{rejectDeadline=reject;});
      job.cancel=()=>{const e=failure(true);controller.abort(e);rejectDeadline(e);};
      const timer=setTimeout(()=>{const e=failure();controller.abort(e);rejectDeadline(e);},duration);
      active=job;
      job.promise=Promise.race([Promise.resolve().then(()=>work(ctx)),deadline]).finally(()=>{clearTimeout(timer);if(!controller.signal.aborted)controller.abort(new CloudError('FINISHED','Операция завершена.'));if(active===job)active=null;});
      return job.promise;
    }
    return {run,cancel:()=>active?.cancel(),get busy(){return !!active;}};
  }
  function verifiedVK(bridge,location,doc,win){
    const uid=new URLSearchParams(location.search||'').get('vk_user_id')||'';
    if(!/^[1-9][0-9]{0,19}$/.test(uid)||!bridge||typeof bridge.send!=='function')return null;
    const trusted=url=>{try{return /(^|\.)vk\.(com|ru)$/.test(new URL(url).hostname);}catch(_){return false;}};
    const origins=Array.from(location.ancestorOrigins||[]);
    let native=false;try{native=!!(bridge.isWebView?.()===true&&(win.AndroidBridge||win.webkit?.messageHandlers?.VKWebAppClose)||typeof win.ReactNativeWebView?.postMessage==='function');}catch(_){}
    if(!native&&!bridge.isEmbedded?.())return null;
    if(!native&&!trusted(doc.referrer||'')&&!origins.some(trusted))return null;
    return {id:'vk:'+uid,displayName:'Профиль VK',provider:'vk'};
  }
  function createVK(bridge,identity,options={}){
    const limit=options.timeout||8000,chunkKey=(d,i)=>'af_bf_g_'+d.generation+'_'+i,runner=operationRunner(options);
    let initialized=false,pendingCommit=null;
    async function send(ctx,name,args){
      ctx.check();
      try{
        let pending;
        try{pending=Promise.resolve(bridge.send(name,args));}catch(e){if(name==='VKWebAppStorageSet'&&args.key===MANIFEST&&pendingCommit)pendingCommit.settled=true;throw e;}
        if(name==='VKWebAppStorageSet'&&args.key===MANIFEST&&pendingCommit){
          const commit=pendingCommit;
          pending.then(()=>{commit.settled=true;},()=>{commit.settled=true;});
        }
        return await ctx.wait(timeout(pending,Math.min(limit,ctx.remaining()),'VK не ответил вовремя. Локальный прогресс сохранён; повтори проверку облака.'));
      }catch(e){ctx.check();if(e instanceof CloudError)throw e;throw new CloudError('VK_ERROR','VK не подтвердил операцию с облачной копией. Локальный прогресс сохранён.',0,{cause:e});}
    }
    async function init(ctx){if(initialized)return;ctx.progress('connecting');const r=await send(ctx,'VKWebAppInit',{});if(r?.result===false)throw new CloudError('VK_INIT','Не удалось подключиться к приложению VK.');initialized=true;}
    async function get(ctx,keys){
      const out={};
      for(let n=0;n<keys.length;n+=8){const batch=keys.slice(n,n+8),r=await send(ctx,'VKWebAppStorageGet',{keys:batch});if(!Array.isArray(r?.keys))throw new CloudError('VK_READ','VK не вернул содержимое хранилища.');for(const key of batch){const row=r.keys.find(x=>x.key===key);if(!row||typeof row.value!=='string')throw new CloudError('VK_READ','VK вернул неполный ответ. Облачная копия не изменена.');out[key]=row.value;}}
      return out;
    }
    async function put(ctx,key,value){const r=await send(ctx,'VKWebAppStorageSet',{key,value});if(r?.result!==true)throw new CloudError('UNCONFIRMED','VK не подтвердил запись. Сначала проверь облачную копию повторно.');}
    async function head(ctx){const value=(await get(ctx,[MANIFEST]))[MANIFEST];if(!value)return {raw:'',meta:null,previous:null};let raw;try{raw=JSON.parse(value);}catch(_){throw new CloudError('CORRUPT','Описание облачной копии повреждено. Оно не будет перезаписано.');}const meta=descriptor(raw);let previous=null;if(raw.previous)try{previous=descriptor(raw.previous);}catch(_){}return {raw:value,meta,previous};}
    async function body(ctx,meta){const keys=Array.from({length:meta.count},(_,i)=>chunkKey(meta,i)),values=await get(ctx,keys);return ctx.wait(unpack(meta,keys.map(key=>values[key]),ctx.signal));}
    function reconcilePending(h){
      // The native bridge cannot cancel a message already sent. Do not issue a
      // competing manifest while a timed-out commit may still reach storage.
      if(pendingCommit&&(h.raw===pendingCommit.raw||pendingCommit.settled))pendingCommit=null;
    }
    async function readBody(ctx){
      await init(ctx);ctx.progress('reading');const h=await head(ctx);
      if(!h.meta){reconcilePending(h);return {exists:false,revision:0,state:null,version:VERSION,updatedAt:null,_raw:'',_head:null,pendingWrite:!!pendingCommit};}
      let state,recovered=false,validMeta=h.meta;
      try{state=await body(ctx,h.meta);}catch(error){ctx.check();if(!h.previous)throw error;try{state=await body(ctx,h.previous);validMeta=h.previous;recovered=true;}catch(_){ctx.check();throw error;}}
      const after=await head(ctx);if(after.raw!==h.raw)throw new CloudError('CONFLICT','Облачная копия изменилась во время чтения. Проверь её ещё раз.',409);
      reconcilePending(h);
      return {exists:true,revision:h.meta.generation,state,version:validMeta.version,updatedAt:validMeta.updatedAt,recovered,_raw:h.raw,_head:h.meta,_valid:validMeta,_previous:h.previous,pendingWrite:!!pendingCommit};
    }
    function cleanOld(meta,currentRaw){
      if(!meta)return;
      // Cleanup never delays a confirmed save, cannot touch the current/previous
      // pointer, and stops when its own short deadline expires.
      const cleanup=operationRunner({operationTimeout:2500});
      void cleanup.run('cleanup',async ctx=>{if((await head(ctx)).raw!==currentRaw)return;for(let i=0;i<meta.count;i++)await put(ctx,chunkKey(meta,i),'');}).catch(()=>{});
    }
    async function writeBody(ctx,basis,state){
      await init(ctx);if(!basis||!Object.hasOwn(basis,'_raw'))throw new CloudError('READ_FIRST','Сначала прочитай облачную копию.');
      ctx.progress('preparing');const payload=await ctx.wait(pack(state,options.compress!==false,ctx.signal)),before=await head(ctx);
      reconcilePending(before);
      if(pendingCommit)throw new CloudError('UNCERTAIN','Предыдущий запрос VK ещё не завершён. Новая запись не отправлена. Нажми «Повторить проверку» чуть позже.');
      if(before.raw!==basis._raw)throw new CloudError('CONFLICT','На другом устройстве появился новый прогресс. Выбери копию заново.',409);
      const random=new Uint32Array(2);crypto.getRandomValues(random);
      const generation=Date.now().toString(36)+'_'+Array.from(random,v=>v.toString(36)).join('_');
      const meta={app:APP,schema:1,version:VERSION,generation,count:payload.parts.length,bytes:payload.bytes,encoding:payload.encoding,sha256:payload.sha256,updatedAt:Date.now()};
      for(let i=0;i<payload.parts.length;i++){ctx.progress('uploading',i+1,payload.parts.length);await put(ctx,chunkKey(meta,i),payload.parts[i]);}
      ctx.progress('verifying');await body(ctx,meta); // Verify staged bytes before moving the manifest.
      if((await head(ctx)).raw!==basis._raw)throw new CloudError('CONFLICT','Пока шла запись, облачная копия обновилась на другом устройстве. Предыдущий прогресс сохранён.',409);
      const previous=basis.exists?(basis._valid||basis._head):null,manifest={...meta,...(previous?{previous:descriptor(previous)}:{})},raw=JSON.stringify(manifest);
      ctx.progress('committing');ctx.commit();pendingCommit={raw,settled:false};
      try{await put(ctx,MANIFEST,raw);}catch(e){throw new CloudError('UNCERTAIN','VK не подтвердил завершение записи. Автосохранение приостановлено; нажми «Повторить проверку». Локальный прогресс сохранён.',0,{cause:e});}
      ctx.progress('confirming');
      try{
        const after=await head(ctx);if(after.raw!==raw)throw new CloudError('CONFLICT','Облако изменилось во время подтверждения. Выбери актуальную копию.',409);
        const verified=await body(ctx,meta);pendingCommit=null;
        if(basis._previous?.generation!==previous?.generation)cleanOld(basis._previous,raw);
        return {exists:true,revision:generation,state:verified,version:VERSION,updatedAt:meta.updatedAt,_raw:raw,_head:meta,_valid:meta,_previous:previous};
      }catch(e){if(e?.status===409)throw e;throw new CloudError('UNCERTAIN','Запись отправлена, но проверить её не удалось. Нажми «Повторить проверку». Локальный прогресс и предыдущая облачная копия сохранены.',0,{cause:e});}
    }
    return {kind:'vk',identity,read:()=>runner.run('read',readBody),write:(basis,state)=>runner.run('write',ctx=>writeBody(ctx,basis,state)),cancel:runner.cancel,get busy(){return runner.busy;}};
  }
  function makeRequester(fetcher,location,apiBase='',ms=10000){
    return async function request(path,options={}){
      if(!/^https?:$/.test(location.protocol||''))throw new CloudError('NO_API','В файле игры доступно локальное сохранение и перенос через JSON.');
      let origin;try{origin=new URL(apiBase||location.origin,location.href).origin;}catch(_){throw new CloudError('NO_API','Сервер сохранений не настроен.');}
      if(origin!==location.origin||!/^\/api\/[a-z][a-z0-9_/?=&%-]*$/i.test(path))throw new CloudError('NO_API','Подключение к серверу доступно только на сайте игры.');
      const headers={'Accept':'application/json'},method=String(options.method||'GET').toUpperCase();
      let body=options.body;
      if(body!=null){body=typeof body==='string'?body:JSON.stringify(body);if(new TextEncoder().encode(body).length>MAX_BYTES)throw new CloudError('SIZE','Сохранение больше 1 МБ. Скачай JSON-резервную копию.');headers['Content-Type']='application/json';}
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);let response;
      try{response=await timeout(fetcher(origin+path,{method,headers,credentials:'same-origin',cache:'no-store',redirect:'error',...(body!=null?{body}:{}),signal:controller.signal}),ms,'Сервер не ответил вовремя. Локальная копия сохранена.');}
      catch(e){if(controller.signal.aborted||e?.code==='TIMEOUT'){controller.abort();throw new CloudError('TIMEOUT','Сервер не ответил вовремя. Локальная копия сохранена.');}throw new CloudError('NETWORK','Нет связи с сервером. Продолжай играть — локальная копия работает.',0,{cause:e});}
      finally{clearTimeout(timer);}
      const type=response.headers?.get?.('content-type')||'';
      if(!type.includes('application/json'))throw new CloudError('NO_API','На этом адресе нет сервера сохранений. Доступен перенос через JSON.',response.status);
      let data;try{data=await timeout(response.json(),ms,'Сервер не завершил ответ. Локальный прогресс сохранён.');}catch(e){if(e instanceof CloudError)throw e;throw new CloudError('BAD_RESPONSE','Сервер вернул неполный ответ. Локальная копия не изменена.',response.status);}
      if(!response.ok||data?.ok===false){const code=typeof data?.error?.code==='string'?data.error.code:response.status===401?'UNAUTHENTICATED':response.status===409?'REVISION_CONFLICT':'API_ERROR';const message=typeof data?.error?.message==='string'?data.error.message.slice(0,280):'Сервер не подтвердил действие.';throw new CloudError(code,message,response.status,{revision:data?.revision,data});}
      return data;
    };
  }
  function cleanServerSave(raw){
    if(!raw||raw.ok!==true||typeof raw.exists!=='boolean'||!Number.isInteger(raw.revision)||raw.revision<0)throw new CloudError('BAD_RESPONSE','Сервер не подтвердил состояние облачной копии.');
    validateVersion(raw.version||VERSION);
    if(raw.exists&&(!validState(raw.state)||raw.revision<1))throw new CloudError('STATE','В облаке не найден корректный игровой прогресс.');
    if(!raw.exists&&(raw.state!==null||raw.revision!==0))throw new CloudError('BAD_RESPONSE','Сервер вернул противоречивое состояние копии.');
    return {exists:raw.exists,revision:raw.revision,state:raw.state,version:raw.version||VERSION,updatedAt:Number.isFinite(raw.updatedAt)?raw.updatedAt:null};
  }
  function createSites(request,identity,options={}){
    const runner=operationRunner(options);
    const readBody=async ctx=>{ctx.progress('reading');return cleanServerSave(await ctx.wait(request('/api/save')));};
    async function writeBody(ctx,basis,state){
      if(!basis||!Number.isInteger(basis.revision))throw new CloudError('READ_FIRST','Сначала проверь облачную копию.');
      const current=await readBody(ctx);if(current.revision!==basis.revision)throw new CloudError('CONFLICT','На другом устройстве сохранён новый прогресс. Выбери копию заново.',409);
      ctx.progress('committing');ctx.commit();
      const data=cleanServerSave(await ctx.wait(request('/api/save',{method:'PUT',body:{revision:basis.revision,version:VERSION,state}})));
      if(!data.exists||data.revision!==basis.revision+1)throw new CloudError('UNCONFIRMED','Сервер не подтвердил новую версию сохранения.');
      ctx.progress('confirming');
      const expected=await ctx.wait(sha256(JSON.stringify(state))),actual=await ctx.wait(sha256(JSON.stringify(data.state)));
      if(actual!==expected)throw new CloudError('UNCONFIRMED','Сохранённая копия не совпадает с отправленной. Проверь облако повторно.');
      return data;
    }
    return {kind:'sites',identity,read:()=>runner.run('read',readBody),write:(basis,state)=>runner.run('write',ctx=>writeBody(ctx,basis,state)),cancel:runner.cancel,get busy(){return runner.busy;}};
  }
  return {CloudError,timeout,validState,progressDigest,sha256,pack,unpack,descriptor,verifiedVK,createVK,makeRequester,cleanServerSave,createSites,constants:{VERSION,APP,MANIFEST,CHUNK,MAX_PARTS,MAX_BYTES}};
})();

function installNextCloud(){
  const A=window.AFNext,C=AFNextCloudCore;if(!A||A.cloud)return;
  const request=C.makeRequester((...args)=>fetch(...args),location,window.__AFNEXT_API||'');
  let adapter=null,identity=null,remote=null,status='checking',error='',baseDigest='',lastSynced=0,armed=false,busy=false,refreshing=null,timer=null,suppress=0,localEpoch=0,reconcileAfter=false,needsCheck=false,nextAutoAt=0,progress=null;
  let verifiedRead=false,retryTimer=null,retryAttempt=0,starting=false,booted=false,bootGame=null,startPromise=null;
  const appId=new URLSearchParams(location.search||'').get('vk_app_id')||'';
  const stateDigest=state=>C.progressDigest(state);
  const cancel=()=>{if(timer)clearTimeout(timer);timer=null;};
  const clock=at=>at?new Date(at).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'ещё не сохранялось';
  const action=(id,label,cls='')=>`<button type="button" class="btn ${cls}" data-nc="${id}">${label}</button>`;
  const label=()=>adapter?.kind==='vk'?'ВК':'Аккаунт';
  const stageLabel=p=>p?.stage==='uploading'?`Передаём часть ${p.done} из ${p.total}`:({connecting:'Подключаемся к ВК',preparing:'Подготавливаем копию',reading:'Читаем облачную копию',verifying:'Проверяем переданные данные',committing:'Сохраняем проверенную копию',confirming:'Подтверждаем запись'})[p?.stage]||'Проверяем сохранение';
  const vkLaunch=()=>C.verifiedVK(window.vkBridge,location,document,window);
  function clearRetry(){if(retryTimer)clearTimeout(retryTimer);retryTimer=null;}
  function retryLater(e){
    clearRetry();
    if(adapter?.kind!=='vk'||!['TIMEOUT','NETWORK','VK_ERROR','VK_INIT','UNCERTAIN','UNCONFIRMED','VK_READ'].includes(e?.code))return;
    const delay=Math.min(60000,5000*Math.pow(2,Math.min(retryAttempt++,4)));
    retryTimer=setTimeout(()=>{retryTimer=null;if(!busy&&!refreshing)void refresh();else retryLater(e);},delay);
  }
  function readLink(state){
    const x=state.next?.meta?.vkSync;
    return x&&x.id===identity?.id&&x.app===appId&&typeof x.digest==='string'?x:null;
  }
  function remember(value,digest){
    if(adapter?.kind!=='vk')return;
    S.next||={};S.next.meta||={};
    S.next.meta.vkSync={id:identity.id,app:appId,revision:value.revision,digest};
    delete S.next.meta.cloudRestart;
    suppress++;try{save();}finally{suppress--;}
  }
  function reportProgress(value){progress=value;const el=document.getElementById('ncOperationProgress');if(el)el.textContent=stageLabel(value);const gate=document.getElementById('afCloudGateDetail');if(gate&&status!=='error')gate.textContent=stageLabel(value);}
  function publicState(){return {status,error,identity:identity?{...identity}:null,provider:adapter?.kind||null,armed,lastSynced,ready:verifiedRead,busy:busy||!!refreshing,progress:progress?{...progress}:null,remote:remote?{exists:remote.exists,revision:remote.revision,updatedAt:remote.updatedAt,recovered:!!remote.recovered}:null};}
  function paintStatus(){
    const badge=document.getElementById('ncSaveStatus');if(!badge)return;
    const vk=adapter?.kind==='vk'||!!vkLaunch();
    badge.textContent=vk?({checking:'ВК · загружаем прогресс',saving:'ВК · сохраняем…',pending:'ВК · ожидает сохранения',synced:'ВК · прогресс сохранён',empty:'ВК · автосохранение готово',choice:'ВК · выбери сохранение',error:'ВК · нет подтверждения',recovered:'ВК · восстановлена копия'})[status]||'ВК · проверяем сохранение':storageOK?'Прогресс на устройстве':'Хранилище недоступно';
    badge.title=error||(lastSynced?'Сохранено: '+clock(lastSynced):'Состояние сохранения прогресса');
    badge.style.color=['error','choice','pending'].includes(status)?'#eac28a':status==='synced'?'#a8d3b6':'';
  }
  function drawGate(){
    if(!starting||booted)return;
    let gate=document.getElementById('afCloudGate');
    if(!gate){gate=document.createElement('div');gate.id='afCloudGate';gate.setAttribute('role','status');gate.style.cssText='position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px;background:#0a2029;color:#e6e4d7;box-sizing:border-box';document.body.append(gate);}
    const failed=status==='error'||status==='local'||status==='auth';
    gate.innerHTML=`<section style="max-width:480px;width:100%"><div class="eyebrow">АЛЬШКАФОНЕ · БОЛЬШАЯ РЫБАЛКА</div><h2 style="margin:18px 0">${failed?'Не удалось загрузить прогресс':'Возвращаемся на твой берег'}</h2><p id="afCloudGateDetail" class="modal-copy">${esc(failed?error||'Связь с ВК пока недоступна.':progress?stageLabel(progress):'Проверяем сохранение твоего аккаунта ВК…')}</p>${failed?`<p class="small muted">Облачная копия остаётся нетронутой. Повтори загрузку или продолжи на этом устройстве.</p><div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:22px">${action('retry-start','Повторить загрузку')}${action('offline-start','Продолжить на устройстве','secondary')}</div>`:'<p class="small muted">Загружаем персонажа, статистику и покупки.</p>'}</section>`;
  }
  function finishStart(){
    if(!starting||busy||refreshing)return;
    if(['error','local','auth'].includes(status)&&!S.profile.done){drawGate();return;}
    releaseBoot();
  }
  function releaseBoot(){
    starting=false;document.getElementById('afCloudGate')?.remove();
    if(!booted&&bootGame){booted=true;bootGame();}
    if(['choice','recovered'].includes(status)&&!activeCast())A.navigate('cloud');
    paintStatus();
  }
  function publish(){
    A.emit('cloudStatus',publicState());
    if(view==='cloud'&&!activeCast())try{render();}catch(e){console.error('Cloud status render',e);}
    paintStatus();if(starting&&status==='error')drawGate();
  }
  function messageFor(e){return e?.message||'Связь с ВК недоступна. Повторим сохранение автоматически.';}
  function classify(e){
    error=messageFor(e);armed=false;cancel();
    if(e?.status===401||e?.code==='UNAUTHENTICATED'){status='auth';identity=null;adapter=null;verifiedRead=false;}
    else if(e?.code==='NO_API'){status='local';identity=null;adapter=null;verifiedRead=false;}
    else status='error';
    retryLater(e);publish();
  }
  async function chooseAdapter(){
    const vk=vkLaunch();
    if(vk){vk.displayName=S.profile.name||'Рыбак ВК';if(adapter?.kind==='vk'&&identity?.id===vk.id){identity=vk;return;}identity=vk;adapter=C.createVK(window.vkBridge,vk,{onProgress:reportProgress});verifiedRead=false;return;}
    const me=await request('/api/me');
    if(!me?.user||typeof me.user.id!=='string'||!me.user.id)throw new C.CloudError('BAD_RESPONSE','Сервер не подтвердил профиль игрока.');
    identity={id:me.user.id,displayName:String(me.user.displayName||'Рыбак').slice(0,60),provider:'sites',club:me.club||null};adapter=C.createSites(request,identity,{onProgress:reportProgress});A.emit('cloud-ready',{identity,provider:'sites'});
  }
  async function refresh(){
    if(refreshing)return refreshing;if(busy){needsCheck=true;return publicState();}
    cancel();clearRetry();armed=false;status='checking';error='';progress=null;publish();
    refreshing=(async()=>{
      let follow='',restoreDigest='';
      try{
        const oldIdentity=identity?.id;await chooseAdapter();A.emit('cloudIdentity',identity);
        remote=await adapter.read();verifiedRead=true;
        const local=A.snapshot(),digest=stateDigest(local),link=readLink(local);
        const remoteDigest=remote.exists?stateDigest(normalise(remote.state)):'';
        const restarting=local.next?.meta?.cloudRestart===true;
        if(!remote.exists){status='empty';baseDigest='';if(adapter.kind==='vk'&&local.profile.done&&!saveBlocked)follow='first';}
        else if(remote.pendingWrite){status='error';error='Предыдущая запись ВК ещё обрабатывается. Повторяем проверку; прежний прогресс остаётся в облаке.';retryLater(new C.CloudError('UNCERTAIN',error));}
        else if(remote.recovered){status='choice';error='Последняя запись неполная. Доступна предыдущая проверенная копия — выбери, как продолжить.';}
        else if(restarting&&adapter.kind==='vk'){
          status='empty';baseDigest='';if(local.profile.done&&!saveBlocked)follow='first';
        }
        else if(digest===remoteDigest){status='synced';baseDigest=digest;armed=true;lastSynced=remote.updatedAt||Date.now();remember(remote,digest);}
        else if(adapter.kind==='vk'&&!saveBlocked&&!local.profile.done&&remote.state?.profile?.done){status='checking';follow='restore';restoreDigest=digest;}
        else if(adapter.kind==='vk'&&!saveBlocked&&link&&link.revision===remote.revision){
          // Cloud still points at the last acknowledged copy: only this device changed.
          baseDigest=link.digest;armed=true;status='pending';follow='push';
        }
        else if(adapter.kind==='vk'&&!saveBlocked&&link&&digest===link.digest){
          // Only the remote branch advanced. A timestamp alone never decides this.
          status='checking';follow='restore';restoreDigest=digest;
        }
        else {status='choice';baseDigest='';}
        if(oldIdentity&&oldIdentity!==identity.id){armed=false;status=remote.exists?'choice':'empty';follow='';}
        if(status!=='error'){retryAttempt=0;clearRetry();}
        needsCheck=false;
      }catch(e){classify(e);}
      finally{refreshing=null;progress=null;publish();}
      if(follow==='restore')await useCloud({automatic:true,expectedDigest:restoreDigest});
      else if(follow==='first')await push(true);
      else if(follow==='push')await push(false);
      finishStart();return publicState();
    })();
    return refreshing;
  }
  function queue(){
    if(!armed||suppress||!adapter||!S.profile.done||saveBlocked||timer||busy||refreshing)return;
    if(stateDigest(A.snapshot())===baseDigest)return;
    status='pending';publish();
    timer=setTimeout(()=>{timer=null;void push(false);},Math.max(1200,nextAutoAt-Date.now()));
  }
  function backupRemote(value){
    if(!value?.exists||!value.state)return;
    try{const key=KEY+':snapshots',rows=JSON.parse(localStorage.getItem(key)||'[]');rows.unshift(JSON.stringify({app:'alshkafone-fishing',version:value.version,reason:'Облачная копия перед заменой',at:Date.now(),state:value.state}));localStorage.setItem(key,JSON.stringify(rows.slice(0,3)));}catch(_){}
  }
  async function push(manual=false){
    if(busy||refreshing||!adapter||!remote||saveBlocked||(!manual&&!armed))return publicState();
    const epoch=localEpoch,basis=remote,snapshot=A.snapshot(),digest=stateDigest(snapshot);
    if(!snapshot.profile.done)return publicState();
    if(!manual&&digest===baseDigest)return publicState();
    if(manual&&['choice','empty','error'].includes(status))backupRemote(basis);
    if(snapshot.next?.meta)delete snapshot.next.meta.cloudRestart;
    cancel();clearRetry();busy=true;status='saving';error='';progress=null;publish();
    try{
      const saved=await adapter.write(basis,snapshot);
      remote=saved;baseDigest=digest;lastSynced=saved.updatedAt||Date.now();status='synced';armed=true;retryAttempt=0;
      if(epoch!==localEpoch){armed=false;reconcileAfter=true;}
      else remember(saved,digest);
    }catch(e){
      armed=false;error=messageFor(e);
      if(e?.status===409||['CONFLICT','REVISION_CONFLICT'].includes(e?.code)){
        try{remote=await adapter.read();status='choice';error='Прогресс изменился и здесь, и на другом устройстве. Выбери, какую копию продолжить.';}catch(readError){classify(readError);}
      }else classify(e);
    }finally{
      busy=false;progress=null;nextAutoAt=Date.now()+1200;
      if(armed&&stateDigest(A.snapshot())!==baseDigest)status='pending';
      publish();
      if(reconcileAfter||needsCheck){reconcileAfter=false;needsCheck=false;void refresh();}
      else queue();
    }
    return publicState();
  }
  async function useCloud(options={}){
    if(busy||refreshing||!adapter||!remote?.exists)return publicState();
    if(activeCast()||S.pending){status='choice';error='Заверши текущую ловлю, прежде чем загружать облачную копию.';publish();return publicState();}
    const chosen=remote,epoch=localEpoch,expected=options.expectedDigest||stateDigest(A.snapshot());
    busy=true;status='checking';armed=false;cancel();publish();
    try{
      const fresh=await adapter.read();
      if(epoch!==localEpoch||stateDigest(A.snapshot())!==expected){status='choice';error='На устройстве появился новый прогресс во время загрузки. Выбери нужную копию.';return publicState();}
      if(!fresh.exists||fresh.revision!==chosen.revision||stateDigest(fresh.state)!==stateDigest(chosen.state)){
        remote=fresh;status=fresh.exists?'choice':'empty';error='Облачная копия изменилась во время загрузки. Проверь её ещё раз.';return publicState();
      }
      if(fresh.pendingWrite)throw new C.CloudError('UNCERTAIN','Предыдущая запись ВК ещё обрабатывается. Повторяем проверку.');
      if(activeCast()||S.pending)throw new C.CloudError('BUSY','Сначала закончи ловлю. Облачная копия пока не загружена.');
      suppress++;
      try{if(adapter.kind==='vk')A.applyCloudState(fresh.state,'Перед загрузкой из ВК');else A.applyState(fresh.state,'Перед загрузкой из облака');}finally{suppress--;}
      remote=fresh;baseDigest=stateDigest(A.snapshot());lastSynced=fresh.updatedAt||Date.now();error='';
      armed=!fresh.recovered;status=fresh.recovered?'recovered':'synced';
      if(armed)remember(fresh,baseDigest);
      if(fresh.recovered)error='Предыдущая копия загружена. Нажми «Сохранить в облако», чтобы подтвердить восстановление.';
      if(!options.automatic)toast('Твой персонаж и прогресс восстановлены.');
    }catch(e){if(epoch===localEpoch)classify(e);}finally{busy=false;progress=null;publish();if(reconcileAfter){reconcileAfter=false;void refresh();}}
    return publicState();
  }
  function downloadRemote(){
    if(!remote?.exists)return;
    downloadBlob(new Blob([JSON.stringify({app:'alshkafone-fishing',version:remote.version,exportedAt:Date.now(),state:remote.state},null,2)],{type:'application/json'}),'rybalka-cloud-backup.json');
  }
  function summaryCard(title,state,sub,isCloud=false){
    if(!state)return `<article class="nc-copy-card nc-copy-empty"><span class="nc-copy-icon">${I('save')}</span><small>${title}</small><h3>Пока пусто</h3><p>Здесь появится первая облачная копия твоего персонажа.</p></article>`;
    const trophies=state.stats?.trophies||0,photos=state.next?.home?.memories?.length||0;
    return `<article class="nc-copy-card ${isCloud?'is-cloud':''}"><div class="nc-copy-label">${I(isCloud?'save':'person')}<span>${title}</span></div><h3>${esc(state.profile?.name||'Рыбак')}</h3><p>${esc(sub||'Текущий прогресс')}</p><div class="nc-copy-stats"><span><b>${N(state.level||1)}</b>уровень</span><span class="nc-stat-gold"><b>${N(state.coins||0)}</b>золота</span><span><b>${N(trophies)}</b>трофеев</span><span><b>${N(photos)}</b>фотографий</span></div></article>`;
  }
  function cloudHTML(){
    const titles={checking:'Проверяем облачную копию',local:'Твой прогресс на этом устройстве',auth:'Войди, чтобы переносить персонажа',empty:'Готово к первой облачной копии',choice:'Выбери, какую историю продолжить',pending:'Новый прогресс ожидает сохранения',saving:'Сохраняем твоё путешествие',synced:'Твой прогресс в облаке',error:'Сохранение пока не подтверждено',recovered:'Предыдущая копия восстановлена'};
    const descriptions={checking:'Сначала прочитаем сохранение и сравним его с прогрессом на устройстве.',local:'Продолжай играть. Для другого браузера или устройства используй файл сохранения.',auth:'На сайте игры облачная копия привязывается к аккаунту ChatGPT. В мини-приложении VK — к профилю VK.',empty:'После создания персонажа первая копия будет сохранена автоматически.',choice:'На устройстве и в облаке разный прогресс. Выбранная копия определит продолжение игры.',pending:'Отправим новые изменения в ВК через несколько секунд.',saving:'Проверяем запись целиком. Дождись подтверждения сохранения.',synced:'Новые изменения сохраняются автоматически. На другом устройстве войди в тот же аккаунт и открой эту игру.',error:'Повторим подключение автоматически. Здесь можно также запустить проверку вручную.',recovered:'Восстановленная история уже на устройстве. Подтверди её запись, когда будешь готов.'};
    const online=!!identity,select=status==='choice',canPush=!!adapter&&!!remote&&!busy&&!refreshing&&['empty','choice','synced','pending','recovered'].includes(status);
    return `${heading('Сохранения','Один персонаж. Все снасти, фотографии и открытия с тобой.')}<section class="nc-hero" style="background-image:linear-gradient(90deg,#071c28ed,#071c2877),url('${art366.fishing}')"><div class="nc-status-pill ${status==='synced'?'good':''}"><i></i>${status==='synced'?'ОБЛАЧНАЯ КОПИЯ ПОДТВЕРЖДЕНА':status==='saving'||status==='checking'?'ПОДКЛЮЧЕНИЕ':storageOK?'ЛОКАЛЬНОЕ СОХРАНЕНИЕ РАБОТАЕТ':'ПРОВЕРЬ ОБЛАЧНОЕ СОХРАНЕНИЕ'}</div><h2>${titles[status]||titles.local}</h2><p>${descriptions[status]||descriptions.local}</p>${online?`<div class="nc-account">${I('person')}<span>${esc(identity.displayName)}<small>${label()}</small></span></div>`:''}</section>${error?`<div class="nc-message" role="status"><b>${status==='choice'?'Нужно твоё решение':'Проверь сохранение'}</b><p>${esc(error)}</p></div>`:''}<div class="nc-copy-grid">${summaryCard('На этом устройстве',S,'Локальная копия · '+clock(S.next?.meta?.modifiedAt))}${summaryCard(online?'В облаке · '+label():'Облачная копия',online&&remote?.exists?remote.state:null,remote?.recovered?'Предыдущая проверенная копия':clock(remote?.updatedAt),true)}</div><section class="nc-controls panel panel-pad">${status==='auth'?`<div><h3>Продолжить с аккаунтом</h3><p>После входа игра сначала сравнит две копии. До твоего выбора прогресс не заменяется.</p></div><a class="btn" href="/signin-with-chatgpt?return_to=/">Войти с ChatGPT</a>`:select?`<div><h3>Сначала проверь имя и прогресс</h3><p>Перед заменой создаётся резервная копия. Обе версии можно скачать отдельно.</p></div><div class="nc-buttons">${canPush?action('local','Продолжить с этого устройства',''):''}${remote?.exists?action('cloud','Загрузить облачную копию','secondary'):''}${action('download-cloud','Скачать облачную JSON','ghost')}</div>`:status==='empty'?`<div><h3>Первое сохранение</h3><p>Будет отправлен персонаж, который сейчас открыт на устройстве.</p></div><div class="nc-buttons">${canPush?action('local','Сохранить персонажа в облако',''):''}</div>`:status==='synced'||status==='pending'||status==='recovered'?`<div><h3>${status==='recovered'?'Подтвердить восстановление':'Автосохранение включено'}</h3><p>Последнее подтверждение: ${clock(lastSynced)}.</p></div><div class="nc-buttons">${canPush?action('sync','Сохранить в облако',''):''}${action('refresh','Проверить облако','secondary')}${remote?.exists?action('download-cloud','Скачать облачную JSON','ghost'):''}</div>`:status==='checking'||status==='saving'?`<div class="nc-working" role="status" aria-live="polite"><span aria-hidden="true"></span><div><h3 id="ncOperationProgress">${progress?stageLabel(progress):status==='saving'?'Подготавливаем копию':'Сравниваем сохранения'}</h3><p>Если облако не ответит, ожидание остановится автоматически. Можно продолжить игру — локальный прогресс сохранён.</p>${adapter?.cancel?action('cancel','Остановить ожидание','ghost'):''}</div></div>`:`<div><h3>${status==='error'?'Проверить соединение':'Перенести прогресс файлом'}</h3><p>${status==='error'?'Повторная проверка сначала прочитает облако и покажет найденный прогресс.':'Скачай JSON, открой игру на другом устройстве и выбери «Загрузить файл».'}</p></div><div class="nc-buttons">${action('refresh',status==='error'?'Повторить проверку':'Проверить подключение','secondary')}</div>`}</section><section class="nc-local-tools panel panel-pad"><div><div class="eyebrow">РЕЗЕРВНАЯ КОПИЯ В ТВОИХ РУКАХ</div><h3>Возьми путешествие с собой</h3><p>Файл содержит персонажа, снасти, дом, лодки, историю и фотографии альбома. Изображения карточек восстанавливаются из самой игры.</p></div><div class="nc-buttons"><button class="btn secondary" data-act="export">${I('save')} Скачать JSON</button><button class="btn secondary" data-act="import">${I('upload')} Загрузить файл</button><button class="btn ghost" data-next-act="backups">Резервные копии</button></div></section>`;
  }
  A.registerPage('cloud',()=> (S.profile.done?'':'<button type="button" class="btn secondary" data-next-route="creator">К созданию персонажа</button>')+cloudHTML());
  A.on('saved',()=>{
    if(suppress)return;
    if(status==='empty'&&adapter?.kind==='vk'&&S.profile.done&&!saveBlocked&&!busy&&!refreshing){void push(true);return;}
    queue();
  });
  A.on('state-replaced',()=>{if(suppress)return;localEpoch++;armed=false;cancel();if(busy)reconcileAfter=true;else if(adapter)void refresh();});
  A.onRender(paintStatus);
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-nc]');if(!b||b.disabled)return;
    e.preventDefault();e.stopImmediatePropagation();const id=b.dataset.nc;
    if(id==='cancel')adapter?.cancel?.();
    else if(id==='refresh'||id==='retry-start'){drawGate();void refresh();}
    else if(id==='offline-start')releaseBoot();
    else if(id==='local'||id==='sync')void push(true);
    else if(id==='cloud')void useCloud();
    else if(id==='download-cloud')downloadRemote();
  },true);
  function flush(){if(armed&&!busy&&!refreshing&&S.profile.done&&stateDigest(A.snapshot())!==baseDigest)void push(false);}
  function resume(){if(adapter?.kind==='vk'&&!busy&&!refreshing)void refresh();}
  window.addEventListener('online',resume);
  window.addEventListener('pagehide',flush);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();else resume();});
  try{window.vkBridge?.subscribe?.(event=>{const type=event?.detail?.type;if(type==='VKWebAppViewHide'){save();flush();}else if(type==='VKWebAppViewRestore')resume();});}catch(_){}
  function start(fn){
    if(startPromise)return startPromise;
    bootGame=fn;
    if(vkLaunch()){starting=true;drawGate();startPromise=refresh();}
    else{releaseBoot();startPromise=refresh();}
    return startPromise;
  }
  A.cloud={request,refresh,sync:()=>push(true),useCloud,downloadRemote,start,
    canBufferProgress:()=>adapter?.kind==='vk'&&verifiedRead&&!!remote&&!saveBlocked&&!['choice','auth','local','error','recovered'].includes(status),
    identity:()=>identity?.provider==='sites'?identity:null,
    get ready(){return startPromise||Promise.resolve(publicState());},
    get profile(){return identity;},get status(){return status;},get error(){return error;},get state(){return publicState();}};
}
