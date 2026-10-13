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
vm.runInContext(code+';this.__t={menu,soloStart,get me(){return me},get run(){return run},get Q(){return Q},K,render,drawScene,layout:()=>[W,H,RX,RW,LP,PXU,CARY],GAP,FIN,VMAX,VNIT};',ctx);
const t=ctx.__t;
console.log('layout portrait',JSON.stringify(t.layout()));
console.log('thumbs ok, menu drawn', (els.ov._h||'').includes('PILIH MOBILMU'));
t.soloStart();
t.K.w=1; let frames=0, vmax=0, nitFrames=0;
// bot: selalu gas penuh dan mengarah ke jalur yang benar tepat waktu (pemain sempurna)
while(rafq.length && frames<60*400){ const f=rafq.shift(); T0+=16.7; f(T0); frames++;
  const m=t.me; if(m && t.run){ if(m.gi<10) m.lane=t.Q[m.gi].cl; vmax=Math.max(vmax,m.sp); if(m.nit>0)nitFrames++; }
  if(!t.run)break; }
const me=t.me;
console.log('frames',frames,'run',t.run,'d',Math.round(me.d),'gi',me.gi,'ok',me.ok,'waktu',me.t&&me.t.toFixed(1)+'s','vmax',Math.round(vmax*3.6)+' km/h','nitro-frame',nitFrames);
console.log('draw calls',calls,'fillRects',rects,'sample texts',texts.slice(0,6));
console.log('overlay result:', (els.ov._h||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,120));
// landscape layout
ctx.innerWidth=1280; ctx.innerHeight=720; t.layout(); console.log('layout landscape',JSON.stringify(t.layout()));
const assert=require('assert');
assert.ok(me.t!==null && me.gi===10 && me.ok===10, 'pemain sempurna harus finish dengan 10 benar');
assert.ok(me.t>70 && me.t<150, 'durasi balapan sempurna harus 70-150 detik, dapat '+me.t);
assert.ok(vmax>t.VMAX && vmax<=t.VNIT+0.5, 'nitro harus melewati VMAX tapi tidak melewati VNIT');
// gambar dengan lawan di berbagai posisi (di layar, jauh di depan, jauh di belakang)
for (const od of [me.d+20, me.d+900, Math.max(0,me.d-900)]) t.drawScene(me.d,1,1,50,false,{d:od,lx:2,ln:0,sp:80,car:2});

assert.ok(!/THREE|WebGL/.test(html), 'tidak boleh ada sisa three.js');
assert.ok(calls/frames<400, 'draw call per frame harus ringan');
console.log('Tes render 2D lulus (' + Math.round(calls/frames) + ' draw call/frame)');
process.exit(0);
