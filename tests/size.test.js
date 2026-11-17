/* Slide text: one size for every slide (default) or larger type for short paragraphs */
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/<link[^>]+>/g,'').replace(/const SB_URL='[^']*',SB_KEY='[^']*';/,"const SB_URL='',SB_KEY='';");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(name,cond,extra='')=>{if(!cond)fails++;console.log((cond?'ok   ':'FAIL ')+name+(extra?' | '+extra:''))};
(async()=>{
  const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app/#read-sample',pretendToBeVisual:true,beforeParse(w){
    w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};
    /* jsdom has no layout: say everything fits, so the largest allowed step is chosen */
    Object.defineProperty(w.HTMLElement.prototype,'offsetHeight',{get(){return 10},configurable:true});
    Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return 1000},configurable:true});}});
  const w=dom.window,d=w.document,$=s=>d.querySelector(s);const errs=[];w.addEventListener('error',e=>errs.push(e.message));await wait(900);
  const steps=()=>[...d.querySelectorAll('#track .txt')].map(t=>parseFloat(t.style.getPropertyValue('--sc')||'1'));
  ok('default is Same size',$('#segFit input[value="same"]').checked);
  ok('every slide at reading size',steps().length>3&&steps().every(s=>s===1),JSON.stringify(steps()));
  ok('setting shown and selected',$('#segFit input[value="same"]').checked);
  const f=$('#segFit input[value="fit"]');f.checked=true;f.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(200);
  ok('Larger when short scales short slides up',steps().some(s=>s>1),JSON.stringify(steps()));
  ok('choice saved',JSON.parse(w.localStorage.getItem('folio.settings')).fit==='fit');
  ok('no errors',!errs.length,JSON.stringify(errs));
  console.log(fails?fails+' failed':'all passed');process.exit(fails?1:0)})();
