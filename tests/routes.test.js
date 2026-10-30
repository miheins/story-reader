const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/<link[^>]+>/g,'');
function mk(url){return new JSDOM(html,{runScripts:'dangerously',url,pretendToBeVisual:true,
  beforeParse(w){w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=()=>({matches:false,addListener(){}});}})}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  let dom=mk('https://miheins.github.io/article-folio/');let w=dom.window,d=w.document;const errs=[];w.addEventListener('error',e=>errs.push(e.message));
  await wait(300);
  d.querySelector('[data-open="sample"]').click();await wait(400);
  console.log('open:',w.location.hash,'reader',!d.getElementById('reader').hidden,'history',w.history.length);
  w.history.back();await wait(300);
  console.log('after Back:',JSON.stringify(w.location.hash),'reader hidden',d.getElementById('reader').hidden);
  w.history.forward();await wait(500);
  console.log('after Forward:',w.location.hash,'reader',!d.getElementById('reader').hidden);
  d.getElementById('close').click();await wait(300);
  console.log('after close button:',JSON.stringify(w.location.hash),'reader hidden',d.getElementById('reader').hidden);
  // deep link in a fresh load (same storage not shared in jsdom, sample always exists)
  const dom2=mk('https://miheins.github.io/article-folio/#read-sample');await wait(700);
  console.log('deep link opens reader:',!dom2.window.document.getElementById('reader').hidden);
  d.getElementById('menuBtn').click();console.log('install text:',d.getElementById('installHow').textContent.slice(0,60));
  console.log('errors',errs);process.exit(0)})();
