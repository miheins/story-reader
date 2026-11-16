/* Supabase sync against an in-memory stand-in for the Auth and REST APIs: two devices, one account */
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/<link[^>]+>/g,'');
const URL_='https://proj.supabase.co',KEY='sb_publishable_test';
function server(){const db={folio_lists:[],folio_categories:[],folio_articles:[],folio_notes:[]};const log=[];let n=0,tables=true;
  const json=(status,body)=>({ok:status<300,status,json:async()=>body,text:async()=>JSON.stringify(body)});
  return{db,log,dropTables(){tables=false},
    fetch:async(u,o={})=>{u=String(u);if(!u.startsWith(URL_))throw new TypeError('blocked');
      const url=new URL(u),h=o.headers||{};log.push((o.method||'GET')+' '+url.pathname+url.search);
      if(h.apikey!==KEY)return json(401,{message:'Invalid API key'});
      if(url.pathname==='/auth/v1/token'){const b=JSON.parse(o.body),g=url.searchParams.get('grant_type');
        if(g==='password'&&!(b.email==='me@example.com'&&b.password==='right'))return json(400,{code:400,error_code:'invalid_credentials',msg:'Invalid login credentials'});
        if(g==='refresh_token'&&!/^r\d+$/.test(b.refresh_token))return json(400,{msg:'Invalid Refresh Token'});
        n++;return json(200,{access_token:'a'+n,refresh_token:'r'+n,expires_in:3600,user:{id:'user-1',email:'me@example.com'}})}
      if(url.pathname==='/auth/v1/logout')return json(204,{});
      if(!/^Bearer a\d+$/.test(h.Authorization||''))return json(401,{message:'JWT expired'});
      const t=url.pathname.replace('/rest/v1/','');if(!tables||!db[t])return json(404,{code:'PGRST205',message:"Could not find the table 'public."+t+"' in the schema cache"});
      const m=o.method||'GET';
      if(m==='GET'){const k=(url.searchParams.get('order')||'id');return json(200,[...db[t]].sort((a,b)=>a[k]>b[k]?1:a[k]<b[k]?-1:0))}
      if(m==='POST'){const ignore=/ignore-duplicates/.test(h.Prefer||'');JSON.parse(o.body).forEach(r=>{if(r.owner_id!=='user-1')throw new Error('RLS');const i=db[t].findIndex(x=>x.id===r.id);if(i<0)db[t].push(r);else if(!ignore)db[t][i]=r});return json(201,null)}
      if(m==='DELETE'){const ids=JSON.parse('['+url.searchParams.get('id').replace(/^in\.\(|\)$/g,'')+']');db[t]=db[t].filter(r=>!ids.includes(r.id));return json(204,null)}
      return json(405,{})}}}
function device(srv,seed={},hash=''){return new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app/'+hash,pretendToBeVisual:true,beforeParse(w){
  w.fetch=srv.fetch;w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};
  w.localStorage.setItem('folio.sb',JSON.stringify({url:URL_,key:KEY}));w.localStorage.setItem('folio.canFetch','true');
  for(const k in seed)w.localStorage.setItem(k,JSON.stringify(seed[k]))}})}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(name,cond,extra='')=>{if(!cond)fails++;console.log((cond?'ok   ':'FAIL ')+name+(extra?' | '+extra:''))};
