/* The original hand photograph supplies the metal, paint and glove textures.
   Coordinates are landmarks on its 1536 x 1024 sensor plane, before rod tilt. */
(() => {
 'use strict';
 const tau=2*Math.PI, width=1536, height=1024, states=new WeakMap();
 const surface=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
 function shape(ctx,commands){
   ctx.beginPath();
   for(const c of commands){
     if(c.length===2)ctx.lineTo(c[0],c[1]);
     else ctx.bezierCurveTo(...c);
   }
   ctx.closePath();
 }
 function cut(image,rect,outline){
   const [x,y,w,h]=rect,c=surface(w,h),g=c.getContext('2d');
   g.translate(-x,-y);shape(g,outline);g.clip();g.drawImage(image,0,0);
   return {canvas:c,x,y};
 }
 function paintPart(g,part){g.drawImage(part.canvas,part.x,part.y);}
 const casing=[[480,715],[514,670],[531,665],[536,674],[522,705],[518,739],[519,753],[534,759],[553,761],[576,768],[604,778],[625,793],[638,808],[640,823],[632,832],[646,835],[654,846],[650,862],[638,864],[627,860],[612,854],[591,850],[575,851],[560,858],[546,873],[528,885],[503,892],[477,887],[472,855],[470,777]];
 const spool=[[544,730],[548,718,552,709,560,705],[566,694,567,679,577,668],[579,658,592,650,608,651],[624,650,646,658,660,669],[672,677,677,689,674,700],[672,707,666,713,664,717],[661,728,656,743,651,753],[649,762,644,771,637,777],[632,780,627,777,624,773],[615,762,587,750,558,750],[546,750,539,744,544,730]];
 // Keep the black knob, its ferrule and the holding fingers; the diagonal
 // crank arm belongs to the separate rotating metal layer.
 const grip=[[715,783],[724,779],[730,758,740,739,748,729],[762,709,791,692,810,685],[826,678,840,677,864,679],[938,653],[1536,653],[1536,1024],[708,1024],[700,911],[702,862],[702,837,701,822,709,812],[714,806],[708,805],[705,802,709,787,715,783]];
 const knobPin=[[697,784],[701,779,710,778,715,784],[716,789,710,803,705,808],[698,811,693,805,693,800],[693,796,694,788,697,784]];
 const rotorFoot=[[627,776],[635,782,638,785,642,782],[649,780,655,764,660,756],[663,750,666,743,671,737],[676,730,687,732,692,738],[699,745,694,753,686,758],[680,761,675,761,672,766],[665,776,658,788,652,794],[646,802,635,803,630,798],[625,793,624,784,627,776]];
 const lever=[[629,835],[637,832,643,836,649,833],[662,825,680,807,692,795],[694,787,696,782,702,779],[709,776,717,780,719,785],[720,791,718,796,715,800],[707,804,701,801,698,805],[685,814,668,833,655,852],[653,862,648,868,640,868],[626,870,620,844,629,835]];
 function prepare(image){
   const fixed=surface(1024,683),g=fixed.getContext('2d');g.scale(1024/width,683/height);g.drawImage(image,0,0);
   g.save();g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='destination-out';const clear=[[545,643],[700,622],[1537,622],[1537,1025],[509,1025],[495,886],[495,848],[502,795],[515,749],[521,690]];shape(g,clear.map(([x,y])=>[x*1024/width,y*683/height]));g.fill();g.restore();
   paintPart(g,cut(image,[463,660,200,240],casing));
   // The black rotor cup is almost circular. Its own photo closes the spindle
   // between the fixed drive housing and the axially reciprocating silver spool.
   const cup=[[521,742],[537,743],[559,746,586,752,607,764],[620,774,628,781,638,783],[646,785],[646,791],[631,810],[600,808],[572,800],[540,786],[523,766]];
   paintPart(g,cut(image,[518,738,134,80],cup));
   const arm=cut(image,[677,619,859,405],grip);
   const socket=cut(image,[689,776,32,39],knobPin);
   // The wrist follows the grip while the far end of the sleeve stays planted.
   // Extend the clipped sleeve beyond the sensor so it can still cover its edge.
   const padded=surface(arm.canvas.width,arm.canvas.height+140),p=padded.getContext('2d');
   p.drawImage(arm.canvas,0,0);p.drawImage(socket.canvas,socket.x-arm.x,socket.y-arm.y);p.translate(0,arm.canvas.height);p.scale(1,-1);
   p.drawImage(arm.canvas,0,arm.canvas.height-140,arm.canvas.width,140,0,-140,arm.canvas.width,140);
   const crank=cut(image,[618,772,105,100],lever);
   const trim=crank.canvas.getContext('2d');trim.save();trim.translate(705-crank.x,791-crank.y);trim.rotate(Math.atan2(-58,64));
   trim.clearRect(-2,-80,120,160);trim.restore();
   return {fixed,foot:cut(image,[622,729,78,80],rotorFoot),spool:cut(image,[535,644,145,140],spool),lever:crank,arm:{canvas:padded,x:arm.x,y:arm.y}};
 }
 const axis=[.37,-.929],across=[.929,.37];
 function project(a,r,z){
   const cross=r*Math.cos(a),axial=z+r*.29*Math.sin(a);
   return [616+across[0]*cross+axis[0]*axial,705+across[1]*cross+axis[1]*axial];
 }
 function stroke(g,pts,color,size){
   g.strokeStyle=color;g.lineWidth=size;g.lineCap='round';g.lineJoin='round';g.beginPath();g.moveTo(...pts[0]);
   for(let i=1;i<pts.length;i++)g.lineTo(...pts[i]);
   g.stroke();
 }
 function armRail(g,a,metal){
   // A full photographic support carries the bail and its original roller
   // around the spool. Two opposite supports are drawn at their true depths.
   const from=project(a,32,-66),to=project(a,77,0),x=to[0]-from[0],y=to[1]-from[1];
   const sx=680-633,sy=742-791,angle=Math.atan2(y,x)-Math.atan2(sy,sx);
   g.save();g.translate(...from);g.rotate(angle+Math.atan2(sy,sx));
   g.scale(Math.hypot(x,y)/Math.hypot(sx,sy),.73+.27*Math.abs(Math.cos(a)));
   g.rotate(-Math.atan2(sy,sx));g.translate(-633,-791);paintPart(g,metal);g.restore();
 }
 function drawRotor(g,a,front,foot){
   for(const side of [a,a+Math.PI])if((Math.sin(side)<0)===front)armRail(g,side,foot);
   let run=[];
   const flush=()=>{
     if(run.length>1){stroke(g,run,'#434549',3.9);stroke(g,run.map(([x,y])=>[x-.7,y-.9]),'#c7c1b4',1.65);stroke(g,run.map(([x,y])=>[x-.5,y-1.25]),'#f1e6ca',.55);}
     run=[];
   };
   for(let i=0;i<=40;i++){
     const t=i/40,theta=a+t*Math.PI,p=project(theta,77,37*Math.sin(Math.PI*t));
     if(i===0){if((Math.sin(theta)<0)===front)run.push(p);continue;}
     if((Math.sin(theta-Math.PI/80)<0)===front){if(!run.length){const old=(i-1)/40;run.push(project(a+Math.PI*old,77,37*Math.sin(Math.PI*old)));}run.push(p);}
     else if(run.length)flush();
   }
   if(run.length)flush();
 }
 function draw(canvas,parts,phase){
   const g=canvas.getContext('2d');g.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
   g.clearRect(0,0,width,height);
   g.drawImage(parts.fixed,0,0,width,height);
   const rotor=phase*3.8-.46;
   drawRotor(g,rotor,false,parts.foot);
   g.save();const axial=Math.sin(phase*.8)*4.5;g.translate(axis[0]*axial,axis[1]*axial);paintPart(g,parts.spool);g.restore();
   drawRotor(g,rotor,true,parts.foot);
   const cs=Math.cos(phase),sn=Math.sin(phase),cx=641,cy=849,u=[64,-58],v=[41,50];
   const vx=u[0]*cs+v[0]*sn,vy=u[1]*cs+v[1]*sn,dx=vx-u[0],dy=vy-u[1];
   const ang=Math.atan2(vy,vx)-Math.atan2(u[1],u[0]);
   g.save();g.translate(cx,cy);g.rotate(ang);const scale=Math.hypot(vx,vy)/Math.hypot(...u);g.scale(scale,scale);g.translate(-cx,-cy);paintPart(g,parts.lever);g.restore();
   g.save();const span=1536-(cx+u[0]);g.transform(1-dx/span,-dy/span,0,1,dx*1536/span,dy*1536/span);paintPart(g,parts.arm);g.restore();
 }
 function tick(photo,elapsed,moving,inFight,reduced){
   if(!photo?.complete||!photo.naturalWidth)return;
   let s=states.get(photo);
   if(!s){
     if(!moving)return;
     const layer=surface(1024,683);layer.className=photo.className;layer.setAttribute('aria-hidden','true');
     layer.style.pointerEvents='none';photo.after(layer);
     s={layer,phase:0,dirty:true,parts:null,painted:-1};states.set(photo,s);
     photo.addEventListener?.('load',()=>{s.dirty=true;});
   }
   if(!moving&&!inFight&&s.phase===0)return;
   if(s.dirty){s.parts=prepare(photo);s.dirty=false;s.painted=-1;}
   if(moving)s.phase=(s.phase+Math.max(0,Math.min(.15,elapsed))*(reduced?2.15:5.05))%(10*Math.PI);
   else if(!inFight){s.phase=0;s.layer.hidden=true;s.layer.style.display='none';photo.style.opacity='';return;}
   s.layer.hidden=false;s.layer.style.display='block';photo.style.opacity='0';
   for(const key of ['width','height','left','top','transform'])s.layer.style[key]=photo.style[key];
   if(s.painted!==s.phase){draw(s.layer,s.parts,s.phase);s.painted=s.phase;}
 }
 window.PierReel={tick};
})();
