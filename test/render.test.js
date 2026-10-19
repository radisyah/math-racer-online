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
const mkEl=(id)=>({id,style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:600,height:400}),
  getContext:()=>ctxProxy(),set innerHTML(v){this._h=v;},get innerHTML(){return this._h||''},textContent:'',offsetWidth:0,value:'',focus(){},toDataURL:()=>'data:x',width:0,height:0,querySelectorAll:()=>[]});
const document={addEventListener(){},getElementById:id=>{ if(id==='wg') return (els.ov&&els.ov._h&&els.ov._h.includes('id="wg"')) ? (els.wg||(els.wg=mkEl('wg'))) : null; return els[id]||(els[id]=mkEl(id)); },createElement:()=>mkEl('c'),querySelectorAll:()=>[],hidden:false,body:{classList:{add(){},remove(){}}}};
let rafq=[]; 
const win={innerWidth:420,innerHeight:800,devicePixelRatio:2,addEventListener(){},document,
  requestAnimationFrame:f=>{rafq.push(f);},performance:{now:()=>T0},MRNet:null,AudioContext:undefined};
let T0=0;
const ctx=vm.createContext(Object.assign(win,{document,window:win,performance:win.performance,requestAnimationFrame:win.requestAnimationFrame,
  setTimeout,clearTimeout,Math,console,navigator:{},Blob,fetch:()=>Promise.reject(new Error('x')),addEventListener(){}}));
ctx.window=ctx;
vm.runInContext(code+';this.__t={menu,soloStart,get me(){return me},get run(){return run},get Q(){return Q},get K(){return K},setTB,render,drawScene,judge,layout:()=>[W,H,RX,RW,LP,PXU,CARY],GAP,FIN,VMAX,VNIT,VBOOST,masterStart,get MV(){return MV}};',ctx);
const t=ctx.__t;
console.log('layout portrait',JSON.stringify(t.layout()));
console.log('thumbs ok, menu drawn', (els.ov._h||'').includes('PILIH MOBILMU'));
t.soloStart();
let frames=0, vmax=0, nitFrames=0;
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
  vm.runInContext('run=false; ROLE="player"; SEAT="host"; ROUND=1; ROOM={peers:()=>[{isMe:true,sameTab:true,presence:{}},{peer:"x",side:"guest",isMe:false,presence:__opp,at:0}],presence(){return Promise.resolve()},hot(){},leave(){return Promise.resolve()},onPeers(){}}; startRace(123,0);',ctx);
  let f=0;
  while(rafq.length && f<maxFrames){ const fn=rafq.shift(); T0+=16.7; fn(T0); f++;
    const m=t.me; if(m && t.run && m.gi<10){ const cl=t.Q[m.gi].cl; m.lane = m.gi<wrong ? (cl+1)%3 : cl; } }
  return f;
}
// aturan penentuan (fungsi murni)
const J=(a,b)=>t.judge(a,b);
assert.strictEqual(J({sc:900,ok:9,t:90},{sc:800,ok:10,t:50}),'win','skor menentukan, bukan jumlah benar');
assert.strictEqual(J({sc:700,ok:7,t:50},{sc:800,ok:8,t:90}),'lose');
assert.strictEqual(J({sc:800,ok:8,t:90},{sc:800,ok:7,t:50}),'win','skor sama: benar terbanyak');
assert.strictEqual(J({sc:800,ok:8,t:70},{sc:800,ok:8,t:80}),'draw','skor & benar sama: seri, waktu tidak dihitung');
assert.strictEqual(J({sc:800,ok:8,t:10},{sc:800,ok:8,t:999}),'draw','selisih waktu besar tetap seri');
assert.strictEqual(J({sc:700,ok:8,t:999},{sc:600,ok:7,t:1}),'win','lebih banyak benar menang walau jauh lebih lambat');
// simetris: kedua pemain menghitung hasil yang sama
for (const [x,y] of [[{sc:5,ok:1,t:3},{sc:9,ok:2,t:1}],[{sc:5,ok:2,t:3},{sc:5,ok:1,t:1}],[{sc:5,ok:2,t:3},{sc:5,ok:2,t:4}],[{sc:5,ok:2,t:30},{sc:5,ok:2,t:4}]]) {
  const r1=J(x,y), r2=J(y,x); assert.ok((r1==='win'&&r2==='lose')||(r1==='lose'&&r2==='win')||(r1==='draw'&&r2==='draw'));
}
// keadilan: skor murni dari benar/salah (benar +100, salah -50), tanpa bonus kecepatan
const pts=(ok,bad)=>ok*100-bad*50;
assert.ok(pts(10,0) > pts(8,2), 'lebih banyak benar selalu lebih tinggi');
assert.ok(pts(0,10)<0 && (1/3)*100-(2/3)*50 < 1, 'asal tebak tanpa untung');
// 1) pemain sempurna vs lawan 7 benar → menang; skor sesuai rumus
play({round:1,ok:7,sc:650,ft:95,gi:10},0); assert.ok(ovText().includes('KAMU MENANG'), '1: '+ovText());
assert.ok(me.sc===1000 && me.ok===10, 'skor sempurna harus tepat 1000, dapat '+me.sc);
assert.ok(ovText().includes('lawan 650') && ovText().includes('7/10'), 'hasil harus menampilkan skor & benar kedua pemain: '+ovText());
// 2) lawan skor lebih tinggi → kalah
play({round:1,ok:10,sc:2000,ft:60,gi:10},0); assert.ok(ovText().includes('KAMU KALAH'), '2: '+ovText());
// 3) lawan skor lebih rendah walau sama-sama 10 benar → menang
play({round:1,ok:10,sc:900,ft:150,gi:10},0); assert.ok(ovText().includes('KAMU MENANG'), '3: '+ovText());
// 4) 3 salah: skor turun sesuai rumus, kalah dari lawan yang benar semua
play({round:1,ok:10,sc:1000,ft:300,gi:10},3);
const m4=t.me; assert.strictEqual(m4.ok,7);
assert.strictEqual(m4.sc,7*100-3*50,'skor 7 benar 3 salah harus tepat 550: '+m4.sc);
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
// 8) skor sama persis → seri (waktu tidak menentukan)
play({round:1,get sc(){return t.me.sc},ok:10,ft:200,gi:10},0);
assert.ok(ovText().includes('SERI') && ovText().includes('Skor sama'), '8: '+ovText());