async function signIn(w,pass='right'){const d=w.document;d.querySelector('#menuBtn').click();await wait(50);
  d.querySelector('#sbEmail').value='me@example.com';d.querySelector('#sbPass').value=pass;
  d.querySelector('#sbForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(250)}
const ls=(w,k)=>JSON.parse(w.localStorage.getItem(k));
(async()=>{
  const srv=server();
  const A=device(srv,{'folio.lists':[{id:'main',name:'Studio reading',slug:'studio-reading'},{id:'w',name:'Weekend',slug:'weekend'}],'folio.cats':[{id:'c1',name:'Branding',c:0}],
    'folio.queue':[{id:'a1',url:'https://a.com/1',title:'First',site:'a.com',status:'reading',pos:3,pct:40,list:'main',cat:'c1',added:'2026-11-01'},
                   {id:'a2',url:'https://b.com/2',title:'Second',site:'b.com',status:'new',pos:-1,pct:0,list:'w',kind:'link',img:'https://b.com/i.jpg',added:'2026-11-02'}],
    'folio.notes':[{id:'n1',art:'a1',pos:2,where:'Slide 2 of 5',excerpt:'A passage',text:'My note',at:1700000000000,title:'First',site:'a.com',url:'https://a.com/1'}]}).window;
  const errs=[];A.addEventListener('error',e=>errs.push(e.message));await wait(300);
  ok('GitHub section hidden once a project is set',(A.document.querySelector('#menuBtn').click(),A.document.querySelector('#ownerSet').hidden));
  A.document.querySelector('#mX').click();
  await signIn(A,'wrong');
  ok('wrong password explained',/don’t match/.test(A.document.querySelector('#sbMsg').textContent)&&!ls(A,'folio.sb.session'),A.document.querySelector('#sbMsg').textContent);
  A.document.querySelector('#sbPass').value='right';A.document.querySelector('#sbForm').dispatchEvent(new A.Event('submit',{bubbles:true,cancelable:true}));await wait(300);
  ok('signed in',/Signed in as/.test(A.document.querySelector('#sbBox').textContent),A.document.querySelector('#sbBox').textContent.slice(0,60));
  ok('lists uploaded',srv.db.folio_lists.length===2&&srv.db.folio_lists[0].owner_id==='user-1');
  ok('articles uploaded with progress and kind',srv.db.folio_articles.length===2&&srv.db.folio_articles.find(r=>r.id==='a1').pct===40&&srv.db.folio_articles.find(r=>r.id==='a2').kind==='link');
  ok('notes and categories uploaded',srv.db.folio_notes.length===1&&srv.db.folio_categories.length===1);
  ok('sample article stays local',!srv.db.folio_articles.some(r=>!r.url));

  // second device, fresh: its default list must not overwrite the account's
  const B=device(srv).window;await wait(300);await signIn(B);
  ok('B gets lists, account wins on same id',ls(B,'folio.lists').length===2&&ls(B,'folio.lists').find(l=>l.id==='main').name==='Studio reading',JSON.stringify(ls(B,'folio.lists')));
  const qb=ls(B,'folio.queue');
  ok('B gets articles with progress, list, category',qb.find(q=>q.id==='a1').pct===40&&qb.find(q=>q.id==='a1').cat==='c1'&&qb.find(q=>q.id==='a2').list==='w'&&qb.find(q=>q.id==='a2').img==='https://b.com/i.jpg');
  ok('B gets notes',ls(B,'folio.notes').length===1&&ls(B,'folio.notes')[0].text==='My note'&&ls(B,'folio.notes')[0].where==='Slide 2 of 5');
  ok('server unchanged by B joining',srv.db.folio_lists.find(l=>l.id==='main').name==='Studio reading'&&srv.db.folio_articles.length===2,JSON.stringify(srv.db.folio_articles.map(r=>[r.id,r.position]))+JSON.stringify(srv.db.folio_lists));

  // B changes things: remove an article through the admin data layer, rename a list
  B.document.querySelector('#mX').click();
  B.location.hash='#admin-weekend';await wait(200);
  B.document.querySelector('#ad_a2').checked=true;B.document.querySelector('#adItems').dispatchEvent(new B.Event('change',{bubbles:true}));B.document.querySelector('#adRemove').click();
  B.document.querySelector('#adName').value='Sunday';B.document.querySelector('#adNameForm').dispatchEvent(new B.Event('submit',{cancelable:true}));
  await wait(2200);
  ok('delete reaches Supabase',!srv.db.folio_articles.some(r=>r.id==='a2'),srv.log.filter(x=>x.startsWith('DELETE')).join(' '));
  ok('rename reaches Supabase',srv.db.folio_lists.find(l=>l.id==='w').name==='Sunday'&&srv.db.folio_lists.find(l=>l.id==='w').slug==='sunday');
  const before=srv.log.length;await wait(1800);
  ok('nothing sent when nothing changed',srv.log.length===before);

  // A syncs: sees B's changes
  A.document.querySelector('#sbNow').click();await wait(300);
  ok('A sees the removal and the rename',!ls(A,'folio.queue').some(q=>q.id==='a2')&&ls(A,'folio.lists').find(l=>l.id==='w').name==='Sunday');
  ok('old list address still resolves on A',ls(A,'folio.lists').find(l=>l.id==='w').alt.includes('weekend'));

  // a new device opening a list address that only exists in the account
  const srvC=srv;const C=device(srvC,{'folio.sb.session':{access_token:'a1',refresh_token:'r1',expires_at:Date.now()+3600e3,email:'me@example.com',uid:'user-1'}},'#list-sunday').window;await wait(400);
  ok('deep link waits for the first sync',C.location.hash==='#list-sunday'&&ls(C,'folio.alist')==='w',C.location.hash+' '+ls(C,'folio.alist'));

  // expired token is refreshed before the first request
  const E=device(srv,{'folio.sb.session':{access_token:'old',refresh_token:'r1',expires_at:Date.now()-1000,email:'me@example.com',uid:'user-1'}}).window;await wait(400);
  ok('token refreshed',srv.log.some(x=>x.includes('grant_type=refresh_token'))&&ls(E,'folio.sb.session').expires_at>Date.now()&&ls(E,'folio.lists').length===2);

  // tables missing
  const srv2=server();srv2.dropTables();const D=device(srv2).window;await wait(300);await signIn(D);
  ok('missing tables explained',/schema\.sql/.test(D.document.querySelector('#sbBox').textContent),D.document.querySelector('#sbBox').innerHTML.slice(0,700)+' LOG '+srv2.log.join(' | '));
  // sign out keeps local data
  A.document.querySelector('#sbOut').click();await wait(50);
  ok('sign out keeps lists here',!ls(A,'folio.sb.session')&&ls(A,'folio.lists').length===2);
  ok('no errors',!errs.length,JSON.stringify(errs));
  console.log(fails?fails+' failed':'all passed');process.exit(fails?1:0)})();
