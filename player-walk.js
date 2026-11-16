(() => {
  'use strict';
  const size = 448;
  const hip = [208, 474], knee = [207, 663], ankle = [185, 918];
  // Absolute thigh, shin and shoe pitches taken from the four existing contact/passing poses.
  const gait = [
    { near: [27, 24, -22], far: [-22, -29, 8] },
    { near: [16, -14, 0], far: [11, -45, 56] },
    { near: [-23, -27, 8], far: [30, 23, -21] },
    { near: [-3, -52, 60], far: [11, -8, 0] }
  ];
  const framesByLook = new Map();
  const rad = Math.PI / 180;
  const scale = size / 1020;
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  function rotate(x, y, angle) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return [cos*x - sin*y, sin*x + cos*y];
  }
  function limb(angles, back) {
    const shift = back ? -10 : 0, wide = back ? .89 : 1;
    const pivots = [hip, knee, ankle], dest = [[hip[0]+shift, hip[1]]];
    const rotations = [
      Math.atan2(knee[0]-hip[0],knee[1]-hip[1])-angles[0]*rad,
      Math.atan2(ankle[0]-knee[0],ankle[1]-knee[1])-angles[1]*rad,
      angles[2]*rad
    ];
    for (let n=0; n<2; n++) {
      const [x,y] = rotate(pivots[n+1][0]-pivots[n][0],pivots[n+1][1]-pivots[n][1],rotations[n]);
      dest.push([dest[n][0]+x,dest[n][1]+y]);
    }
    function bone(x,y,n) {
      const [dx,dy] = rotate((x-pivots[n][0])*wide,y-pivots[n][1],rotations[n]);
      return [dest[n][0]+dx,dest[n][1]+dy];
    }
    function blend(a,b,t) {
      const f = t*t*(3-2*t);
      return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
    }
    return (x,y) => {
      if (y<hip[1]+49) return blend([x+shift,y],bone(x,y,0),Math.max(0,(y-hip[1])/49));
      if (y<knee[1]-32) return bone(x,y,0);
      if (y<knee[1]+32) return blend(bone(x,y,0),bone(x,y,1),(y-knee[1]+32)/64);
      if (y<ankle[1]-26) return bone(x,y,1);
      if (y<ankle[1]+26) return blend(bone(x,y,1),bone(x,y,2),(y-ankle[1]+26)/52);
      return bone(x,y,2);
    };
  }
  // A continuous fabric mesh bends the original dressed figure at each joint.
  // Adjacent triangles share vertices and write to the same raster (no clipping seams).
  function triangle(dst, src, a,b,c, shade) {
    const bx=b[0]-a[0], by=b[1]-a[1], cx=c[0]-a[0], cy=c[1]-a[1];
    const det=bx*cy-cx*by;
    if (Math.abs(det)<1e-5) return;
    const left=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0])));
    const right=Math.min(size-1,Math.ceil(Math.max(a[0],b[0],c[0])));
    const top=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1])));
    const bottom=Math.min(size-1,Math.ceil(Math.max(a[1],b[1],c[1])));
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++) {
      const px=x+.5-a[0],py=y+.5-a[1];
      const u=(px*cy-py*cx)/det,v=(bx*py-by*px)/det;
      if(u<-.0001||v<-.0001||u+v>1.0001)continue;
      const sx=Math.floor(a[2]+u*(b[2]-a[2])+v*(c[2]-a[2]));
      const sy=Math.floor(a[3]+u*(b[3]-a[3])+v*(c[3]-a[3]));
      if (sx<0||sx>=420||sy<0||sy>=1000) continue;
      const from=4*(sy*420+sx),to=4*(y*size+x);
      if(!src[from+3])continue;
      for(let k=0;k<3;k++)dst[to+k]=src[from+k]*shade;
      dst[to+3]=src[from+3];
    }
  }
  function drawLeg(ctx, pixels, mapper, position, shade) {
    const layer=canvas(size,size), gc=layer.getContext('2d');
    const data=gc.createImageData(size,size);
    function vertex(x,y) {
      const [dx,dy]=position(...mapper(x,y));
      return [dx,dy,x,y];
    }
    // The side-view foot extends to the right of the shin. Include its toe in the mesh.
    const left=44,right=375;
    for (let y=hip[1];y<1000;y+=16) {
      const end=Math.min(y+16,1000);
      const a=vertex(left,y),b=vertex(right,y),c=vertex(right,end),d=vertex(left,end);
      triangle(data.data,pixels,a,b,c,shade);
      triangle(data.data,pixels,a,c,d,shade);
    }
    gc.putImageData(data,0,0);
    ctx.drawImage(layer,0,0);
  }
  function footOutline(pixels) {
    const points=[];
    for(let x=50;x<370;x+=4) {
      for(let y=999;y>=900;y--) {
        if(pixels[(y*420+x)*4+3]>120) {points.push([x,y]);break;}
      }
    }
    return points;
  }
  // Wardrobe side photographs show the other boot peeking above the toe. Isolate
  // their nearer boot before making the two independently moving legs.
  const bootRows=[805,840,860,875,885,895,905,912,916,919,922,926,932,938,953,975];
  const bootContours={
    f0:[188,174,173,175,179,185,197,209,219,232,245,248,249,252,260,265],
    f1:[192,173,166,167,170,179,190,201,209,220,235,243,246,247,255,260],
    f2:[200,183,178,180,184,191,201,212,222,230,242,249,252,252,260,264],
    m0:[173,165,164,168,173,179,190,203,214,228,238,242,244,245,252,257],
    m1:[204,183,179,180,186,193,206,220,236,252,259,261,262,264,270,280],
    m2:[201,189,187,189,193,202,213,226,240,251,258,262,264,267,277,281]
  };
  function isolateBoot(pixels, profile, equip) {
    const standard={jacket:'jacket_classic',pants:'pants_basic',boots:'boots_basic',gloves:'gloves_basic'};
    if(Object.keys(standard).every(slot=>!equip[slot]||equip[slot]===standard[slot]))return;
    const cohort=profile.age<35?0:profile.age<55?1:2;
    const contour=bootContours[(profile.gender==='female'?'f':'m')+cohort];
    for(let i=0;i<bootRows.length-1;i++) {
      for(let y=bootRows[i];y<bootRows[i+1];y++) {
        const t=(y-bootRows[i])/(bootRows[i+1]-bootRows[i]);
        const edge=contour[i]+t*(contour[i+1]-contour[i]);
        for(let x=Math.floor(edge);x<420;x++)pixels[(420*y+x)*4+3]*=Math.max(0,edge-x);
      }
    }
  }
  function poseFrames(source, profile, equip) {
    const stand=canvas(420,1000);
    const gc = stand.getContext('2d',{willReadFrequently:true});
    gc.drawImage(source,0,0,420,1000);
    const pixels=gc.getImageData(0,0,420,1000).data;
    isolateBoot(pixels,profile,equip);
    const foot=footOutline(pixels);
    const out=gait.map(step=>{
      const near=limb(step.near,false),far=limb(step.far,true);
      let floor=900;
      for(const [x,y] of foot)floor=Math.max(floor,near(x,y)[1],far(x,y)[1]);
      const position=(x,y)=>[size*.50+(x-hip[0])*scale, size-3+(y-floor)*scale];
      const frame=canvas(size,size), ctx=frame.getContext('2d');
      drawLeg(ctx,pixels,far,position,.77);
      drawLeg(ctx,pixels,near,position,1);
      const [x,y]=position(0,0);
      ctx.drawImage(stand,0,0,420,hip[1]+11,x,y,420*scale,(hip[1]+11)*scale);
      return frame;
    });
    const idle=canvas(size,size);
    const ground=foot.length?Math.max(...foot.map(pt=>pt[1])):990;
    idle.getContext('2d').drawImage(stand,size*.5-hip[0]*scale,size-3-ground*scale,420*scale,1000*scale);
    out.push(idle);
    return out;
  }
  function getFrames(profile,equip) {
    const key=JSON.stringify([profile,equip]);
    if(!framesByLook.has(key)){
      if(framesByLook.size>=3)framesByLook.delete(framesByLook.keys().next().value);
      const requested=Promise.resolve().then(()=>window.AF35Character.walkSource(profile,equip)).then(source=>poseFrames(source,profile,equip||{}));
      framesByLook.set(key,requested);
      requested.catch(()=>{if(framesByLook.get(key)===requested)framesByLook.delete(key);});
    }
    return framesByLook.get(key);
  }
  const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function markup(profile,equip,frame=4,id='',label='Твой персонаж') {
    return '<pier-walker'+(id?' id="'+escape(id)+'"':'')+' role="img" aria-label="'+escape(label)+'" data-state="'+escape(JSON.stringify([profile,equip||{}]))+'" data-frame="'+frame+'"></pier-walker>';
  }
  class PierWalker extends HTMLElement {
    static get observedAttributes(){return ['data-frame','data-state'];}
    connectedCallback() {
      if(!this.surface){this.surface=canvas(size,size);this.append(this.surface);}
      this.load();
    }
    attributeChangedCallback(name) {
      if(!this.surface||!this.isConnected)return;
      if(name==='data-frame')this.paint();else this.load();
    }
    async load(){
      const key=this.dataset.state;
      if(key===this.key&&this.frames){this.paint();return;}
      this.key=key;
      this.frames=null;
      this.surface.getContext('2d').clearRect(0,0,size,size);
      try {
        const frames=await getFrames(...JSON.parse(key));
        if(this.key!==key||!this.isConnected)return;
        this.frames=frames;
        this.dataset.ready='1';
        this.paint();
      }catch{if(this.key===key)this.dataset.failed='1';}
    }
    paint(){
      const frame=this.frames?.[Number(this.dataset.frame)];
      if(!frame)return;
      const ctx=this.surface.getContext('2d');
      ctx.clearRect(0,0,size,size);
      ctx.drawImage(frame,0,0);
    }
  }
  customElements.define('pier-walker',PierWalker);
  window.PierWalk={markup,getFrames};
})();