// ---- Boost: W / ▲ ditahan = ngebut, dilepas = kembali ke kecepatan default
{
  rafq.length=0; vm.runInContext('run=false; ROLE="solo"; ROOM=null; startRace(7,0);',ctx);
  const step=(n)=>{ for(let i=0;i<n && rafq.length;i++){ const fn=rafq.shift(); T0+=16.7; fn(T0); const m=t.me; if(m&&t.run) m.d=Math.min(m.d,300); } };   // jangan sampai gerbang (nitro/jawaban) memengaruhi uji kecepatan
  step(60*14);                                   // lewati hitung mundur, capai kecepatan default
  const base=t.me.sp;
  assert.ok(base>55 && base<=t.VMAX+0.01, 'kecepatan default mendekati VMAX tanpa tombol: '+base);
  t.K.w=1; step(60*4);
  const fast=t.me.sp;
  assert.ok(fast>t.VMAX+10 && fast<=t.VBOOST+0.01, 'W ditahan harus ngebut di atas default (maks VBOOST): '+fast);
  delete t.K.w; t.K.w=0; step(60*3);
  assert.ok(t.me.sp<=t.VMAX+0.5 && t.me.sp>55, 'W dilepas → kembali ke kecepatan default: '+t.me.sp);
  t.setTB(true); step(60*4);
  assert.ok(t.me.sp>t.VMAX+10, 'tombol ▲ ditahan juga ngebut: '+t.me.sp);
  t.setTB(false); step(60*3);
  assert.ok(t.me.sp<=t.VMAX+0.5 && t.me.sp>55, 'tombol ▲ dilepas → kembali normal: '+t.me.sp);
  t.K.arrowup=1; step(60*4); assert.ok(t.me.sp>t.VMAX+10,'panah atas juga ngebut'); t.K.arrowup=0; step(60*3);
  // rem menang atas boost
  t.K.w=1; t.K.s=1; step(60*2); assert.ok(t.me.sp<t.VMAX-2,'rem mengalahkan boost'); t.K.w=0; t.K.s=0;
  vm.runInContext('run=false;',ctx); rafq.length=0;
  // balapan sempurna dengan W ditahan terus lebih cepat dari default, skor tetap sama (waktu tidak dihitung)
  vm.runInContext('ROLE="solo"; startRace(7,0);',ctx); t.K.w=1; let f2=0;
  while(rafq.length && f2<60*400){ const fn=rafq.shift(); T0+=16.7; fn(T0); f2++; const m=t.me; if(m&&t.run&&m.gi<10) m.lane=t.Q[m.gi].cl; if(!t.run)break; }
  assert.ok(t.me.t<me.t && t.me.sc===1000, 'boost menyingkat waktu tapi skor tetap 1000: '+t.me.t+' vs '+me.t);
  t.K.w=0;
  console.log('Tes boost W/▲ lulus');
}

