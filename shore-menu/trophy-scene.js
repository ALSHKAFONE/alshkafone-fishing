/* Draw the saved character with the fish that was actually caught. */
(() => {
  'use strict';
  const files = new URL('./', document.currentScript.src);
  const images = new Map();
  function image(src) {
    if (!images.has(src)) {
      const pending = new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(Error('Изображение улова недоступно'));
        im.src = src;
      });
      images.set(src, pending);
      pending.catch(() => images.delete(src));
      if (images.size > 12) images.delete(images.keys().next().value);
    }
    return images.get(src);
  }
  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  }
  function heroLabel(c) {
    if (c.legendName) return 'Легендарный улов';
    if (c.trophy) return 'Трофейный улов';
    if (c.record && !c.first) return 'Личный рекорд';
    return c.first ? 'Новый вид' : 'Твой улов';
  }
  function bellyAt(fish, fraction) {
    // Probe the near flank instead of placing fingers on a fixed rectangle.
    const crop = document.createElement('canvas');
    crop.width = 64; crop.height = 48;
    const ctx = crop.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(fish,0,0,64,48);
    const data = ctx.getImageData(0,0,64,48).data;
    const at = Math.max(1,Math.min(62,Math.round((1-fraction)*63)));
    const contour = [];
    for (let x=at-1; x<=at+1; x++) {
      let y=47;
      while (y>0 && data[(y*64+x)*4+3]<115) y--;
      contour.push((y+1)/48);
    }
    return contour.sort((a,b)=>a-b)[1];
  }
  function paint(canvas, fish, actor, hands, length, female=false) {
    const w=1080,h=630;
    canvas.width=w; canvas.height=h;
    const g=canvas.getContext('2d');
    g.imageSmoothingEnabled=true;
    g.imageSmoothingQuality='high';
    const fw=Math.max(w*.18,Math.min(w*.79,w*(.13+Math.sqrt(Math.max(1,length))*.059)));
    const fh=Math.min(h*.44,fw*(fish.naturalHeight/fish.naturalWidth));
    const width=fh*fish.naturalWidth/fish.naturalHeight;
    const x=actor ? w*.47 : w*.50,y=actor ? h*.735 : h*.50,angle=-.105;
    const palmWidth=116,palmHeight=palmWidth*155/200;
    const supports=(width>w*.40?[.31,.69]:[.53]).map((fraction,index)=>{
      const right=index===1;
      const gripX=(fraction-.5)*width,gripY=(bellyAt(fish,fraction)-.5)*fh;
      const hx=gripX-palmWidth*(right?.34:.66),hy=gripY-palmHeight*.27;
      const cx=hx+palmWidth*(right?.85:.15),cy=hy+palmHeight*.87;
      return {right,hx,hy,wristX:x+cx*Math.cos(angle)-cy*Math.sin(angle),wristY:y+cx*Math.sin(angle)+cy*Math.cos(angle)};
    });
    if(actor){
      const scale=h*.00243,ox=w*.395-actor.width*scale*.5,oy=h*.013;
      const armData=female?[
        {elbow:[136,329],wrist:[166,436],edge:[[91,316],[170,324],[164,374],[179,411],[198,443],[153,458],[117,411],[94,363]]},
        {elbow:[388,330],wrist:[391,448],edge:[[364,318],[410,319],[426,368],[417,449],[371,451],[367,390]]}
      ]:[
        {elbow:[134,328],wrist:[160,439],edge:[[90,318],[172,324],[166,370],[177,410],[198,439],[148,459],[117,414],[94,366]]},
        {elbow:[399,328],wrist:[399,453],edge:[[374,317],[427,317],[439,368],[432,456],[376,459],[374,409]]}
      ];
      function outline(ctx,points){
        ctx.moveTo(points[0][0],points[0][1]);
        for(const [px,py] of points.slice(1))ctx.lineTo(px,py);
        ctx.closePath();
      }
      const active=hands?supports:[];
      // Move the real coat sleeves with the supported fish. They keep their gear dyes.
      active.forEach((hand,index)=>{
        const arm=armData[index],[ex,ey]=arm.elbow,[wx,wy]=arm.wrist;
        const ax=ox+ex*scale,ay=oy+ey*scale,dx=hand.wristX-ax,dy=hand.wristY-ay;
        g.save();g.translate(ax,ay);g.rotate(Math.atan2(dy,dx));
        g.scale(Math.hypot(dx,dy)/Math.hypot(wx-ex,wy-ey),scale);
        g.rotate(-Math.atan2(wy-ey,wx-ex));g.translate(-ex,-ey);
        g.beginPath();outline(g,arm.edge);g.clip();g.drawImage(actor,0,0);g.restore();
      });
      g.save();g.translate(ox,oy);g.scale(scale,scale);
      if(active.length){
        g.beginPath();g.rect(0,0,actor.width,actor.height);
        for(const [i] of active.entries()){
          const [ex,ey]=armData[i].elbow;
          if(i===0)outline(g,[[-1,ey+7],[ex+38,ey+7],[ex+34,370],[ex+47,408],[ex+73,458],[ex+62,525],[-1,525]]);
          else outline(g,[[ex-25,ey+7],[545,ey+7],[545,533],[ex-40,533],[ex-24,428],[ex-23,372]]);
        }
        g.clip('evenodd');
      }
      g.drawImage(actor,0,0);g.restore();
    }
    g.save();g.translate(x,y);g.rotate(angle);
    function palm(hand,tipsOnly) {
      const {right,hx,hy}=hand;g.save();
      if(tipsOnly){
        g.beginPath();g.rect(hx+palmWidth*(right?.04:.49),hy,palmWidth*.50,palmHeight*.31);g.clip();
      }
      g.drawImage(hands,right?200:0,0,200,155,hx,hy,palmWidth,palmHeight);g.restore();
    }
    if(actor&&hands)supports.forEach(hand=>palm(hand,false));
    g.save();g.scale(-1,1);g.shadowColor='rgba(18,15,11,.43)';g.shadowBlur=9;g.shadowOffsetY=9;
    g.drawImage(fish,-width/2,-fh/2,width,fh);g.restore();
    if(actor&&hands)supports.forEach(hand=>palm(hand,true));
    g.restore();
  }
  function action(icon, title, sub, act, style, disabled=false) {
    return '<button class="btn pt-action '+style+'" type="button" data-act="catch-'+act+'"'+(disabled?' disabled':'')+'>'+icon+'<span><b>'+title+'</b><small>'+sub+'</small></span></button>';
  }
  function show(c, api) {
    const name=escape(c.name), summary=heroLabel(c), xp=api.number(c.xp), price=api.number(c.value);
    const release=api.number(Math.round(c.xp*.25));
    const capacityFull=api.full;
    const foot='<div class="result-actions pt-actions">'+
      action(api.icon('bag'),'В садок',capacityFull?'Садок полон':'Оставить улов','keep','secondary',capacityFull)+
      action(api.icon('coin'),'Продать',price+' монет','sell','pt-primary')+
      action(api.icon('wave'),'Отпустить','+'+release+' опыта','release','secondary release')+'</div>';
    const card='<article class="result pt-result">'+
      '<div class="pt-stage" role="img" aria-label="'+escape((api.profileName||'Рыбак')+' с уловом — '+c.name)+'">'+
      '<img class="pt-fallback-fish" src="'+escape(api.fishSrc)+'" alt=""><canvas class="pt-scene" aria-hidden="true"></canvas>'+
      (api.locationName?'<span class="pt-location">'+api.icon('pin')+escape(api.locationName)+'</span>':'')+'</div>'+
      '<div class="pt-panel"><div class="pt-banner">'+api.icon(c.trophy||c.legendName?'trophy':'fish')+'<span>'+summary+'</span></div>'+
      '<h2>'+escape(c.legendName||c.name)+'</h2>'+
      '<div class="pt-rarity">'+(c.legendName?name+' · ':'')+escape(api.rarity||'')+'</div>'+
      '<dl class="pt-stats"><div><dt>Вес</dt><dd>'+api.weight(c.weight)+' <small>кг</small></dd></div>'+
      '<div><dt>Длина</dt><dd>'+api.number(c.length)+' <small>см</small></dd></div>'+
      '<div><dt>Опыт за улов</dt><dd>+'+xp+' <small>XP</small></dd></div></dl>'+
      ((c.record&&!c.first&&c.trophy)?'<span class="pt-record">Личный рекорд по весу</span>':'')+
      (capacityFull?'<p class="pt-capacity">Садок заполнен. Улов можно продать или отпустить.</p>':'')+
      foot+'<button type="button" class="btn ghost small pt-photo" data-act="catch-photo">'+api.icon('camera')+'Карточка улова</button>'+
      '</div></article>';
    api.open(summary,card);
    const stage=document.querySelector('#dialogBody .pt-stage');
    if(!stage)return;
    if(api.backdrop)stage.style.backgroundImage='url("'+api.backdrop.replace(/["\\]/g,'')+'")';
    const canvas=stage.querySelector('canvas');
    const gloved=!!api.equip?.gloves;
    const hands=image(new URL(gloved?'hands-glove.webp':'hands-bare.webp',files).href).catch(()=>null);
    const fishImage=c.species==='pike' ? image(new URL('pike.webp',files).href).catch(()=>image(api.fishSrc)) : image(api.fishSrc);
    Promise.all([fishImage,Promise.resolve().then(api.frame).catch(()=>null),hands])
      .then(([fish,actor,hand])=>{
        if(!stage.isConnected)return;
        paint(canvas,fish,actor,hand,Number(c.length)||20,api.female);
        stage.dataset.ready='1';
      }).catch(()=>{});
  }
  window.PierTrophy=Object.freeze({show});
})();
