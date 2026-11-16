/* Registered photographic skin for the two existing, animated room GLBs. */
(() => {
  'use strict';
  const clamp = (x, low=0, high=1) => Math.max(low, Math.min(high, x));
  const lerp = (a,b,t) => a+(b-a)*t;
  const smooth = (lo,hi,x) => { const t=clamp((x-lo)/(hi-lo)); return t*t*(3-2*t); };
  const size = 560;
  function photoRows(canvas,side) {
    const width=canvas.width, height=canvas.height;
    const rgba=canvas.getContext('2d').getImageData(0,0,width,height).data;
    const rows=[];
    let crown=0;
    for(let y=0;y<height;y++){
      let left=width, right=-1;
      for(let x=side?104:143;x<=Math.min(width-1,side?454:414);x++){
        if(rgba[(y*width+x)*4+3]<190)continue;
        left=Math.min(left,x);right=x;
      }
      if(!crown && right-left>=10)crown=y;
      // The source portrait includes jacket shoulders below the jaw.
      if(!side&&y>295){const half=clamp(104-(y-295)*.54,64,104);left=Math.max(left,280-half);right=Math.min(right,280+half);}
      if(side&&y>302)right=Math.min(right,395-(y-302)*.48);
      rows.push(right>left?[left,right]:null);
    }
    return {rows,crown};
  }
  function photoExtent(photo,y){
    const row=photo.rows[clamp(Math.round(y),photo.crown,photo.rows.length-1)];
    return row || [275,285];
  }
  function rigRows(position,center,crown,floor){
    const count=70,rows=Array.from({length:count},()=>[Infinity,-Infinity,Infinity,-Infinity]);
    const index=y=>clamp(Math.round((y-floor)/(crown-floor)*(count-1)),0,count-1);
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      if(y<floor||Math.abs(x-center)>.115)continue;
      const r=rows[index(y)];
      r[0]=Math.min(r[0],x);r[1]=Math.max(r[1],x);r[2]=Math.min(r[2],z);r[3]=Math.max(r[3],z);
    }
    const nearest=i=>{
      for(let step=0;step<count;step++){
        const r=rows[Math.max(0,i-step)],s=rows[Math.min(count-1,i+step)];
        if(r[1]-r[0]>.006)return r;
        if(s[1]-s[0]>.006)return s;
      }
      return [center-.08,center+.08,-.13,.075];
    };
    return y=>{
      const n=clamp((y-floor)/(crown-floor)*(count-1),0,count-1),a=nearest(Math.floor(n)),b=nearest(Math.ceil(n));
      return a.map((v,i)=>lerp(v,b[i],n%1));
    };
  }
  function trimSculptedBun(position,center){
    // The shipped woman has a high permanent bun sculpted into her skin mesh.
    // Project those rear vertices onto the occipital curve before fitting
    // photographs, preserving the original skinning and a rounded skull.
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      if(y<1.544||z>-.07)continue;
      const dx=(x-center)/.089,dy=(y-1.554)/.128;
      const back=-.036-.114*Math.sqrt(Math.max(.004,1-dx*dx-dy*dy));
      if(z<back)position.setXYZ(i,x,y,back+(z-back)*.025);
    }
  }
  function fitGeometry(T,mesh,front,side,female){
    const geo=mesh.geometry.clone(),p=geo.getAttribute('position');
    const crown=female?1.68004:1.79996,eye=female?1.55:1.665,floor=female?1.405:1.51;
    const center=female?.008:.001,pxPerMeter=female?1240:1190;
    const fEye=female?197:205,sEye=female?195:202;
    if(female)trimSculptedBun(p,center);
    const fRows=photoRows(front,false),sRows=photoRows(side,true),extent=rigRows(p,center,crown,floor);
    const projections=new Float32Array(p.count*4),weights=new Float32Array(p.count*4);
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      const influence=smooth(floor,floor+.036,y)*(1-smooth(.103,.126,Math.abs(x-center)));
      if(!influence)continue;
      const fY=y>eye?lerp(fEye,fRows.crown,clamp((y-eye)/(crown-eye))):fEye+(eye-y)*pxPerMeter;
      const sY=y>eye?lerp(sEye,sRows.crown,clamp((y-eye)/(crown-eye))):sEye+(eye-y)*pxPerMeter;
      const [xMin,xMax,zMin,zMax]=extent(y);
      const nx=clamp((x-xMin)/Math.max(.004,xMax-xMin)),nz=clamp((z-zMin)/Math.max(.004,zMax-zMin));
      const [fl,fr]=photoExtent(fRows,fY),[sl,sr]=photoExtent(sRows,sY);
      // Sample just inside the matte, including on the silhouette seen edge-on.
      const u=lerp(fl,fr,lerp(.018,.982,nx)),v=lerp(sr,sl,lerp(.018,.982,nz));
      const base=i*4;
      projections.set([u/size,fY/front.height,v/size,sY/side.height],base);
      const azimuth=Math.atan2(Math.abs(nx*2-1),nz*2-1);
      // Mirror the selected haircut around the nape. A registered side
      // photograph also supplies the rear, including its actual hair colour.
      const earBand=smooth(142,192,sY)*(1-smooth(266,312,sY));
      const across=1-Math.abs(nx*2-1);
      const rearSample=lerp(sl,sr,.69+.16*earBand+(.145-.10*earBand)*across);
      const backX=lerp(rearSample,307+16*across,smooth(322,360,sY));
      weights.set([backX/size,sY/side.height,azimuth,influence],base);
      // The bind-space reshape follows the actual two photographs. The same GLB
      // weights still carry every modified vertex through sitting and walking.
      const dx=clamp(center+(u-280)/pxPerMeter-x,-.025,.025);
      const dz=clamp((236-v)/pxPerMeter-z,-.035,.035);
      const dy=clamp(eye-(fY-fEye)/pxPerMeter-y,-.02,.02);
      p.setXYZ(i,x+influence*dx,y+influence*dy,z+influence*dz);
    }
    geo.setAttribute('pierPhotoUV',new T.BufferAttribute(projections,4));
    geo.setAttribute('pierPhotoView',new T.BufferAttribute(weights,4));
    geo.computeBoundingBox();geo.computeBoundingSphere();
    mesh.geometry=geo;mesh.userData.shared=false;
  }
  function shader(material,front,side){
    const previous=material.onBeforeCompile;
    material.onBeforeCompile=function(program,renderer){
      previous.call(this,program,renderer);
      Object.assign(program.uniforms,{
        pierRegisteredFront:{value:front},pierRegisteredSide:{value:side}
      });
      program.vertexShader=program.vertexShader.replace('#include <common>',
        '#include <common>\nattribute vec4 pierPhotoUV; attribute vec4 pierPhotoView; varying vec4 pierUV; varying vec4 pierView;'
      ).replace('#include <begin_vertex>','#include <begin_vertex>\npierUV=pierPhotoUV; pierView=pierPhotoView;');
      program.fragmentShader=program.fragmentShader.replace('#include <common>',
        '#include <common>\nvarying vec4 pierUV; varying vec4 pierView; uniform sampler2D pierRegisteredFront; uniform sampler2D pierRegisteredSide;'
      ).replace('#include <map_fragment>',`#include <map_fragment>
        if (pierView.w > 0.001) {
          vec4 frontPhoto=texture2D(pierRegisteredFront,pierUV.xy);
          vec4 sidePhoto=texture2D(pierRegisteredSide,pierUV.zw);
          vec4 rearPhoto=texture2D(pierRegisteredSide,pierView.xy);
          float sideWeight=smoothstep(0.99,1.46,pierView.z);
          float rearWeight=smoothstep(1.84,2.58,pierView.z);
          vec3 w=vec3((1.0-sideWeight)*frontPhoto.a,sideWeight*(1.0-rearWeight)*sidePhoto.a,rearWeight*rearPhoto.a);
          float total=w.x+w.y+w.z;
          vec3 portrait=(frontPhoto.rgb*w.x+sidePhoto.rgb*w.y+rearPhoto.rgb*w.z)/max(total,0.0001);
          diffuseColor.rgb=mix(diffuseColor.rgb,portrait,clamp(total,0.0,1.0)*pierView.w);
        }`);
    };
    material.customProgramCacheKey=()=> 'pier-room-registered-v1';material.needsUpdate=true;
  }
  function registeredSkin(actor){
    const skin=[];
    actor.body.traverse(mesh=>{
      if(mesh.isSkinnedMesh && !Array.isArray(mesh.material) && mesh.material?.name==='Material_0' && mesh.skeleton.bones.includes(actor.bones.Head))skin.push(mesh);
    });
    return skin;
  }
  function headSocket(T,actor,profile,kind){
    const bone=actor.bones.Head,group=new T.Group(),mesh=registeredSkin(actor)[0];
    if(!mesh){
      const size=bone.getWorldScale(new T.Vector3());group.scale.set(1/size.x,1/size.y,1/size.z);
    }else{
      const female=profile.gender==='female',eye=female?1.55:1.665,center=female?.008:.001;
      const hat=kind==='hat',origin=new T.Matrix4().makeTranslation(center,eye-(hat?.166:.115),hat?-.035:(female?.082:.078)-.105);
      if(kind==='hair')origin.identity();
      if(hat)origin.multiply(new T.Matrix4().makeScale(.88,1,1));
      const headIndex=mesh.skeleton.bones.indexOf(bone);
      group.matrix.copy(mesh.skeleton.boneInverses[headIndex]).multiply(mesh.bindMatrix).multiply(origin);
      group.matrixAutoUpdate=false;
    }
    bone.add(group);return group;
  }
  function tiedHair(T,actor,profile,sideTexture){
    if(profile.gender!=='female')return;
    // Keep hair that extends beyond the neck in the registered side photograph.
    // Each ring gives the image row and the two sides of that lock, in pixels.
    const pony=[[222,359,374],[244,365,399],[265,372,417],[282,380,435],[303,376,445],[324,368,448],[346,358,446],[365,354,443],[380,367,438],[395,397,407]];
    const braid=[[179,379,389],[196,371,417],[219,373,431],[245,376,428],[262,376,421],[279,380,412],[289,388,396]];
    const bob=[[216,343,375],[241,335,419],[267,323,428],[289,316,415],[306,312,403],[320,310,389],[329,322,358]];
    const rows=profile.hair==='pony'?pony:profile.hair==='bob'?bob:['braids','long'].includes(profile.hair)?braid:null;
    if(!rows)return;
    const xyz=[],uv=[],triangles=[],segments=28;
    for(let r=0;r<rows.length;r++){
      const [py,left,right]=rows[r],center=(right+left)/2,depth=(right-left)/2;
      for(let k=0;k<=segments;k++){
        const angle=k*2*Math.PI/segments,sideX=center+depth*Math.cos(angle);
        const radiusX=(profile.hair==='bob'?1.50:1.10)*depth/1240;
        xyz.push(.008+radiusX*Math.sin(angle),1.55+(195-py)/1240,(236-sideX)/1240);
        uv.push(sideX/size,py/515);
        if(r&&k){const a=(r-1)*(segments+1)+k-1,b=a+1,c=a+segments+1,d=c+1;triangles.push(a,c,b,b,c,d);}
      }
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(xyz,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(triangles);geometry.computeVertexNormals();
    const material=new T.MeshStandardMaterial({map:sideTexture,roughness:.91,metalness:0,side:T.DoubleSide,alphaTest:.45});
    const mesh=new T.Mesh(geometry,material);mesh.userData.ownedMaterial=true;mesh.castShadow=true;mesh.receiveShadow=true;
    const socket=headSocket(T,actor,profile,'hair');socket.add(mesh);
  }
  function clothing(profile,equip,item,paletteForItem){
    const dyes=['','#9e845b','#314451','#533632'];
    const starter={jacket:'jacket_classic',pants:'pants_basic',boots:'boots_basic'};
    const original={jacket:'#574534',pants:'#57533b',boots:'#464a2d'};
    const dye={jacket:['forest','sand','navy','wine'].indexOf(profile.outfit),pants:profile.pantsTone,boots:profile.bootTone};
    const color=slot=>{
      const chosen=equip[slot],collection=chosen&&paletteForItem?.(chosen);
      if(collection?.color)return collection.color;
      const it=chosen&&chosen!==starter[slot]?item?.(chosen):null;
      const palette=it&&window.PierGarmentColor?.(slot,chosen);
      if(palette)return '#'+palette.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
      return dyes[dye[slot]]||original[slot];
    };
    return {AF_Jacket:color('jacket'),AF_Pants:color('pants'),AF_Boots:color('boots'),AF_Trim:color('jacket')};
  }
  async function apply(T,actor,profile,isDisposed,onTexture){
    if(!actor?.bones?.Head||!window.PierArt||isDisposed())return;
    const skin=registeredSkin(actor);
    if(!skin.length)return;
    const [front,side]=await Promise.all([PierArt.makeFace(profile,0),PierArt.makeFace(profile,1)]);
    if(isDisposed())return;
    const maps=[front,side].map(image=>{
      const texture=new T.CanvasTexture(image);texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;
      texture.anisotropy=4;texture.needsUpdate=true;onTexture(texture);return texture;
    });
    for(const mesh of skin){
      fitGeometry(T,mesh,front,side,profile.gender==='female');
      shader(mesh.material,...maps);
    }
    tiedHair(T,actor,profile,maps[1]);
    actor.group.userData.registeredHead=true;
  }
  window.PierRoomLook={apply,headSocket,clothing};
})();
