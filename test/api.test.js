'use strict';
/* Tes API room + transport klien (dua klien sungguhan lewat net.js ke dev server, penyimpanan memori). */
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
  assert.strictEqual(r.s, 200); assert.match(r.j.code, /^[A-Z2-9]{4}$/); assert.strictEqual(r.j.side, 'host'); ok('create → kode 4 karakter');
  const code = r.j.code, host = r.j;
  r = await raw({ action: 'join', code: 'ZZZZ' }); assert.strictEqual(r.s, 404); ok('join kode salah → 404');
  r = await raw({ action: 'join', code: 'ab' }); assert.strictEqual(r.s, 400); ok('join kode pendek → 400');
  r = await raw({ action: 'join', code: code.toLowerCase() }); assert.strictEqual(r.s, 200); assert.strictEqual(r.j.side, 'guest'); const guest = r.j; ok('join (huruf kecil) → guest');
  r = await raw({ action: 'join', code }); assert.strictEqual(r.s, 409); ok('join kedua saat kursi aktif → 409');
  await raw({ action: 'sync', code, side: 'guest', id: guest.id, s: 1, p: { role: 'guest' } });
  r = await raw({ action: 'join', code }); assert.strictEqual(r.s, 409); ok('guest aktif (ada presence) → tetap penuh');
  r = await raw({ action: 'sync', code, side: 'host', id: host.id, s: 1, p: { role: 'host', d: 5 } });
  assert.strictEqual(r.j.o.p.role, 'guest'); assert.strictEqual(r.j.o.id, guest.id); ok('sync host menerima presence guest');
  r = await raw({ action: 'sync', code, side: 'guest', id: guest.id, s: 2, p: {} });
  assert.strictEqual(r.j.o.p.d, 5); ok('sync guest menerima presence host');
  r = await raw({ action: 'sync', code, side: 'host', id: host.id, s: 3, p: { x: 'y'.repeat(2000) } }); assert.strictEqual(r.s, 413); ok('presence terlalu besar ditolak');
  r = await raw({ action: 'leave', code, side: 'guest', token: 'salah' });
  r = await raw({ action: 'sync', code, side: 'host', id: host.id, s: 4, p: {} }); assert.ok(r.j.o, 'leave dengan token salah tidak boleh menghapus'); ok('leave token salah diabaikan');
  await raw({ action: 'leave', code, side: 'guest', token: guest.token });
  r = await raw({ action: 'sync', code, side: 'host', id: host.id, s: 5, p: {} }); assert.strictEqual(r.j.o, null); ok('guest keluar → presence hilang');
  r = await raw({ action: 'join', code }); assert.strictEqual(r.s, 200); ok('kursi guest bisa dipakai lagi');
  await raw({ action: 'leave', code, side: 'host', token: host.token });
  r = await raw({ action: 'sync', code, side: 'guest', id: r.j.id, s: 1, p: {} }); assert.strictEqual(r.s, 404); assert.strictEqual(r.j.gone, true); ok('host keluar → room ditutup (404 gone)');
  r = await raw({ action: 'bogus' }); assert.strictEqual(r.s, 400); ok('aksi tak dikenal → 400');
  r = await fetch(base).then(x => x.status); assert.strictEqual(r, 405); ok('GET ditolak (405)');

  // ---- dua klien lewat transport
  const RM = makeRM({ api: base, hidden: () => false });
  const hostRoom = await RM.join(null, 'host');
  assert.match(hostRoom.code, /^[A-Z2-9]{4}$/);
  await hostRoom.presence({ role: 'host', car: 0, round: 0 });
  const guestRoom = await RM.join(hostRoom.code, 'guest');
  let hostNotified = 0; hostRoom.onPeers(() => hostNotified++);
  await guestRoom.presence({ role: 'guest', car: 1, round: 0 });
  await until(() => hostRoom.peers().length === 2 && hostRoom.peers()[1].presence.role === 'guest', 3000, 'host melihat guest');
  await until(() => guestRoom.peers().length === 2 && guestRoom.peers()[1].presence.role === 'host', 3000, 'guest melihat host');
  assert.strictEqual(hostRoom.peers()[1].presence.role, 'guest');
  assert.strictEqual(guestRoom.peers()[1].presence.role, 'host'); ok('klien: kedua sisi saling melihat');

  const t0 = Date.now();
  hostRoom.presence({ round: 1, seed: 12345, lvl: 2, opp: hostRoom.peers()[1].peer });
  await until(() => { const p = guestRoom.peers()[1]; return p && p.presence.round === 1; }, 3000, 'guest menerima ronde baru');
  const lat = Date.now() - t0;
  assert.strictEqual(guestRoom.peers()[1].presence.seed, 12345);
  assert.strictEqual(guestRoom.peers()[1].presence.opp, guestRoom.id);
  assert.ok(typeof guestRoom.peers()[1].at === 'number'); ok('klien: ronde baru (urgent) tiba dalam ' + lat + ' ms');

  hostRoom.hot(true); guestRoom.hot(true);
  const t1 = Date.now();
  for (let i = 1; i <= 40; i++) { hostRoom.presence({ d: i * 10 }); await sleep(80); }
  await until(() => guestRoom.peers()[1].presence.d === 400, 2000, 'jarak terakhir host');
  const per = Date.now() - t1; ok('klien: 40 pembaruan jarak mengalir (' + per + ' ms), guest melihat nilai terakhir');

  hostRoom.presence({ d: 500, ft: 12.3 });
  await until(() => guestRoom.peers()[1].presence.ft === 12.3, 2000, 'ft host'); ok('klien: waktu finish (urgent) sampai ke lawan');

  let closed = false; guestRoom.onClose(() => { closed = true; });
  await hostRoom.leave();
  await until(() => closed, 4000, 'guest tahu room ditutup'); assert.strictEqual(guestRoom.closed, true); ok('klien: host keluar → guest menerima onClose');

  // guest keluar → host melihat peers menyusut
  const h2 = await RM.join(null, 'host'); await h2.presence({ role: 'host' });
  const g2 = await RM.join(h2.code, 'guest'); await g2.presence({ role: 'guest' });
  await until(() => h2.peers().length === 2, 3000, 'h2 melihat g2');
  await g2.leave();
  await until(() => h2.peers().length === 1, 3000, 'h2 melihat g2 keluar'); ok('klien: guest keluar → host melihat lawan hilang');
  await h2.leave();

  // kegagalan jaringan sesaat tidak dianggap lawan keluar
  let flaky = false;
  const RM2 = makeRM({ api: base, hidden: () => false, fetch: (u, o) => (flaky ? Promise.reject(new Error('net')) : fetch(u, o)) });
  const h3 = await RM2.join(null, 'host'); await h3.presence({ role: 'host' });
  const g3 = await RM2.join(h3.code, 'guest'); await g3.presence({ role: 'guest' });
  await until(() => h3.peers().length === 2, 3000, 'h3 melihat g3');
  flaky = true; await sleep(1800); flaky = false;
  assert.strictEqual(h3.peers().length, 2); assert.strictEqual(h3.closed, false); ok('klien: gangguan jaringan sesaat tidak memutus lawan');
  await h3.leave(); await g3.leave();

  // ---- Room Master (penonton): melihat kedua pemain, tidak ikut bermain
  r = await raw({ action: 'create' }); const mh = r.j; const mcode = mh.code;
  r = await raw({ action: 'watch', code: 'ZZZZ' }); assert.strictEqual(r.s, 404); ok('master: kode salah → 404');
  r = await raw({ action: 'join', code: mcode }); const mg = r.j;
  r = await raw({ action: 'watch', code: mcode }); assert.strictEqual(r.s, 200); assert.strictEqual(r.j.side, 'master'); const mm = r.j; ok('master: masuk lewat kode (kursi ke-3)');
  r = await raw({ action: 'watch', code: mcode }); assert.strictEqual(r.s, 409); ok('master kedua ditolak → 409');
  r = await raw({ action: 'join', code: mcode }); assert.strictEqual(r.s, 409); ok('master tidak memakai kursi pemain (guest tetap 409)');
  await raw({ action: 'sync', code: mcode, side: 'host', id: mh.id, s: 1, p: { role: 'host', d: 120 } });
  await raw({ action: 'sync', code: mcode, side: 'guest', id: mg.id, s: 1, p: { role: 'guest', d: 80 } });
  r = await raw({ action: 'sync', code: mcode, side: 'master', id: mm.id, s: 1, p: { role: 'master' } });
  assert.strictEqual(r.j.h.p.d, 120); assert.strictEqual(r.j.g.p.d, 80); ok('master: satu sync membaca host + guest');
  r = await raw({ action: 'sync', code: mcode, side: 'host', id: mh.id, s: 2, p: { role: 'host' } });
  assert.strictEqual(r.j.o.p.role, 'guest'); assert.strictEqual(r.j.m, 1); ok('pemain: tidak melihat master sebagai lawan, tapi tahu ada master (m=1)');
  r = await raw({ action: 'leave', code: mcode, side: 'master', token: mm.token });
  r = await raw({ action: 'sync', code: mcode, side: 'host', id: mh.id, s: 3, p: {} }); assert.strictEqual(r.j.m, 0); ok('master keluar → pemain tahu (m=0)');
  r = await raw({ action: 'watch', code: mcode }); assert.strictEqual(r.s, 200); ok('kursi master bisa dipakai lagi');
  await raw({ action: 'leave', code: mcode, side: 'host', token: mh.token });
  r = await raw({ action: 'watch', code: mcode }); assert.strictEqual(r.s, 404); ok('host keluar → room (dan kursi master) tertutup');

  // transport: master melihat kedua pemain, pemain tahu watched()
  const MRM = makeRM({ api: base, hidden: () => false });
  const th = await MRM.join(null, 'host'); await th.presence({ role: 'host', car: 0 });
  const tg = await MRM.join(th.code, 'guest'); await tg.presence({ role: 'guest', car: 2 });
  const tm = await MRM.join(th.code, 'master'); await tm.presence({ role: 'master' });
  assert.strictEqual(tm.side, 'master');
  await until(() => tm.peers().length === 3, 3000, 'master melihat 2 pemain');
  const sides = tm.peers().slice(1).map(p => p.side).sort(); assert.deepStrictEqual(sides, ['guest', 'host']);
  await until(() => th.watched() && tg.watched(), 3000, 'pemain tahu ada master'); ok('klien: master melihat host & guest; pemain watched()');
  assert.strictEqual(th.peers().length, 2); assert.strictEqual(tg.peers().length, 2); ok('klien: pemain tetap hanya melihat lawan (bukan master)');
  th.live(true); tg.live(true); tm.hot(true);
  const tt = Date.now();
  for (let i = 1; i <= 20; i++) { th.presence({ d: i * 50, sp: 60 }); await sleep(60); }
  await until(() => { const h = tm.peers().find(p => p.side === 'host'); return h && h.presence.d === 1000; }, 2500, 'master menerima posisi host');
  ok('klien: posisi host sampai ke master (' + (Date.now() - tt) + ' ms)');
  let mclosed = false; tm.onClose(() => { mclosed = true; });
  await th.leave();
  await until(() => mclosed, 4000, 'master tahu room ditutup'); ok('klien: host keluar → master menerima onClose');
  await tg.leave(); await tm.leave();

  srv.close(); console.log('\nSemua tes lulus (' + n + ').'); process.exit(0);
})().catch(e => { console.error('GAGAL:', e); process.exit(1); });
