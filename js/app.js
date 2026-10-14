const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const DEF={mode:'auto',bright:0,contrast:10,thr:50,white:60,keep:true,denoise:false};
const NAMES={ink:'Ink Saver',gray:'Grayscale',bw:'Sharp B&W',auto:'Smart Auto'};
let S={...DEF},hist=[],last=JSON.stringify(S),pages=[],entries=[],cur=0,zoom=1,view='slider',pos=50,tok=0,deb;
const tick=()=>new Promise(r=>setTimeout(r,25));
const fmtSize=b=>b>1e6?(b/1e6).toFixed(1)+' MB':Math.round(b/1e3)+' KB';
function toast(m,e){const d=document.createElement('div');d.textContent=m;if(e)d.className='e';$('#toast').append(d);setTimeout(()=>d.remove(),e?6000:3000)}
function busy(on,t){$('#busy').hidden=!on;if(t)$('#busyt').textContent=t}
if(window.pdfjsLib)pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/* ---------- upload ---------- */
const drop=$('#drop'),inp=$('#file');
drop.onclick=()=>inp.click();drop.onkeydown=e=>e.key==='Enter'&&inp.click();
inp.onchange=()=>{addFiles([...inp.files]);inp.value=''};
['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>addFiles([...e.dataTransfer.files]));
function readBuf(f,cb){return new Promise((res,rej)=>{const r=new FileReader();r.onprogress=e=>e.lengthComputable&&cb(e.loaded/e.total*40);r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('Could not read file'));r.readAsArrayBuffer(f)})}
function toCanvas(src,w,h,max=2400){const s=Math.min(1,max/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.round(w*s);c.height=Math.round(h*s);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(src,0,0,c.width,c.height);return c}
async function addFiles(list){
 for(const f of list){
  const ent={name:f.name,size:f.size,n:0},li=document.createElement('li');
  li.innerHTML='<div class=nm></div><div class=meta></div><div class=pb><i></i></div><button class=x title=Remove>×</button>';
  li.querySelector('.nm').textContent=f.name;const meta=li.querySelector('.meta'),bar=li.querySelector('i');
  const prog=p=>bar.style.width=p+'%',set=t=>meta.textContent=fmtSize(f.size)+' · '+t;
  li.querySelector('.x').onclick=()=>{pages=pages.filter(p=>p.ent!==ent);li.remove();cur=Math.min(cur,Math.max(0,pages.length-1));render()};
  $('#files').append(li);set('reading…');
  try{
   const pdf=/\.pdf$/i.test(f.name)||f.type==='application/pdf',img=/\.(jpe?g|png)$/i.test(f.name)||/^image\/(jpeg|png)$/.test(f.type);
   if(!pdf&&!img)throw new Error('Unsupported file type. Use JPG, PNG or PDF.');
   if(f.size>80e6)throw new Error('File too large (max 80 MB).');
   if(f.size===0)throw new Error('File is empty.');
   const buf=await readBuf(f,prog);
   if(pdf){
    if(!window.pdfjsLib)throw new Error('PDF library failed to load (check internet/CDN).');
    const doc=await pdfjsLib.getDocument({data:buf}).promise;
    for(let i=1;i<=doc.numPages;i++){set(`decoding page ${i}/${doc.numPages}`);const pg=await doc.getPage(i),v1=pg.getViewport({scale:1}),sc=2300/Math.max(v1.width,v1.height),v=pg.getViewport({scale:sc}),c=document.createElement('canvas');
     c.width=Math.round(v.width);c.height=Math.round(v.height);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:x,viewport:v}).promise;
     pages.push({ent,src:c,orig:c,rot:0,label:f.name+(doc.numPages>1?` – p${i}/${doc.numPages}`:'')});ent.n++;prog(40+60*i/doc.numPages)}
   }else{
    const bmp=await createImageBitmap(new Blob([buf],{type:f.type||'image/jpeg'}));
    {const cv=toCanvas(bmp,bmp.width,bmp.height,3000);pages.push({ent,src:cv,orig:cv,rot:0,label:f.name})};ent.n=1;prog(100)}
   set(ent.n+(ent.n>1?' pages':' page'));
   if(pages.length===ent.n)$('#orient').value=pages[0].src.width>pages[0].src.height?'landscape':'portrait';
   if(pages.length&&ent.n)cur=pages.indexOf(pages.find(p=>p.ent===ent));
   render();
  }catch(e){meta.innerHTML='<span class=err></span>';meta.firstChild.textContent=e.message||'Failed to process file';bar.style.background='#c0262d';toast(f.name+': '+(e.message||'error'),1)}
 }
}

