/* Remember a slide without a note; add an article from the L switcher; note sheet basics */
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/const SB_URL='[^']*',SB_KEY='[^']*';/,"const SB_URL='',SB_KEY='';").replace(/<link[^>]+>/g,'');
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
  ok('Remember sits in the top bar',!!$('.bar #remBtn'));
  ok('site name is a link to the original',$('#srcLink').tagName==='A'&&$('#srcLink').contains($('#av'))&&$('#srcLink').getAttribute('href')===null,'sample has no url');
  ok('Remember shows on a text slide',!$('#remBtn').hidden&&$('#remBtn').getAttribute('aria-pressed')==='false');
  $('#remBtn').click();
  ok('slide remembered without a note',notes().length===1&&notes()[0].like===true&&notes()[0].text===''&&notes()[0].excerpt.length>10&&$('#remBtn').getAttribute('aria-pressed')==='true');
  ok('remembered slide gets the green line',$('#frame').classList.contains('noted'));
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await wait(100);
  ok('next slide is not remembered',$('#remBtn').getAttribute('aria-pressed')==='false');
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await wait(100);
  ok('going back shows it remembered',$('#remBtn').getAttribute('aria-pressed')==='true');
  $('#remBtn').click();ok('tapping again forgets it',notes().length===0);
  // note with a name; green line on the slide; name remembered for next time
  ok('no green line before a note',!$('#frame').classList.contains('noted'));
  $('#noteBtn').click();await wait(80);
  ok('name field is there and optional',!!$('#nName')&&!$('#nName').required);
  $('#nText').value='A good line';$('#nName').value='Sam';$('#nSave').click();await wait(50);
  ok('note saved with the name',notes().some(n=>n.text==='A good line'&&n.by==='Sam'));
  ok('green line on the slide with a note',$('#frame').classList.contains('noted'));
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await wait(100);
  ok('no line on the next slide',!$('#frame').classList.contains('noted'));
  $('#noteFab').click();await wait(80);ok('bottom button opens the same sheet',!$('#noteSheet').hidden&&$('#noteCount2').textContent===$('#noteCount').textContent);ok('name prefilled next time',$('#nName').value==='Sam');
  $('#nName').value='';$('#nText').value='Unsigned';$('#nSave').click();await wait(50);
  ok('a note without a name is fine',notes().some(n=>n.text==='Unsigned'&&!n.by));
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await wait(100);
  $('#remBtn').click();$('#close').click();await wait(200);
  $('#tabNotes').click();await wait(50);
  ok('Notes tab shows the name',[...d.querySelectorAll('#notesList .nwho')].some(x=>x.textContent==='Sam'));
  ok('remembered slide kept (merged with the written note on that slide)',notes().some(n=>n.like&&n.text==='A good line'));
  // bottom note button + setting
  ok('default: note button bottom right',d.documentElement.dataset.notepos==='bottom'&&!$('#stage').contains($('#noteFab')));
  ok('setting offers top/bottom',d.querySelectorAll('#segNotePos input').length===2);
  const top=d.querySelector('#segNotePos input[value="top"]');top.checked=true;top.onchange();
  ok('switch to top bar',d.documentElement.dataset.notepos==='top');
  ok('no errors',!errs.length,JSON.stringify(errs));
  console.log(fails?fails+' failed':'all passed');process.exit(fails?1:0)})();
