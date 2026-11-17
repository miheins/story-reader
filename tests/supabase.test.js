/* Supabase with list keys, against an in-memory stand-in for the database functions in supabase/schema.sql.
   (The SQL itself was checked on a real Postgres; this covers the app side: two devices, one list key.) */
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/const SB_URL='[^']*',SB_KEY='[^']*';/,"const SB_URL='',SB_KEY='';").replace(/<link[^>]+>/g,'');
const URL_='https://proj.supabase.co',KEY='sb_publishable_test',ADMIN='admin-key-123';
function server(){const lists=[];const log=[];let n=0,up=true;
  const json=(status,body)=>({ok:status<300,status,json:async()=>body});const err=m=>json(400,{code:'P0001',message:m});
  const find=(ref,key)=>{const l=lists.find(x=>x.id===ref||x.slug===ref||x.alt.includes(ref));if(!l)return'FOLIO_NOLIST';return l.key===key?l:'FOLIO_KEY'};
  const fns={folio_ping:()=>true,
    folio_check_admin:a=>a.p_admin===ADMIN?true:'FOLIO_ADMIN',
    folio_publish:a=>{if(a.p_admin!==ADMIN)return'FOLIO_ADMIN';if((a.p_key||'').length<8)return'FOLIO_SHORT';if(lists.some(l=>l.slug===a.p_slug))return'FOLIO_SLUG';
      const l={id:'00000000-0000-4000-8000-00000000000'+(++n),slug:a.p_slug,name:a.p_name,alt:[],key:a.p_key,articles:[],notes:[]};lists.push(l);return l.id},
    folio_set_key:a=>{if(a.p_admin!==ADMIN)return'FOLIO_ADMIN';const l=lists.find(x=>x.id===a.p_list);if(!l)return'FOLIO_NOLIST';l.key=a.p_key;return null},
    folio_delete_list:a=>{if(a.p_admin!==ADMIN)return'FOLIO_ADMIN';const i=lists.findIndex(x=>x.id===a.p_list);if(i>=0)lists.splice(i,1);return null},
    folio_open:a=>{const l=find(a.p_ref,a.p_key);if(typeof l==='string')return l;
      return{list:{id:l.id,name:l.name,slug:l.slug,alt:l.alt,intro:l.intro||''},articles:[...l.articles].sort((x,y)=>x.position-y.position),notes:[...l.notes].sort((x,y)=>x.noted_at-y.noted_at)}},
    folio_push:a=>{const l=find(a.p_list,a.p_key);if(typeof l==='string')return l;
      if((a.p_meta||a.p_articles.length||a.p_del_articles.length)&&a.p_admin!==ADMIN)return'FOLIO_ADMIN';
      if(a.p_meta){l.intro=a.p_meta.intro||'';l.name=a.p_meta.name;l.slug=a.p_meta.slug;l.alt=a.p_meta.alt||[]}
      for(const [k,rows,del] of [['articles',a.p_articles,a.p_del_articles],['notes',a.p_notes,a.p_del_notes]]){
        l[k]=l[k].filter(r=>!del.includes(r.id));rows.forEach(r=>{const i=l[k].findIndex(x=>x.id===r.id);if(i<0)l[k].push(r);else l[k][i]=r})}
      return null}};
  return{lists,log,down(){up=false},
    fetch:async(u,o={})=>{u=String(u);if(!u.startsWith(URL_))throw new TypeError('blocked');
      const fn=new URL(u).pathname.replace('/rest/v1/rpc/','');log.push(fn);
      if((o.headers||{}).apikey!==KEY)return json(401,{message:'Invalid API key'});
      if(!up||!fns[fn])return json(404,{code:'PGRST202',message:'Could not find the function public.'+fn});
      const r=fns[fn](JSON.parse(o.body||'{}'));return typeof r==='string'&&r.startsWith('FOLIO_')?err(r):json(200,r)}}}
function device(srv,seed={},hash='',cfg=true){return new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app/'+hash,pretendToBeVisual:true,beforeParse(w){
  w.fetch=srv.fetch;w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};
  if(cfg)w.localStorage.setItem('folio.sb',JSON.stringify({url:URL_,key:KEY}));w.localStorage.setItem('folio.canFetch','true');
  for(const k in seed)w.localStorage.setItem(k,JSON.stringify(seed[k]))}})}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(name,cond,extra='')=>{if(!cond)fails++;console.log((cond?'ok   ':'FAIL ')+name+(extra?' | '+extra:''))};
