/* "Just link": saved with the page's Open Graph title and image; opening goes to the original page */
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/const SB_URL='[^']*',SB_KEY='[^']*';/,"const SB_URL='',SB_KEY='';").replace(/<link[^>]+>/g,'');
const page=`<!doctype html><html><head><title>Fallback</title><meta property="og:title" content="A Beautiful Studio Site"><meta property="og:image" content="/img/share.jpg"><meta property="og:site_name" content="Studio Name"></head><body><p>hi</p></body></html>`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(name,cond,extra='')=>{if(!cond)fails++;console.log((cond?'ok   ':'FAIL ')+name+(extra?' | '+extra:''))};
(async()=>{
  const opened=[];
  const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app/',pretendToBeVisual:true,beforeParse(w){
    w.fetch=async(u)=>String(u).startsWith('https://r.jina.ai/')?{ok:true,status:200,text:async()=>page}:Promise.reject(new TypeError('blocked'));
    w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};w.open=(u)=>{opened.push(u);return{}};
    w.localStorage.setItem('folio.queue',JSON.stringify([{id:'s1',url:'https://story.example/a',title:'A story',site:'story.example',status:'new',list:'main'}]));}});
  const w=dom.window,d=w.document,$=s=>d.querySelector(s);const errs=[];w.addEventListener('error',e=>errs.push(e.message));await wait(300);
  $('#openAdd').click();await wait(80);
  $('#kLink').checked=true;$('#segKind').dispatchEvent(new w.Event('change',{bubbles:true}));
  ok('button labels follow the choice',$('#addBtn').textContent==='Add link'&&$('#readNext').textContent==='Add and open',$('#addBtn').textContent);
  $('#links').value='https://studio.example/work';$('#addBtn').click();await wait(200);
  const Q=JSON.parse(w.localStorage.getItem('folio.queue'));const it=Q.find(x=>x.url==='https://studio.example/work');
  ok('saved as a link',it&&it.kind==='link');
  ok('title from og:title',it&&it.title==='A Beautiful Studio Site',it&&it.title);
  ok('image from og:image, absolute',it&&it.img==='https://studio.example/img/share.jpg',it&&it.img);
  ok('site from og:site_name',it&&it.site==='Studio Name',it&&it.site);
  ok('choice remembered',JSON.parse(w.localStorage.getItem('folio.addKind'))==='link');
  // list view shows status "Link" and a thumbnail
  w.localStorage.setItem('folio.view','"list"');
  $('#vList').click();await wait(50);
  const row=[...d.querySelectorAll('#queue li')].find(li=>li.textContent.includes('A Beautiful Studio Site'));
  ok('row shows Link',row&&row.querySelector('.qst')?.textContent==='Link',row&&row.querySelector('.qst')?.textContent);
  ok('row shows image',!!(row&&row.querySelector('img.qthumb')));
  // opening goes to the page, not the reader
  row.querySelector('.qopen').click();await wait(50);
  ok('opens original page',opened[0]==='https://studio.example/work',opened[0]);
  ok('reader stays closed',$('#reader').hidden);
  ok('marked opened',JSON.parse(w.localStorage.getItem('folio.queue')).find(x=>x.kind==='link').status==='read');
  // stories still work; Read next skips links
  ok('story choice still default-able',($('#kStory').checked=true,$('#segKind').dispatchEvent(new w.Event('change',{bubbles:true})),$('#addBtn').textContent==='Add to list'));
  ok('no errors',!errs.length,JSON.stringify(errs));
  console.log(fails?fails+' failed':'all passed');process.exit(fails?1:0)})();
