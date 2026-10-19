'use strict';
/* Tes API room + transport klien (klien sungguhan lewat net.js ke dev server, penyimpanan memori).
   Alur: Room Master membuat lobby → Pemain 1 & 2 masuk lewat kode → master mengirim sinyal ronde. */
const assert = require('assert');
const { start } = require('../dev-server.js');
const { makeRM } = require('../public/net.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 4000, what = 'kondisi') {
  const t = Date.now();
  while (Date.now() - t < ms) { if (fn()) return; await sleep(25); }
  throw new Error('timeout menunggu ' + what);
}

(async () => {
  const srv = await start(0);
  const base = 'http://127.0.0.1:' + srv.address().port + '/api/room';
  const raw = (b) => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(async r => ({ s: r.status, j: await r.json() }));
  let n = 0; const ok = m => console.log('  ok ' + (++n) + ' ' + m);

  // ---- API mentah
  let r = await raw({ action: 'create' });
  assert.strictEqual(r.s, 200); assert.match(r.j.code, /^[A-Z2-9]{4}$/); assert.strictEqual(r.j.side, 'master'); ok('create → Room Master membuat lobby (kode 4 karakter)');
  const code = r.j.code, master = r.j;
  r = await raw({ action: 'watch', code }); assert.strictEqual(r.s, 400); ok('aksi "watch" lama sudah tidak ada');
  r = await raw({ action: 'join', code: 'ZZZZ' }); assert.strictEqual(r.s, 404); ok('join kode salah → 404');
  r = await raw({ action: 'join', code: 'ab' }); assert.strictEqual(r.s, 400); ok('join kode pendek → 400');
  r = await raw({ action: 'join', code: code.toLowerCase() }); assert.strictEqual(r.s, 200); assert.strictEqual(r.j.side, 'host'); const p1 = r.j; ok('join pertama (huruf kecil) → Pemain 1 (host)');
  r = await raw({ action: 'join', code }); assert.strictEqual(r.s, 200); assert.strictEqual(r.j.side, 'guest'); const p2 = r.j; ok('join kedua → Pemain 2 (guest)');
  r = await raw({ action: 'join', code }); assert.strictEqual(r.s, 409); ok('join ketiga → lobby penuh (409)');
  // dua orang masuk bersamaan tidak boleh mendapat kursi yang sama
  const rc = (await raw({ action: 'create' })).j.code;
  const both = await Promise.all([raw({ action: 'join', code: rc }), raw({ action: 'join', code: rc }), raw({ action: 'join', code: rc })]);
  const sides = both.filter(x => x.s === 200).map(x => x.j.side).sort();
  assert.deepStrictEqual(sides, ['guest', 'host']); assert.strictEqual(both.filter(x => x.s === 409).length, 1); ok('join serentak: tiap kursi hanya satu pemilik');

  r = await raw({ action: 'sync', code, side: 'master', id: master.id, s: 1, p: { role: 'master', round: 0 } });
  assert.ok(r.j.h && r.j.g); ok('master melihat kedua kursi pemain terisi');
  await raw({ action: 'sync', code, side: 'host', id: p1.id, s: 1, p: { role: 'player', d: 5 } });
  await raw({ action: 'sync', code, side: 'guest', id: p2.id, s: 1, p: { role: 'player', d: 7 } });
  r = await raw({ action: 'sync', code, side: 'host', id: p1.id, s: 2, p: { role: 'player', d: 5 } });
  assert.strictEqual(r.j.o.p.d, 7); assert.strictEqual(r.j.o.id, p2.id); assert.strictEqual(r.j.m, 1); assert.strictEqual(r.j.M.p.round, 0); ok('pemain menerima presence lawan + presence master');
  r = await raw({ action: 'sync', code, side: 'master', id: master.id, s: 2, p: { role: 'master', round: 1, seed: 42, lvl: 1 } });
  assert.strictEqual(r.j.h.p.d, 5); assert.strictEqual(r.j.g.p.d, 7); ok('master membaca P1 + P2 dalam satu sync');
  r = await raw({ action: 'sync', code, side: 'guest', id: p2.id, s: 2, p: {} });
  assert.strictEqual(r.j.M.p.round, 1); assert.strictEqual(r.j.M.p.seed, 42); assert.strictEqual(r.j.M.p.lvl, 1); ok('pemain menerima sinyal ronde dari master');
  r = await raw({ action: 'sync', code, side: 'host', id: p1.id, s: 3, p: { x: 'y'.repeat(2000) } }); assert.strictEqual(r.s, 413); ok('presence terlalu besar ditolak');
  await raw({ action: 'leave', code, side: 'guest', token: 'salah' });
  r = await raw({ action: 'sync', code, side: 'host', id: p1.id, s: 4, p: {} }); assert.ok(r.j.o, 'leave dengan token salah tidak boleh menghapus'); ok('leave token salah diabaikan');
  await raw({ action: 'leave', code, side: 'guest', token: p2.token });
  r = await raw({ action: 'sync', code, side: 'host', id: p1.id, s: 5, p: {} }); assert.strictEqual(r.j.o, null); ok('Pemain 2 keluar → presence hilang');
  r = await raw({ action: 'join', code }); assert.strictEqual(r.s, 200); assert.strictEqual(r.j.side, 'guest'); const p2b = r.j; ok('kursi Pemain 2 bisa dipakai lagi');
  await raw({ action: 'leave', code, side: 'host', token: p1.token });
  r = await raw({ action: 'join', code }); assert.strictEqual(r.s, 200); assert.strictEqual(r.j.side, 'host'); ok('Pemain 1 keluar → kursi host kosong lagi');
  await raw({ action: 'leave', code, side: 'master', token: master.token });
  r = await raw({ action: 'sync', code, side: 'guest', id: p2b.id, s: 1, p: {} }); assert.strictEqual(r.s, 404); assert.strictEqual(r.j.gone, true); ok('Room Master keluar → lobby ditutup (404 gone)');
  r = await raw({ action: 'join', code }); assert.strictEqual(r.s, 404); ok('join ke lobby yang sudah ditutup → 404');
  r = await raw({ action: 'bogus' }); assert.strictEqual(r.s, 400); ok('aksi tak dikenal → 400');
  r = await fetch(base).then(x => x.status); assert.strictEqual(r, 405); ok('GET ditolak (405)');

  // ---- tiga klien lewat transport: master + 2 pemain
  const RM = makeRM({ api: base, hidden: () => false });
  const tm = await RM.join(null, 'master'); await tm.presence({ role: 'master', round: 0 });
  assert.strictEqual(tm.side, 'master'); assert.match(tm.code, /^[A-Z2-9]{4}$/);
  const e1 = await RM.join('ZZZZ', 'player').catch(e => e); assert.strictEqual(e1.type, 'not-found'); ok('klien: kode salah → error not-found');
  const t1 = await RM.join(tm.code, 'player'); await t1.presence({ role: 'player', car: 0, round: 0 });
  const t2 = await RM.join(tm.code, 'player'); await t2.presence({ role: 'player', car: 2, round: 0 });
  assert.strictEqual(t1.side, 'host'); assert.strictEqual(t2.side, 'guest');
  const e3 = await RM.join(tm.code, 'player').catch(e => e); assert.strictEqual(e3.type, 'full'); ok('klien: pemain ke-3 ditolak (full)');
  await until(() => tm.peers().length === 3, 3000, 'master melihat 2 pemain');
  assert.deepStrictEqual(tm.peers().slice(1).map(p => p.side).sort(), ['guest', 'host']);
  assert.strictEqual(tm.peers().find(p => p.side === 'guest').presence.car, 2); ok('klien: master melihat Pemain 1 & 2 beserta mobilnya');
  await until(() => t1.peers().length === 3 && t2.peers().length === 3, 3000, 'pemain melihat lawan + master');
  assert.deepStrictEqual(t1.peers().slice(1).map(p => p.side).sort(), ['guest', 'master']);
  assert.deepStrictEqual(t2.peers().slice(1).map(p => p.side).sort(), ['host', 'master']);
  assert.ok(t1.watched() && t2.watched()); ok('klien: pemain melihat lawan & master; watched() true');

  const t0 = Date.now();
  tm.presence({ role: 'master', round: 1, seed: 12345, lvl: 2 });   // urgent
  await until(() => [t1, t2].every(t => { const m = t.peers().find(p => p.side === 'master'); return m && m.presence.round === 1; }), 3000, 'kedua pemain menerima ronde');
  const lat = Date.now() - t0;
  assert.strictEqual(t1.peers().find(p => p.side === 'master').presence.seed, 12345);
  assert.strictEqual(t2.peers().find(p => p.side === 'master').presence.lvl, 2); ok('klien: sinyal Mulai dari master tiba di kedua pemain dalam ' + lat + ' ms');

  t1.live(true); t2.live(true); tm.hot(true);
  const t3 = Date.now();
  for (let i = 1; i <= 20; i++) { t1.presence({ d: i * 50, sp: 60 }); await sleep(60); }
  await until(() => { const h = tm.peers().find(p => p.side === 'host'); return h && h.presence.d === 1000; }, 2500, 'master menerima posisi P1');
  ok('klien: posisi Pemain 1 sampai ke master (' + (Date.now() - t3) + ' ms)');
  t1.presence({ d: 1500, ft: 12.3 });
  await until(() => t2.peers().find(p => p.side === 'host').presence.ft === 12.3, 2500, 'ft P1 sampai ke P2'); ok('klien: penanda finish (urgent) sampai ke lawan');

  // Pemain 2 keluar → master dan Pemain 1 melihatnya hilang
  await t2.leave();
  await until(() => tm.peers().length === 2 && t1.peers().length === 2, 3000, 'P2 hilang'); ok('klien: Pemain 2 keluar → master & Pemain 1 melihat kursi kosong');
  const t2b = await RM.join(tm.code, 'player'); assert.strictEqual(t2b.side, 'guest'); ok('klien: pengganti Pemain 2 mengisi kursi kosong');

  let c1 = false, c2 = false; t1.onClose(() => { c1 = true; }); t2b.onClose(() => { c2 = true; });
  await tm.leave();
  await until(() => c1 && c2, 4000, 'pemain tahu lobby ditutup'); ok('klien: Room Master keluar → kedua pemain menerima onClose');
  await t1.leave(); await t2b.leave();

  // kegagalan jaringan sesaat tidak dianggap lawan keluar
  let flaky = false;
  const RM2 = makeRM({ api: base, hidden: () => false, fetch: (u, o) => (flaky ? Promise.reject(new Error('net')) : fetch(u, o)) });
  const m3 = await RM2.join(null, 'master'); await m3.presence({ role: 'master' });
  const g3 = await RM2.join(m3.code, 'player'); await g3.presence({ role: 'player' });
  await until(() => m3.peers().length === 2 && g3.peers().length === 2, 3000, 'saling melihat');
  flaky = true; await sleep(1800); flaky = false;
  assert.strictEqual(m3.peers().length, 2); assert.strictEqual(m3.closed, false); ok('klien: gangguan jaringan sesaat tidak memutus pemain');
  await m3.leave(); await g3.leave();

  srv.close(); console.log('\nSemua tes lulus (' + n + ').'); process.exit(0);
})().catch(e => { console.error('GAGAL:', e); process.exit(1); });
