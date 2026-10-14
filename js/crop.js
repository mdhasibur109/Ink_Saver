/* Crop tools: rectangular crop (lossless pixel copy) + perspective crop (homography + bilinear warp).
   All maths is local. Selection is stored in ORIGINAL-image pixels, so zoom/pan never causes drift. */
const Crop=(()=>{
const E=id=>document.getElementById(id),cv=E('ccv'),g=cv.getContext('2d'),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let isOpen=false,page,img,tool,rect,pts,ratio=0,V={s:1,ox:0,oy:0},drag=null,pan=false,space=false,CW=0,CH=0;
const HN=['nw','n','ne','e','se','s','sw','w'],iw=()=>img.width,ih=()=>img.height;
const S2I=(px,py)=>[(px-V.ox)/V.s,(py-V.oy)/V.s],I2S=(x,y)=>[x*V.s+V.ox,y*V.s+V.oy];
function size(){const r=cv.parentElement.getBoundingClientRect(),d=devicePixelRatio||1;CW=r.width;CH=r.height;cv.width=CW*d;cv.height=CH*d;cv.style.width=CW+'px';cv.style.height=CH+'px';g.setTransform(d,0,0,d,0,0)}
function fit(){V.s=Math.min(CW/iw(),CH/ih())*.94;V.ox=(CW-iw()*V.s)/2;V.oy=(CH-ih()*V.s)/2;draw()}
function zoomAt(f,px,py){const ns=clamp(V.s*f,.02,16);f=ns/V.s;V.ox=px-(px-V.ox)*f;V.oy=py-(py-V.oy)*f;V.s=ns;draw()}
const order=p=>{const s=p.map(a=>a[0]+a[1]),d=p.map(a=>a[0]-a[1]),ix=(arr,f)=>arr.indexOf(f(...arr));return[p[ix(s,Math.min)],p[ix(d,Math.max)],p[ix(s,Math.max)],p[ix(d,Math.min)]]};
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function outSize(){const q=order(pts);let W=Math.max(dist(q[0],q[1]),dist(q[3],q[2])),H=Math.max(dist(q[0],q[3]),dist(q[1],q[2])),k=Math.min(1,4200/Math.max(W,H,1));return[Math.round(W*k),Math.round(H*k),q]}
function hpos(){const[x0,y0]=I2S(rect.x,rect.y),x1=x0+rect.w*V.s,y1=y0+rect.h*V.s,xm=(x0+x1)/2,ym=(y0+y1)/2;return[[x0,y0],[xm,y0],[x1,y0],[x1,ym],[x1,y1],[xm,y1],[x0,y1],[x0,ym]]}
function draw(){if(!isOpen)return;g.clearRect(0,0,CW,CH);g.fillStyle='#252a33';g.fillRect(0,0,CW,CH);g.imageSmoothingQuality='high';g.drawImage(img,V.ox,V.oy,iw()*V.s,ih()*V.s);
 g.save();g.beginPath();g.rect(0,0,CW,CH);
 if(tool==='rect'){const[a,b]=I2S(rect.x,rect.y),w=rect.w*V.s,h=rect.h*V.s;g.rect(a,b,w,h);g.fillStyle='#000a';g.fill('evenodd');g.restore();
  g.strokeStyle='#fff';g.lineWidth=1.5;g.strokeRect(a,b,w,h);g.strokeStyle='#fff6';g.lineWidth=1;g.beginPath();for(let i=1;i<3;i++){g.moveTo(a+w*i/3,b);g.lineTo(a+w*i/3,b+h);g.moveTo(a,b+h*i/3);g.lineTo(a+w,b+h*i/3)}g.stroke();
  g.fillStyle='#fff';g.strokeStyle='#1d6fe0';g.lineWidth=2;for(const[x,y]of hpos()){g.fillRect(x-6,y-6,12,12);g.strokeRect(x-6,y-6,12,12)}
 }else{const P=pts.map(p=>I2S(p[0],p[1]));P.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fillStyle='#000a';g.fill('evenodd');g.restore();
  g.beginPath();P.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.strokeStyle='#1d6fe0';g.lineWidth=2;g.stroke();
  P.forEach((p,i)=>{g.beginPath();g.arc(p[0],p[1],11,0,7);g.fillStyle='#fff';g.fill();g.stroke();g.fillStyle='#1d6fe0';g.font='bold 12px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(i+1,p[0],p[1])})}
 info()}
function info(){let t=`Image ${iw()}×${ih()}px · Zoom ${Math.round(V.s*100)}%`;
 if(tool==='rect'){const r=rect;t=`Selection ${Math.round(r.w)} × ${Math.round(r.h)} px at (${Math.round(r.x)}, ${Math.round(r.y)}) · `+t;
  for(const[k,v]of[['cx',r.x],['cy',r.y],['cw',r.w],['ch',r.h]])if(document.activeElement!==E(k))E(k).value=Math.round(v)}
 else{const[W,H]=outSize();t=`Corrected output ${W} × ${H} px · `+t}
 E('cinfo').textContent=t+(tool==='rect'?' · Drag outside to draw, handles to resize, inside to move.':' · Drag the 4 corners (or inside to move all). Order is detected automatically.')}
const defRect=()=>({x:iw()*.05,y:ih()*.05,w:iw()*.9,h:ih()*.9}),defPts=()=>[[.08,.08],[.92,.08],[.92,.92],[.08,.92]].map(p=>[p[0]*iw(),p[1]*ih()]);
function openEd(t){if(!pages.length)return toast('Upload a document first',1);page=pages[cur];img=page.orig;tool=t;const c=page.crop;
 rect=c&&c.tool===t&&c.rect?{...c.rect}:defRect();pts=c&&c.tool===t&&c.pts?c.pts.map(p=>[...p]):defPts();ratio=0;E('cratio').value='0';
 E('ctitle').textContent=t==='rect'?'Rectangular Crop':'Perspective Crop';document.querySelectorAll('.ronly').forEach(e=>e.style.display=t==='rect'?'':'none');document.querySelectorAll('.ponly').forEach(e=>e.style.display=t==='persp'?'':'none');
 E('cropm').hidden=false;isOpen=true;size();fit()}
function close(){isOpen=false;E('cropm').hidden=true;drag=null}
/* ----- interaction ----- */
const pp=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
function hitH(px,py){let b=null,bd=18;hpos().forEach((p,i)=>{const d=Math.hypot(p[0]-px,p[1]-py);if(d<bd){bd=d;b=HN[i]}});return b}
const inRect=(ix,iy)=>ix>=rect.x&&iy>=rect.y&&ix<=rect.x+rect.w&&iy<=rect.y+rect.h;
function inPoly(x,y){let c=false;for(let i=0,j=3;i<4;j=i++){const a=pts[i],b=pts[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
cv.addEventListener('pointerdown',e=>{if(!isOpen)return;cv.setPointerCapture(e.pointerId);const[px,py]=pp(e),[ix,iy]=S2I(px,py);
 if(pan||space||e.button===1){drag={t:'pan',px,py,ox:V.ox,oy:V.oy};return}
 if(tool==='rect'){const h=hitH(px,py);drag=h?{t:'rs',h,r0:{...rect}}:inRect(ix,iy)?{t:'mv',ix,iy,r0:{...rect}}:{t:'new',ix:clamp(ix,0,iw()),iy:clamp(iy,0,ih())}}
 else{let bi=-1,bd=26;pts.forEach((p,i)=>{const[sx,sy]=I2S(p[0],p[1]),d=Math.hypot(sx-px,sy-py);if(d<bd){bd=d;bi=i}});
  drag=bi>=0?{t:'pt',i:bi}:inPoly(ix,iy)?{t:'all',ix,iy,p0:pts.map(p=>[...p])}:{t:'pan',px,py,ox:V.ox,oy:V.oy}}});
cv.addEventListener('pointermove',e=>{if(!isOpen)return;const[px,py]=pp(e),[ix,iy]=S2I(px,py),W=iw(),H=ih();
 if(!drag){cv.style.cursor=pan||space?'grab':tool==='rect'?(hitH(px,py)?'pointer':inRect(ix,iy)?'move':'crosshair'):'crosshair';return}
 const d=drag;
 if(d.t==='pan'){V.ox=d.ox+px-d.px;V.oy=d.oy+py-d.py}
 else if(d.t==='pt')pts[d.i]=[clamp(ix,0,W),clamp(iy,0,H)];
 else if(d.t==='all'){let dx=ix-d.ix,dy=iy-d.iy;for(const p of d.p0){dx=clamp(dx,-p[0],W-p[0]);dy=clamp(dy,-p[1],H-p[1])}pts=d.p0.map(p=>[p[0]+dx,p[1]+dy])}
 else if(d.t==='mv'){rect.x=clamp(d.r0.x+ix-d.ix,0,W-rect.w);rect.y=clamp(d.r0.y+iy-d.iy,0,H-rect.h)}
 else if(d.t==='new'){let w=Math.abs(clamp(ix,0,W)-d.ix),h=ratio?w/ratio:Math.abs(clamp(iy,0,H)-d.iy);const sx=ix<d.ix?-1:1,sy=iy<d.iy?-1:1,x2=d.ix+sx*w,y2=d.iy+sy*h;
  if(w>=2&&h>=2&&x2>=0&&x2<=W&&y2>=0&&y2<=H)rect={x:Math.min(d.ix,x2),y:Math.min(d.iy,y2),w,h}}
 else if(d.t==='rs'){const h=d.h,r0=d.r0;let l=r0.x,t=r0.y,r=l+r0.w,b=t+r0.h;
  if(h.includes('w'))l=clamp(ix,0,r-8);if(h.includes('e'))r=clamp(ix,l+8,W);if(h.includes('n'))t=clamp(iy,0,b-8);if(h.includes('s'))b=clamp(iy,t+8,H);
  if(ratio){const w=r-l,hh=b-t;if(h.length===2){const nh=w/ratio;if(h.includes('n'))t=b-nh;else b=t+nh}
   else if(h==='n'||h==='s'){const nw=hh*ratio,c=(l+r)/2;l=c-nw/2;r=c+nw/2}else{const nh=w/ratio,c=(t+b)/2;t=c-nh/2;b=c+nh/2}
   if(l<0||t<0||r>W||b>H)return}
  rect={x:l,y:t,w:r-l,h:b-t}}
 draw()});
const up=()=>{drag=null};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{if(!isOpen)return;e.preventDefault();const[px,py]=pp(e);zoomAt(Math.exp(-e.deltaY*.0015),px,py)},{passive:false});
addEventListener('resize',()=>{if(isOpen){size();draw()}});
E('czi').onclick=()=>zoomAt(1.25,CW/2,CH/2);E('czo').onclick=()=>zoomAt(.8,CW/2,CH/2);E('cfit').onclick=fit;
E('cpan').onclick=()=>{pan=!pan;E('cpan').classList.toggle('on',pan)};
E('cratio').onchange=e=>{const v=e.target.value;ratio=v==='o'?iw()/ih():+v;if(!ratio)return;let w=rect.w,h=w/ratio;const k=Math.min(1,iw()/w,ih()/h);w*=k;h*=k;
 const cx=rect.x+rect.w/2,cy=rect.y+rect.h/2;rect={x:clamp(cx-w/2,0,iw()-w),y:clamp(cy-h/2,0,ih()-h),w,h};draw()};
['cx','cy','cw','ch'].forEach(id=>E(id).onchange=()=>{let x=+E('cx').value,y=+E('cy').value,w=+E('cw').value,h=+E('ch').value;if(ratio){if(id==='cw')h=w/ratio;else if(id==='ch')w=h*ratio}
 w=clamp(w,8,iw());h=clamp(h,8,ih());rect={x:clamp(x,0,iw()-w),y:clamp(y,0,ih()-h),w,h};draw()});
E('creset').onclick=()=>{rect=defRect();pts=defPts();ratio=0;E('cratio').value='0';fit()};
E('cauto').onclick=()=>{busy(true,'Detecting document edges…');setTimeout(()=>{try{const r=detect();if(r){pts=r;draw();toast('Edges detected – fine-tune the corners if needed')}else toast('Could not detect edges reliably. Place the corners manually.',1)}finally{busy(false)}},30)};
E('ccancel').onclick=close;E('capply').onclick=applyCrop;
addEventListener('keydown',e=>{if(!isOpen)return;const inp=/INPUT|SELECT/.test(e.target.tagName);
 if(e.key==='Escape')close();else if(e.key==='Enter'&&!inp)applyCrop();else if(e.key===' '&&!inp){space=true;e.preventDefault()}});
addEventListener('keyup',e=>{if(e.key===' ')space=false});
/* ----- apply ----- */
function cropRect(){const x=Math.round(rect.x),y=Math.round(rect.y),w=Math.max(1,Math.min(Math.round(rect.w),iw()-x)),h=Math.max(1,Math.min(Math.round(rect.h),ih()-y)),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,x,y,w,h,0,0,w,h);return c}
function homog(D,Sr){const A=[];for(let i=0;i<4;i++){const[u,v]=D[i],[x,y]=Sr[i];A.push([u,v,1,0,0,0,-x*u,-x*v,x],[0,0,0,u,v,1,-y*u,-y*v,y])}
 for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];if(Math.abs(A[c][c])<1e-12)throw new Error('Corners are invalid (collinear). Move them apart.');
  for(let r=0;r<8;r++)if(r!==c){const f=A[r][c]/A[c][c];for(let k=c;k<9;k++)A[r][k]-=f*A[c][k]}}
 return A.map((r,i)=>r[8]/r[i])}
function warp(){const[W,H,q]=outSize();if(W<20||H<20)throw new Error('Selection too small');
 const m=homog([[0,0],[W,0],[W,H],[0,H]],q),sw=iw(),sh=ih(),s=img.getContext('2d').getImageData(0,0,sw,sh).data,out=new ImageData(W,H),o=out.data;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=x+.5,v=y+.5,z=m[6]*u+m[7]*v+1,sx=(m[0]*u+m[1]*v+m[2])/z-.5,sy=(m[3]*u+m[4]*v+m[5])/z-.5,j=(y*W+x)*4;
  if(sx<-.5||sy<-.5||sx>sw-.5||sy>sh-.5){o[j]=o[j+1]=o[j+2]=o[j+3]=255;continue}
  const x0=Math.max(0,Math.floor(sx)),y0=Math.max(0,Math.floor(sy)),x1=Math.min(sw-1,x0+1),y1=Math.min(sh-1,y0+1),fx=Math.max(0,sx-x0),fy=Math.max(0,sy-y0),a=(y0*sw+x0)*4,b=(y0*sw+x1)*4,c=(y1*sw+x0)*4,d=(y1*sw+x1)*4;
  for(let k=0;k<3;k++)o[j+k]=(s[a+k]*(1-fx)+s[b+k]*fx)*(1-fy)+(s[c+k]*(1-fx)+s[d+k]*fx)*fy;o[j+3]=255}
 const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').putImageData(out,0,0);return c}
function applyCrop(){if(!isOpen)return;busy(true,'Applying crop…');setTimeout(()=>{try{const res=tool==='rect'?cropRect():warp();
 page.src=res;page.key=null;page.crop={tool,rect:{...rect},pts:pts.map(p=>[...p])};close();render();toast(`Crop applied: ${res.width}×${res.height}px. Reopen Crop tools to adjust.`)}
 catch(e){toast(e.message||'Crop failed',1)}finally{busy(false)}},30)}
/* ----- optional auto edge detection: blur -> Otsu -> largest blob -> extreme corners ----- */
function blur(a,w,h){const t=new Float32Array(a.length),o=new Float32Array(a.length);Proc.pass(a,t,w,h,1,w,1,0);Proc.pass(t,o,h,w,w,1,1,0);return o}
function comp(m,w,h){const vis=new Uint8Array(w*h),st=[];let best=null;
 for(let s=0;s<w*h;s++){if(!m[s]||vis[s])continue;let a=0,t=0;const e=[[1e9],[-1e9],[-1e9],[1e9]];st.push(s);vis[s]=1;
  while(st.length){const i=st.pop(),x=i%w,y=(i/w)|0;a++;if(!x)t|=1;if(!y)t|=2;if(x===w-1)t|=4;if(y===h-1)t|=8;const s1=x+y,s2=x-y;
   if(s1<e[0][0])e[0]=[s1,x,y];if(s1>e[1][0])e[1]=[s1,x,y];if(s2>e[2][0])e[2]=[s2,x,y];if(s2<e[3][0])e[3]=[s2,x,y];
   for(const n of[x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(n>=0&&m[n]&&!vis[n]){vis[n]=1;st.push(n)}}
  if(!best||a>best.a)best={a,t,e}}return best}
function detect(){const sc=Math.min(1,320/Math.max(iw(),ih())),w=Math.round(iw()*sc),h=Math.round(ih()*sc),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(img,0,0,w,h);
 const d=x.getImageData(0,0,w,h).data,N=w*h;let gr=new Float32Array(N);for(let i=0;i<N;i++)gr[i]=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];gr=blur(blur(gr,w,h),w,h);
 const hi=new Float64Array(256);for(let i=0;i<N;i++)hi[gr[i]|0]++;let sum=0;for(let i=0;i<256;i++)sum+=i*hi[i];let wb=0,sb=0,mx=0,th=128;
 for(let i=0;i<256;i++){wb+=hi[i];if(!wb)continue;const wf=N-wb;if(!wf)break;sb+=i*hi[i];const v=wb*wf*Math.pow(sb/wb-(sum-sb)/wf,2);if(v>mx){mx=v;th=i}}
 let best=null,bs=0;for(const pol of[1,0]){const m=new Uint8Array(N);for(let i=0;i<N;i++)m[i]=(gr[i]>th)===!!pol?1:0;const r=comp(m,w,h);if(!r)continue;
  const touch=[1,2,4,8].filter(b=>r.t&b).length,f=r.a/N,sc2=touch<3&&f>.12?f:0;if(sc2>bs){bs=sc2;best=r}}
 return best?[best.e[0],best.e[2],best.e[1],best.e[3]].map(p=>[(p[1]+.5)/sc,(p[2]+.5)/sc]):null}
/* ----- menu wiring ----- */
E('cropbtn').onclick=e=>{e.stopPropagation();E('cropmenu').hidden=!E('cropmenu').hidden};
document.addEventListener('click',()=>E('cropmenu').hidden=true);
document.querySelectorAll('#cropmenu [data-t]').forEach(b=>b.onclick=()=>openEd(b.dataset.t));
E('cropoff').onclick=()=>{if(!pages.length)return toast('Upload a document first',1);const p=pages[cur];p.src=p.orig;p.crop=null;p.key=null;render();toast('Restored the uncropped page')};
return{openEd}})();