/* ---------- processing & rendering ---------- */
function rot(c,deg){deg=((deg%360)+360)%360;if(!deg)return c;const o=document.createElement('canvas'),sw=deg%180;o.width=sw?c.height:c.width;o.height=sw?c.width:c.height;const x=o.getContext('2d');x.translate(o.width/2,o.height/2);x.rotate(deg*Math.PI/180);x.drawImage(c,-c.width/2,-c.height/2);return o}
async function getOut(p){const k=JSON.stringify(S);if(p.key===k)return p.out;await tick();const r=Proc.run(p.src,S);Object.assign(p,{out:r.canvas,info:r.mode,saved:r.saved,key:k});return p.out}
function applyZoom(){const st=$('#stage');$('#frame').style.width=Math.max(120,(st.clientWidth-24)*zoom)+'px';$('#zl').textContent=Math.round(zoom*100)+'%'}
function setPos(v){pos=Math.max(0,Math.min(100,v));$('#hdl').style.left=pos+'%';$('#cO').style.clipPath=`inset(0 ${100-pos}% 0 0)`}
async function render(){
 const has=pages.length>0;$('#empty').hidden=has;$('#frame').hidden=!has;
 $('#pgl').textContent=has?`${cur+1} / ${pages.length} · ${pages[cur].label}`:'No pages';
 if(!has){$('#stat').textContent='';return}
 const t=++tok,p=pages[cur];busy(true,'Processing page…');
 try{const out=await getOut(p);if(t!==tok)return;
  for(const [id,c] of [['#cO',p.src],['#cP',out]]){const r=rot(c,p.rot),e=$(id);e.width=r.width;e.height=r.height;e.getContext('2d').drawImage(r,0,0)}
  applyZoom();setPos(pos);
  $('#autoinfo').textContent=S.mode==='auto'?`Auto selected: ${NAMES[p.info]}`:'';
  $('#stat').textContent=`${NAMES[p.info]} · ${p.src.width}×${p.src.height}px · estimated ink saved ≈ ${p.saved}%`;
 }catch(e){toast('Processing failed: '+e.message,1)}finally{if(t===tok)busy(false)}}
function go(i){if(!pages.length)return;cur=(i+pages.length)%pages.length;render()}
$('#pp').onclick=()=>go(cur-1);$('#pn').onclick=()=>go(cur+1);
addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(e.target.tagName)||!$('#cropm').hidden)return;if(e.key==='ArrowLeft')go(cur-1);if(e.key==='ArrowRight')go(cur+1)});
$('#zi').onclick=()=>{zoom=Math.min(5,zoom*1.25);applyZoom()};$('#zo').onclick=()=>{zoom=Math.max(.25,zoom/1.25);applyZoom()};
$('#fit').onclick=()=>{if(!pages.length)return;const st=$('#stage'),c=$('#cP'),a=c.height/c.width*(view==='side'?.5:1);zoom=Math.min(1,(st.clientHeight-30)/((st.clientWidth-24)*a));applyZoom()};
$('#rl').onclick=()=>rotate(-90);$('#rr').onclick=()=>rotate(90);
function rotate(d){if(pages.length){pages[cur].rot+=d;render()}}
$('#vw').onclick=()=>{view=view==='slider'?'side':'slider';$('#frame').classList.toggle('side',view==='side');$('#vw').textContent=view==='side'?'Slider compare':'Side by side';applyZoom()};
addEventListener('resize',applyZoom);
(()=>{let drag=false;const mv=e=>{const r=$('#frame').getBoundingClientRect();setPos((e.clientX-r.left)/r.width*100)};
 $('#hdl').onpointerdown=e=>{drag=true;e.target.setPointerCapture?.(e.pointerId);e.preventDefault()};
 addEventListener('pointermove',e=>drag&&mv(e));addEventListener('pointerup',()=>drag=false);
 $('#frame').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&view==='slider'&&e.target.tagName==='CANVAS')mv(e)})})();

/* ---------- controls, undo/reset/reprocess ---------- */
function sync(){$$('#modes button').forEach(b=>b.classList.toggle('on',b.dataset.m===S.mode));
 for(const k of['bright','contrast','thr','white']){$('#'+k).value=S[k];$('#o_'+k).textContent=S[k]}$('#keep').checked=S.keep;$('#denoise').checked=S.denoise}
