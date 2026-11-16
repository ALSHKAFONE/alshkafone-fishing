/* Selectable water atlas. All prices, species and restrictions come from the current career. */
const LakeAtlas33 = (() => {
  // Positions are percentages of the map. The second pair is for narrow screens.
  const marks = {
    wild:      [[14,17],[24,10]],
    pine:      [[43,15],[73,10]],
    mountain:  [[80,17],[76,30]],
    lesnoe:    [[29,48],[25,30]],
    river:     [[53,47],[30,50]],
    deep:      [[85,48],[77,50]],
    swamp:     [[29,79],[29,70]],
    night:     [[56,82],[77,70]],
    reservoir: [[83,79],[68,90]]
  };
  // The same coordinates anchor the cards, the routes and saved journal markers.
  function position(id) {
    const [wide,phone]=marks[id];
    return wide.map((value,axis)=>'calc('+value+'% + '+(phone[axis]-value)+'% * var(--at-phone, 0))');
  }
  const paths=[
    ['wild','pine','mountain'], ['wild','lesnoe','river','deep'],
    ['pine','river','night','reservoir'], ['lesnoe','swamp','night'], ['mountain','deep','reservoir']
  ];
  function routes(layout) {
    return paths.map(path=>{
      const points=path.map(id=>marks[id][layout].join(' '));
      return '<path d="M'+points.join(' L')+'"/>';
    }).join('');
  }
  function photo(lake) {
    return '<img src="shore-menu/waters/'+encodeURIComponent(lake.id)+'.webp" alt="" draggable="false">';
  }
  function stars(lake) {
    const count=Math.min(5,1+Math.ceil((lake.level-1)/3));
    return '<span class="at-stars" aria-label="Сложность маршрута '+count+' из 5"><b aria-hidden="true">'+
      '★'.repeat(count)+'</b><i aria-hidden="true">'+ '☆'.repeat(5-count)+'</i></span>';
  }
  function estimate(lake) {
    const pool=lake.fish.map(id=>SPECIES[id]).filter(Boolean);
    const lo=pool.map(f=>careerQuote(f,f.min,false)),hi=pool.map(f=>careerQuote(f,f.max,true));
    const range=k=>N(Math.min(...lo.map(x=>x[k])))+'–'+N(Math.max(...hi.map(x=>x[k])));
    return {gold:range('gold'),xp:range('xp')};
  }
  const temperature=l=>(l.temp>0?'+':'')+l.temp+'°';
  function weatherIcon(lake) {
    return I(lake.id==='night'?'moon':/туман|ветер|течение/i.test(lake.weather)?'wave':'sun');
  }
  function localFish(lake) {return lake.fish.filter(id=>SPECIES[id]);}
  function sample(lake,labels) {
    return localFish(lake).slice(0,3).map(id=>'<span>'+pic(id,'',labels?'':SPECIES[id].name)+(labels?'<small>'+esc(SPECIES[id].name)+'</small>':'')+'</span>').join('');
  }
  function card(lake,sel,access,list) {
    const picked=sel.id===lake.id,lock=access(lake);
    const label=esc(lake.name+(lock?', '+lock:''));
    const common='type="button" data-af32="mapselect" data-id="'+lake.id+'" aria-pressed="'+picked+'" aria-label="'+label+'"';
    const [left,top]=position(lake.id);
    const pos=list?'':' style="left:'+left+';top:'+top+'"';
    const value=estimate(lake);
    return '<button '+common+pos+' class="'+(list?'at-directory-card':'atlas32-pin at-landmark')+'">'+
       '<span class="at-card-cover">'+photo(lake)+(lock?'<span class="at-card-lock" title="'+esc(lock)+'">'+I('lock')+'</span>':'')+'<span class="at-card-name">'+I(lake.boat?'boat':'wave')+'<strong>'+esc(lake.name)+'</strong></span></span>'+
       '<span class="at-card-metrics">'+stars(lake)+'<span class="at-temp">'+weatherIcon(lake)+temperature(lake)+'</span></span>'+
       '<span class="at-card-lower"><span class="at-fish-mini">'+sample(lake,false)+'</span><span title="Стоимость продажи одной рыбы, включая трофей">'+I('coin')+value.gold+'<small class="at-mini-xp"><em>XP</em>'+value.xp+'</small></span></span>'+
       (list?'':'<span class="at-map-beacon" aria-hidden="true"><i></i></span>')+'</button>';
  }
  function dossier(lake,access) {
    const reason=access(lake)||(activeCast()?'Сначала убери снасть':'');
    const value=estimate(lake),here=lake.id===S.location;
    return '<section class="at-dossier" id="afMapDetails" aria-label="Выбранный водоём">'+
      '<div class="at-dossier-photo">'+photo(lake)+'</div><div class="at-dossier-info"><div class="at-place-line">'+I(here?'pin':lake.boat?'boat':'wave')+'<span>'+(here?'Твой водоём':lake.boat?'Ловля с лодки':'Ловля с берега')+'</span></div>'+
      '<h2>'+esc(lake.name)+'</h2><p>'+esc(lake.desc)+'</p></div>'+
      '<div class="at-dossier-spec"><div class="at-fish-bank"><small>Основные виды рыб</small><div>'+sample(lake,true)+'</div></div>'+
      '<div><small>Сложность</small>'+stars(lake)+'</div><div><small>Погода</small><b title="'+esc(lake.weather)+'">'+weatherIcon(lake)+temperature(lake)+'C</b></div>'+
      '<div class="at-value" title="Диапазон за одну рыбу, включая трофей. Сумма зависит от вида и веса."><small>За улов</small><b>'+I('coin')+value.gold+'</b><b><em>XP</em>'+value.xp+'</b></div></div>'+
      '<div class="at-action">'+(reason?'<span class="at-lock">'+I('lock')+esc(reason)+'</span>':'')+
      '<button type="button" class="at-travel" data-act="travel" data-id="'+lake.id+'" '+(reason?'disabled':'')+'>'+(here?'Ловить здесь':'Выбрать локацию')+' <span aria-hidden="true">›</span></button></div></section>';
  }
  function baits(lake) {
    const fish=localFish(lake);
    return '<details class="at-baits"><summary>'+I('fish')+' Рыба и наживки <span>'+fish.length+'</span></summary><ul>'+fish.map(id=>{
      const f=SPECIES[id],names=f.baits.map(key=>BAITS.find(b=>b.id===key)?.name.split(' «')[0]).filter(Boolean);
      return '<li>'+pic(id,'','')+'<span><b>'+esc(f.name)+'</b><small>'+esc(names.join(' · '))+'</small></span></li>';
    }).join('')+'</ul></details>';
  }
  function map(sel,access) {
    return '<div class="at-stage"><div class="at-portrait" aria-hidden="true"><canvas></canvas></div>'+
      '<section class="af-world-map at-field" aria-label="Карта водоёмов">'+
      '<svg class="at-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g class="at-routes-wide">'+routes(0)+'</g><g class="at-routes-phone">'+routes(1)+'</g></svg>'+
      WORLD.map(l=>card(l,sel,access,false)).join('')+'</section>'+dossier(sel,access)+'</div>';
  }
  function render(sel,mode,access) {
    const list=mode==='list';
    return '<section class="at-water-atlas"><header class="at-toolbar"><div class="at-heading"><span class="at-back-slot"></span><h1>Карта мира</h1><small>Выбор локации</small></div>'+
      '<div class="at-tools"><button type="button" data-nb-go="forest" aria-label="Лесные маршруты" title="Лесные маршруты" class="at-forest">'+I('tree')+'<span>Лесные маршруты</span></button>'+
      '<div class="at-modes" role="group" aria-label="Вид карты"><button data-af32="mapmode" data-id="map" aria-pressed="'+!list+'">'+I('map')+'Карта</button>'+
      '<button data-af32="mapmode" data-id="list" aria-pressed="'+list+'">'+I('book')+'Список</button></div></div></header>'+
      (list?'<section class="at-directory" aria-label="Водоёмы">'+WORLD.map(l=>card(l,sel,access,true)).join('')+'</section>'+dossier(sel,access):map(sel,access))+baits(sel)+'</section>';
  }
  function mount() {
    const atlas=document.querySelector('.at-water-atlas');if(!atlas)return;
    const back=document.querySelector('#v35MenuContent > .nb-breadcrumb .nb-return');
    const slot=atlas.querySelector('.at-back-slot');if(back&&slot)slot.append(back);
    const canvas=atlas.querySelector('.at-portrait canvas');if(!canvas||canvas.dataset.mounted)return;
    canvas.dataset.mounted='1';
    AF35Character.frame(S.profile,{...S.equip,rod:null,reel:null},0).then(frame=>{
      if(!canvas.isConnected)return;
      // Use the actual registered head and clothing; crop empty margins and legs for the map portrait.
      const w=frame.width,h=frame.height;
      canvas.width=w;canvas.height=Math.round(h*.63);
      canvas.getContext('2d').drawImage(frame,0,0);
    }).catch(()=>{});
  }
  return {render,mount};
})();