const ls=(w,k)=>JSON.parse(w.localStorage.getItem(k));
const submit=(w,sel)=>w.document.querySelector(sel).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
(async()=>{
  const srv=server();
  const A=device(srv,{'folio.lists':[{id:'main',name:'Studio reading',slug:'studio-reading'},{id:'w',name:'Weekend',slug:'weekend'}],'folio.cats':[{id:'c1',name:'Branding',c:2}],
    'folio.queue':[{id:'a1',url:'https://a.com/1',title:'First',site:'a.com',status:'reading',pos:3,pct:40,list:'w',cat:'c1',added:'2026-11-01'},
                   {id:'a2',url:'https://b.com/2',title:'Second',site:'b.com',status:'new',pos:-1,pct:0,list:'w',kind:'link',img:'https://b.com/i.jpg',added:'2026-11-02'},
                   {id:'p1',url:'https://p.com/x',title:'Private',site:'p.com',status:'new',pos:-1,pct:0,list:'main'}],
    'folio.notes':[{id:'n1',art:'a1',pos:2,where:'Paragraph 2',excerpt:'A passage',text:'My note',at:1700000000000,title:'First',site:'a.com',url:'https://a.com/1'},
                   {id:'n2',art:'p1',pos:1,where:'Paragraph 1',excerpt:'Private passage',text:'Private note',at:1700000000001,title:'Private',site:'p.com',url:'https://p.com/x'}]},'#admin-weekend').window;
  const errs=[];A.addEventListener('error',e=>errs.push(e.message));await wait(300);
  const $A=s=>A.document.querySelector(s);
  ok('manage page needs admin',$A('#viewAdmin').hidden&&!$A('#menuSheet').hidden&&!!$A('#admForm'));
  ok('new-list form hidden without admin',A.document.documentElement.classList.contains('noadmin'));
  $A('#admKey').value='wrong';submit(A,'#admForm');await wait(150);
  ok('wrong admin key refused',/admin key/.test($A('#admMsg').textContent),$A('#admMsg').textContent);
  $A('#admKey').value=ADMIN;submit(A,'#admForm');await wait(150);
  ok('admin unlocked',!A.document.documentElement.classList.contains('noadmin')&&/Admin/.test($A('#sbBox').textContent));
  $A('#mX').click();A.location.hash='#admin-weekend';await wait(200);
  ok('admin page offers Put online, no admin field',!!$A('#adPub')&&!$A('#adAdminK'));
  $A('#adListK').value='short';submit(A,'#adPub');await wait(50);
  ok('short list key refused in the app',/8 characters/.test($A('#adOnMsg').textContent)&&!srv.lists.length);
  $A('#adListK').value='weekend-key-1';submit(A,'#adPub');await wait(300);
  const L=srv.lists[0];
  ok('list is online',!!L&&L.slug==='weekend'&&/Online/.test($A('#adOnline').textContent),$A('#adOnline').textContent.slice(0,50));
  ok('its articles and notes went up',L.articles.length===2&&L.notes.length===1&&L.articles.find(r=>r.id==='a1').cat_name==='Branding'&&L.articles.find(r=>r.id==='a2').kind==='link');
  ok('other lists stay private',!JSON.stringify(srv.lists).includes('Private'));
  ok('reading progress is not uploaded',!('pct' in L.articles[0])&&!('status' in L.articles[0]));

  // second device: address + key
  const B=device(srv,{},'#list-weekend').window;await wait(400);const $B=s=>B.document.querySelector(s);
  ok('unknown list address asks for its key',!$B('#unlockSheet').hidden&&$B('#uRef').value==='weekend');
  $B('#uKey').value='not-the-key';submit(B,'#uForm');await wait(150);
  ok('wrong list key refused',/doesn’t open/.test($B('#uMsg').textContent)&&(ls(B,'folio.lists')||[]).every(l=>!l.rid),$B('#uMsg').textContent);
  $B('#uKey').value='weekend-key-1';submit(B,'#uForm');await wait(300);
  const lb=ls(B,'folio.lists').find(l=>l.rid===L.id);
  ok('B has the list and is on it',!!lb&&lb.name==='Weekend'&&B.location.hash==='#list-weekend'&&ls(B,'folio.alist')===lb.id,B.location.hash);
  const qb=ls(B,'folio.queue').filter(q=>q.list===lb.id);
  ok('B has the articles in order, with category and link image',qb.length===2&&qb[0].id==='a1'&&qb[1].img==='https://b.com/i.jpg'&&ls(B,'folio.cats').some(c=>c.name==='Branding'&&c.c===2&&c.id===qb[0].cat));
  ok('B has the note, not the private one',ls(B,'folio.notes').length===1&&ls(B,'folio.notes')[0].text==='My note');
  ok('progress starts fresh on B',qb[0].status==='new');
  ok('B’s own lists and starter links stayed local',L.articles.length===2&&srv.lists.length===1);

  // B (not admin): can't manage or create lists, can remove an article from the list
  B.location.hash='#admin-weekend';await wait(200);
  ok('B can’t open the manage page',$B('#viewAdmin').hidden&&B.location.hash==='#list-weekend',B.location.hash);
  ok('B has no New list or Manage',B.document.documentElement.classList.contains('noadmin')&&![...$B('#listSel').options].some(o=>o.value==='__new'||o.value==='__admin'));
  B.document.dispatchEvent(new B.KeyboardEvent('keydown',{key:'l',bubbles:true}));
  ok('L does nothing without admin',$B('#listSw').hidden);
  $B('#openAdd').click();await wait(50);
  ok('B can’t add articles (button hidden by .noadmin; checked in Chromium)',$B('#addSheet').hidden&&B.document.documentElement.classList.contains('noadmin'));
  ok('B can’t switch lists',[...$B('#listSel').options].filter(o=>!o.value.startsWith('__')).length===1&&B.getComputedStyle($B('#sbSet .subset')).display==='none');
  $B('#mX').click();B.localStorage.setItem('folio.view','"list"');$B('#vList').click();await wait(50);
  $B('[data-rm="a2"]').click();await wait(300);
  // B (not admin): a category change stays local without an error
  const sel=$B('[data-cat="a1"]');sel.value='';sel.dispatchEvent(new B.Event('change',{bubbles:true}));await wait(2200);
  ok('B’s category change is not sent, no error',L.articles.find(r=>r.id==='a1').cat_name==='Branding'&&!/error/i.test($B('#sbBox')?$B('#sbBox').className:'')&&ls(B,'folio.queue').find(q=>q.id==='a1').cat==null);
  ok('B can’t remove articles',ls(B,'folio.queue').some(q=>q.id==='a2')&&L.articles.length===2);
  // A (admin) removes it
  $A('#ad_a2').checked=true;$A('#adItems').dispatchEvent(new A.Event('change',{bubbles:true}));$A('#adRemove').click();await wait(2200);
  ok('admin removal reaches Supabase',L.articles.length===1);
  // a reader's note syncs without admin (fresh device holding the list key and one new note)
  const R2=device(srv,{'folio.lists':[{id:L.id,rid:L.id,name:'Sunday',slug:'sunday'}],'folio.alist':L.id,'folio.sb.keys':{[L.id]:'weekend-key-1'},
    'folio.queue':[{id:'a1',url:'https://a.com/1',title:'First',site:'a.com',status:'new',pos:-1,pct:0,list:L.id}],
    'folio.notes':[{id:'nr',art:'a1',pos:1,where:'Paragraph 1',excerpt:'x',text:'',like:true,at:Date.now(),title:'First',site:'a.com',url:'https://a.com/1'}]}).window;await wait(500);
  ok('a reader’s remembered slide reaches Supabase',L.notes.some(n=>n.id==='nr'&&n.liked),JSON.stringify(L.notes.map(n=>n.id)));
  B.document.querySelector('#menuBtn').click();await wait(50);$B('#sbNow').click();await wait(300);$B('#mX').click();
  ok('after sync B has the account’s category back',ls(B,'folio.queue').find(q=>q.id==='a1').cat!=null);
  // A (admin) renames
  $A('#adName').value='Sunday';submit(A,'#adNameForm');await wait(2200);
  ok('admin rename reaches Supabase',L.name==='Sunday'&&L.slug==='sunday'&&L.alt.includes('weekend'));
  $B('[data-dk],#vStack')&&0;B.dispatchEvent(new B.Event('focus'));
  const before=srv.log.length;await wait(1800);ok('nothing sent when nothing changed',srv.log.length===before);
  $A('#adIntro').value='Read these first.\nThen the rest.';submit(A,'#adIntroForm');await wait(2200);
  ok('intro saved and synced',L.intro==='Read these first.\nThen the rest.',L.intro);
  ok('intro hidden on the manage page',$A('#listIntro').hidden);
  $B('#menuBtn').click();await wait(50);$B('#sbNow').click();await wait(300);$B('#mX').click();
  ok('B shows the intro above the tabs',!$B('#listIntro').hidden&&$B('#listIntro').textContent==='Read these first.\nThen the rest.');
  ok('B can’t edit the intro',B.eval("1")&&!B.document.querySelector('#viewAdmin:not([hidden])'));
  ok('B sees the rename',ls(B,'folio.lists').find(l=>l.rid===L.id).name==='Sunday');
  $A('#adSyncNow').click();await wait(300);
  ok('A sees both, keeps its progress',!ls(A,'folio.queue').some(q=>q.id==='a2')&&ls(A,'folio.lists').find(l=>l.id==='w').name==='Sunday'&&ls(A,'folio.queue').find(q=>q.id==='a1').pct===40);
  ok('A’s private list untouched',ls(A,'folio.queue').some(q=>q.id==='p1')&&ls(A,'folio.notes').some(n=>n.id==='n2'));

  // admin changes the key: B is locked out until it has the new one
  A.document.querySelector('.adkey').open=true;$A('#adListK').value='brand-new-key-9';submit(A,'#adRekey');await wait(200);
  ok('key changed',L.key==='brand-new-key-9');
  $B('#menuBtn').click();await wait(50);$B('#sbNow').click();await wait(300);
  ok('B is locked, keeps its copy',/1 locked/.test($B('#sbBox').textContent)&&ls(B,'folio.queue').some(q=>q.id==='a1'),$B('#sbBox').textContent.slice(0,120));
  $B('#sbUnlockBtn').click();await wait(50);$B('#uRef').value='sunday';$B('#uKey').value='brand-new-key-9';submit(B,'#uForm');await wait(300);
  ok('B unlocks with the new key',ls(B,'folio.sb.keys')[L.id]==='brand-new-key-9');

  // private link: the key travels in the link, then leaves the address bar
  let link='';Object.defineProperty(A.navigator,'clipboard',{value:{writeText:t=>{link=t;return Promise.resolve()}},configurable:true});
  A.document.querySelector('#adPrivLink').click();await wait(50);
  ok('private link carries slug and key',/#list-sunday&key=brand-new-key-9$/.test(link),link);
  const P=device(srv,{},link.slice(link.indexOf('#'))).window;await wait(500);
  ok('private link opens the list without typing',ls(P,'folio.lists').some(l=>l.rid===L.id)&&P.document.querySelector('#unlockSheet').hidden,P.document.querySelector('#uMsg').textContent);
  ok('key removed from the address',P.location.hash==='#list-sunday'&&!P.location.href.includes('key='),P.location.href);
  const bad=device(srv,{},'#list-sunday&key=wrong-key-000').window;await wait(500);
  ok('bad private link asks for the key',!bad.document.querySelector('#unlockSheet').hidden&&/doesn’t open/.test(bad.document.querySelector('#uMsg').textContent)&&!bad.location.href.includes('key='),bad.document.querySelector('#uMsg').textContent);
  bad.document.querySelector('#uRef').value=link;bad.document.querySelector('#uKey').value='';bad.document.querySelector('#uForm').dispatchEvent(new bad.Event('submit',{bubbles:true,cancelable:true}));await wait(300);
  ok('pasting the private link into Unlock works',ls(bad,'folio.lists').some(l=>l.rid===L.id));

  // first connection, and a project without the functions
  const C=device(srv,{},'',false).window;await wait(300);C.document.querySelector('#menuBtn').click();await wait(50);
  ok('no email or password asked',!C.document.querySelector('#sbBox input[type=password]')&&!C.document.querySelector('#sbBox input[type=email]'));
  const srv2=server();srv2.down();const D=device(srv2,{},'',false).window;await wait(300);D.document.querySelector('#menuBtn').click();await wait(50);
  D.document.querySelector('#sbUrl').value=URL_;D.document.querySelector('#sbKey').value=KEY;submit(D,'#sbForm');await wait(200);
  ok('missing set-up explained',/schema\.sql/.test(D.document.querySelector('#sbMsg').textContent)&&!ls(D,'folio.sb'),D.document.querySelector('#sbMsg').textContent);
  D.document.querySelector('#sbKey').value='sb_secret_abc';submit(D,'#sbForm');await wait(50);
  ok('secret key refused',/secret key/.test(D.document.querySelector('#sbMsg').textContent));
  ok('no errors',!errs.length,JSON.stringify(errs));
  console.log(fails?fails+' failed':'all passed');process.exit(fails?1:0)})();
