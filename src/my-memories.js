/* Luqyak - "ذكرياتي": only photos I uploaded, then rectangular meeting albums.
   UI never caches private image bytes, all access controlled by the existing photo API. */
export function mountMyMemories(root, options) {
  const {api,meetups,onOpenMeetup}=options;
  if(!root)return;
  let destroyed=false,photos=[],page=0,selected='all',albumPhotos=[],lastReq=0;
  const perPage=6;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const albums=meetups.filter(x=>!x.isInvited&&(x.ended||x.photoCount>0||x.photos?.length)).sort((a,b)=>new Date(b.time)-new Date(a.time));
  const urlPhoto=(m,p)=>'/api/social/photo?id='+encodeURIComponent(m)+'&photo='+encodeURIComponent(p);
  root.innerHTML='<section class="lk-my-header"><h1>ذكرياتي</h1><p>اللحظات التي وثّقتها بعدستي</p></section><div class="lk-my-title"><strong>صوري</strong><span id="lkMyCounter">جارٍ التحميل...</span></div><div class="lk-my-track" id="lkMyTrack" aria-live="polite"></div><div class="lk-my-pagination" id="lkMyPager"></div><div class="lk-my-bottom"><h2>ألبومات اللقاءات</h2><div class="lk-my-albums" id="lkMyAlbums" role="group" aria-label="ألبومات اللقاءات"></div><div id="lkMyAlbumContent"></div></div><section class="lk-my-outbox"><span id="photoOutboxCount">التحقق من الصور المعلقة...</span><button type="button" class="secondary" id="retryPhotoOutbox">إعادة إرسال الصور</button></section>';
  const grid=document.getElementById('lkMyTrack'),pager=document.getElementById('lkMyPager'),counter=document.getElementById('lkMyCounter'),tabRoot=document.getElementById('lkMyAlbums'),albumRoot=document.getElementById('lkMyAlbumContent');
  const pages=()=>Math.ceil(photos.length/perPage);
  const safe=()=>!destroyed&&root.isConnected;
  function imageButton(p,index,group) {
    const button=document.createElement('button');button.type='button';button.className='lk-my-photo';button.setAttribute('aria-label','فتح الصورة من '+(p.title||'لقاء'));button.dataset.photoId=p.id;
    const img=document.createElement('img');img.src=urlPhoto(p.meetup_id,p.id);img.alt='صورة من '+(p.title||'اللقاء');img.loading='lazy';button.append(img);
    button.onclick=()=>openViewer(group,index);return button;
  }
  function showPage(){
    if(!safe())return;
    const total=pages();page=Math.max(0,Math.min(page,Math.max(0,total-1)));
    counter.textContent=total?'المجموعة '+(page+1)+' من '+total:'لا توجد صور بعد';
    grid.replaceChildren();
    const set=photos.slice(page*perPage,(page+1)*perPage);
    if(!set.length){const empty=document.createElement('p');empty.className='lk-my-empty';empty.textContent='الصور التي تضيفها بنفسك إلى اللقاءات ستظهر هنا تلقائيًا.';grid.append(empty)}
    else {const list=document.createElement('div');list.className='lk-my-grid';set.forEach((p,i)=>list.append(imageButton(p,page*perPage+i,photos)));grid.append(list)}
    pager.replaceChildren();
    if(total>1){
      const prev=document.createElement('button');prev.type='button';prev.textContent='‹';prev.setAttribute('aria-label','المجموعة السابقة');prev.onclick=()=>{page=(page-1+total)%total;showPage()};
      const dots=document.createElement('span');dots.className='lk-my-dots';
      for(let i=0;i<total;i++){const dot=document.createElement('button');dot.type='button';dot.className=i===page?'is-active':'';dot.setAttribute('aria-label','المجموعة '+(i+1));dot.setAttribute('aria-current',i===page?'page':'false');dot.onclick=()=>{page=i;showPage()};dots.append(dot)}
      const next=document.createElement('button');next.type='button';next.textContent='›';next.setAttribute('aria-label','المجموعة التالية');next.onclick=()=>{page=(page+1)%total;showPage()};
      pager.append(prev,dots,next)
    }
  }
  let touchStart=null;
  grid.addEventListener('touchstart',e=>{if(e.touches.length===1)touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});
  grid.addEventListener('touchend',e=>{if(!touchStart||!e.changedTouches.length||pages()<2)return;const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;touchStart=null;if(Math.abs(dx)<45||Math.abs(dx)<Math.abs(dy)*1.25)return;page=(page+(dx<0?1:-1)+pages())%pages();showPage()},{passive:true});
  grid.addEventListener('keydown',e=>{if(pages()<2)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();page=(page+(e.key==='ArrowLeft'?1:-1)+pages())%pages();showPage()}});
  async function renderAlbums(){
    if(!safe())return;
    tabRoot.replaceChildren();albumRoot.replaceChildren();
    const choices=[{id:'all',title:'جميع اللقاءات'},...albums.map(m=>({id:m.id,title:m.title}))];
    for(const a of choices){const b=document.createElement('button');b.type='button';b.className='lk-my-album-tab'+(a.id===selected?' is-active':'');b.textContent=a.title;b.onclick=()=>{selected=a.id;renderAlbums()};tabRoot.append(b)}
    if(!albums.length){albumRoot.innerHTML='<p class="lk-my-empty">ألبومات اللقاءات التي شاركت فيها ستظهر هنا.</p>';return}
    if(selected==='all'){
      const list=document.createElement('div');list.className='lk-my-album-list';
      for(const m of albums){const b=document.createElement('button');b.type='button';b.className='lk-my-album-card';const im=document.createElement('span');im.className='lk-my-album-cover';if(m.photos?.[0]){const img=document.createElement('img');img.src=urlPhoto(m.id,m.photos[0].id);img.alt='غلاف '+m.title;img.loading='lazy';im.append(img)}else im.textContent='▧';const content=document.createElement('span');content.className='lk-my-album-label';const title=document.createElement('strong');title.textContent=m.title;const count=document.createElement('small');count.textContent=(m.photoCount||0)+' صور';content.append(title,count);b.append(im,content);b.onclick=()=>{selected=m.id;renderAlbums()};list.append(b)}
      albumRoot.append(list);return;
    }
    const m=albums.find(a=>a.id===selected);if(!m){selected='all';renderAlbums();return}
    const header=document.createElement('div');header.className='lk-my-album-heading';
    const title=document.createElement('strong');title.textContent=m.title;
    const open=document.createElement('button');open.className='secondary';open.type='button';open.textContent='فتح اللقاء';open.onclick=()=>onOpenMeetup(m.id);
    header.append(title,open);albumRoot.append(header);
    const loading=document.createElement('p');loading.className='lk-my-empty';loading.textContent='جارٍ عرض صور اللقاء...';albumRoot.append(loading);
    const req=++lastReq;
    try{
      const result=await api('/api/social/meetup?id='+encodeURIComponent(m.id));
      if(!safe()||selected!==m.id||req!==lastReq)return;
      albumPhotos=(result.item?.photos||[]).map(p=>({...p,meetup_id:m.id,title:m.title}));
      loading.remove();
      if(!albumPhotos.length){albumRoot.insertAdjacentHTML('beforeend','<p class="lk-my-empty">لم تُضف صور لهذا اللقاء بعد.</p>');return}
      const list=document.createElement('div');list.className='lk-my-grid';albumPhotos.forEach((p,i)=>list.append(imageButton(p,i,albumPhotos)));albumRoot.append(list)
    }catch(e){if(safe()&&selected===m.id)loading.textContent='تعذر تحميل صور الألبوم. حاول فتح اللقاء مجددًا.'}
  }
  function openViewer(group,starting){
    if(!group.length)return;
    let current=starting,closed=false;
    const dlg=document.createElement('div');dlg.className='lk-my-viewer';dlg.setAttribute('role','dialog');dlg.setAttribute('aria-modal','true');dlg.setAttribute('aria-label','عرض صورة الذكرى');
    const top=document.createElement('div');top.className='lk-my-viewer-top';
    const back=document.createElement('button');back.textContent='✕';back.type='button';back.setAttribute('aria-label','إغلاق الصورة');
    const options=document.createElement('span');options.textContent='الذكريات';top.append(back,options);
    const img=document.createElement('img');img.className='lk-my-large';img.alt='صورة الذكرى';
    const bottom=document.createElement('div');bottom.className='lk-my-viewer-footer';
    const label=document.createElement('button');label.className='lk-my-event-link';label.type='button';
    const controls=document.createElement('div');controls.className='lk-my-viewer-controls';
    const prev=document.createElement('button');prev.textContent='❯';prev.type='button';prev.setAttribute('aria-label','الصورة السابقة');
    const next=document.createElement('button');next.textContent='❮';next.type='button';next.setAttribute('aria-label','الصورة التالية');
    const count=document.createElement('span');controls.append(prev,count,next);bottom.append(label,controls);dlg.append(top,img,bottom);document.body.append(dlg);
    const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    function update(){const p=group[current];img.src=urlPhoto(p.meetup_id,p.id);img.alt='صورة من '+(p.title||'اللقاء');label.textContent=p.title||'عرض اللقاء';count.textContent=(current+1)+' / '+group.length;label.onclick=()=>{close();onOpenMeetup(p.meetup_id)}}
    function move(delta){current=(current+delta+group.length)%group.length;update()}
    function key(e){if(e.key==='Escape')close();if(e.key==='ArrowLeft')move(1);if(e.key==='ArrowRight')move(-1)}
    function close(){if(closed)return;closed=true;document.removeEventListener('keydown',key);document.body.style.overflow=previousOverflow;dlg.remove()}
    back.onclick=close;prev.onclick=()=>move(-1);next.onclick=()=>move(1);document.addEventListener('keydown',key);
    let gesture=null;img.addEventListener('touchstart',e=>{if(e.touches.length===1)gesture={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});
    img.addEventListener('touchend',e=>{if(!gesture)return;const dx=e.changedTouches[0].clientX-gesture.x,dy=e.changedTouches[0].clientY-gesture.y;gesture=null;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.3)move(dx<0?1:-1)},{passive:true});
    update();
  }
  async function load(){
    try{const result=await api('/api/social/my-photos');if(!safe())return;photos=result.items||[];showPage()}
    catch(e){if(!safe())return;counter.textContent='تعذر تحميل الصور';grid.innerHTML='<p class="lk-my-empty">تعذر تحميل صورك، حاول إعادة فتح ذكرياتي.</p>'}
  }
  renderAlbums();load();
  return ()=>{destroyed=true};
}
