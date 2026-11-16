/* The catalogue reads live inventory and delegates every transaction to the game. */
function installShoreMenu() {
  const A=window.AFNext;
  const categories=[
    ['all','Все товары','shop'],['rod','Удилища','rod'],['reel','Катушки','gear'],
    ['rig','Леска и оснастка','rod'],['clothes','Одежда','shirt'],['boots','Обувь','shirt'],
    ['gloves','Перчатки','shirt'],['pack','Рюкзаки','bag'],['boat','Лодки','boat']
  ];
  const tier=['Базовое','Улучшенное','Редкое','Эпическое','Легендарное','Мастерское','Коллекционное'];
  // Metrics compare pieces in their own slot, in the units the fishing engine uses.
  const metrics=[
    ['load','Нагрузка',' кг'],['kg','Нагрузка',' кг'],['range','Дальность',' м'],['sensitivity','Чувствительность',''],
    ['retrieve367','Подмотка','%'],['damping367','Гашение рывка','%'],['hookWindow','Окно подсечки',' с'],
    ['repair367','Экономия на ремонте','%'],['control','Контроль',''],['speed','Клёв','%',100],
    ['luck','Шанс трофея',' п.п.',100],['capacity','Вместимость',' мест']
  ];
  const num=n=>Number(n.toFixed(2)).toLocaleString('ru-RU');
  const tierOf=i=>Math.min(7,Math.max(1,Number(i.grade)||1));
  const gem='<span class="sm-gem" aria-label="Алмазы">◆</span>';
  const moneyIcon=i=>i.currency==='diamonds'?gem:I('coin');
  const cost=i=>moneyIcon(i)+' '+N(i.price||0);
  const fmt=(n,m)=>num(n*(m[3]||1))+m[2];
  let category='all',section='gear',page=0;
  const perPage=12;

  function stats(i) {
    if(i.slot==='boat'){
      const b=AF34.D.boats.find(b=>b.id===i.id);
      return b?[['Скорость',num(b.navSpeed)+' км/ч'],['Вместимость','+'+num(b.capacity)+' мест']]:[];
    }
    return metrics.filter(([key])=>i[key]>0).map(m=>[m[1],fmt(i[m[0]],m)]);
  }
  function matches(i){
    if(category==='all')return true;
    if(category==='clothes')return ['jacket','pants','hat','glasses'].includes(i.slot);
    if(category==='rig')return ['line','hooks','tools'].includes(i.slot);
    return i.slot===category;
  }
  const rodPhotos={rod_reed:'rod-kamysh.webp',kit3_rod:'rod-amethyst.webp',kit5_rod:'rod-ruby.webp'};
  function productImage(i) {
    if(rodPhotos[i.id])return '<img class="sm-rod-detail" src="shore-menu/'+rodPhotos[i.id]+'" alt="'+esc(i.name)+'">';

    const hull=i.slot==='boat'&&AF34.A.boats[i.id]?.src;
    return hull?'<img src="'+esc(hull)+'" alt="'+esc(i.name)+'">':pic(i.art,'',i.name);
  }
  function catalog(){
    const products=ITEMS.filter(i=>!i.registrationOnly && i.art && matches(i) && (section!=='premium'||i.currency==='diamonds'));
    const sorted=products.sort((a,b)=>(a.currency==='diamonds')-(b.currency==='diamonds')||a.price-b.price||a.name.localeCompare(b.name,'ru'));
    if(category!=='all')return sorted;
    const featured=[];
    for(const slot of ['rod','reel','jacket','boots','gloves','pack','boat']){
      const candidates=sorted.filter(i=>i.slot===slot&&i.price>0);
      for(const band of [2,4,6].slice(0,['rod','reel','jacket'].includes(slot)?3:1)){
        const preferred=candidates.find(i=>tierOf(i)>=band&&!featured.includes(i))||candidates.find(i=>!featured.includes(i));
        if(preferred)featured.push(preferred);
      }
    }
    return [...featured,...sorted.filter(i=>!featured.includes(i))];
  }
  function operation(i){
    const owned=S.owned.includes(i.id),equipped=S.equip[i.slot]===i.id;
    if(i.slot==='boat'){
      if(owned)return '<button class="sm-action" data-af34="preview-boat" data-id="'+esc(i.id)+'">'+I('boat')+' Осмотреть</button>';
      if(!free367())return '<button class="sm-action" data-nb-go="property-garages">Расширить эллинг</button>';
      return '<button class="sm-action" data-af34="park-buy" data-id="'+esc(i.id)+'" aria-label="Купить '+esc(i.name)+'">'+cost(i)+' '+I('shop')+'</button>';
    }
    return '<button class="sm-action" data-ncg="'+(owned?'wear':'buy')+'" data-id="'+esc(i.id)+'" '+(equipped?'disabled':'')+' aria-label="'+esc((owned?'Надеть ':'Купить ')+i.name)+'">'+(equipped?'Надето':owned?'Надеть':cost(i)+' '+I('shop'))+'</button>';
  }
  function card(i) {
    const grade=tierOf(i),rows=stats(i).slice(0,2);
    return '<article class="sm-product" data-grade="'+grade+'"><button class="sm-product-open" data-shore-item="'+esc(i.id)+'" aria-label="Характеристики — '+esc(i.name)+'"><div class="sm-art">'+productImage(i)+'</div><div class="sm-product-title"><small>'+esc(SLOTS[i.slot]||labels367[i.slot]||'Снаряжение')+'</small><h3>'+esc(i.name)+'</h3></div><span class="sm-tier">'+tier[grade-1]+'</span></button><div class="sm-specs">'+rows.map(([label,val])=>'<span>'+esc(label)+'<b>'+esc(val)+'</b></span>').join('')+'</div>'+operation(i)+'</article>';
  }
  function compare(i){
    if(!i)return;
    const before=item(S.equip[i.slot]);
    const boat=i.slot==='boat';
    const rows=boat?stats(i).map(([l,v])=>[l,v,'','']):metrics.filter(([k])=>i[k]>0||before?.[k]>0).map(m=>{
      const val=i[m[0]]||0,diff=val-(before?.[m[0]]||0);
      return [m[1],fmt(val,m),before&&diff?(diff>0?'+':'−')+fmt(Math.abs(diff),m):'',diff>0?'gain':'loss'];
    });
    const rigSlots=['rod','reel','line'];
    if(rigSlots.includes(i.slot)){
      const after=Math.min(...rigSlots.map(slot=>{const part=slot===i.slot?i:item(S.equip[slot]);return Number(part?.[slot==='rod'?'load':'kg'])||0;}));
      const limit=careerRig(),change=after-limit;
      rows.push(['Предел собранной снасти',num(after)+' кг',change?(change>0?'+':'−')+num(Math.abs(change))+' кг':'',change>0?'gain':'loss']);
    }
    const wearable=['jacket','pants','hat','glasses','boots','gloves','pack'].includes(i.slot);
    const preview=wearable?'<div class="sm-fit">'+AF35Character.front(S.profile,{...S.equip,[i.slot]:i.id})+'</div>':'';
    openModal(i.name,'<section class="sm-compare"><div class="sm-compare-art">'+(preview||productImage(i))+'</div><div class="sm-compare-data"><span class="sm-tier">'+tier[tierOf(i)-1]+'</span><p>'+esc(i.desc||'')+'</p>'+(before&&before.id!==i.id?'<small>Сейчас выбрано · '+esc(before.name)+'</small>':'')+'<dl>'+rows.map(([l,v,d,c])=>'<div><dt>'+esc(l)+'</dt><dd>'+esc(v)+(d?' <em class="'+c+'">'+esc(d)+'</em>':'')+'</dd></div>').join('')+'</dl></div></section>',operation(i)+'<button class="btn secondary" data-act="close">Закрыть</button>');
  }
  function button(key,label,icon,active,group){
    return '<button type="button" data-shore-'+group+'="'+key+'" aria-pressed="'+active+'" class="'+(active?'active':'')+'">'+I(icon)+'<span>'+label+'</span></button>';
  }
  function sets(){
    const kits=[1,4,7,10,16,22].map(level=>{
      const pieces=ITEMS.filter(i=>i.family==='wear'&&i.collection3621===level);
      if(!pieces.length)return '';
      const coat=pieces.find(i=>i.slot==='jacket')||pieces[0],c=A.wardrobeCollections.rules.collection(level);
      const missing=pieces.filter(i=>!S.owned.includes(i.id)),total=missing.reduce((n,i)=>n+i.price,0);
      return '<article class="sm-product sm-set"><div class="sm-art">'+productImage(coat)+'</div><div class="sm-product-title"><small>Комплект · '+pieces.length+' вещей</small><h3>'+esc(c.name)+'</h3></div><button class="sm-action" data-ncg="'+(missing.length?'buy-set':'wear-set')+'" data-id="'+level+'" aria-label="'+esc((missing.length?'Купить комплект ':'Надеть комплект ')+c.name)+'">'+(missing.length?cost({...coat,price:total}):'Надеть комплект')+'</button></article>';
    }).join('');
    return '<div class="sm-grid">'+kits+'</div><button class="sm-more" data-nb-go="shop-clothes">Все коллекции одежды '+I('shirt')+'</button>';
  }
  function listing(){
    if(section==='sets')return sets();
    const list=catalog(),pages=Math.max(1,Math.ceil(list.length/perPage));page=Math.min(page,pages-1);
    const pager=pages>1?'<div class="sm-pager"><button data-shore-page="-1" '+(page===0?'disabled':'')+' aria-label="Предыдущая страница">‹</button><span>'+ (page+1)+' / '+pages+'</span><button data-shore-page="1" '+(page===pages-1?'disabled':'')+' aria-label="Следующая страница">›</button></div>':'';
    return '<div class="sm-grid">'+list.slice(page*perPage,(page+1)*perPage).map(card).join('')+'</div>'+(list.length?'':'<p>В этой категории пока нет товаров за алмазы.</p>')+pager;
  }
  function storeHTML(){
    return '<section class="sm-store"><header class="sm-mast"><div class="sm-mast-figure" aria-hidden="true"><canvas></canvas></div><div class="sm-brand">'+I('fish')+' Альшкафоне</div><h1>Рыбацкая лавка</h1><div class="sm-hero-wallet">'+I('coin')+' '+N(S.coins)+' <i></i> '+gem+' '+N(S.tokens||0)+'</div></header><nav class="sm-depts" aria-label="Отделы магазина">'+button('gear','Снаряжение','rod',section==='gear','section')+button('premium','Премиум','star',section==='premium','section')+button('sets','Наборы','bag',section==='sets','section')+'<button data-nb-go="shop-bait">'+I('leaf')+' Наживки</button></nav><div class="sm-store-body"><nav class="sm-rail" aria-label="Категории товаров">'+categories.map(([k,l,ic])=>button(k,l,ic,k===category&&section!=='sets','category')).join('')+'<button data-nb-go="shop-decor">'+I('home')+' Для дома</button><button data-nb-go="forestShop">'+I('tree')+' Поход</button></nav><section class="sm-list" aria-label="Товары"><div class="sm-list-head"><h2 tabindex="-1">'+(section==='sets'?'Комплекты':section==='premium'?'За алмазы':categories.find(c=>c[0]===category)[1])+'</h2><button data-nb-go="'+(category==='boat'?'shop-boats':category==='rod'?'shop-rods':['rig','reel'].includes(category)?'shop-tackle':'shop-clothes')+'">'+(category==='boat'?'Лодочный магазин':category==='rod'?'Подбор снастей':['rig','reel'].includes(category)?'Комплекты снастей':'Гардероб и коллекции')+' ›</button></div>'+listing()+'</section></div></section>';
  }
  function mountStoreActor(){
    const canvas=document.querySelector('.sm-mast-figure canvas');
    if(!canvas || canvas.dataset.mount)return;
    canvas.dataset.mount='1';
    AF35Character.frame(S.profile,{...S.equip,rod:null,reel:null},0).then(frame=>{
      if(!canvas.isConnected)return;
      canvas.width=frame.width;canvas.height=frame.height;
      canvas.getContext('2d').drawImage(frame,0,0);
    }).catch(()=>{});
  }
  A.registerPage('base-shop',storeHTML);
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-shore-item],[data-shore-category],[data-shore-section],[data-shore-page]');
    if(!b||b.disabled)return;
    if(b.dataset.shoreItem){compare(item(b.dataset.shoreItem));return;}
    if(b.dataset.shoreSection){section=b.dataset.shoreSection;category='all';page=0;}
    else if(b.dataset.shoreCategory){category=b.dataset.shoreCategory;if(section==='sets')section='gear';page=0;}
    else page=Math.max(0,page+Number(b.dataset.shorePage));
    const old=b.closest('.sm-store'),scroll=document.getElementById('screen');
    if(!old||!scroll)return;
    const top=scroll.scrollTop,selector=b.hasAttribute('data-shore-page')?'.sm-list-head':'[data-shore-'+(b.hasAttribute('data-shore-category')?'category="'+category:'section="'+section)+'"]';
    old.outerHTML=storeHTML();mountStoreActor();scroll.scrollTop=top;
    const focus=scroll.querySelector(selector);
    if(focus){focus.focus({preventScroll:true});if(b.hasAttribute('data-shore-page'))focus.scrollIntoView({block:'start'});}
  });

  A.onRender(()=>{
    const body=document.body;
    if(view==='base-shop')mountStoreActor();
    if(view==='map')LakeAtlas33.mount();
    body.classList.toggle('sm-player',!!S.profile.done);
    body.dataset.shoreView=view;body.dataset.shoreGear=gearTab;
    const panel=document.querySelector('#v35MenuContent');
    if(view==='shop'&&panel&&!panel.querySelector('.sm-return-store')){
      const b=document.createElement('button');b.type='button';b.dataset.nbGo='base-shop';b.className='sm-return-store';b.innerHTML=I('shop')+' Все товары';panel.querySelector('.nb-breadcrumb')?.after(b);
    }
    if(view==='gear'&&gearTab==='equipment'){
      const preview=document.querySelector('#screen .v35-preview');
      if(preview&&!preview.querySelector('.sm-score')){
        const score=document.createElement('div');score.className='sm-score';score.innerHTML=I('trophy')+'<span>Личные очки<b>'+N(personalScore())+'</b></span>';preview.append(score);
          const bonuses=document.createElement('div'),t=totals();bonuses.className='sm-worn-bonuses';
          bonuses.innerHTML='<strong>Бонусы снаряжения</strong><span>Клёв <b>+'+Math.round(t.speed*100)+'%</b></span><span>Контроль <b>'+N(t.control)+'</b></span><span>Садок <b>'+N(t.capacity)+'</b></span>';preview.append(bonuses);
      }
    }
  });
}
