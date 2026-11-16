/* Photographic rendering for the lakeside character editor and profile. */
(() => {
  'use strict';
  const art = name => window.PierLocal?.[name] || ('creator-art/' + name + '.webp');
  const images = new Map(), portraitImages = new Map(), faces = new Map(), bodies = new Map();
  function load(name) {
    const pool=/^(look|mat|follicles)-/.test(name)?portraitImages:images;
    if (!pool.has(name)) {
      if(pool===portraitImages&&pool.size>=24)pool.delete(pool.keys().next().value);
      pool.set(name, new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => { pool.delete(name); reject(new Error('Не загрузилось изображение: ' + name)); };
        image.src = art(name);
      }));
    }
    return pool.get(name);
  }
  function canvas(w,h) {
    const c = document.createElement('canvas');
    c.width=w; c.height=h; return c;
  }
  const limit = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
  const mix = (a,b,k) => a+(b-a)*k;
  const hairColors = [[33,27,24],[94,59,39],[175,145,93],[164,161,151],[153,75,37]];
  const eyeColors = [[87,56,35],[76,133,163],[95,127,65],[122,140,143]];
  const fabric = [[0,0,0],[158,132,91],[49,68,81],[83,54,50]];
  const hairIndex = hair => ({short:0,pony:0,parted:1,bob:1,shaved:2,curly:3,braids:3,long:3})[hair] ?? 0;
  function cached(store,key,make,max) {
    if(!store.has(key)){
      if(store.size>=max)store.delete(store.keys().next().value);
      const promise=make().catch(error=>{store.delete(key);throw error;});
      store.set(key,promise);
    }
    return store.get(key);
  }
  async function makeFace(p,side=0) {
    const gender=p.gender==='female'?'f':'m';
    const identity=Math.round(limit(Number(p.face)||0,0,3));
    const stem=gender+identity+'-'+hairIndex(p.hair)+'-'+side;
    const key=JSON.stringify([stem,p.hairColor,p.eyeColor,p.age,p.skin,p.beard]);
    return cached(faces,key,async()=>{
      const channel=gender==='m'?({stubble:0,beard:1,goatee:2,moustache:2})[p.beard]:undefined;
      const [photo,mat,beardMask]=await Promise.all([load('look-'+stem),load('mat-'+stem),channel===undefined?null:load('follicles-'+stem)]);
      const w=photo.naturalWidth,h=photo.naturalHeight;
      const c=canvas(w,h),ctx=c.getContext('2d',{willReadFrequently:true});
      let follicles;
      if(beardMask){
        ctx.drawImage(beardMask,100,180);
        follicles=ctx.getImageData(0,0,w,h).data;
        ctx.clearRect(0,0,w,h);
      }
      ctx.drawImage(mat,0,0,w,h);const masks=ctx.getImageData(0,0,w,h).data;
      ctx.clearRect(0,0,w,h);ctx.drawImage(photo,0,0);
      const frame=ctx.getImageData(0,0,w,h),pix=frame.data;
      const tone=Number(p.hairColor)||0, dye=hairColors[tone]||hairColors[0];
      const eye=eyeColors[p.eyeColor]||eyeColors[0],age=Number(p.age)||35;
      const silver=limit((age-45)/35)*.72, maturity=limit((age-35)/40), youth=limit((35-age)/17);
      const skinTone=(1-(p.skin??1))*3;
      for(let i=0;i<pix.length;i+=4){
        if(!pix[i+3])continue;
        const hair=masks[i]/255,iris=masks[i+1]/255,skin=masks[i+2]/255;
        const light=pix[i]*.25+pix[i+1]*.57+pix[i+2]*.18;
        const beardOpacity=follicles&&(p.beard!=='moustache'||i<w*4*297)?follicles[i+channel]/255:0;
        for(let n=0;n<3;n++){
          let v=pix[i+n];
          if(skin) v+=skin*((v-108)*(maturity*.14-youth*.065)+skinTone);
          if(hair&&(tone||silver)){
            const dyed=tone?mix(v,dye[n]*(.31+light/112)+light*.20,.83):v;
            v=mix(v,mix(dyed,light*.86+81,silver),hair);
          }
          if(iris)v=mix(v,eye[n]*(.36+light/145),iris*.83);
          if(beardOpacity){
            const strand=mix((tone?dye[n]:[35,27,23][n])*(.32+light/260),light*.71+29,silver);
            v=mix(v,strand,beardOpacity);
          }
          pix[i+n]=v;
        }
      }
      ctx.putImageData(frame,0,0);
      return c;
    },12);
  }
  function outfitIndex(value){return ['forest','sand','navy','wine'].indexOf(value);}
  function outfitCodes(p,e){
    const cosmetic=[Math.max(0,outfitIndex(p.outfit)),p.pantsTone||0,p.bootTone||0];
    if(!window.PierGarmentColor)return cosmetic;
    const starter=['jacket_classic','pants_basic','boots_basic'];
    ['jacket','pants','boots'].forEach((slot,i)=>{
      if(e?.[slot] && e[slot]!==starter[i]) cosmetic[i]=window.PierGarmentColor(slot,e[slot])||cosmetic[i];
    });
    return cosmetic;
  }
  async function body(p,angle,e) {
    const g=p.gender==='female'?'f':'m', colors=outfitCodes(p,e);
    const customGlove=e?.gloves&&e.gloves!=='gloves_basic'?e.gloves:null;
    const key=JSON.stringify([g,angle,colors,e?.jacket,e?.pants,e?.boots,customGlove,angle===2?p.hairColor:0,angle===2?p.age:35,angle===2?p.hair:null]);
    return cached(bodies,key,async()=>{
      const src=await load(g+'-'+(angle>=4?'turn'+(2*(angle-4)+1):angle%2?'collar'+angle:angle));
      if(!colors.some(Boolean)&&!customGlove&&angle!==2)return src;
      const c=canvas(420,1000),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0);
      const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
      const purchased=[e?.jacket,e?.pants,e?.boots].map((id,i)=>id&&id!==['jacket_classic','pants_basic','boots_basic'][i]?id:null);
      const slots=['jacket','pants','boots'];
      for(let i=0;i<d.length;i+=4){
        if(!d[i+3])continue;
        const x=(i/4)%420,y=Math.floor(i/1680),lum=d[i]*.27+d[i+1]*.54+d[i+2]*.19;
        const clothing=y<405?0:y<779?1:2, code=colors[clothing];
        const cutoff=clothing===0?limit((y-130)/23):1;
        const exposedSkin=y<520&&d[i]-d[i+1]>18&&d[i+1]-d[i+2]>10&&d[i]>82;
        const hand=(y>372&&y<540&&exposedSkin&&(x<155||x>260));
        if(customGlove&&hand&&window.PierGarmentPixels){
          const rgb=window.PierGarmentPixels('gloves',customGlove,lum,x,y);
          for(let n=0;n<3;n++)d[i+n]=rgb[n];
        }else if(purchased[clothing]&&y>123&&!exposedSkin&&window.PierGarmentPixels){
          const rgb=window.PierGarmentPixels(slots[clothing],purchased[clothing],lum,x,y);
          for(let n=0;n<3;n++)d[i+n]=mix(d[i+n],rgb[n],cutoff*.94);
        }else if(code && y>123 && !exposedSkin){
          const tone=Array.isArray(code)?code:fabric[code],shade=Math.max(.13,lum/104);
          for(let n=0;n<3;n++)d[i+n]=mix(d[i+n],tone[n]*shade,cutoff*.83);
        }
        if(angle===2&&g==='f'&&y>38&&y<117&&['shaved','bob'].includes(p.hair)){
          const frontSide=angle===1?x-210:angle===3?210-x:Math.abs(x-210);
          const edge=(p.hair==='shaved'?42:55)+Math.sin((y-38)/79*Math.PI)*5;
          if(frontSide>edge) d[i+3]*=limit((edge+3-frontSide)/3);
        }
        if(angle===2 && y<115 && Math.abs(x-210)<75){
          const hc=hairColors[p.hairColor]||hairColors[0],mask=angle===2?limit((119-y)/25):limit((58+Math.abs(x-210)*.23-y)/20);
          const silver=limit((p.age-45)/35)*.72;
          if(!(y>75&&exposedSkin)){
            for(let n=0;n<3;n++){
              const dye=p.hairColor?mix(d[i+n],hc[n]*(.31+lum/112)+lum*.20,.83):d[i+n];
              d[i+n]=mix(d[i+n],mix(dye,lum*.86+81,silver),mask);
            }
          }
        }
      }
      ctx.putImageData(im,0,0);
      return c;
    },12);
  }
  const starterCaps=new Map();
  function capFor(dir){
    if(dir===0)return load('cap');
    return cached(starterCaps,dir,async()=>{
      const image=await load('game-cap'+dir),c=canvas(image.naturalWidth,image.naturalHeight);
      const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);
      const frame=g.getImageData(0,0,c.width,c.height),px=frame.data;
      for(let n=0;n<px.length;n+=4){
        if(!px[n+3])continue;
        const l=px[n]*.24+px[n+1]*.59+px[n+2]*.17;
        const grey=17+l*.78;
        px[n]=grey*1.04;px[n+1]=grey*1.02;px[n+2]=grey;
      }
      g.putImageData(frame,0,0);return c;
    },6);
  }
  async function accessories(ctx,p,angle){
    if(p.cap){
      const cap=await capFor([0,2,4,6][angle]);
      if(angle===0)ctx.drawImage(cap,155,-2,110,62);
      else ctx.drawImage(cap,angle===1?139:angle===3?156:156,-4,angle===2?110:137,65);
    }
    if(p.glasses&&p.glasses!=='none'&&angle!==2){
      const glasses=await load('game-spec'+[0,2,4,6][angle]);
      ctx.drawImage(glasses,angle===1?147:angle===3?193:168,54,angle?75:84,28);
    }
  }
  async function render(c,p,angle=0,e={},camera='full'){
    const [clothes,head,logo]=await Promise.all([body(p,angle,e),angle===2?null:makeFace(p,angle===0?0:1),angle===0?load('brand-fish'):null]);
    const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.save();
    const close=camera==='close',width=close?224*c.width/c.height:420,height=close?224:1000;
    ctx.scale(c.width/width,c.height/height);
    if(close)ctx.translate(width/2-210,12);
    ctx.drawImage(clothes,0,0);
    if(head){
      ctx.save();
      if(angle===3){ctx.translate(420,0);ctx.scale(-1,1);}
      ctx.drawImage(head,98,-12,224,206);ctx.restore();
    }
    if(logo){
      ctx.save();ctx.translate(p.gender==='female'?153:148,235);ctx.rotate(-.055);
      ctx.fillStyle='#282b20b8';ctx.fillRect(-30,-12,61,24);ctx.fillStyle='#e8e4ce';ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.drawImage(logo,-6,-11,13,11);ctx.fillText('Альшкафоне',0,8);ctx.restore();
    }
    try{await accessories(ctx,p,angle);}finally{ctx.restore();}
  }
  class PierFigure extends HTMLElement {
    static get observedAttributes(){return ['data-state','data-angle','data-camera'];}
    connectedCallback(){if(!this.surface){this.surface=canvas(1,1);this.append(this.surface);}this.draw();}
    attributeChangedCallback(){if(this.surface&&this.isConnected)this.draw();}
    async draw(){
      const token=this.token=(this.token||0)+1;
      let state;try{state=JSON.parse(this.getAttribute('data-state')||'{}');}catch{return;}
      if(!state.p)return;
      const close=this.dataset.camera==='close',output=close?canvas(770,560):canvas(504,1200);
      try{await render(output,state.p,Number(this.dataset.angle)||0,state.e,close?'close':'full');}
      catch{if(token===this.token){this.setAttribute('aria-label','Изображение персонажа не загрузилось');this.dataset.failed='1';}return;}
      if(token!==this.token||!this.isConnected)return;
      this.surface.width=output.width;this.surface.height=output.height;
      this.surface.getContext('2d').drawImage(output,0,0);this.dataset.ready='1';delete this.dataset.failed;
      this.setAttribute('aria-label',close?'Лицо персонажа крупным планом':'Персонаж в полный рост');
    }
  }
  customElements.define('pier-figure',PierFigure);
  function dressed(p,e={}) {
    return {...p,cap:Object.hasOwn(e,'hat')?!!e.hat:!!p.cap,glasses:Object.hasOwn(e,'glasses')?(e.glasses?(p.glasses&&p.glasses!=='none'?p.glasses:'square'):'none'):(p.glasses||'none')};
  }
  window.PierArt={art,load,capFor,makeFace,render,body,dressed};
})();
