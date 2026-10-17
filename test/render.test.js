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
const document={getElementById:id=>{ if(id==='wg') return (els.ov&&els.ov._h&&els.ov._h.includes('id="wg"')) ? (els.wg||(els.wg=mkEl('wg'))) : null; return els[id]||(els[id]=mkEl(id)); },createElement:()=>mkEl('c'),querySelectorAll:()=>[],hidden:false,body:{classList:{add(){},remove(){}}}};
let rafq=[]; 
const win={innerWidth:420,innerHeight:800,devicePixelRatio:2,addEventListener(){},document,
  requestAnimationFrame:f=>{rafq.push(f);},performance:{now:()=>T0},MRNet:null,AudioContext:undefined};
let T0=0;
const ctx=vm.createContext(Object.assign(win,{document,window:win,performance:win.performance,requestAnimationFrame:win.requestAnimationFrame,
  setTimeout,clearTimeout,Math,console,navigator:{},Blob,fetch:()=>Promise.reject(new Error('x')),addEventListener(){}}));
ctx.window=ctx;
vm.runInContext(code+';this.__t={menu,soloStart,get me(){return me},get run(){return run},get Q(){return Q},K,render,drawScene,judge,layout:()=>[W,H,RX,RW,LP,PXU,CARY],GAP,FIN,VMAX,VNIT};',ctx);
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
t.drawScene(me.d,1,1,50,false);
assert.ok(!/THREE|WebGL/.test(html), 'tidak boleh ada sisa three.js');
const perFrame=Math.round(calls/frames);
assert.ok(perFrame<400, 'draw call per frame harus ringan');

