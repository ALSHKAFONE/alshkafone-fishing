/* The diagonal photographs share the registration wardrobe, head and hair assets. */
(() => {
  'use strict';
  const rearHeads=new Map();
  const poses={
    m:{
      1:[198,13,1.21,1.08,260,272,486],3:[200,12,1.17,1.05,206,294,478],
      5:[219,12,1.20,1.08,202,129,477],7:[219,11,1.22,1.08,157,148,481]
    },
    f:{
      1:[217,6,1.12,1.12,255,280,513],3:[198,4,1.10,1.1,212,306,516],
      5:[215,4,1.10,1.10,197,112,514],7:[213,3,1.06,1.06,158,317,510]
    }
  };
  function geometry(p,dir){
    const [x,top,sx,sy,pack,hx,hy]=poses[p.gender==='female'?'f':'m'][dir];
    return {x,top,sx,sy,pack,hand:[hx,hy]};
  }
  async function rearQuarter(p){
    const [rear,side]=await Promise.all([window.PierPose.turnHead(p,'rear3'),window.PierPose.turnHead(p,'side')]);
    if(rearHeads.has(side))return rearHeads.get(side);
    const c=document.createElement('canvas');c.width=224;c.height=206;
    const g=c.getContext('2d');
    g.save();
    // The registered profile supplies only the jaw and temple glimpsed beyond the hair.
    g.beginPath();g.moveTo(45,38);g.lineTo(88,38);g.lineTo(92,112);g.lineTo(83,143);g.lineTo(70,150);g.lineTo(44,146);g.closePath();g.clip();
    g.translate(29,11);g.scale(.69,.88);g.drawImage(side,0,0);g.restore();
    g.drawImage(rear,0,0);
    if(rearHeads.size>=18)rearHeads.delete(rearHeads.keys().next().value);
    rearHeads.set(side,c);return c;
  }
  function headwear(g,im,pose,dir,glasses,mirror=false){
    const side=dir>=5?1:-1, rear=dir===3||dir===5;
    const w=(glasses?78:rear?108:115)*pose.sx,h=(glasses?24:58)*pose.sy;
    const y=pose.top+(glasses?55:-10)*pose.sy;
    g.save();g.translate(pose.x+(glasses?side*11:rear?0:side*4),y);
    if(mirror)g.scale(-1,1);g.drawImage(im,-w/2,0,w,h);g.restore();
  }
  async function render(c,p,dir,e,pose){
    const rear=dir===3||dir===5,art=window.PierArt;
    const [body,head,cap,glasses]=await Promise.all([
      art.body(p,4+(dir-1)/2,e),rear?rearQuarter(p):window.PierPose.turnHead(p,'front3'),
      p.cap?art.capFor(rear?4:1):null,
      p.glasses&&p.glasses!=='none'&&!rear?art.load('game-spec0'):null
    ]);
    const g=c.getContext('2d');if(!rear)g.drawImage(body,0,0);
    g.save();g.translate(pose.x,pose.top);g.scale((dir>=5?-1:1)*pose.sx,pose.sy);
    g.drawImage(head,-(rear?109:106),-(p.gender==='female'?13:rear?23:22));g.restore();
    if(rear)g.drawImage(body,0,0);
    if(cap)headwear(g,cap,pose,dir,false,dir>=5);
    if(glasses)headwear(g,glasses,pose,dir,true,dir>=5);
  }
  window.PierTurn={geometry,headwear,render};
})();
