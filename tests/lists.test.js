const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/<link[^>]+>/g,'');
const lists=[{id:'main',name:'Reading list'},{id:'w',name:'Weekend Reads'}];
const q=[{id:'sample',url:null,title:'Sample',site:'Sample',status:'new',list:'main'},{id:'a',url:'https://a.com/x',title:'A weekend piece',site:'a.com',status:'new',list:'w'}];
function mk(url){return new JSDOM(html,{runScripts:'dangerously',url,pretendToBeVisual:true,
  beforeParse(w){w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=()=>({matches:false,addListener(){}});
   w.localStorage.setItem('folio.lists',JSON.stringify(lists));w.localStorage.setItem('folio.queue',JSON.stringify(q));}})}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  let dom=mk('https://x.test/app/');let w=dom.window,d=w.document;const errs=[];w.addEventListener('error',e=>errs.push(e.message));await wait(300);
  const title=()=>d.querySelector('#deck .ctl')?.textContent;
  console.log('plain load ->',w.location.hash,'| selector hidden:',d.getElementById('listSw').hidden,'| top:',title());
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'l',bubbles:true}));
  console.log('after L: selector shown:',!d.getElementById('listSw').hidden);
  const sel=d.getElementById('listSel');sel.value='w';sel.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(50);
  console.log('picked Weekend ->',w.location.hash,'| top:',title(),'| selector hidden again:',d.getElementById('listSw').hidden);
  w.history.back();await wait(300);console.log('Back ->',w.location.hash,'| top:',title());
  d.querySelector('#links').focus();d.querySelector('#links').dispatchEvent(new w.KeyboardEvent('keydown',{key:'l',bubbles:true}));
  console.log('L while typing ignored:',d.getElementById('listSw').hidden);
  const dom2=mk('https://x.test/app/#list-weekend-reads');await wait(300);
  console.log('deep link ->',dom2.window.location.hash,'| top:',dom2.window.document.querySelector('#deck .ctl')?.textContent);
  const dom3=mk('https://x.test/app/#list-nope');await wait(300);
  console.log('unknown list ->',dom3.window.location.hash,'|',dom3.window.document.getElementById('toastT').textContent);
  console.log('errors',errs);process.exit(0)})();
