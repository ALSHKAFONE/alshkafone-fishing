/* The maps show the game's live destinations, season and inventory requirements. */
function installTrailMaps36() {
  const A=AFNext, G=AF36, path='shore-menu/trails/';
  const basePlaces={
    forest:[9.7,45,15,19,'Лесные тропы, находки и наблюдения'],
    'base-waters':[90.8,46.2,84,23,'Водоёмы и сезон рыбалки'],
    home:[32,46.2,33,32,'Дом, аквариум и коллекции'],
    'base-shop':[65.3,50.4,75,36,'Снасти, экипировка и наживки'],
    'base-club':[26.3,66.8,25,55,'Жители, задания и турниры'],
    'base-journal':[49,57.7,53,45,'Уловы, фотографии и записи'],
    garage:[78.4,67.1,85,59,'Лодки, моторы и стоянка'],
    fishing:[54.3,86,56,81,'Вернуться к месту ловли']
  };
  const trailPoints={pine:[21,20],birch:[48,21],mixed:[80,18],spruce:[17,48],wet:[47,50],bog:[77,44],meadow:[28,79],island:[74,77]};
  const seasonArt=['forest-spring','forest-summer','forest-autumn','forest-winter'];
  const modes={base:'map',forest:'map'};
  let selected='',lastTrip=null;
  const viewModes=(key)=>'<nav class="tm-switch" aria-label="Вид карты">'+[['map','map','Карта'],['list','book','Список']].map(([id,ico,label])=>'<button type="button" data-tm-mode="'+id+'" data-tm-map="'+key+'" aria-pressed="'+(modes[key]===id)+'">'+I(ico)+'<span>'+label+'</span></button>').join('')+'</nav>';
  const compass='<span class="tm-compass" aria-hidden="true"><i></i></span>';
  function mast(title,key){return '<header class="tm-mast"><div class="tm-mast-name">'+compass+'<h1>'+title+'</h1></div>'+viewModes(key)+'</header>';}
  function stateStyle(x,y,mx=x,my=y){return '--x:'+x+'%;--y:'+y+'%;--mx:'+mx+'%;--my:'+my+'%';}
  function basePins(){
    return A.base.rules.hotspots.map(p=>{
      const [x,y,mx,my,desc]=basePlaces[p.id];
      return '<button type="button" class="tm-base-pin'+(p.id==='fishing'?' tm-pier':'')+'" data-nb-go="'+p.id+'" style="'+stateStyle(x,y,mx,my)+'" title="'+esc(desc)+'"><span class="tm-base-plaque">'+I(p.icon)+'<b>'+esc(p.label)+'</b></span><i aria-hidden="true"></i></button>';
    }).join('');
  }
  function baseList(){
    return A.base.rules.hotspots.map(p=>{
      const [x,y,,,desc]=basePlaces[p.id];
      return '<button type="button" data-nb-go="'+p.id+'" class="tm-place-card"><span class="tm-place-photo" style="--bx:'+x+'%;--by:'+y+'%"></span><span class="tm-place-copy"><strong>'+I(p.icon)+' '+esc(p.label)+'</strong><small>'+esc(desc)+'</small></span><b aria-hidden="true">›</b></button>';
    }).join('');
  }
  function baseView(){
    const winter=A.fishing?.mode?.()==='ice',place=typeof current==='function'?current().name:'Водоём';
    const trips=A.outings?.trips?.()||[];
    const paused=activeCast()?'<section class="nb-resume-card" id="nbResumeCast"><div><b>Заброс на паузе</b></div><button class="btn" data-nb-act="resume">'+I('rod')+' Продолжить ловлю</button></section>':'';
    return '<section class="tm-page tm-base" aria-label="Карта рыбацкой базы">'+paused+mast('Рыбацкая база','base')+'<div class="tm-base-stage tm-stage"'+(modes.base==='map'?'':' hidden')+'><div class="tm-base-plane tm-plane"><picture><source media="(max-width:600px)" srcset="'+path+'base-phone.webp"><img src="'+path+'base.webp" alt="Деревянная база на берегу озера, от лесной арки до рыболовного причала" fetchpriority="high"></picture>'+basePins()+'</div></div><div class="tm-place-list"'+(modes.base==='list'?'':' hidden')+'>'+baseList()+'</div><footer class="tm-base-foot"><span class="tm-location-icon">'+I(winter?'snow':'rod')+'</span><div class="tm-current"><small>'+(winter?'Зимняя рыбалка':'Текущее место ловли')+'</small><strong>'+esc(place)+'</strong></div><div class="tm-foot-actions">'+(trips.length?'<button type="button" data-nb-go="outing-album">'+I('book')+' Последние выезды</button>':'')+'<button type="button" data-nb-go="map">'+I('map')+' Карта водоёмов</button></div></footer></section>';
  }
  const candidates=id=>G.D.species.filter(s=>!s.fee&&G.available(s,id));
  const animals=id=>G.D.animals.filter(a=>a.biomes.includes(id));
  const chosen=()=>G.D.biomes.find(b=>b.id===selected)||G.D.biomes[0];
  function forestButton(b,layout){
    const map=layout==='pin',isSelected=b.id===selected,trip=G.state().trip;
    const locked=!!G.entryReason(b)&&trip?.biome!==b.id;
    const [x,y]=trailPoints[b.id];
    const glyph=locked?'lock':trip?.biome===b.id?'pin':b.id==='island'?'boat':'tree';
    return '<button type="button" data-tm-route="'+b.id+'" aria-pressed="'+isSelected+'" aria-label="'+esc(b.name+(locked?' — условия входа':''))+'" class="tm-trail-'+layout+'" style="'+stateStyle(x,y)+'"><span class="tm-trail-picture"><img src="'+esc(G.scene(b.id))+'" alt="" loading="'+(map?'eager':'lazy')+'"></span><span class="tm-trail-name">'+I(glyph)+'<strong>'+esc(b.name)+'</strong></span>'+(map?'<i class="tm-tack" aria-hidden="true"></i>':'<small>'+esc(b.desc)+'</small>')+'</button>';
  }
  function samples(rows,art){
    return rows.map(r=>'<span class="tm-sample">'+G.photo(art(r),'',r.name)+'<span>'+esc(r.name)+'</span></span>').join('');
  }
  function routeGuide(finds,wild) {
    function catalogue(title,rows,art){
      if(!rows.length)return '';
      return '<section><h3>'+title+'</h3><div class="tm-guide-items">'+samples(rows,art)+'</div></section>';
    }
    return '<details class="tm-guide"><summary>'+I('book')+' Что встречается на маршруте</summary><div class="tm-guide-body">'+catalogue('Находки в этом сезоне',finds,s=>s.art)+catalogue('Животные для фотоальбома',wild,a=>G.animalArt(a))+'</div></details>';
  }
  function details(b){
    const trip=G.state().trip,here=trip?.biome===b.id,reason=here?'':G.entryReason(b),finds=candidates(b.id),wild=animals(b.id);
    const mushroom=finds.find(s=>s.kind==='mushroom'),berry=finds.find(s=>s.kind==='berry');
    const picks=[...new Set([mushroom,berry,...finds].filter(Boolean))].slice(0,2);
    const preview=picks.length?samples(picks,s=>s.art):samples(wild.slice(0,2),a=>G.animalArt(a));
    const action=G.button(here?'resume':'start',here?'':b.id,here?'Продолжить выход':'На маршрут','tm-go',!!reason);
    return '<div class="tm-trail-detail"><img class="tm-detail-scene" src="'+esc(G.scene(b.id))+'" alt=""><div class="tm-detail-title"><small>'+I('tree')+' '+b.stops+' участков'+(here?' · Сейчас на участке '+(trip.stop+1):'')+'</small><h2>'+esc(b.name)+'</h2><p>'+esc(b.desc)+'</p></div><div class="tm-finds"><small>'+(picks.length?'Сезонные находки':'Можно сфотографировать')+'</small><div>'+preview+'</div></div><div class="tm-start">'+(reason?'<span>'+I('lock')+' '+esc(reason)+'</span>':'')+action+'</div></div>'+routeGuide(finds,wild);
  }
  function forestNav(){
    const items=[['forest','tree','Маршруты'],['forestShop','shop','Лавка'],['forestMarket','bag','Корзина'],['forestAtlas','book','Атлас'],['forestAlbum','camera','Фотоальбом']];
    return '<nav class="tm-forest-nav" aria-label="Разделы леса">'+items.map(([id,ico,label])=>'<button type="button" data-nb-go="'+id+'" aria-current="'+(view===id?'page':'false')+'">'+I(ico)+' '+label+'</button>').join('')+'</nav>';
  }
  function forestView(){
    conditions=routeConditions();
    const trip=G.state().trip;
    if(trip&&lastTrip!==trip.id){selected=trip.biome;lastTrip=trip.id;}
    if(!trip)lastTrip=null;
    selected=chosen().id;
    const biomes=G.D.biomes;
    const camp='<section class="tm-camp"><div><h2>'+I('tree')+' Лесной лагерь</h2>'+G.summary()+'</div><div class="tm-camp-actions">'+G.button('food','','Перекусить')+G.button('rest','','Отдохнуть бесплатно')+G.button('sleep','1','Пропустить день')+G.button('open','shore','К берегу')+(trip?G.button('resume','','Продолжить выход')+G.button('finish','','Завершить выход','ghost'):'')+'</div></section>';
    return '<section class="tm-page tm-forest" aria-label="Карта лесных маршрутов">'+mast('Лесные маршруты','forest')+'<div class="tm-forest-tools">'+forestNav()+'<span class="tm-weather">'+esc(G.D.seasons[G.season()])+' · День '+G.seasonDay()+' <i></i> '+esc(G.weather().name)+'</span></div><div class="tm-forest-stage tm-stage"'+(modes.forest==='map'?'':' hidden')+'><div class="tm-forest-plane tm-plane"><img class="tm-landscape" src="'+path+seasonArt[G.season()]+'.webp" alt="Карта восьми лесных маршрутов" fetchpriority="high">'+biomes.map(b=>forestButton(b,'pin')).join('')+'</div></div><div class="tm-trail-list"'+(modes.forest==='list'?'':' hidden')+'>'+biomes.map(b=>forestButton(b,'card')).join('')+'</div><div class="tm-selection" aria-live="polite">'+details(chosen())+'</div>'+camp+G.testPanel()+'</section>';
  }
  function replaceModes(page,key,mode) {
    modes[key]=mode;
    page.querySelectorAll('[data-tm-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tmMode===mode)));
    page.querySelector('.tm-stage').hidden=mode!=='map';
    page.querySelector(key==='base'?'.tm-place-list':'.tm-trail-list').hidden=mode!=='list';
  }
  // A day can advance while the map is open without a navigation event.
  let checkedSecond=-1,conditions='';
  function routeConditions(){return [G.state().day,G.state().energy<10,G.state().trip?.id||0].join('/');}
  A.onTick(()=>{
    if(view!=='forest')return;
    const second=Math.floor(G.state().activeSeconds);
    if(checkedSecond===second)return;
    checkedSecond=second;
    const now=routeConditions();
    if(conditions&&conditions!==now){conditions=now;render();}
  });
  A.registerPage('base',baseView);
  G.hubHTML=forestView;
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-tm-mode],[data-tm-route]');if(!button)return;
    const page=button.closest('.tm-page');if(!page)return;
    if(button.dataset.tmMode){replaceModes(page,button.dataset.tmMap,button.dataset.tmMode);return;}
    const b=G.D.biomes.find(b=>b.id===button.dataset.tmRoute);if(!b)return;
    selected=b.id;page.querySelectorAll('[data-tm-route]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.tmRoute===selected)));
    page.querySelector('.tm-selection').innerHTML=details(b);
    if(modes.forest==='list'&&innerWidth<650)page.querySelector('.tm-selection').scrollIntoView({block:'nearest'});
  });
  A.on('state-replaced',()=>{selected='';lastTrip=null;});
  A.onRender(()=>{
    if(!['forestShop','forestMarket','forestAtlas','forestAlbum'].includes(view))return;
    const panel=document.getElementById('v35MenuContent');
    if(!panel||panel.querySelector('.tm-forest-nav'))return;
    const tabs=panel.querySelector('.f36-tabs');
    if(tabs)tabs.outerHTML=forestNav();
  });
}
