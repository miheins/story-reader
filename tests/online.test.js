const {JSDOM}=require('jsdom');const fs=require('fs');const nodeCrypto=require('crypto');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/<link[^>]+>/g,'');
const TOK='github_pat_'+'A'.repeat(40);
/* a tiny fake of the GitHub contents API, shared by all "devices" */
const files={};let shaN=0,puts=0;
function gh(url,opt={}){
  const auth=(opt.headers||{}).Authorization;const ok=r=>Promise.resolve(r);
  const res=(status,body)=>({ok:status<300,status,json:async()=>body,text:async()=>JSON.stringify(body),clone(){return this}});
  if(!url.startsWith('https://api.github.com'))return ok(res(404,{}));            // Pages fallback copy: not used here
  if(auth&&auth!=='Bearer '+TOK)return ok(res(401,{message:'Bad credentials'}));
  const m=url.match(/\/repos\/miheins\/story-reader(?:\/contents\/(.+))?$/);if(!m)return ok(res(404,{}));
  if(!m[1])return ok(res(200,{full_name:'miheins/story-reader'}));
  const path=m[1];
  if(!opt.method){const f=files[path];return ok(f?res(200,{content:Buffer.from(f.text).toString('base64'),sha:f.sha}):res(404,{message:'Not Found'}))}
  if(opt.method==='PUT'){if(!auth)return ok(res(401,{}));const b=JSON.parse(opt.body);const f=files[path];
    if(f&&b.sha!==f.sha)return ok(res(409,{message:'sha mismatch'}));if(!f&&b.sha)return ok(res(422,{}));
    puts++;files[path]={text:Buffer.from(b.content,'base64').toString('utf8'),sha:'s'+(++shaN)};return ok(res(f?200:201,{content:{sha:files[path].sha}}))}
}
function device(url,seed){const dom=new JSDOM(html,{runScripts:'dangerously',url,pretendToBeVisual:true,beforeParse(w){
  w.fetch=(u,o)=>gh(String(u),o);w.matchMedia=()=>({matches:false,addListener(){}});
  Object.defineProperty(w,'crypto',{value:nodeCrypto.webcrypto});w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
  if(seed)seed(w)}});const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));return w}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const doc=()=>JSON.parse(files['data/folio.json'].text);
const titles=w=>[...w.document.querySelectorAll('#queue .qt')].map(e=>e.textContent);
(async()=>{
  const URL0='https://miheins.github.io/story-reader/';
  /* Device A: has local lists, sets up owner access */
  const A=device(URL0,w=>{w.localStorage.setItem('folio.view','"list"');w.localStorage.setItem('folio.queue',JSON.stringify([
    {id:'a1',url:'https://a.com/one',title:'One',site:'a.com',status:'read',list:'main'},{id:'a2',url:'https://b.com/two',title:'Two',site:'b.com',status:'new',list:'main'}]))});
  await wait(300);const a=A.document;
  console.log('A before setup: remote?',!!A.localStorage.getItem('folio.remote'),'| ro class:',a.documentElement.classList.contains('ro'));
  a.getElementById('menuBtn').click();await wait(100);
  console.log('A owner panel:',a.getElementById('ownerBox').textContent.replace(/\s+/g,' ').trim().slice(0,90));
  a.getElementById('oStart').click();a.getElementById('oSuggest').click();const pass=a.getElementById('oPass').value;
  console.log('suggested passphrase words:',pass.split(' ').length);
  a.getElementById('oTok').value=TOK;
  a.getElementById('oSetup').dispatchEvent(new A.Event('submit',{bubbles:true,cancelable:true}));await wait(2500);
  console.log('A after setup: files',Object.keys(files),'| articles online:',doc().articles.map(x=>x.title),'| owner?',!!A.localStorage.getItem('folio.owner'));
  const own=JSON.parse(files['data/owner.json'].text);console.log('owner.json has no plain token:',!files['data/owner.json'].text.includes(TOK),'| iter',own.iter);
  /* A adds a link and creates a list */
  a.getElementById('mX').click();a.getElementById('links').value='https://c.com/three-things';a.getElementById('addBtn').click();
  await wait(1500);console.log('A added → online:',doc().articles.map(x=>x.url.split('/').pop()),'| puts',puts);
  a.getElementById('menuBtn').click();a.getElementById('listName').value='Weekend';a.getElementById('listForm').dispatchEvent(new A.Event('submit',{bubbles:true,cancelable:true}));
  await wait(1500);console.log('A new list online:',doc().lists.map(l=>l.slug));

  /* Device B: has its own local article, opens the site (read-only), then unlocks */
  const B=device(URL0,w=>{w.localStorage.setItem('folio.view','"list"');w.localStorage.setItem('folio.queue',JSON.stringify([{id:'b9',url:'https://z.com/phone-only',title:'Phone only',site:'z.com',status:'new',list:'main'}]))});
  await wait(600);const b=B.document;
  console.log('B visitor: ro class',b.documentElement.classList.contains('ro'),'| add box hidden by style:',B.getComputedStyle(b.getElementById('links')).display,'| queue:',titles(B));
  b.getElementById('menuBtn').click();await wait(200);
  b.getElementById('oPassU').value='  '+pass.toUpperCase()+' ';   // capitals and spaces must not matter
  b.getElementById('oUnlock').dispatchEvent(new B.Event('submit',{bubbles:true,cancelable:true}));await wait(3000);
  console.log('B unlocked:',!!B.localStorage.getItem('folio.owner'),'| ro:',b.documentElement.classList.contains('ro'),'| merged online:',doc().articles.map(x=>x.title));
  /* wrong passphrase */
  const W=device(URL0);await wait(500);W.document.getElementById('menuBtn').click();await wait(200);
  W.document.getElementById('oPassU').value='wrong words here please';W.document.getElementById('oUnlock').dispatchEvent(new W.Event('submit',{bubbles:true,cancelable:true}));await wait(1500);
  console.log('wrong passphrase →',W.document.getElementById('oErrU').textContent,'| owner?',!!W.localStorage.getItem('folio.owner'));

  /* both owners add at the same moment: nothing may be lost */
  a.getElementById('mX').click();b.getElementById('mX').click();
  a.getElementById('links').value='https://same.time/from-a';a.getElementById('addBtn').click();
  b.getElementById('links').value='https://same.time/from-b';b.getElementById('addBtn').click();
  await wait(3000);const urls=doc().articles.map(x=>x.url);console.log('concurrent adds kept:',urls.includes('https://same.time/from-a')&&urls.includes('https://same.time/from-b'));

  /* Device C: brand-new visitor opens the Weekend list address directly */
  const C=device(URL0+'#list-weekend',w=>w.localStorage.setItem('folio.view','"list"'));await wait(800);
  console.log('C deep link →',C.location.hash,'| open list:',(C.document.querySelector('#listSel option[selected]')||{}).textContent,'| toast:',C.document.getElementById('toastT').textContent||'(none)');
  console.log('errors A,B,C,W:',A.errs,B.errs,C.errs,W.errs);process.exit(0)})().catch(e=>{console.error('TEST CRASH',e);process.exit(1)});
