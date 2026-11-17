/* Direction, distance and time are shared by the photographed fish and the bite timer. */
(() => {
  'use strict';
  const clamp = n => Math.max(0, Math.min(1, n));
  function ease(t, start, end) {
    const u = clamp((t-start)/(end-start));
    return u*u*(3-2*u);
  }
  function fade(t, start, end) { return ease(t,start,start+.45)*(1-ease(t,end-.5,end)); }

  function choose(pool, target, mayLoseWorm, roll, variation) {
    if (roll < .36 || !pool.length) return null;
    const seed = variation * Math.PI * 2;
    if (roll < .56) {
      const bottomFeeder=['crucian','bream','carp','tench','gudgeon','ruffe','silverbream'].includes(target);
      if (bottomFeeder && roll < .48) return {kind:'forage',duration:5.6,seed};
      return {kind:'probe',duration:5.6,seed};
    }
    const small = ['bleak','roach','rudd','dace','ruffe','perch'].find(id=>pool.includes(id)) || target;
    if (roll < .76) {
      const intruder = ['pike','zander','perch','asp','carp','bream'].find(id=>id!==target&&pool.includes(id)) || pool.find(id=>id!==target);
      if(intruder) return {kind:'scare',duration:7.5,actor:intruder,small,seed};
    }
    if (roll < .94 || !mayLoseWorm) return {kind:'shoal',duration:7.3,small,seed};
    return {kind:'theft',duration:5.7,small,seed};
  }
  function interest(event,t) {
    if (!event || t<0 || t>=event.duration) return null;
    let distance=.1,turn=1,vertical=0,label='Приближается',fast=false;
    if (event.kind==='forage') {
      const down=ease(t,.45,2.2)*(1-ease(t,3.35,5.3));
      distance=1.05-.8*ease(t,0,2.2)-.21*ease(t,3.35,5.6);
      return {stage:'inspect',distance,turn:1,vertical:0,bottom:down,tilt:.27*down,
        label:t<3.4?'Ищет корм у дна':'Поднимается к наживке'};
    }
    if (event.kind==='probe') {
      const recoil=ease(t,2.65,3.55);
      distance=1.2*(1-ease(t,0,2.2))+.16*recoil-.14*ease(t,3.8,5.6);
      const label=t<2.2?'Присматривается к наживке':t<2.85?'Касается наживки':t<3.8?'Отходит на длину тела':'Возвращается к крючку';
      return {stage:'inspect',distance,turn:1,vertical:.035*recoil*(1-ease(t,3.8,5.6)),label};
    }
    if(t<2.25) distance=1.32-1.22*ease(t,0,2.25);
    else if(event.kind==='scare'){
      if(t<3.3){distance=.1-.065*ease(t,2.25,3.25);label='Присматривается к наживке';}
      else if(t<5.65){distance=.035+.87*ease(t,3.3,4.7);turn=-1;vertical=.14*ease(t,3.3,4.7);label='Испугалась крупной рыбы и метнулась в укрытие';fast=true;}
      else {distance=.905-.79*ease(t,5.65,7.5);vertical=.14*(1-ease(t,5.65,7.5));label='Возвращается к наживке';}
    } else if(event.kind==='shoal'){
      const spread=ease(t,2.25,3.8)*(1-ease(t,5.35,7.3));
      distance=.1+.16*spread;vertical=.10*spread;
      label=t<3.6?'К крючку подходит стайка':t<5.9?'Мальки разделились у лески':'Стайка прошла. Рыба снова подходит';
    } else if(event.kind==='theft'){
      if(t<3.45){distance=.1*(1-ease(t,2.25,3.45));label='Теребит кончик червя';}
      else if(t<3.85){distance=0;label='Стащила червя с крючка';}
      else {distance=1.3*ease(t,3.85,5.7);turn=-1;vertical=-.17*ease(t,3.85,5.7);label='Уплывает с червём';fast=true;}
    }
    return {stage:fast?'leave':'inspect',distance,turn,vertical,label,fast};
  }
  function layer(kind, event, t, env){
    if(!event || t<0 || t>=event.duration || (kind!=='back'&&kind!=='front')) return;
    const {g,w,h,x,y,fish,reduced}=env;
    const wave=reduced?0:Math.sin(t*2+event.seed);
    if(event.kind==='scare'&&kind==='back'){
      const p=ease(t,1.1,5.85),alpha=fade(t,.75,6.25);
      if(alpha<=0)return;
      const fw=Math.min(w*.32,Math.max(88,w*.21));
      const cx=w*1.17-(w*1.44)*p,cy=y+h*(.17-.27*Math.sin(p*Math.PI)) + wave*2;
      fish(event.actor,cx,cy,fw,-1,.8*alpha,true,event.seed);
      return;
    }
    if(event.kind==='shoal'){
      const near=kind==='front',n=near?4:7;
      for(let i=0;i<n;i++){
        const stagger= i*.115+(near?.7:0),local=t-stagger;
        const u=ease(local,.8,6.05),alpha=fade(local,.45,6.3);
        if(!alpha)continue;
        const branch=Math.sin(Math.PI*ease(local,2.3,4.8));
        const polarity=(i%2===0?1:-1);
        const cy=y+h*((near?.11:-.17)+(i%3-1)*.068+branch*polarity*(near?.22:.115));
        const cx=(u*1.34-.17)*w,fw=Math.min(near?56:30,w*(near?.075:.043))*(1-(i%3)*.085);
        fish(event.small,cx,cy+(reduced?0:Math.sin(t*2.5+i)*2),fw,1,alpha*(near?.86:.45),branch>.5,i*1.47+event.seed);
      }
    }
    // Silt rises behind the fleeing body, keeping the nearer fish in focus.
    if(event.kind==='scare'&&kind==='front'&&!reduced&&t>=3.5&&t<5.5){
      g.save();const q=(t-3.5)/2;
      for(let i=0;i<12;i++){
        const n=i/11,dx=(.018+n*.17)*w*q;
        g.globalAlpha=.32*(1-q);g.fillStyle=i%3===0?'#b1b198':'#b4c9a0';
        g.beginPath();g.ellipse(x-w*.17-dx,y+h*(.13+n*.08)-h*q*(.15+.12*n),1+q*(1+i%3),.8+q*1.2,0,0,Math.PI*2);g.fill();
      }
      g.restore();
    }
  }
  function baitNudge(event,t) {
    if(event?.kind!=='probe')return 0;
    return Math.sin(Math.PI*ease(t,2.2,2.9));
  }
  function sediment(g,x,y,unit,event,t){
    if(t<1.9||t>4.7)return;
    g.save();
    // Two small puffs spread from the feeding spot and drift into clear water.
    for(let i=0;i<16;i++){
      const age=(t-1.9-(i%2)*.5-(i%4)*.08)/2;
      if(age<=0||age>=1)continue;
      const angle=event.seed+i*2.4;
      const px=x+unit*age*(.15+Math.cos(angle)*.43);
      const py=y-unit*age*(.14+.32*Math.abs(Math.sin(angle)));
      const r=unit*(.027+age*.053);
      g.fillStyle='rgba(179,160,112,'+(.28*Math.sin(Math.PI*age))+')';
      g.beginPath();g.ellipse(px,py,r,r*.65,angle,0,Math.PI*2);g.fill();
    }
    g.restore();
  }
  function worm(g,x,y,dir,t,reduced){
    const wiggle=reduced?0:Math.sin(t*7);
    g.save();g.translate(x,y);g.scale(dir,1);g.lineCap='round';
    g.beginPath();g.moveTo(-1,0);g.bezierCurveTo(2,2,4,9,7,5+wiggle);
    g.bezierCurveTo(9,2+wiggle,10,4,12,6-wiggle);
    g.strokeStyle='#844b38';g.lineWidth=3.1;g.stroke();g.strokeStyle='#e7a482';g.lineWidth=1.85;g.stroke();g.restore();
  }
  function surface(event,t) {
    if(!event)return null;
    if(event.kind==='forage')return null;
    if(event.kind==='probe'){
      const n=baitNudge(event,t);
      return n>0?{spread:clamp((t-2.2)/.7),opacity:n*.45,x:0,y:0,dip:n*.5}:null;
    }
    const steal=event.kind==='theft',scare=event.kind==='scare';
    const start=steal?2.95:scare?2.40:2.25,end=steal?4.9:scare?5.10:5.75;
    if(t<start||t>=end)return null;
    const progress=clamp((t-start)/(end-start));
    return {
      spread:progress, opacity:Math.sin(Math.PI*progress)*.67,
      x:steal?0:scare?13-progress*14:-12+progress*18,
      y:steal?0:scare?-4:2,
      dip:steal?Math.sin(Math.PI*ease(t,3.15,4.12))*1.27:0
    };
  }
  window.PierWaterEncounters=Object.freeze({choose,interest,layer,worm,surface,baitNudge,sediment});
})();
