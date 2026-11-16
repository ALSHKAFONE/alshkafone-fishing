/* Registered head placement on the original rotating and animated gear carriers. */
(() => {
  'use strict';
const carriers = {"m00":[106,22,134,54,134],"m01":[103,22,118,54,136],"m02":[121,22,137,54,149],"m03":[100,22,131,55,109],"m04":[105,22,135,54,135],"m05":[95,23,127,55,128],"m06":[83,23,138,55,127],"m07":[105,22,150,55,138],"m10":[105,22,135,54,132],"m11":[101,22,119,55,136],"m12":[108,22,124,54,140],"m13":[107,21,136,54,124],"m14":[108,22,139,54,138],"m15":[96,22,129,54,129],"m16":[93,22,150,54,134],"m17":[105,22,149,55,136],"m20":[102,21,133,54,134],"m21":[102,22,119,54,134],"m22":[113,22,128,54,137],"m23":[110,21,145,53,144],"m24":[112,22,142,54,142],"m25":[101,22,131,54,132],"m26":[89,22,142,54,134],"m27":[99,22,142,54,133],"f00":[105,22,135,54,135],"f01":[109,22,126,54,142],"f02":[120,23,136,55,150],"f03":[103,22,138,55,141],"f04":[107,22,138,54,138],"f05":[87,22,124,54,122],"f06":[69,22,136,55,125],"f07":[97,22,152,55,139],"f10":[104,22,135,54,134],"f11":[110,22,125,54,140],"f12":[117,22,133,55,142],"f13":[104,22,136,54,174],"f14":[109,22,141,54,155],"f15":[78,22,129,54,98],"f16":[60,22,136,55,127],"f17":[89,22,148,54,134],"f20":[106,25,137,57,136],"f21":[107,23,123,56,136],"f22":[114,24,131,56,141],"f23":[95,24,127,56,111],"f24":[107,24,138,56,138],"f25":[90,23,126,55,142],"f26":[85,24,144,56,132],"f27":[109,24,157,56,142],"pm00":[101,21,151,54,140],"pm01":[68,36,114,61,112],"pm02":[55,21,110,58,92],"pm10":[100,20,153,53,140],"pm11":[67,26,114,55,104],"pm12":[52,21,106,56,84],"pm20":[101,20,151,53,140],"pm21":[74,31,121,59,114],"pm22":[69,20,122,55,107],"pf00":[94,21,145,55,133],"pf01":[68,33,114,65,100],"pf02":[69,21,123,57,108],"pf10":[85,21,153,54,135],"pf11":[61,26,123,54,110],"pf12":[50,21,126,58,108],"pf20":[98,21,153,54,141],"pf21":[95,47,133,76,128],"pf22":[55,20,114,58,99]};
  const atlasUri = "data:image/png;base64,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";
  const keys = Object.keys(carriers);
  const keysByCanvas = new WeakMap();
  const heads = new Map();
  let atlas;

  function canvas(width, height) {
    const result = document.createElement('canvas');
    result.width = width;
    result.height = height;
    return result;
  }

  function atlasPixels() {
    if (!atlas) atlas = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const board = canvas(image.width, image.height);
        const ctx = board.getContext('2d', {willReadFrequently: true});
        ctx.drawImage(image, 0, 0);
        resolve(ctx.getImageData(0, 0, board.width, board.height));
      };
      image.onerror = () => { atlas = null; reject(new Error('Не загрузились маски поз персонажа')); };
      image.src = atlasUri;
    });
    return atlas;
  }

  function cropPhoto(photo, profile, side) {
    const result = canvas(224, 206);
    const ctx = result.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(photo, 0, 0, result.width, result.height);
    const data = ctx.getImageData(0, 0, 224, 206);
    // The registered photographs include the creator's coat. Follow the underside
    // of the jaw and the neck so that the native shirt/skin wins at the collar.
    const cut = side
      ? [[98,97],[139,97],[149,111],[159,128],[170,135],[177,142],[182,158],
         [187,172],[195,174],[209,164],[219,148],[231,133],[244,122],[255,104],[275,95],[322,93]]
      : [[98,94],[156,94],[166,107],[174,124],[181,135],[185,142],[186,156],
         [194,167],[210,175],[226,167],[234,156],[235,142],[239,135],[246,125],[254,108],[264,94],[322,94]];
    let segment = 0;
    for (let col=0; col<224; col++) {
      const x = 98+col+.5;
      while (segment+2<cut.length && x>cut[segment+1][0]) segment++;
      const [x0,y0] = cut[segment], [x1,y1] = cut[segment+1];
      const limit = y0 + (y1-y0)*(x-x0)/(x1-x0);
      for (let row=Math.max(0,Math.floor(limit+10)); row<206; row++) {
        const index = (row*224+col)*4, y=row-12+.5;
        if (!data.data[index+3]) continue;
        let bottom = limit;
        if(side && profile.gender==='female' && profile.hair==='bob' && x>220 && x<278) {
          bottom=Math.max(limit,117-Math.max(0,x-258)*.5);
        }
        if(side && profile.gender==='female' && ['pony','braids','long'].includes(profile.hair) && x>245 && x<280) {
          bottom=Math.max(limit,117);
        }
        data.data[index+3] *= Math.max(0,Math.min(1,(bottom-y)/2+.5));
      }
    }
    ctx.putImageData(data,0,0);
    return result;
  }

  function trimRear(source) {
    const result = canvas(224,206);
    const ctx = result.getContext('2d');
    ctx.save();ctx.translate(-98,12);
    ctx.beginPath();
    ctx.moveTo(128,0);ctx.lineTo(285,0);ctx.lineTo(284,85);
    ctx.lineTo(255,95);ctx.lineTo(248,112);ctx.lineTo(237,118);
    ctx.lineTo(231,126);ctx.lineTo(193,126);ctx.lineTo(185,117);
    ctx.lineTo(175,111);ctx.lineTo(168,99);ctx.lineTo(130,88);ctx.closePath();ctx.clip();
    ctx.drawImage(source,0,0);ctx.restore();
    return result;
  }

  function angled(photo, rear=false) {
    // Work in calibrated photograph coordinates: foreshorten the far cheek
    // around the curved face; the bridge and tip project farther than the ears.
    // Using a single source for all the visible features keeps one continuous
    // hairline and one mouth at every age and hairstyle.
    const result=canvas(224,206), g=result.getContext('2d');
    const source=photo.getContext('2d').getImageData(0,0,224,206).data;
    const output=g.createImageData(224,206), target=output.data;
    const scale=rear?.96:.97;
    for(let y=0;y<206;y++) {
      const features=Math.max(0,1-Math.abs(y-109)/43);
      const depth=rear?-5:18+4*features;
      for(let x=0;x<224;x++) {
        const u=x-112;
        let local=u/scale;
        if(Math.abs(local)<55) local=(u+depth)/(scale+(u < -depth?-1:1)*depth/55);
        const origin=112+local, left=Math.floor(origin);
        if(left<0 || left>=223) continue;
        const offset=(y*224+left)*4,t=(y*224+x)*4;
        const weight=origin-left;
        const a=source[offset+3]*(1-weight), b=source[offset+7]*weight;
        if(a+b<.5)continue;
        for(let c=0;c<3;c++)target[t+c]=(source[offset+c]*a+source[offset+4+c]*b)/(a+b);
        target[t+3]=a+b;
      }
    }
    g.putImageData(output,0,0);
    return result;
  }

  function signature(p) {
    return JSON.stringify([p.gender,p.face,p.hair,p.hairColor,p.eyeColor,p.age,p.skin,p.beard]);
  }

  function headFor(p, kind) {
    const key=signature(p)+kind;
    if (heads.has(key)) return heads.get(key);
    const promise=(async () => {
      if (kind==='rear' || kind==='rear3') {
        const rear=trimRear(await window.PierArt.body(p,2,{}));
        if (kind==='rear') return rear;
        return angled(rear,true);
      }
      if (kind==='front3') return angled(await headFor(p,'front'));
      const side=kind==='side';
      return cropPhoto(await window.PierArt.makeFace(p,side?1:0),p,side);
    })().catch(error => { heads.delete(key);throw error; });
    if(heads.size>=32) heads.delete(heads.keys().next().value);
    heads.set(key,promise);
    return promise;
  }

  function layout(k) {
    const fish=k[0]==='p', angle=Number(k.slice(-1));
    const kind = fish?'front3':['front','front3','side','rear3','rear','rear3','side','front3'][angle];
    const mirror=fish||angle>=5;
    const female=k.includes('f'), scale=(fish ? .572 : .535);
    const anchor=kind==='side'?70:kind==='front3'?99:112;
    const tilt=fish ? [0,-.09,.035][angle] : 0;
    return {kind,mirror,scale,anchor,tilt,sourceY:12+(female?67:70)-(kind==='side'?1:0)};
  }

  function placement(k) {
    const [,,cx,cy,neck]=carriers[k],info=layout(k);
    if(info.kind!=='front3')return [cx,cy];
    const direction=info.mirror?-1:1;
    const projectedNeck=cx+(94-info.anchor)*info.scale*direction;
    return [cx+.75*(neck-projectedNeck),cy];
  }

  function accessoryAnchor(k, original) {
    if(!carriers[k]) return original;
    const [x,y]=placement(k), {kind,mirror}=layout(k);
    const mid=x+(mirror?-1:1)*(kind==='side'?15:kind==='front3'?8:0);
    const w=kind==='side'?49:kind==='rear3'?47:44;
    return {...original,head:[mid-w/2,mid+w/2],eyeY:y};
  }

  async function registeredBody(p, carrier, nativeMask, k) {
    const position=carriers[k];
    if(!position) throw new Error('Нет позы персонажа '+k);
    const key=k+signature(p);
    let states=keysByCanvas.get(carrier);
    if(!states){states=new Map();keysByCanvas.set(carrier,states);}
    if(states.has(key)) return states.get(key);
    const [sx,sy]=position, info=layout(k), tile=keys.indexOf(k);
    const result=(async()=>{
      const [head,atlas]=await Promise.all([headFor(p,info.kind),atlasPixels()]);
      const clean=canvas(carrier.width,carrier.height), ctx=clean.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(carrier,0,0);
      const rect=ctx.getImageData(sx,sy,100,117), pixels=rect.data;
      const original=ctx.getImageData(0,sy,carrier.width,117).data;
      const under=ctx.createImageData(100,117), material=under.data;
      const tx=tile%8*100,ty=Math.floor(tile/8)*117;
      for(let y=0;y<117;y++)for(let x=0;x<100;x++){
        const mask=((ty+y)*atlas.width+tx+x)*4, j=(y*100+x)*4;
        if(!atlas.data[mask])continue;
        const left=atlas.data[mask+1],right=atlas.data[mask+2];
        if(left && right) {
          const off=(y*carrier.width+sx+x)*4;
          // The atlas points exclusively to real garment pixels in the same
          // row. Old hair, skin and gloves are excluded when locating donors.
          for(let ch=0;ch<3;ch++)material[j+ch]=(original[off-left*4+ch]*right+original[off+right*4+ch]*left)/(left+right);
          material[j+3]=pixels[j+3];
        }
        pixels[j+3]=0;
      }
      ctx.putImageData(rect,sx,sy);
      const output=canvas(carrier.width,carrier.height),g=output.getContext('2d');
      g.putImageData(under,sx,sy);
      const [cx,cy]=placement(k);
      g.save();g.translate(cx,cy);g.rotate(info.tilt);g.scale(info.mirror?-info.scale:info.scale,info.scale);
      g.drawImage(head,-info.anchor,-info.sourceY);
      g.restore();
      g.drawImage(clean,0,0);
      return output;
    })().catch(error=>{states.delete(key);throw error;});
    if(states.size>=4)states.delete(states.keys().next().value);
    states.set(key,result);return result;
  }

  window.PierPose={registeredBody,accessoryAnchor,turnHead:headFor};
})();