function commit(){const j=JSON.stringify(S);if(j!==last){hist.push(last);last=j}}
function changed(now){clearTimeout(deb);deb=setTimeout(render,now?0:150)}
$$('#modes button').forEach(b=>b.onclick=()=>{S.mode=b.dataset.m;sync();commit();changed(1)});
for(const k of['bright','contrast','thr','white']){const e=$('#'+k);e.oninput=()=>{S[k]=+e.value;$('#o_'+k).textContent=e.value;changed()};e.onchange=commit}
for(const k of['keep','denoise'])$('#'+k).onchange=e=>{S[k]=e.target.checked;commit();changed(1)};
$('#undo').onclick=()=>{if(!hist.length)return toast('Nothing to undo');S=JSON.parse(hist.pop());last=JSON.stringify(S);sync();changed(1)};
$('#reset').onclick=()=>{S={...DEF};commit();sync();pages.forEach(p=>p.rot=0);changed(1)};
$('#reproc').onclick=()=>{pages.forEach(p=>p.key=null);render()};

/* ---------- export / print ---------- */
const needPages=()=>pages.length?true:(toast('Upload a document first',1),false);
const isPng=p=>$('#fmt').value==='png';
async function outCanvas(p){return rot(await getOut(p),p.rot)}
function save(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
const base=p=>p.label.replace(/\.[^.]+/,'').replace(/[^\w\-]+/g,'_');
async function dlImage(p){const c=await outCanvas(p),png=isPng();await new Promise(r=>c.toBlob(b=>{save(b,`${base(p)}_ChalanPrint.${png?'png':'jpg'}`);r()},png?'image/png':'image/jpeg',.95))}
$('#dlimg').onclick=async()=>{if(!needPages())return;busy(true,'Preparing image…');try{await dlImage(pages[cur])}catch(e){toast(e.message,1)}busy(false)};
$('#dlall').onclick=async()=>{if(!needPages())return;try{for(let i=0;i<pages.length;i++){busy(true,`Exporting ${i+1}/${pages.length}…`);await dlImage(pages[i]);await new Promise(r=>setTimeout(r,350))}toast('Done. Allow multiple downloads if your browser asks.')}catch(e){toast(e.message,1)}busy(false)};
$('#dlpdf').onclick=async()=>{if(!needPages())return;if(!window.jspdf)return toast('PDF library failed to load (check internet/CDN).',1);
 try{const o=$('#orient').value,pdf=new jspdf.jsPDF({orientation:o,unit:'mm',format:'a4'}),W=pdf.internal.pageSize.getWidth(),H=pdf.internal.pageSize.getHeight(),m=8;
  for(let i=0;i<pages.length;i++){busy(true,`Building PDF ${i+1}/${pages.length}…`);const p=pages[i],c=await outCanvas(p),s=Math.min((W-2*m)/c.width,(H-2*m)/c.height),w=c.width*s,h=c.height*s,png=p.info==='bw'||isPng();
   if(i)pdf.addPage('a4',o);pdf.addImage(c.toDataURL(png?'image/png':'image/jpeg',.92),png?'PNG':'JPEG',(W-w)/2,(H-h)/2,w,h,undefined,'FAST');await tick()}
  pdf.save('ChalanPrint_'+new Date().toISOString().slice(0,10)+'.pdf')}catch(e){toast('PDF failed: '+e.message,1)}busy(false)};
$('#prev').onclick=async()=>{if(!needPages())return;const o=$('#orient').value,sh=$('#sheets'),pa=$('#printArea');sh.innerHTML=pa.innerHTML='';
 try{for(let i=0;i<pages.length;i++){busy(true,`Preparing preview ${i+1}/${pages.length}…`);const c=await outCanvas(pages[i]),u=c.toDataURL(pages[i].info==='bw'?'image/png':'image/jpeg',.92);
  sh.insertAdjacentHTML('beforeend',`<div class="sheet ${o}"><img src="${u}"></div>`);
  pa.insertAdjacentHTML('beforeend',`<div class=pg style="height:${o==='portrait'?281:194}mm"><img src="${u}"></div>`)}
  let st=$('#pstyle');if(!st){st=document.createElement('style');st.id='pstyle';document.head.append(st)}st.textContent=`@page{size:A4 ${o};margin:8mm}`;
  $('#modal').hidden=false}catch(e){toast(e.message,1)}busy(false)};
$('#closem').onclick=()=>$('#modal').hidden=true;$('#doprint').onclick=()=>window.print();
sync();render();

$('#printnow').onclick=async()=>{if(!needPages())return;await $('#prev').onclick();$('#modal').hidden=true;setTimeout(()=>window.print(),150)};
$('#clear').onclick=()=>{pages=[];cur=0;hist=[];$('#files').innerHTML='';$('#sheets').innerHTML=$('#printArea').innerHTML='';for(const id of['#cO','#cP']){$(id).width=$(id).height=0}render();toast('All documents cleared from memory')};
addEventListener('beforeunload',()=>{pages=[]});
