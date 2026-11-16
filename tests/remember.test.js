/* Remember a slide without a note; add an article from the L switcher; note sheet basics */
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/<link[^>]+>/g,'');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(name,cond,extra='')=>{if(!cond)fails++;console.log((cond?'ok   ':'FAIL ')+name+(extra?' | '+extra:''))};
(async()=>{
  const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app/',pretendToBeVisual:true,beforeParse(w){
    w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};}});
  const w=dom.window,d=w.document,$=s=>d.querySelector(s);const errs=[];w.addEventListener('error',e=>errs.push(e.message));await wait(300);
  const notes=()=>JSON.parse(w.localStorage.getItem('folio.notes')||'[]');
  // L switcher
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'l',bubbles:true}));
  const opt=[...$('#listSel').options].find(o=>o.value==='__add');ok('L switcher offers Add an article',!!opt,opt&&opt.textContent);
  $('#listSel').value='__add';$('#listSel').dispatchEvent(new w.Event('change',{bubbles:true}));await wait(100);
  ok('it opens the add panel',!$('#addSheet').hidden);$('#aX').click();
  // open the sample article
  d.querySelector('.card2.k0').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await wait(900);
  ok('reader open',!$('#reader').hidden);
  ok('no Remember on the cover',$('#remBtn').hidden);
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await wait(100);
  ok('Remember shows on a text slide',!$('#remBtn').hidden&&$('#remT').textContent==='Remember');
  $('#remBtn').click();
  ok('slide remembered without a note',notes().length===1&&notes()[0].like===true&&notes()[0].text===''&&notes()[0].excerpt.length>10&&$('#remBtn').getAttribute('aria-pressed')==='true'&&$('#remT').textContent==='Remembered');
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await wait(100);
  ok('next slide is not remembered',$('#remBtn').getAttribute('aria-pressed')==='false');
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await wait(100);
  ok('going back shows it remembered',$('#remBtn').getAttribute('aria-pressed')==='true');
  $('#remBtn').click();ok('tapping again forgets it',notes().length===0);
  $('#remBtn').click();$('#close').click();await wait(200);
  $('#tabNotes').click();await wait(50);
  ok('Notes tab lists it as Remembered',/Remembered/.test($('#notesList').textContent)&&/Add a note/.test($('#notesList').textContent));
  ok('no errors',!errs.length,JSON.stringify(errs));
  console.log(fails?fails+' failed':'all passed');process.exit(fails?1:0)})();
