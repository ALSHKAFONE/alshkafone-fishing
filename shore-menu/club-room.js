/* The noticeboard reads the same saved orders as the outing and resident screens. */
function installClubRoom37() {
  const A=window.AFNext;
  const artRoot='shore-menu/club/';
  const links={
    'outing-orders': {title:'Заказы жителей', text:'Посмотри условия и выбери заказ.', art:'orders'},
    'outing-goal': {title:'Цель выезда', text:'Выбери рыбу, за которой отправишься.', art:'goal'},
    'water-challenges': {title:'Испытания выезда', text:'Пройди испытание за одну поездку.', art:'trials'},
    stories: {title:'Жители и истории', text:'Познакомься с рыбаками и возьми поручение.'},
    competitions: {title:'Соревнования', text:'Попробуй свои силы на одинаковых снастях.', art:'match'},
    club: {title:'Рыбацкий клуб', text:'Клубные встречи, общий альбом и переписка.', art:'club-lodge-phone'}
  };
  function link(id,caption) {
    const row=links[id];
    const photo=row.art?'<img class="cr37-photo" src="'+artRoot+row.art+'.webp" alt="">':A.menuArt.html(id,'cr37-resident');
    return '<button class="cr37-link" type="button" data-nb-go="'+id+'">'+photo+'<span class="cr37-link-copy"><strong>'+row.title+'</strong><span>'+esc(caption||row.text)+'</span></span><span class="cr37-arrow" aria-hidden="true">›</span></button>';
  }
  function board(group,title,icon,items) {
    return '<section class="cr37-board cr37-'+group+'"><header>'+I(icon)+'<h2>'+title+'</h2></header><div>'+items.join('')+'</div></section>';
  }
  function hub() {
    const outings=A.outings,orders=outings.state().orders,defs=outings.model.ORDERS;
    const ongoing=defs.filter(d=>orders[d.id].accepted&&!orders[d.id].claimed);
    const ready=ongoing.find(d=>outings.model.orderProgress(d,orders[d.id],S.bag)>=d.target);
    const finished=defs.filter(d=>orders[d.id].claimed).length;
    const g=outings.goal(),trial=A.waters.state().challenge;
    const orderText=ready?'Можно получить награду за заказ «'+ready.name+'».':ongoing.length?'В работе: '+ongoing.map(d=>'«'+d.name+'»').join(', '):finished===defs.length?'Все заказы выполнены.':links['outing-orders'].text;
    const goalText=g?(g.status==='done'?'Цель достигнута. ':'')+outings.model.goalTitle(g,SPECIES):'Первый улов, новый рекорд или рыбалка со льда.';
    const trialText=trial?A.waters.model.challenge(trial.kind).name+' · '+(trial.status==='done'?'выполнено':trial.progress+' из '+A.waters.model.challenge(trial.kind).target):null;
    return '<section class="cr37-hub"><header class="cr37-hero"><picture><source media="(max-width:600px)" srcset="'+artRoot+'club-lodge-phone.webp"><img src="'+artRoot+'club-lodge.webp" alt="Деревянный клуб на причале. В раскрытом окне видны лодки и вечернее озеро."></picture><div><span class="cr37-emblem" aria-hidden="true">'+I('fish')+'</span><h1>Клуб у озера</h1><p>Заказы и рассказы местных рыбаков</p></div></header><div class="cr37-boards">'+
      board('tasks','Доска заданий','book',[link('outing-orders',orderText),link('outing-goal',goalText),link('water-challenges',trialText)])+
      board('people','Клубная жизнь','person',[link('stories'),link('competitions'),link('club')])+'</div></section>';
  }
  function readingKey() {
    if(view==='outings')return ({orders:'outing-orders',goal:'outing-goal'})[A.outings.activeTab()]||'';
    if(view==='waters')return A.waters.activeTab()==='challenges'?'water-challenges':'';
    return ['base-club','stories','club','competitions','expeditions','journal'].includes(view)?view:'';
  }
  const headings={
    'outing-orders':['Заказы жителей','Заказы можно выполнять в своём темпе.'],
    'outing-goal':['Цель выезда','Выбери вид рыбы и условие следующего улова.'],
    'water-challenges':['Испытания выезда','Выбери испытание до первого заброса.'],
    stories:['Жители и истории','Поговори с жителями, чтобы услышать их истории и взять поручение.'],
    competitions:['Соревнования','У каждого участника одинаковые снасти.'],
    club:['Рыбацкий клуб','Общие выезды, задания и фотографии участников.']
  };
  function decorate() {
    const key=readingKey();
    if(!key){delete document.body.dataset.clubReading;return;}
    document.body.dataset.clubReading=key;
    const main=document.getElementById('screen');
    if(key==='base-club'||!main)return;
    const h1=main.querySelector('h1'),head=h1?.closest('.section-heading');
    if(!head)return;
    head.classList.add('cr37-reading-head');
    if(headings[key]){
      h1.textContent=headings[key][0];
      const p=h1.parentElement.querySelector('p');if(p)p.textContent=headings[key][1];
    }
  }
  A.registerPage('base-club',hub);
  A.onRender(decorate);
}

function clubOrderCard37(d,order,progress,portrait,action) {
  const numeric=order.claimed?d.target:Math.max(0,Math.min(progress,d.target));
  const ready=order.accepted&&numeric>=d.target;
  const status=order.claimed?'Награда получена':ready?'Можно сдать':order.accepted?'В работе':'Можно принять';
  const reward='<details class="cr37-reward"><summary>'+I('trophy')+' Награда <b>+'+d.xp+' к опыту и приз на выбор</b></summary><p>Вместе с опытом ты получишь один приз на выбор.</p><ul><li>'+d.gold+' золота</li><li>8 червей и 6 мотылей</li><li>'+esc(d.souvenir)+'</li></ul></details>';
  return '<article class="cr37-order"><header><img alt="" src="'+esc(portrait)+'"><div><span>'+esc(d.person)+'</span><h2>'+esc(d.name)+'</h2></div></header><div class="cr37-order-copy"><p>'+esc(d.text)+'</p><div class="cr37-status"><span>'+status+'</span><b>'+numeric+' из '+d.target+'</b></div><progress aria-label="Выполнение заказа" max="'+d.target+'" value="'+numeric+'"></progress>'+reward+'</div><footer>'+action+'</footer></article>';
}
