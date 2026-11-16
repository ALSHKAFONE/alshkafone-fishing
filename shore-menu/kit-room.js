/* Character cabinet and bait counter. Actions and values come from the live game. */
function installFishingCabinet35() {
  const slots = ['jacket','hat','pants','glasses','boots','gloves','pack','rod','boat'];
  const rig = ['hooks','line','tools','reel'];
  const labels = {jacket:'Куртка',hat:'Кепка',pants:'Брюки',glasses:'Очки',boots:'Сапоги',gloves:'Перчатки',pack:'Рюкзак',rod:'Удилище',boat:'Лодка',hooks:'Крючки',line:'Леска',tools:'Инструменты',reel:'Катушка'};
  const first = {jacket:'jacket_classic',hat:'hat_basic',pants:'pants_basic',glasses:'suit0_glasses',boots:'boots_basic',gloves:'gloves_basic',pack:'pack_basic',rod:'rod_classic',reel:'reel_classic',line:'line_basic',hooks:'hooks_basic',tools:'tools_basic'};
  const trayGroups = {all:'Всё',lures:'Приманки',bait:'Наживки',hooks:'Крючки',line:'Леска',tools:'Инструменты',reel:'Катушки'};
  const shopGroups = {all:'Все',bait:'Наживки',lures:'Приманки'};
  let trayGroup='all',shopGroup='all';
  const el=(tag,cls)=>Object.assign(document.createElement(tag),{className:cls});
  const photo=(path,label='')=>'<img src="shore-menu/'+path+'.webp" alt="'+esc(label)+'" draggable="false">';
  function baitPhoto(b) {
    const color=b.reusable?S.next?.wardrobeCollections?.lureColor:'original';
    return '<span class="k35-photo color-'+(color==='rose'||color==='pearl'?color:'original')+'">'+photo('baits/'+b.id,b.name)+'</span>';
  }
  function itemPhoto(slot,i) {
    if(slot==='boat'){
      const hull=AF34.A.boats[i?.id||'boat_wood']?.src;
      return hull?'<img src="'+esc(hull)+'" alt="'+esc(i?.name||'')+'">':i?pic(i.art,'',i.name):'';
    }
    return !i||first[slot]===i.id?photo('kit/'+slot,i?.name||''):pic(i.art,'',i.name);
  }
  const filterButtons=(groups,chosen,key)=>Object.entries(groups).map(([id,label])=>'<button type="button" data-k35-'+key+'="'+id+'" aria-pressed="'+(chosen===id)+'">'+label+'</button>').join('');
  function facts(i){return (effects(i)||'').split(' · ').filter(Boolean);}
  function factLine(text){
    const parts=text.match(/^(.+?)\s+([+−-]?\d.*)$/);
    return parts?'<span><i>'+esc(parts[1])+'</i><b>'+esc(parts[2].replace(/(\d)\.(\d)/g,'$1,$2'))+'</b></span>':'<span>'+esc(text)+'</span>';
  }
  function card(slot){
    const i=item(S.equip[slot]),label=labels[slot],name=i?i.name:'Не экипировано';
    const lines=i?facts(i):[];
    const boat=slot==='boat';
    return '<button type="button" data-act="choose-slot" data-id="'+slot+'" aria-label="'+esc(label+' — '+name+'. Выбрать')+'" class="k35-slot'+(i?'':' empty')+(boat?' k35-boat':'')+'"><span class="k35-product-image">'+itemPhoto(slot,i)+'</span><span class="k35-slot-copy"><small>'+label+'</small><strong>'+esc(i?i.name:boat?'Выбрать лодку':'Свободный слот')+'</strong>'+(i?'<span class="k35-stars" aria-label="Звёзд: '+Number(i.grade||1)+'">'+'★'.repeat(Math.min(7,i.grade||1))+'</span>':'')+'<span class="k35-facts">'+(i?lines.map(factLine).join(''):'<span>'+ (boat?'Перейти к лодкам':'Выбрать '+({hat:'кепку',glasses:'очки'}[slot]||'предмет')) +' ›</span>')+'</span></span></button>';
  }
  function tray(){
    const ownedBaits=BAITS.filter(b=>hasBait(b.id));
    const ownedRig=S.owned.map(item).filter(i=>i&&rig.includes(i.slot));
    const bTile=b=>'<button type="button" class="k35-tile" data-act="bait-equip" data-id="'+b.id+'"><span class="k35-tile-art">'+baitPhoto(b)+'<b>×'+N(S.baits[b.id]||0)+'</b></span><strong>'+esc(b.name)+'</strong><small>'+(S.bait===b.id?'На крючке':b.reusable?'Приманка':'Наживка')+'</small></button>';
    const gTile=i=>'<button type="button" class="k35-tile" data-act="'+(S.equip[i.slot]===i.id?'choose-slot':'equip')+'" data-id="'+esc(S.equip[i.slot]===i.id?i.slot:i.id)+'"><span class="k35-tile-art">'+itemPhoto(i.slot,i)+'</span><strong>'+esc(i.name)+'</strong><small>'+esc(facts(i)[0]||labels[i.slot])+'</small></button>';
    let tiles=[];
    if(trayGroup==='all'){
      const firstBait=ownedBaits.find(b=>!b.reusable),firstLure=ownedBaits.find(b=>b.reusable);
      const featured=[firstBait,firstLure].filter(Boolean);
      const equipped=rig.map(s=>ownedRig.find(i=>i.id===S.equip[s])).filter(Boolean);
      tiles=[...featured.map(bTile),...equipped.map(gTile),...ownedBaits.filter(b=>!featured.includes(b)).map(bTile),...ownedRig.filter(i=>!equipped.includes(i)).map(gTile)];
    }else if(trayGroup==='bait'||trayGroup==='lures')tiles=ownedBaits.filter(b=>!!b.reusable===(trayGroup==='lures')).map(bTile);
    else tiles=ownedRig.filter(i=>i.slot===trayGroup).map(gTile);
    return '<header class="k35-bar"><h2>'+I('bag')+' Такелажный инвентарь</h2><button data-act="gear-tab" data-id="inventory">Весь инвентарь ›</button></header><nav class="k35-filters" aria-label="Фильтр снастей">'+filterButtons(trayGroups,trayGroup,'tray')+'</nav><div class="k35-track" tabindex="0" aria-label="Предметы в рюкзаке">'+(tiles.join('')||'<div class="k35-empty">Пока пусто. <button data-nb-go="'+(trayGroup==='lures'||trayGroup==='bait'?'shop-bait':'shop-tackle')+'">Открыть магазин ›</button></div>')+'</div>';
  }
  function mountGear(root,panel) {
    if(root.classList.contains('k35-cabinet'))return;
    const gear=panel.querySelector('.equipment-panel'),stage=root.querySelector('.v35-preview');
    if(!gear||!stage)return;
    root.classList.add('k35-cabinet');
    const crumb=panel.querySelector('.nb-breadcrumb');
    if(crumb){crumb.classList.add('k35-crumb');root.before(crumb);}
    const tabs=panel.querySelector('.main-gear-tabs');
    const stats=totals();
    const stageInfo=el('div','k35-player-info');
    stageInfo.innerHTML='<div class="k35-score">'+I('trophy')+'<small>Личные очки</small><strong>'+N(personalScore())+'</strong></div><div class="k35-totals"><b>Бонусы снаряжения</b>'+[['Клёв','+'+Math.round(stats.speed*100)+'%'],['Контроль',N(stats.control)],['Шанс трофея','+'+Number((stats.luck*100).toFixed(1)).toLocaleString('ru-RU')+' п.п.'],['Садок',N(stats.capacity)]].map(([k,v])=>'<span>'+k+' <em>'+v+'</em></span>').join('')+'</div>';
    stage.append(stageInfo);
    const actions=el('div','k35-stage-actions');
    actions.innerHTML='<button type="button" data-ncx="inspect">Рассмотреть</button><button type="button" data-ncg="wardrobe">Сменить одежду</button>';stage.append(actions);
    const deck=el('section','k35-deck');
    deck.innerHTML='<header class="k35-bar"><h1>'+I('shirt')+' Снаряжение</h1><span>Основной набор</span></header><div class="k35-grid">'+slots.map(card).join('')+'</div>';
    const bottom=el('div','k35-bottom'),box=el('section','k35-inventory');box.innerHTML=tray();
    const storage=panel.querySelector('.catch-storage');bottom.append(box);
    if(storage){storage.classList.add('k35-catch');storage.querySelector('h2').innerHTML=I('fish')+' Хранилище улова';bottom.append(storage);}
    const extra=el('details','k35-extra'),summary=document.createElement('summary');summary.textContent='Снаряжение и обмен';extra.append(summary);
    for(const extraPanel of panel.querySelectorAll('.af33-resale,.v34-link-panel'))if(extraPanel.textContent.trim())extra.append(extraPanel);
    panel.replaceChildren(...(tabs?[tabs]:[]),deck);
    root.append(bottom,extra);
  }
  function updateBaitFilter(root){
    root.querySelectorAll('[data-k35-family]').forEach(c=>c.hidden=shopGroup!=='all'&&c.dataset.k35Family!==shopGroup);
  }
  function mountBaits(root,panel){
    if(root.classList.contains('k35-counter'))return;
    const goods=[...panel.querySelectorAll('button[data-act="buy-bait"]')];
    if(!goods.length)return;
    root.classList.add('k35-counter');
    const grid=goods[0].closest('.product-card').parentElement;grid.classList.add('k35-market');
    for(const buy of goods){
      const b=bait(buy.dataset.id),c=buy.closest('.product-card');
      const fish=(c.querySelector('.muted')?.textContent||'').replace(/^Предпочитают:\s*/,'').split(', ').filter(Boolean);
      const sell=c.querySelector('[data-af34="sell-bait"]');
      c.className='k35-bait';c.dataset.k35Family=b.reusable?'lures':'bait';
      c.innerHTML='<div class="k35-bait-art">'+baitPhoto(b)+'<b aria-label="В запасе '+N(S.baits[b.id]||0)+'">×'+N(S.baits[b.id]||0)+'</b></div><div class="k35-bait-body"><small>'+(b.reusable?'Искусственная приманка':'Наживка')+'</small><h3>'+esc(b.name)+'</h3><p class="k35-use">'+(b.reusable?'Многоразовая · теряется при обрыве':'1 шт. на заброс')+'</p><details><summary>Кто клюёт <b>'+fish.length+'</b></summary><p>'+esc(fish.join(', '))+'</p><p>'+esc(b.desc)+'</p></details></div>';
      const foot=el('div','k35-bait-buy');buy.setAttribute('aria-label','Купить '+b.name+', '+b.pack+' шт. за '+b.price+' золота');buy.innerHTML=I('coin')+' '+N(b.price)+' <span>· '+b.pack+' шт.</span>';foot.append(buy);if(sell)foot.append(sell);c.append(foot);
    }
    const mast=el('header','k35-counter-head');mast.innerHTML='<span>'+I('shop')+' Рыбацкая лавка</span><h1>Наживки и приманки</h1>';
    const tools=el('div','k35-market-tools');tools.innerHTML='<nav class="k35-filters" aria-label="Категории наживок">'+filterButtons(shopGroups,shopGroup,'shop')+'</nav>';
    const swatches=panel.querySelector('.ncg-lure-color');
    if(swatches){const d=el('details','k35-colors');d.innerHTML='<summary>Цвет приманок</summary>';d.append(swatches);tools.append(d);}
    const crumb=panel.querySelector('.nb-breadcrumb');if(crumb){crumb.classList.add('k35-crumb');root.before(crumb);}
    const nav=panel.querySelector('[data-act="shop-tab"]')?.parentElement;
    panel.insertBefore(mast,panel.firstChild);
    if(nav){nav.classList.add('k35-shop-nav');mast.after(nav);}
    grid.before(tools);
    // Place auxiliary shop destinations together, below the working sales counter.
    const more=el('details','k35-extra');more.innerHTML='<summary>Другие отделы магазина</summary>';
    for(const child of [...panel.children]){
      if([mast,nav,tools,grid].includes(child)||child.contains(grid)||child.matches('.v34-groundbait'))continue;
      if(child.matches('.section-heading,.ui361-hero-toggle'))child.remove();
      else if(child.querySelector('button')||child.matches('button'))more.append(child);
    }
    panel.append(more);updateBaitFilter(root);
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-k35-tray],[data-k35-shop]');if(!b)return;
    if(b.hasAttribute('data-k35-tray')){
      trayGroup=b.dataset.k35Tray;const box=b.closest('.k35-inventory');box.innerHTML=tray();
      box.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
    }else{
      shopGroup=b.dataset.k35Shop;b.parentElement.querySelectorAll('button').forEach(bt=>bt.setAttribute('aria-pressed',String(bt===b)));
      updateBaitFilter(b.closest('.k35-counter'));
    }
  });
  AFNext.onRender(()=>{
    const panel=document.querySelector('#v35MenuContent'),root=panel?.closest('.v35-menu-layout');
    if(!root)return;
    if(view==='gear'&&gearTab==='equipment')mountGear(root,panel);
    else if(view==='shop'&&shopTab==='bait')mountBaits(root,panel);
    else if(view==='gear'&&gearTab==='inventory'){
      for(const btn of panel.querySelectorAll('.inv-tile[data-act="bait-equip"]')){
        const art=btn.querySelector('.inv-art'),b=bait(btn.dataset.id);if(!art||!b||art.querySelector('.k35-photo'))continue;
        art.querySelector('img')?.remove();art.insertAdjacentHTML('afterbegin',baitPhoto(b));
        const qty=art.querySelector('.quantity');if(qty)qty.textContent='×'+N(S.baits[b.id]||0);
      }
    }
  });
}
