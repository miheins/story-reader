const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/const SB_URL='[^']*',SB_KEY='[^']*';/,"const SB_URL='',SB_KEY='';").replace(/<link[^>]+>/g,'');
const lists=[{id:'main',name:'Reading list',slug:'reading-list'},{id:'w',name:'Weekend Reads',slug:'weekend-reads'}];
const q=[{id:'a1',url:'https://a.com/x',title:'Piece A',site:'a.com',status:'new',list:'main'},{id:'a2',url:'https://a.com/x',title:'Piece A',site:'a.com',status:'new',list:'w'}];
const N=[{id:'n1',art:'a1',pos:1,where:'Slide 1',excerpt:'one',text:'main note',at:1},{id:'n2',art:'a2',pos:1,where:'Slide 1',excerpt:'one',text:'weekend note',at:2},
  {id:'n3',art:'gone',list:'w',pos:1,where:'Slide 1',excerpt:'x',text:'orphan in weekend',at:3,title:'Old'}];
const wait=ms=>new Promise(r=>setTimeout(r,ms));let fail=0;const ok=(n,c)=>{console.log((c?'ok   ':'FAIL ')+n);if(!c)fail++};
(async()=>{
  const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app/#notes',pretendToBeVisual:true,
    beforeParse(w){w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};
      w.localStorage.setItem('folio.lists',JSON.stringify(lists));w.localStorage.setItem('folio.queue',JSON.stringify(q));w.localStorage.setItem('folio.notes',JSON.stringify(N));w.localStorage.setItem('folio.list','main')}});
  const w=dom.window,d=w.document,$=s=>d.querySelector(s);const errs=[];w.addEventListener('error',e=>errs.push(e.message));await wait(400);
  const txt=()=>$('#notesList').textContent;
  ok('main list shows only its note',/main note/.test(txt())&&!/weekend note|orphan/.test(txt()));
  ok('tab count is per list',$('#noteTotal').textContent==='1');
  const ls=$('#listSel');ls.value='w';ls.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(100);
  $('#tabNotes').click();await wait(100);
  ok('weekend list shows its own notes',/weekend note/.test(txt())&&/orphan in weekend/.test(txt())&&!/main note/.test(txt()));
  ok('count follows the list',$('#noteTotal').textContent==='2');
  ok('no errors',!errs.length);if(errs.length)console.log(errs);
  console.log(fail?'FAILED':'all passed');process.exit(fail?1:0)})();
