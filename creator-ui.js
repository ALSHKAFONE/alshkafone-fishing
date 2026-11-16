/* The editor only writes through the game's existing transactional profile save. */
(() => {
'use strict';
const extra=(p={})=>({pantsTone:Math.max(0,Math.min(3,Number(p.pantsTone)||0))|0,bootTone:Math.max(0,Math.min(3,Number(p.bootTone)||0))|0});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const thumb=(art,label='')=>'<img draggable="false" src="'+window.PierArt.art(art)+'" alt="'+esc(label)+'">';
const figure=(p,e={},angle=0)=>'<pier-figure role="img" aria-label="Фотографический образ рыбака" data-angle="'+angle+'" data-state="'+esc(JSON.stringify({p,e}))+'"></pier-figure>';
const tabs=[['person','Персонаж','person'],['kit','Экипировка','shirt'],['tackle','Снасти','rod'],['bag','Рюкзак','bag'],['awards','Достижения','trophy']];
const faceNames=['Овальное лицо','Широкое лицо','Округлое лицо','Удлинённое лицо'];
const toneNames=['Тёмный','Каштановый','Светлый','Серебристый','Рыжий'];
const eyeNames=['Карие','Голубые','Зелёные','Серые'];
const beardValues=['none','stubble','beard','goatee'];
const beardNames=['Без бороды','Щетина','Борода','Эспаньолка'];
const kits=[['Куртка','jacket'],['Брюки','pants'],['Сапоги','boots'],['Кепка','hat'],['Очки','glasses']];
const fabrics=['Лесной','Песочный','Графитовый','Табачный'];
const outfits=['forest','sand','navy','wine'];
const fabricColors=['#626142','#ae9471','#475c6b','#704f45'];
function editor(api){
 let tab='person',slot=null,angle=0,zoom=false,drag=null;
 const p=()=>api.get();
 const hairStyles=()=>p().gender==='female'?[['pony','Хвост'],['bob','Каре'],['shaved','Короткая'],['long','Собранные волосы']]:[['short','Короткая'],['parted','С пробором'],['shaved','Под машинку'],['curly','Волнистая']];
 const icon=k=>api.icon(k);
 const button=(action,label,more='',body=esc(label),active=null)=>'<button type="button" data-pier="'+action+'" '+more+' aria-label="'+esc(label)+'" title="'+esc(label)+'"'+(active===null?'':' aria-pressed="'+active+'"')+'>'+body+'</button>';
 const pick=(key,value,label,body,on)=>button('choose',label,'data-key="'+key+'" data-value="'+value+'"',body,on);
 const imgRow=(key,heading,options,draw)=>'<div class="pc-field pc-pictures"><span>'+heading+'</span><div class="pc-choices" role="group" aria-label="'+heading+'" style="--choices:'+options.length+'">'+options.map((v,i)=>pick(key,v[0],v[1],draw(i,v),p()[key]===v[0])).join('')+'</div></div>';
 const gearStrip=()=>'<div class="pc-kitstrip">'+kits.map(([label],n)=>button('gear',label,'data-slot="'+n+'"',thumb('kit'+n),slot===n)).join('')+'</div>';
 function gearOptions(){
   if(slot===null)return '';
   const field=['outfit','pantsTone','bootTone','cap','glasses'][slot],values=slot<3?(slot===0?outfits:[0,1,2,3]):slot===3?[true,false]:['none','square'];
   const names=slot<3?fabrics:slot===3?['Надеть','Снять']:['Без очков','С очками'];
   return '<div class="pc-kit-options"><span>'+kits[slot][0]+'</span><div>'+values.map((v,i)=>pick(field,String(v),names[i],(slot<3?'<i style="background:'+fabricColors[i]+'"></i>':'')+esc(names[i]),slot===4?(i===0?p().glasses==='none':p().glasses!=='none'):p()[field]===v)).join('')+'</div></div>';
 }
 function profileControls(){
   const c=p(),g=c.gender==='female'?'f':'m',hairs=hairStyles(), hairValue=c.hair==='braids'?'long':c.hair==='moustache'?'short':c.hair;
   const capPick=button('toggle-cap',c.cap?'Снять кепку':'Надеть кепку','',thumb('hair3'),c.cap);
   const hairRow='<div class="pc-field pc-pictures"><span>Причёска</span><div class="pc-choices pc-hairs" role="group" aria-label="Причёска" style="--choices:5">'+hairs.map(([v,n],i)=>pick('hair',v,n,thumb('cut-'+g+c.face+'-'+i),!c.cap&&hairValue===v)).join('')+capPick+'</div></div>';
   return '<div class="pc-field pc-name"><label for="ncxName">Имя</label><input maxlength="24" id="ncxName" value="'+esc(c.name)+'" autocomplete="nickname" placeholder="Имя рыбака"></div>'+
   '<div class="pc-field"><span>Пол</span><div class="pc-gender">'+[['male','Мужчина','♂'],['female','Женщина','♀']].map(([v,n,s])=>pick('gender',v,n,'<b>'+s+'</b>'+n,c.gender===v)).join('')+'</div></div>'+
   '<div class="pc-field"><span>Возраст</span><div class="pc-step">'+button('younger','Уменьшить возраст',c.age<=18?'disabled':'','‹')+'<output aria-live="polite">'+api.age(c.age)+'</output>'+button('older','Увеличить возраст',c.age>=75?'disabled':'','›')+'</div></div>'+
   imgRow('face','Тип лица',faceNames.map((n,i)=>[i,n]),i=>thumb('id-'+g+i))+
   hairRow+
   imgRow('hairColor','Цвет волос',toneNames.map((n,i)=>[i,n]),i=>thumb('tone'+i))+
   imgRow('eyeColor','Цвет глаз',eyeNames.map((n,i)=>[i,n]),i=>thumb('eye'+i))+
   (c.gender==='male'?imgRow('beard','Борода / щетина',beardValues.map((v,i)=>[v,beardNames[i]]),i=>thumb('beard'+i)):'')+
   '<div class="pc-gear"><h3>Экипировка <small>'+(api.done()?'':'(стартовая)')+'</small></h3>'+gearStrip()+gearOptions()+'</div>';
 }
 function detailCard(img,title,sub,glyph){
   return '<div class="pc-data-row">'+(img?thumb(img):'<i>'+icon(glyph||'bag')+'</i>')+'<div><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></div></div>';
 }
 function controls(){
   if(tab==='person')return profileControls();
   if(tab==='kit')return '<div class="pc-pane"><h3>Моя экипировка</h3>'+gearStrip()+gearOptions()+'</div>';
   const s=api.state(),equip=s.equip||{};
   if(tab==='tackle')return '<div class="pc-pane"><h3>Мои снасти</h3>'+[['rod','Удилище','game-rod_classic'],['reel','Катушка','game-gear0_1'],['line','Леска',null],['hooks','Крючки',null]].map(([k,n,a])=>detailCard(a,api.item(equip[k])?.name||n,n,'rod')).join('')+'</div>';
   if(tab==='bag'){
     const pack=api.item(equip.pack)?.name||'Рюкзак рыбака',stock=Object.entries(s.baits||{}).filter(([,count])=>count>0);
     return '<div class="pc-pane"><h3>'+esc(pack)+'</h3>'+detailCard(null,'Улов в садке', (s.bag?.length||0)+' шт.','fish')+stock.map(([id,count])=>detailCard(null,api.bait(id)?.name||id,count+' шт.','bag')).join('')+'</div>';
   }
   const achievements=[[s.stats?.caught||0,'Первая рыба','Поймать первую рыбу'],[s.stats?.trophies||0,'Первый трофей','Поймать трофейную рыбу'],[(s.visited?.length||1)-1,'Новый берег','Посетить второй водоём']];
   return '<div class="pc-pane"><h3>Мои достижения</h3>'+achievements.map(([count,n,goal])=>detailCard(null,n,count>0?'Получено':goal,count>0?'trophy':'lock')).join('')+'</div>';
 }
 function panelTitle(){return tab==='person'?'Создание персонажа':tabs.find(t=>t[0]===tab)[1];}
 function actions(){return '<p class="pc-register-note">После создания имя и внешность закрепятся за персонажем.</p><div id="ncxError" class="pc-error" role="alert" hidden></div><div class="pc-actions">'+button('random','Случайный образ','class="pc-random"',icon('dice')+'<span>Случайный образ</span>')+button('save','Создать персонажа','class="pc-primary"',icon('check')+'<span>Создать персонажа</span>')+'</div>';}
 function panel(){return '<header class="pc-panel-head">'+icon(tabs.find(t=>t[0]===tab)[2])+'<h1>'+panelTitle()+'</h1><button type="button" class="pc-cancel" data-act="settings" aria-label="Настройки и сохранения">Сохранения</button>'+'</header><div class="pc-scroll" id="pcFields">'+controls()+'</div>'+actions();}
 function menu(){return tabs.map(([key,label,ic])=>button('nav',label,'data-tab="'+key+'"',icon(ic)+'<span>'+label+'</span>',key===tab)).join('');}
 function page(){
   return '<section class="pc-editor" aria-label="Создание персонажа"><div class="pc-scenery"></div><div class="pc-wrap"><header class="pc-brand">'+thumb('brand-fish')+'<div><strong>Альшкафоне</strong><small>БОЛЬШАЯ РЫБАЛКА <em>3.6.37</em></small></div></header><nav class="pc-menu" aria-label="Разделы персонажа">'+menu()+'</nav><section class="pc-stage'+(zoom?' pc-closeup':'')+'" aria-label="Предпросмотр персонажа"><div class="pc-model" id="pcModel">'+figure(p(),api.state().equip,angle)+'</div><div class="pc-rotate">'+button('left','Повернуть влево','','‹')+'<span aria-live="polite">'+['Спереди','Левый профиль','Со спины','Правый профиль'][angle]+'</span>'+button('right','Повернуть вправо','','›')+'</div>'+button('zoom',zoom?'В полный рост':'Рассмотреть лицо','class="pc-zoom"',icon('zoom'))+'</section><section class="pc-panel" aria-label="Настройки персонажа">'+panel()+'</section></div></section>';
 }
 function announceError(message){
   const node=document.getElementById('ncxError');if(node){node.hidden=!message;node.textContent=message;}
 }
 function display(){
   const host=document.querySelector('#pcModel pier-figure');if(!host)return;
   const data=JSON.stringify({p:p(),e:api.state().equip});if(host.dataset.state!==data)host.dataset.state=data;
   if(Number(host.dataset.angle)!==angle)host.dataset.angle=angle;
   const camera=zoom?'close':'full';if(host.dataset.camera!==camera)host.dataset.camera=camera;
   const stage=host.closest('.pc-stage');stage.classList.toggle('pc-closeup',zoom);
   stage.querySelector('.pc-rotate span').textContent=['Спереди','Левый профиль','Со спины','Правый профиль'][angle];
   const z=stage.querySelector('.pc-zoom');z.setAttribute('aria-label',zoom?'В полный рост':'Рассмотреть лицо');z.title=z.getAttribute('aria-label');
 }
 function repanel(replace=false){
   const root=document.querySelector('.pc-editor');if(!root)return;
   if(replace){root.querySelector('.pc-panel').innerHTML=panel();root.querySelector('.pc-menu').innerHTML=menu();}
   else{const box=root.querySelector('#pcFields'),top=box.scrollTop,focus=document.activeElement?.dataset;box.innerHTML=controls();box.scrollTop=top;
     if(focus?.key)Array.from(box.querySelectorAll('[data-key]')).find(b=>b.dataset.key===focus.key&&b.dataset.value===focus.value)?.focus({preventScroll:true});}
   display();
 }
 function choose(k,v){
   const allowed=['gender','face','hair','hairColor','eyeColor','beard','outfit','pantsTone','bootTone','cap','glasses'];
   if(!allowed.includes(k))return;
   const change={};
   if(['face','hairColor','eyeColor','pantsTone','bootTone'].includes(k))change[k]=Number(v);
   else if(k==='cap')change.cap=v==='true';else change[k]=v;
   if(k==='hair')change.cap=false;
   if(k==='gender'&&v!==p().gender){change.hair=v==='female'?'pony':'short';change.beard=v==='female'?'none':'stubble';}
   if(['gender','face','hair','hairColor','eyeColor','beard'].includes(k)){zoom=true;if(angle===2||k==='eyeColor'||k==='gender')angle=0;}
   if(['outfit','pantsTone','bootTone'].includes(k))zoom=false;
   api.update(change);announceError('');repanel();
 }
 document.addEventListener('click',event=>{
   const b=event.target.closest?.('.pc-editor [data-pier]');if(!b||b.disabled)return;
   event.preventDefault();event.stopPropagation();
   const action=b.dataset.pier;
   if(action==='choose')return choose(b.dataset.key,b.dataset.value);
   if(action==='save')return api.save();
   if(action==='cancel')return api.cancel();
   if(action==='nav'){tab=b.dataset.tab;if(tab!=='person')zoom=false;slot=tab==='kit'?0:null;return repanel(true);}
   if(action==='gear'){slot=slot===Number(b.dataset.slot)?null:Number(b.dataset.slot);rePanelSlot();return;}
   if(action==='toggle-cap')return choose('cap',String(!p().cap));
   if(action==='random'){api.random();angle=0;announceError('');return repanel();}
   if(action==='older'||action==='younger'){zoom=true;if(angle===2)angle=0;api.update({age:p().age+(action==='older'?1:-1)});return repanel();}
   if(action==='zoom'){zoom=!zoom;if(zoom&&angle===2)angle=0;}
   if(action==='left'||action==='right')angle=(angle+(action==='right'?1:3))%4;
   display();
 });
 function rePanelSlot(){repanel();const box=document.getElementById('pcFields');if(box?.scrollHeight>box?.clientHeight&&slot!==null)box.scrollTop=box.scrollHeight;}
 document.addEventListener('pointerdown',e=>{if(!e.target.closest?.('.pc-model'))return;drag={x:e.clientX,y:e.clientY};});
 document.addEventListener('pointerup',e=>{if(drag&&Math.abs(e.clientX-drag.x)>35&&Math.abs(e.clientY-drag.y)<60){angle=(angle+(e.clientX>drag.x?1:3))%4;display();}drag=null;});
 document.addEventListener('pointercancel',()=>{drag=null;});
 return {page,display,reset(){angle=0;slot=null;tab='person';zoom=false;drag=null;}};
}
window.PierCreator={editor,extra,figure};
})();
