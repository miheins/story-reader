/* old six-step size settings move to the nearest of the four sizes */
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/<link[^>]+>/g,'').replace(/const SB_URL='[^']*',SB_KEY='[^']*';/,"const SB_URL='',SB_KEY='';");
let fails=0;const ok=(n,c,x='')=>{if(!c)fails++;console.log((c?'ok   ':'FAIL ')+n+(x?' | '+x:''))};
const map={0:'16px',1:'16px',2:'19px',3:'19px',4:'22px',5:'25px'};
(async()=>{for(const old in map){const d=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app/',pretendToBeVisual:true,beforeParse(w){
    w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};
    w.localStorage.setItem('folio.settings',JSON.stringify({size:+old,face:'serif'}))}});
  await new Promise(r=>setTimeout(r,150));const v=d.window.document.documentElement.style.getPropertyValue('--rs');
  ok(`old step ${old} → ${map[old]}`,v===map[old],v);d.window.close()}
  console.log(fails?fails+' failed':'all passed');process.exit(fails?1:0)})();
