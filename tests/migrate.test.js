/* saved sizes from older scales: the middle size unless picked on the current scale */
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/<link[^>]+>/g,'').replace(/const SB_URL='[^']*',SB_KEY='[^']*';/,"const SB_URL='',SB_KEY='';");
let fails=0;const ok=(n,c,x='')=>{if(!c)fails++;console.log((c?'ok   ':'FAIL ')+n+(x?' | '+x:''))};
const map={0:'22px',1:'22px',3:'22px',5:'22px'};
(async()=>{for(const old in map){const d=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app/',pretendToBeVisual:true,beforeParse(w){
    w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};
    w.localStorage.setItem('folio.settings',JSON.stringify({size:+old,face:'serif',sv:2}))}});
  await new Promise(r=>setTimeout(r,150));const v=d.window.document.documentElement.style.getPropertyValue('--rs');
  ok(`old step ${old} → ${map[old]}`,v===map[old],v);d.window.close()}
  {const d=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app/',pretendToBeVisual:true,beforeParse(w){w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};
    w.localStorage.setItem('folio.settings',JSON.stringify({size:4,sizeSet:true,sv:3}))}});await new Promise(r=>setTimeout(r,150));
   ok('a picked size is kept',d.window.document.documentElement.style.getPropertyValue('--rs')==='28px')}
  console.log(fails?fails+' failed':'all passed');process.exit(fails?1:0)})();
