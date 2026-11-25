const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/const SB_URL='[^']*',SB_KEY='[^']*';/,"const SB_URL='',SB_KEY='';").replace(/<link[^>]+>/g,'');
const lists=[{id:'main',name:'Reading list',slug:'reading-list'},{id:'w',name:'Weekend Reads',slug:'weekend-reads'}];
const q=[{id:'a1',url:'https://a.com/x',title:'Piece A',site:'a.com',status:'read',pos:4,pct:80,list:'main'},{id:'a2',url:'https://b.com/y',title:'Piece B',site:'b.com',status:'new',pos:-1,pct:0,list:'main'}];
const wait=ms=>new Promise(r=>setTimeout(r,ms));let fail=0;const ok=(n,c)=>{console.log((c?'ok   ':'FAIL ')+n);if(!c)fail++};
(async()=>{
  const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app/#admin-reading-list',pretendToBeVisual:true,
    beforeParse(w){w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=()=>({matches:false,addListener(){}});
      w.localStorage.setItem('folio.lists',JSON.stringify(lists));w.localStorage.setItem('folio.queue',JSON.stringify(q));
      w.localStorage.setItem('folio.c.a1',JSON.stringify({title:'Piece A',blocks:[{t:'p',html:'x'}]}))}});
  const w=dom.window,d=w.document,$=s=>d.querySelector(s);const errs=[];w.addEventListener('error',e=>errs.push(e.message));await wait(400);
  const Q=()=>JSON.parse(w.localStorage.getItem('folio.queue'));
  ok('admin shows a Copy button',!!$('#adCopyTo')&&!$('#adCopyTo').disabled);
  d.querySelector('input[data-ad="a1"]').checked=true;$('#adItems').dispatchEvent(new w.Event('change',{bubbles:true}));
  $('#adMoveTo').value='w';$('#adCopyTo').click();await wait(50);
  const both=Q().filter(x=>x.url==='https://a.com/x');
  ok('article now in both lists',both.length===2&&both.some(x=>x.list==='main')&&both.some(x=>x.list==='w'));
  const copy=both.find(x=>x.list==='w'),orig=both.find(x=>x.list==='main');
  ok('copy has its own id',copy&&copy.id!==orig.id);
  ok('original untouched',orig.status==='read'&&orig.pct===80);
  ok('copy starts unread',copy&&copy.status==='new'&&copy.pct===0);
  ok('cached text copied',!!w.localStorage.getItem('folio.c.'+copy.id));
  d.querySelector('input[data-ad="a1"]').checked=true;$('#adItems').dispatchEvent(new w.Event('change',{bubbles:true}));
  $('#adMoveTo').value='w';$('#adCopyTo').click();await wait(50);
  ok('copying again does not duplicate',Q().filter(x=>x.url==='https://a.com/x').length===2&&/Already in/.test($('#toastT').textContent));
  // adding a link that already lives in another list now adds it here too
  $('#adBack').click();await wait(100);const ls=$('#listSel');ls.value='w';ls.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(200);
  $('#links').value='https://b.com/y';$('#addBtn').click();await wait(50);
  ok('same link can be added to a second list',Q().filter(x=>x.url==='https://b.com/y').map(x=>x.list).sort().join()==='main,w');
  $('#links').value='https://b.com/y';$('#addBtn').click();await wait(50);
  ok('but not twice to the same list',Q().filter(x=>x.url==='https://b.com/y').length===2&&/Already in this list/.test($('#toastT').textContent));
  ok('no errors',!errs.length);if(errs.length)console.log(errs);
  console.log(fail?'FAILED':'all passed');process.exit(fail?1:0)})();
