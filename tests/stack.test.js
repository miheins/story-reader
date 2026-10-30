const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/<link[^>]+>/g,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,
  beforeParse(w){w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=()=>({matches:false,addListener(){}});}});
const w=dom.window,d=w.document;const errs=[];w.addEventListener('error',e=>errs.push(e.message));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const top=()=>d.querySelector('#deck .card2.k0 .ctl')?.textContent;
(async()=>{await wait(300);
  console.log('default view stack:',!d.getElementById('stack').hidden,'list hidden:',d.getElementById('queue').hidden,'| cards:',d.querySelectorAll('#deck .card2').length,'|',d.querySelector('.dkn').textContent);
  console.log('top:',top());
  d.querySelector('[data-dk="1"]').click();await wait(300);console.log('after next:',top(),'|',d.querySelector('.dkn').textContent);
  d.querySelector('#deck .card2.k0').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await wait(300);console.log('after ← key:',top());
  d.getElementById('vList').click();console.log('list view rows:',d.querySelectorAll('#queue li[data-id]').length,'stack hidden:',d.getElementById('stack').hidden);
  d.getElementById('vStack').click();
  d.querySelector('#deck .card2.k0').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await wait(400);
  console.log('Enter opens reader:',!d.getElementById('reader').hidden,w.location.hash);
  console.log('errors',errs);process.exit(0)})();
