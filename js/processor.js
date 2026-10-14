/* ChalanPrint image engine – pure JS, runs locally. No generative AI: only pixel math.
   Pipeline: luminance -> background estimation (block max + dilate + blur) -> illumination
   normalisation (colored/shaded paper becomes white) -> optional denoise -> mode-specific tone
   mapping or integral-image adaptive threshold -> optional colored logo/stamp preservation. */
const Proc=(()=>{
const clamp=v=>v<0?0:v>255?255:v;
function gray(d,N){const g=new Float32Array(N);for(let i=0,j=0;j<N;i+=4,j++)g[j]=.299*d[i]+.587*d[i+1]+.114*d[i+2];return g}
// 1-D box mean (mx=0) or max (mx=1) pass over `lines` lines of length n
function pass(s,d,n,lines,st,ls,r,mx){for(let l=0;l<lines;l++){const b=l*ls;for(let i=0;i<n;i++){let m=mx?-1:0,c=0;
 for(let k=Math.max(0,i-r),e=Math.min(n-1,i+r);k<=e;k++){const v=s[b+k*st];if(mx){if(v>m)m=v}else{m+=v;c++}}d[b+i*st]=mx?m:m/c}}}
function sep(a,w,h,r,mx){const t=new Float32Array(a.length),o=new Float32Array(a.length);pass(a,t,w,h,1,w,r,mx);pass(t,o,h,w,w,1,r,mx);return o}
function bgEstimate(g,w,h){
 const s=Math.max(6,Math.round(Math.max(w,h)/160)),sw=Math.ceil(w/s),sh=Math.ceil(h/s);let a=new Float32Array(sw*sh);
 for(let y=0;y<h;y++){const r=(y/s|0)*sw;for(let x=0;x<w;x++){const k=r+(x/s|0),v=g[y*w+x];if(v>a[k])a[k]=v}}
 a=sep(a,sw,sh,2,1);a=sep(a,sw,sh,2,0);a=sep(a,sw,sh,1,0);
 const bg=new Float32Array(w*h);
 for(let y=0;y<h;y++){const fy=Math.min(sh-1.001,Math.max(0,y/s-.5)),y0=fy|0,ty=fy-y0;
  for(let x=0;x<w;x++){const fx=Math.min(sw-1.001,Math.max(0,x/s-.5)),x0=fx|0,tx=fx-x0,i=y0*sw+x0;
   bg[y*w+x]=(a[i]*(1-tx)+a[i+1]*tx)*(1-ty)+(a[i+sw]*(1-tx)+a[i+sw+1]*tx)*ty}}
 return bg}
function analyze(d,g,N){let col=0,mid=0,c=0;const hist=new Uint32Array(256);
 for(let i=0;i<N;i+=7){const j=i*4,mx=Math.max(d[j],d[j+1],d[j+2]),mn=Math.min(d[j],d[j+1],d[j+2]);c++;
  if(mx>80&&(mx-mn)/mx>.25)col++;const v=g[i]|0;hist[v]++;if(v>60&&v<190)mid++}
 let acc=0,p90=255;for(let v=0;v<256;v++){acc+=hist[v];if(acc>=c*.1){p90=v;break}} // 10th pct = typical paper tone (bright side handled below)
 let tot=0,p50=0;for(let v=0;v<256;v++){tot+=hist[v];if(tot>=c*.5){p50=v;break}}
 if(col/c>.12||p50<205)return'ink';if(mid/c<.1)return'bw';if(mid/c>.35)return'gray';return'ink'}
function run(src,o){
 const w=src.width,h=src.height,N=w*h,d=src.getContext('2d').getImageData(0,0,w,h).data,g=gray(d,N);
 const mode=o.mode==='auto'?analyze(d,g,N):o.mode,bg=bgEstimate(g,w,h),n=new Float32Array(N);let inkIn=0;
 for(let i=0;i<N;i++){n[i]=clamp(g[i]/Math.max(bg[i],40)*255);inkIn+=255-Math.min(d[i*4],d[i*4+1],d[i*4+2])}
 if(o.denoise){const t=new Float32Array(N),b=new Float32Array(N);pass(n,t,w,h,1,w,1,0);pass(t,b,h,w,w,1,1,0);for(let i=0;i<N;i++)n[i]=(n[i]+b[i])/2}
 const wp=mode==='gray'?255-o.white*.35:Math.max(150,250-o.white*.9),k=1+o.contrast/50,bo=o.bright*1.3;
 let I=null,rad=0,t=0;
 if(mode==='bw'){const W=w+1;I=new Float64Array(W*(h+1));for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=n[y*w+x];I[(y+1)*W+x+1]=I[y*W+x+1]+row}}
  rad=Math.max(10,Math.round(Math.max(w,h)/70));t=.30-o.thr/100*.25-o.bright/400}
 const out=new Uint8ClampedArray(N*4);let inkOut=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,j=i*4,r=d[j],gg=d[j+1],b=d[j+2],mx=Math.max(r,gg,b),mn=Math.min(r,gg,b),nv=n[i];let R,G,B;
  if(o.keep&&mx>110&&(mx-mn)/mx>.4&&nv<215){const f=65025/(Math.max(bg[i],40)*wp);R=clamp(r*f);G=clamp(gg*f);B=clamp(b*f)}
  else{let v;
   if(mode==='bw'){const x0=Math.max(0,x-rad),x1=Math.min(w,x+rad+1),y0=Math.max(0,y-rad),y1=Math.min(h,y+rad+1),W=w+1;
    const m=(I[y1*W+x1]-I[y0*W+x1]-I[y1*W+x0]+I[y0*W+x0])/((x1-x0)*(y1-y0));
    v=(nv>=wp||!(nv<m*(1-t)||nv<60+o.thr*.5))?255:0}
   else{v=clamp(nv/wp*255);v=clamp((v-128)*k+128+bo)}
   R=G=B=v}
  out[j]=R;out[j+1]=G;out[j+2]=B;out[j+3]=255;inkOut+=255-Math.min(R,G,B)}
 const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').putImageData(new ImageData(out,w,h),0,0);
 return{canvas:c,mode,saved:Math.max(0,Math.round((1-inkOut/Math.max(inkIn,1))*100))}}
return{run,pass}})();
