'use strict';
/* Room relay untuk Math Racer. Tanpa kunci/lock: tiap pemain hanya menulis kuncinya sendiri
   (pres:<kode>:<sisi>), jadi tidak ada balapan tulis antar pemain. Satu request "sync" =
   tulis presence sendiri + baca presence lawan dalam SATU round-trip Redis. */
const crypto = require('crypto');
const { getStore } = require('../lib/store.js');

const TTL = 6 * 3600;        // room hilang 6 jam setelah dibuat
const PRES_TTL = 10;         // detik; pemain dianggap keluar bila tidak sync selama ini
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_P = 1500;          // batas ukuran presence (karakter JSON)

const fail = (status, msg) => { const e = new Error(msg); e.status = status; return e; };
const rid = n => crypto.randomBytes(n).toString('hex');
const roomKey = c => 'mr:room:' + c;
const seatKey = (c, s) => 'mr:seat:' + c + ':' + s;
const presKey = (c, s) => 'mr:pres:' + c + ':' + s;
const oppOf = s => (s === 'host' ? 'guest' : 'host');
const normCode = c => {
  c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 4) throw fail(400, 'Kode room harus 4 karakter.');
  return c;
};
const normSide = s => { if (s !== 'host' && s !== 'guest' && s !== 'master') throw fail(400, 'Sisi tidak valid.'); return s; };

async function actCreate() {
  const store = getStore(), token = rid(12), id = rid(4);
  for (let i = 0; i < 12; i++) {
    let code = '';
    for (let k = 0; k < 4; k++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
    const ok = await store.cmd(['SET', roomKey(code), String(Date.now()), 'NX', 'EX', TTL]);
    if (ok === 'OK') {
      await store.cmd(['SET', seatKey(code, 'host'), token, 'EX', TTL]);
      return { code, side: 'host', token, id };
    }
  }
  throw fail(503, 'Gagal membuat room. Coba lagi.');
}

async function actJoin(b) {
  const code = normCode(b.code), store = getStore();
  const [room, guestPres] = await store.pipeline([['GET', roomKey(code)], ['GET', presKey(code, 'guest')]]);
  if (!room) throw fail(404, 'Room tidak ditemukan. Cek kodenya dan pastikan host sudah membuat room.');
  const token = rid(12), id = rid(4);
  const got = await store.cmd(['SET', seatKey(code, 'guest'), token, 'NX', 'EX', TTL]);
  if (got !== 'OK') {
    // kursi tersisa dari pemain yang sudah tidak aktif (refresh/tutup tab) boleh diambil alih
    if (guestPres) throw fail(409, 'Room sudah penuh.');
    await store.cmd(['SET', seatKey(code, 'guest'), token, 'EX', TTL]);
  }
  // tandai kursi aktif seketika, sebelum sync pertama klien (mencegah orang ketiga merebut kursi)
  await store.cmd(['SET', presKey(code, 'guest'), JSON.stringify({ id, s: 0, p: {} }), 'EX', PRES_TTL]);
  return { code, side: 'guest', token, id };
}

/* Room master: pengamat ke-3 yang hanya melihat kedua pemain. Satu kursi 'master' per room. */
async function actWatch(b) {
  const code = normCode(b.code), store = getStore();
  const [room, masterPres] = await store.pipeline([['GET', roomKey(code)], ['GET', presKey(code, 'master')]]);
  if (!room) throw fail(404, 'Room tidak ditemukan. Cek kodenya dan pastikan host sudah membuat room.');
  const token = rid(12), id = rid(4);
  const got = await store.cmd(['SET', seatKey(code, 'master'), token, 'NX', 'EX', TTL]);
  if (got !== 'OK') {
    if (masterPres) throw fail(409, 'Room ini sudah punya Room Master.');
    await store.cmd(['SET', seatKey(code, 'master'), token, 'EX', TTL]);
  }
  await store.cmd(['SET', presKey(code, 'master'), JSON.stringify({ id, s: 0, p: {} }), 'EX', PRES_TTL]);
  return { code, side: 'master', token, id };
}

const parsePres = raw => { if (!raw) return null; try { return JSON.parse(raw); } catch (e) { return null; } };

async function actSync(b) {
  const code = normCode(b.code), side = normSide(b.side), store = getStore();
  const id = String(b.id || '').replace(/[^a-f0-9]/g, '').slice(0, 16);
  if (!id) throw fail(400, 'Sesi tidak valid.');
  const p = b.p && typeof b.p === 'object' && !Array.isArray(b.p) ? b.p : {};
  const payload = JSON.stringify({ id, s: Number(b.s) || 0, p });
  if (payload.length > MAX_P) throw fail(413, 'Data terlalu besar.');
  const gone = () => { const e = fail(404, 'Room sudah ditutup.'); e.gone = true; return e; };
  if (side === 'master') {
    // master membaca KEDUA pemain sekaligus (satu round-trip)
    const r = await store.pipeline([
      ['SET', presKey(code, 'master'), payload, 'EX', PRES_TTL],
      ['GET', presKey(code, 'host')],
      ['GET', presKey(code, 'guest')],
      ['EXISTS', roomKey(code)]
    ]);
    if (!r[3]) throw gone();
    return { h: parsePres(r[1]), g: parsePres(r[2]) };
  }
  const r = await store.pipeline([
    ['SET', presKey(code, side), payload, 'EX', PRES_TTL],
    ['GET', presKey(code, oppOf(side))],
    ['EXISTS', roomKey(code)],
    ['EXISTS', presKey(code, 'master')]
  ]);
  if (!r[2]) throw gone();
  return { o: parsePres(r[1]), m: r[3] ? 1 : 0 };   // m: ada Room Master yang menonton
}

async function actLeave(b) {
  const code = normCode(b.code), side = normSide(b.side), store = getStore();
  const seat = await store.cmd(['GET', seatKey(code, side)]);
  if (!seat || seat !== String(b.token || '')) return {};          // bukan pemilik kursi: abaikan
  if (side === 'host') {
    await store.pipeline([['DEL', roomKey(code)], ['DEL', seatKey(code, 'host')], ['DEL', presKey(code, 'host')],
      ['DEL', seatKey(code, 'master')], ['DEL', presKey(code, 'master')]]);
  } else {
    await store.pipeline([['DEL', seatKey(code, side)], ['DEL', presKey(code, side)]]);   // guest atau master
  }
  return {};
}

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch (e) { throw fail(400, 'Body tidak valid.'); } }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') throw fail(405, 'Metode tidak didukung.');
    const b = readBody(req);
    const acts = { create: actCreate, join: actJoin, watch: actWatch, sync: actSync, leave: actLeave };
    if (!acts[b.action]) throw fail(400, 'Aksi tidak dikenal.');
    const out = await acts[b.action](b);
    res.status(200).json(Object.assign({ ok: true }, out));
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(e);
    res.status(status).json({
      ok: false, gone: !!e.gone,
      error: status >= 500 && !e.status ? 'Terjadi kesalahan di server.' : e.message
    });
  }
};
