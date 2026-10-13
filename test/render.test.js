const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(require('path').join(__dirname,'..','public','index.html'),'utf8');
const code=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
let calls=0, texts=[], rects=0;
const ctxProxy=()=>{ const st={}; return new Proxy(function(){}, {
  get(t,k){ if(k==='canvas')return {}; if(k in st) return st[k]; if(k==='measureText')return ()=>({width:10});
    if(k==='createLinearGradient')return ()=>({addColorStop(){}});
    return (...a)=>{calls++; if(k==='fillText'||k==='strokeText')texts.push(a[0]); if(k==='fillRect')rects++;};},
  set(t,k,v){st[k]=v;return true;} }); };
const els={};
const mkEl=(id)=>({id,style:{},classList:{add(){},remove(){}},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:600,height:400}),
  getContext:()=>ctxProxy(),set innerHTML(v){this._h=v;},get innerHTML(){return this._h||''},textContent:'',offsetWidth:0,value:'',focus(){},toDataURL:()=>'data:x',width:0,height:0,querySelectorAll:()=>[]});
const document={getElementById:id=>els[id]||(els[id]=mkEl(id)),createElement:()=>mkEl('c'),querySelectorAll:()=>[],hidden:false};
let rafq=[]; 
const win={innerWidth:420,innerHeight:800,devicePixelRatio:2,addEventListener(){},document,
  requestAnimationFrame:f=>{rafq.push(f);},performance:{now:()=>T0},MRNet:null,AudioContext:undefined};
let T0=0;
const ctx=vm.createContext(Object.assign(win,{document,window:win,performance:win.performance,requestAnimationFrame:win.requestAnimationFrame,
  setTimeout,clearTimeout,Math,console,navigator:{},Blob,fetch:()=>Promise.reject(new Error('x')),addEventListener(){}}));
ctx.window=ctx;
vm.runInContext(code+';this.__t={menu,soloStart,get me(){return me},get run(){return run},K,render,layout:()=>[W,H,RX,RW,LP,PXU,CARY]};',ctx);
const t=ctx.__t;
console.log('layout portrait',JSON.stringify(t.layout()));
console.log('thumbs ok, menu drawn', (els.ov._h||'').includes('PILIH MOBILMU'));
t.soloStart(); 
// run frames
t.K.w=1; let frames=0;
while(rafq.length && frames<4000){ const f=rafq.shift(); T0+=16.7; f(T0); frames++; if(!t.run)break; }
const me=t.me;
console.log('frames',frames,'run',t.run,'d',Math.round(me.d),'gi',me.gi,'ok',me.ok,'t',me.t);
console.log('draw calls',calls,'fillRects',rects,'sample texts',texts.slice(0,6));
console.log('overlay result:', (els.ov._h||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,120));
// landscape layout
ctx.innerWidth=1280; ctx.innerHeight=720; t.layout(); console.log('layout landscape',JSON.stringify(t.layout()));
const assert=require('assert');
assert.ok(t.run && me.d>500 && me.gi>0, 'balapan solo harus berjalan dan melewati gerbang');
assert.ok(!/THREE|WebGL/.test(html), 'tidak boleh ada sisa three.js');
assert.ok(calls/frames<400, 'draw call per frame harus ringan');
console.log('Tes render 2D lulus (' + Math.round(calls/frames) + ' draw call/frame)');
process.exit(0);