// ---- skenario online: pemenang ditentukan skor (benar + cepat, salah dikurangi)
const ovText=()=> (els.ov._h||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
function play(oppPr, wrong, maxFrames=60*400){
  ctx.__opp=oppPr; rafq.length=0;
  vm.runInContext('run=false; ROLE="host"; oppId="x"; ROUND=1; ROOM={peers:()=>[{isMe:true,sameTab:true,presence:{}},{peer:"x",isMe:false,presence:__opp,at:0}],presence(){return Promise.resolve()},hot(){},leave(){return Promise.resolve()},onPeers(){}}; startRace(123,0);',ctx);
  t.K.w=1; let f=0;
  while(rafq.length && f<maxFrames){ const fn=rafq.shift(); T0+=16.7; fn(T0); f++;
    const m=t.me; if(m && t.run && m.gi<10){ const cl=t.Q[m.gi].cl; m.lane = m.gi<wrong ? (cl+1)%3 : cl; } }
  return f;
}
// aturan penentuan (fungsi murni)
const J=(a,b)=>t.judge(a,b);
assert.strictEqual(J({sc:900,ok:9,t:90},{sc:800,ok:10,t:50}),'win','skor menentukan, bukan jumlah benar');
assert.strictEqual(J({sc:700,ok:7,t:50},{sc:800,ok:8,t:90}),'lose');
assert.strictEqual(J({sc:800,ok:8,t:90},{sc:800,ok:7,t:50}),'win','skor sama: benar terbanyak');
assert.strictEqual(J({sc:800,ok:8,t:70},{sc:800,ok:8,t:80}),'win','skor & benar sama: waktu tercepat');
assert.strictEqual(J({sc:800,ok:8,t:80},{sc:800,ok:8,t:80.01}),'draw');
// simetris: kedua pemain menghitung hasil yang sama
for (const [x,y] of [[{sc:5,ok:1,t:3},{sc:9,ok:2,t:1}],[{sc:5,ok:2,t:3},{sc:5,ok:1,t:1}],[{sc:5,ok:2,t:3},{sc:5,ok:2,t:4}]]) {
  const r1=J(x,y), r2=J(y,x); assert.ok((r1==='win'&&r2==='lose')||(r1==='lose'&&r2==='win')||(r1==='draw'&&r2==='draw'));
}
// keadilan: ilustrasi dengan rumus (benar 100 + bonus <= 60, salah -50)
const pts=(ok,bad,bonus)=>ok*100+bonus*ok-bad*50;
assert.ok(pts(10,0,0) > pts(6,4,60), 'teliti-lambat (10/10) mengalahkan penebak cepat (6 benar)');
assert.ok(pts(8,2,60) > pts(10,0,0), 'cepat dengan 8 benar boleh mengalahkan teliti yang sangat lambat');
assert.ok(pts(0,10,60)<0 && (1/3)*160-(2/3)*50 < 25, 'asal tebak nyaris tanpa untung');
// 1) pemain sempurna vs lawan 7 benar → menang; skor sesuai rumus
play({round:1,ok:7,sc:650,ft:95,gi:10},0); assert.ok(ovText().includes('KAMU MENANG'), '1: '+ovText());
assert.ok(me.sc>=1000 && me.sc<=1600 && me.ok===10, 'skor sempurna harus 1000-1600, dapat '+me.sc);
assert.ok(ovText().includes('lawan 650') && ovText().includes('7/10'), 'hasil harus menampilkan skor & benar kedua pemain: '+ovText());
// 2) lawan skor lebih tinggi → kalah
play({round:1,ok:10,sc:2000,ft:60,gi:10},0); assert.ok(ovText().includes('KAMU KALAH'), '2: '+ovText());
// 3) lawan skor lebih rendah walau sama-sama 10 benar → menang
play({round:1,ok:10,sc:900,ft:150,gi:10},0); assert.ok(ovText().includes('KAMU MENANG'), '3: '+ovText());
// 4) 3 salah: skor turun sesuai rumus, kalah dari lawan yang benar semua
play({round:1,ok:10,sc:1000,ft:300,gi:10},3);
const m4=t.me; assert.strictEqual(m4.ok,7);
assert.ok(m4.sc>=7*100-3*50 && m4.sc<=7*160-3*50, 'skor 7 benar 3 salah di luar rentang: '+m4.sc);
assert.ok(ovText().includes('KAMU KALAH'), '4: '+ovText());
// 5) lawan belum selesai: tunggu (tanpa hasil) lalu lawan selesai → hasil keluar
play({round:1,ok:4,sc:300,gi:6},0,60*125);
assert.ok(t.run && ovText().includes('SUDAH FINISH') && els.wg.textContent.includes('Menunggu lawan') && els.wg.textContent.includes('6/10'), '5a: '+ovText()+' | '+els.wg.textContent);
ctx.__opp={round:1,ok:9,sc:700,ft:120,gi:10};
for(let i=0;i<5 && rafq.length;i++){ const fn=rafq.shift(); T0+=16.7; fn(T0); }
assert.ok(!t.run && ovText().includes('KAMU MENANG'), '5b: '+ovText());
// 6) lawan selesai duluan tidak mengakhiri balapanku di tengah jalan
play({round:1,ok:10,sc:1500,ft:50,gi:10},0,60*20);
assert.ok(t.run && t.me.t===null, '6: balapan harus lanjut meski lawan sudah finish');
// 7) lawan tidak pernah selesai: setelah 90 dtk hasil keluar (fallback)
play({round:1,ok:4,sc:300,gi:6},0,60*230);
assert.ok(!t.run && ovText().includes('terlalu lama'), '7: '+ovText());
// 8) skor sama persis → jawaban benar sama → waktu tercepat menentukan (pesan seri-skor tampil)
play({round:1,get sc(){return t.me.sc},ok:10,ft:200,gi:10},0);
assert.ok(ovText().includes('KAMU MENANG') && ovText().includes('Skor sama'), '8: '+ovText());

// ---- Room Master: dua panel, soal dari seed yang sama, hasil dihitung dari kedua pemain
{
  const T1=T0; rafq.length=0;
  let pres={host:{role:'host',car:0,round:1,seed:123,lvl:0,gi:0,ok:0,sc:0,ft:null,d:0,sp:0,ln:1},
            guest:{role:'guest',car:2,round:1,gi:0,ok:0,sc:0,ft:null,d:0,sp:0,ln:1}};
  let hotCalls=[];
  ctx.__peers=()=>[{isMe:true,presence:{}},
    {peer:'h',side:'host',isMe:false,presence:pres.host,at:T0},
    {peer:'g',side:'guest',isMe:false,presence:pres.guest,at:T0}];
  ctx.__hot=v=>hotCalls.push(v);
  vm.runInContext('run=false; ROLE="master"; CODE="ABCD"; ROOM={peers:()=>__peers(),presence(){return Promise.resolve()},hot:__hot,leave(){return Promise.resolve()}}; startWatch();',ctx);
  const frame=(n=1)=>{ for(let i=0;i<n && rafq.length;i++){ const fn=rafq.shift(); T0+=16.7; fn(T0);} };
  const mv=vm.runInContext('MV',ctx);
  assert.ok(vm.runInContext('document.body.classList',ctx)!==undefined);
  frame(3);
  const mvv=()=>vm.runInContext('MV',ctx);
  assert.strictEqual(mvv().round,1,'master harus mengikuti ronde host');
  assert.strictEqual(mvv().Q.length,10,'master membangun soal dari seed');
  // soal master identik dengan soal pemain dengan seed yang sama
  vm.runInContext('ROLE="host";oppId="x";ROUND=1;ROOM2=ROOM;ROOM={peers:()=>[],presence(){return Promise.resolve()},hot(){},leave(){return Promise.resolve()}};startRace(123,0);',ctx);
  const qPlayer=JSON.stringify(t.Q.map(q=>q.t)); vm.runInContext('run=false;ROLE="master";ROOM=ROOM2;',ctx);
  assert.strictEqual(JSON.stringify(mvv().Q.map(q=>q.t)),qPlayer,'soal master = soal pemain');
  rafq.length=0; vm.runInContext('requestAnimationFrame(mLoop)',ctx);
  // posisi pemain dikirim → panel bergerak
  const at0=calls;
  pres.host={...pres.host,d:700,sp:60,gi:0}; pres.guest={...pres.guest,d:300,sp:40,ln:2};
  ctx.__peers=()=>[{isMe:true,presence:{}},{peer:'h',side:'host',isMe:false,presence:pres.host,at:T0},{peer:'g',side:'guest',isMe:false,presence:pres.guest,at:T0}];
  frame(90);
  const pl=mvv().pl;
  assert.ok(pl[0].d>600 && pl[1].d>250 && pl[0].d>pl[1].d, 'posisi kedua pemain terlihat: '+pl[0].d+' / '+pl[1].d);
  assert.ok(calls>at0 && texts.some(x=>/PEMAIN 1/.test(String(x))) && texts.some(x=>/PEMAIN 2/.test(String(x))),'dua panel digambar');
  // jawaban benar / salah memunculkan pesan, dan hanya host yang memulai ronde (master tidak bisa mengontrol)
  pres.host={...pres.host,gi:1,ok:1,sc:150,d:900}; pres.guest={...pres.guest,gi:1,ok:0,sc:-50,d:800};
  ctx.__peers=()=>[{isMe:true,presence:{}},{peer:'h',side:'host',isMe:false,presence:pres.host,at:T0},{peer:'g',side:'guest',isMe:false,presence:pres.guest,at:T0}];
  frame(5);
  assert.ok(/NITRO/.test(mvv().pl[0].msg) && /Salah/.test(mvv().pl[1].msg),'pesan benar/salah per pemain');
  assert.ok(hotCalls.includes(true),'master sync cepat saat balapan');
  // kedua pemain finish → pemenang ditentukan dari skor
  pres.host={...pres.host,gi:10,ok:10,sc:1200,ft:100,d:7300,sp:0}; pres.guest={...pres.guest,gi:10,ok:9,sc:900,ft:95,d:7300,sp:0};
  ctx.__peers=()=>[{isMe:true,presence:{}},{peer:'h',side:'host',isMe:false,presence:pres.host,at:T0},{peer:'g',side:'guest',isMe:false,presence:pres.guest,at:T0}];
  frame(5);
  assert.strictEqual(mvv().res.r,'win','skor tertinggi (host) menang walau guest finish lebih cepat');
  assert.ok(hotCalls[hotCalls.length-1]===false,'sync normal lagi setelah hasil keluar');
  assert.ok(texts.some(x=>/PEMAIN 1 MENANG/.test(String(x))),'banner pemenang digambar');
  // ronde baru dari host me-reset panel
  pres.host={...pres.host,round:2,seed:999,gi:0,ok:0,sc:0,ft:null,d:0,sp:0}; pres.guest={...pres.guest,round:2,gi:0,ok:0,sc:0,ft:null,d:0,sp:0};
  ctx.__peers=()=>[{isMe:true,presence:{}},{peer:'h',side:'host',isMe:false,presence:pres.host,at:T0},{peer:'g',side:'guest',isMe:false,presence:pres.guest,at:T0}];
  frame(3);
  assert.ok(mvv().round===2 && !mvv().res && mvv().pl[0].d<5,'ronde baru mereset tampilan master');
  vm.runInContext('ROLE="";ROOM=null;',ctx);
  console.log('Tes tampilan Room Master lulus');
}
console.log('Tes render 2D + skenario pemenang lulus (' + perFrame + ' draw call/frame)');
process.exit(0);
