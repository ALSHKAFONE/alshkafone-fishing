/* All sources stay in the same gesture-unlocked audio context as the fishing sounds. */
(() => {
  'use strict';
  const tracks = {
    groove: {name:'По течению',style:'клавиши и бас',file:'media/sound-groove.mp3',key:'__pierGroove',length:48.0},
    piano: {name:'Тёплый берег',style:'фортепиано',file:'media/sound-piano.mp3',key:'__pierPiano',length:43.94800453514739},
    lake: {name:'Ночное озеро',style:'только природа',file:'media/sound-lake.mp3',key:'__pierLake',length:42.24},
    morning: {name:'Утро на причале',style:'акустическая гитара',file:'media/morning-track.mp3',key:'__pierMorningTrack',length:3993962/44100}
  };
  const defaultTrack = 'lake';
  const normalize = id=>Object.hasOwn(tracks,id)?id:defaultTrack;
  const buffers=new Map(),pending=new Map(),retryAt=new Map(),positions=new Map();
  let playing=null;
  function options(id){
    return Object.entries(tracks).map(([key,track])=>'<option value="'+key+'"'+(key===normalize(id)?' selected':'')+'>'+track.name+' · '+track.style+'</option>').join('');
  }
  async function load(ctx,track){
    const response = await fetch(track.file);
    if (!response.ok) throw Error('Не загрузился звуковой файл');
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
    if(buffer.duration<track.length-.12)throw Error('Запись неполная');
    return buffer;
  }
  function remember(id,buffer){
    buffers.set(id,buffer);
    while(buffers.size>2){
      const oldest=[...buffers.keys()].find(key=>key!==id&&key!==playing?.id);
      buffers.delete(oldest);
    }
  }
  function stop(ctx){
    if(!playing)return;
    const {source,gain,id,started,offset}=playing;
    playing=null;
    positions.set(id,(offset+ctx.currentTime-started)%source.loopEnd);
    gain.gain.setTargetAtTime(0,ctx.currentTime,.04);
    source.onended=()=>{source.disconnect();gain.disconnect();};
    source.stop(ctx.currentTime+.24);
  }
  function update(ctx,bus,id,wanted,refresh){
    id=normalize(id);
    if(!wanted){stop(ctx);return;}
    if(playing?.id===id)return;
    const buffer=buffers.get(id),track=tracks[id];
    if(!buffer){
      if(!pending.has(id)&&Date.now()>=(retryAt.get(id)||0)){
        const task=load(ctx,track).then(decoded=>{remember(id,decoded);retryAt.delete(id);})
          .catch(()=>{retryAt.set(id,Date.now()+12000);})
          .finally(()=>{pending.delete(id);refresh();});
        pending.set(id,task);
      }
      return;
    }
    stop(ctx);
    const source=ctx.createBufferSource(),gain=ctx.createGain(),now=ctx.currentTime;
    source.buffer=buffer;source.loop=true;source.loopEnd=Math.min(track.length||buffer.duration,buffer.duration);
    const offset=(positions.get(id)||0)%source.loopEnd;
    gain.gain.value=0;source.connect(gain);gain.connect(bus);
    gain.gain.setTargetAtTime(1,now,.075);source.start(now,offset);
    playing={id,source,gain,started:now,offset};
  }
  window.PierSoundtrack=Object.freeze({defaultTrack,options,normalize,update});
})();