// ---- Room Master membuat lobby: mulai ronde, dua panel, hasil dari kedua pemain
{
  rafq.length=0;
  let hotCalls=[], sent=[];
  const mkPres=(over)=>({role:'player',car:0,round:0,gi:0,ok:0,sc:0,ft:null,d:0,sp:0,ln:1,...over});
  let pres={host:mkPres(),guest:mkPres({car:2})}, hereH=true, hereG=true;
  ctx.__peers=()=>[{isMe:true,presence:{}}].concat(hereH?[{peer:'h',side:'host',isMe:false,presence:pres.host,at:T0}]:[]).concat(hereG?[{peer:'g',side:'guest',isMe:false,presence:pres.guest,at:T0}]:[]);
  ctx.__hot=v=>hotCalls.push(v); ctx.__sent=sent;
  vm.runInContext('run=false; ROLE="master"; CODE="ABCD"; ROUND=0; ROOM={peers:()=>__peers(),presence(p){__sent.push(p);return Promise.resolve()},hot:__hot,leave(){return Promise.resolve()}}; startWatch();',ctx);
  const frame=(n=1)=>{ for(let i=0;i<n && rafq.length;i++){ const fn=rafq.shift(); T0+=16.7; fn(T0);} };
  const mvv=()=>vm.runInContext('MV',ctx);
  const ov=()=>(els.ov._h||'');
  frame(3);
  // lobby: kode tampil, kedua pemain siap, tombol Mulai aktif
  assert.ok(ov().includes('LOBBY ROOM MASTER') && ov().includes('ABCD'),'lobby menampilkan kode room');
  assert.ok(!/disabled>▶ Mulai/.test(ov()),'Mulai aktif bila kedua pemain siap');
  // pemain 2 belum masuk → tombol Mulai nonaktif, masterStart tidak berbuat apa-apa
  hereG=false; mvv().ui=''; frame(2);
  assert.ok(/disabled>▶ Mulai/.test(ov()),'Mulai nonaktif bila pemain belum lengkap');
  t.masterStart(); assert.strictEqual(sent.filter(x=>x.round).length,0,'tidak bisa mulai tanpa 2 pemain');
  hereG=true; frame(3);
  // master menekan Mulai
  vm.runInContext('LVL=0',ctx);
  t.masterStart();
  const st=sent.find(x=>x.round===1);
  assert.ok(st && st.seed!=null && st.lvl===0 && st.role==='master','sinyal ronde (round, seed, lvl) dikirim lewat presence master');
  assert.strictEqual(mvv().round,1,'master mulai ronde 1'); assert.strictEqual(mvv().Q.length,10,'master membangun soal dari seed');
  assert.strictEqual(els.ov.style.display,'none','lobby tertutup setelah mulai');
  t.masterStart(); assert.strictEqual(sent.filter(x=>x.round).length,1,'tidak bisa mulai lagi saat balapan berjalan');
  // soal master identik dengan soal pemain yang memakai seed yang sama
  const mq=JSON.stringify(mvv().Q.map(q=>q.t));
  vm.runInContext('ROLE="player";SEAT="host";ROUND=1;ROOM2=ROOM;ROOM={peers:()=>[],presence(){return Promise.resolve()},hot(){},leave(){return Promise.resolve()}};',ctx);
  vm.runInContext('startRace('+st.seed+',0)',ctx);
  assert.strictEqual(JSON.stringify(t.Q.map(q=>q.t)),mq,'soal master = soal pemain'); assert.ok(els.p0.textContent.includes('P1')&&els.p0.textContent.includes('W'),'label HUD pemain: '+els.p0.textContent);
  vm.runInContext('run=false;ROLE="master";ROOM=ROOM2;',ctx); rafq.length=0; vm.runInContext('requestAnimationFrame(mLoop)',ctx);
  // pemain mengirim posisi → panel bergerak (presence round harus sama dengan ronde master)
  const at0=calls;
  pres.host={...pres.host,round:1,d:700,sp:60}; pres.guest={...pres.guest,round:1,d:300,sp:40,ln:2};
  frame(90);
  const pl=mvv().pl;
  assert.ok(pl[0].d>600 && pl[1].d>250 && pl[0].d>pl[1].d, 'posisi kedua pemain terlihat: '+pl[0].d+' / '+pl[1].d);
  assert.ok(calls>at0 && texts.some(x=>/PEMAIN 1/.test(String(x))) && texts.some(x=>/PEMAIN 2/.test(String(x))),'dua panel digambar');
  assert.ok(els.mbar._h.includes('masterStart()') && /disabled>▶ Balapan/.test(els.mbar._h),'bilah kontrol: Mulai nonaktif saat balapan');
  pres.host={...pres.host,gi:1,ok:1,sc:150,d:900}; pres.guest={...pres.guest,gi:1,ok:0,sc:-50,d:800};
  frame(5);
  assert.ok(/NITRO/.test(mvv().pl[0].msg) && /Salah/.test(mvv().pl[1].msg),'pesan benar/salah per pemain');
  assert.ok(hotCalls.includes(true),'master sync cepat saat balapan');
  // pemain yang presence-nya masih ronde lama tidak dihitung
  pres.host={...pres.host,round:0,gi:10,ok:10,sc:9999,ft:1}; frame(3);
  assert.ok(mvv().pl[0].sc!==9999,'presence ronde lama diabaikan');
  pres.host={...pres.host,round:1,gi:10,ok:10,sc:1200,ft:100,d:7300,sp:0}; pres.guest={...pres.guest,gi:10,ok:9,sc:900,ft:95,d:7300,sp:0};
  frame(5);
  assert.strictEqual(mvv().res.r,'win','skor tertinggi (Pemain 1) menang walau Pemain 2 finish lebih cepat');
  assert.ok(hotCalls[hotCalls.length-1]===false,'sync normal lagi setelah hasil keluar');
  assert.ok(texts.some(x=>/PEMAIN 1 MENANG/.test(String(x))),'banner pemenang digambar');
  assert.ok(/>▶ Main lagi/.test(els.mbar._h) && !/disabled>▶ Main lagi/.test(els.mbar._h),'Main lagi aktif setelah hasil keluar');
  // Main lagi → ronde 2 dengan seed baru, panel direset
  t.masterStart();
  assert.ok(sent.some(x=>x.round===2)&&mvv().round===2&&!mvv().res&&mvv().pl[0].d<5,'Main lagi memulai ronde 2 dan mereset tampilan');
  // pemain keluar di tengah balapan → lawannya menang otomatis
  hereG=false; pres.host={...pres.host,round:2,d:2000,sp:60}; frame(60*4);
  assert.ok(mvv().res && mvv().res.r==='win' && mvv().res.left===1,'Pemain 2 keluar → Pemain 1 menang');
  vm.runInContext('ROLE="";ROOM=null;',ctx);
  console.log('Tes lobby & tampilan Room Master lulus');
}
console.log('Tes render 2D + skenario pemenang lulus (' + perFrame + ' draw call/frame)');
process.exit(0);
