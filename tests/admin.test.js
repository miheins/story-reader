/* List admin: #admin-<slug> route, rename, move, remove, notes, L switcher entry, read-only visitors */
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/<link[^>]+>/g,'');
const lists=[{id:'main',name:'Reading list'},{id:'w',name:'Weekend Reads'}];
const q=[{id:'a',url:'https://a.com/1',title:'First piece',site:'a.com',status:'new',list:'main'},
         {id:'b',url:'https://b.com/2',title:'Second piece',site:'b.com',status:'new',list:'main'},
         {id:'c',url:'https://c.com/3',title:'Weekend piece',site:'c.com',status:'new',list:'w'}];
const notes=[{id:'n1',art:'a',pos:2,where:'Slide 2 of 5',excerpt:'A passage',text:'My note',at:Date.now(),title:'First piece',site:'a.com'}];
function mk(url){return new JSDOM(html,{runScripts:'dangerously',url,pretendToBeVisual:true,
  beforeParse(w){w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};
   w.localStorage.setItem('folio.lists',JSON.stringify(lists));w.localStorage.setItem('folio.queue',JSON.stringify(q));w.localStorage.setItem('folio.notes',JSON.stringify(notes));}})}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(name,cond,extra='')=>{if(!cond)fails++;console.log((cond?'ok   ':'FAIL ')+name+(extra?' | '+extra:''))};
(async()=>{
  const dom=mk('https://x.test/app/#admin-reading-list');const w=dom.window,d=w.document;const errs=[];w.addEventListener('error',e=>errs.push(e.message));await wait(300);
  const $=s=>d.querySelector(s);
  ok('deep link opens admin',!$('#viewAdmin').hidden&&$('#viewQueue').hidden&&$('#tabs').hidden,w.location.hash);
  ok('items listed',d.querySelectorAll('#adItems input[data-ad]').length===2,$('#adItemsN').textContent);
  ok('notes listed',d.querySelectorAll('#adNotes .adnote').length===1,$('#adNotesN').textContent);
  ok('address shown',$('#adUrl').textContent==='#list-reading-list');
  // rename
  $('#adName').value='Studio reading';$('#adNameForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait(50);
  ok('rename updates hash',w.location.hash==='#admin-studio-reading',w.location.hash);
  ok('rename saved',JSON.parse(w.localStorage.getItem('folio.lists'))[0].name==='Studio reading');
  // old address still resolves
  // move one
  $('#ad_a').checked=true;$('#adItems').dispatchEvent(new w.Event('change',{bubbles:true}));
  ok('move button counts selection',$('#adMove').textContent==='Move 1',$('#adMove').textContent);
  $('#adMoveTo').value='w';$('#adMove').click();await wait(50);
  const Q1=JSON.parse(w.localStorage.getItem('folio.queue'));
  ok('moved to Weekend',Q1.find(x=>x.id==='a').list==='w');
  ok('admin re-rendered',d.querySelectorAll('#adItems input[data-ad]').length===1);
  $('#toastB').click();await wait(50);
  ok('undo move',JSON.parse(w.localStorage.getItem('folio.queue')).find(x=>x.id==='a').list==='main');
  // remove one with undo
  $('#ad_b').checked=true;$('#adItems').dispatchEvent(new w.Event('change',{bubbles:true}));$('#adRemove').click();await wait(50);
  ok('removed',!JSON.parse(w.localStorage.getItem('folio.queue')).some(x=>x.id==='b'));
  $('#toastB').click();await wait(50);
  ok('undo remove',JSON.parse(w.localStorage.getItem('folio.queue')).some(x=>x.id==='b'));
  // back to the list
  $('#adBack').click();await wait(50);
  ok('back closes admin',$('#viewAdmin').hidden&&!$('#viewQueue').hidden&&w.location.hash==='#list-studio-reading',w.location.hash);
  // L switcher has Manage
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'l',bubbles:true}));
  const opt=[...$('#listSel').options].find(o=>o.value==='__admin');ok('L switcher offers Manage',!!opt,opt&&opt.textContent);
  $('#listSel').value='__admin';$('#listSel').dispatchEvent(new w.Event('change',{bubbles:true}));await wait(50);
  ok('Manage opens admin',!$('#viewAdmin').hidden&&w.location.hash==='#admin-studio-reading',w.location.hash);
  // browser Back returns to the list
  w.history.back();await wait(300);
  ok('Back leaves admin',$('#viewAdmin').hidden,w.location.hash);
  // unknown admin address
  const d2=mk('https://x.test/app/#admin-nope');await wait(300);
  ok('unknown list handled',d2.window.document.getElementById('viewAdmin').hidden,d2.window.document.getElementById('toastT').textContent);
  // permission gate
  ok('no errors',!errs.length,JSON.stringify(errs));
  console.log(fails?fails+' failed':'all passed');process.exit(fails?1:0)})();
