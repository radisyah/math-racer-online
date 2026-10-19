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

/* Room Master membuat lobby: dia memegang kursi 'master' dan mengendalikan ronde.
   Pemain 1 = kursi 'host', Pemain 2 = kursi 'guest' (diisi otomatis berurutan lewat kode). */
async function actCreate() {
  const store = getStore(), token = rid(12), id = rid(4);
  for (let i = 0; i < 12; i++) {
    let code = '';
    for (let k = 0; k < 4; k++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
    const ok = await store.cmd(['SET', roomKey(code), String(Date.now()), 'NX', 'EX', TTL]);
    if (ok === 'OK') {
      await store.cmd(['SET', seatKey(code, 'master'), token, 'EX', TTL]);
      await store.cmd(['SET', presKey(code, 'master'), JSON.stringify({ id, s: 0, p: {} }), 'EX', PRES_TTL]);
      return { code, side: 'master', token, id };
    }
  }
  throw fail(503, 'Gagal membuat room. Coba lagi.');
}

/* Pemain masuk lewat kode: kursi kosong pertama (Pemain 1, lalu Pemain 2). Kehadiran (presence)
   direbut dengan SET NX sehingga dua orang yang masuk bersamaan tidak bisa mendapat kursi yang sama;
   kursi sisa dari pemain yang sudah tidak aktif (presence kedaluwarsa) otomatis bisa diambil alih. */
async function actJoin(b) {
  const code = normCode(b.code), store = getStore();
  const room = await store.cmd(['GET', roomKey(code)]);
  if (!room) throw fail(404, 'Room tidak ditemukan. Cek kodenya dan pastikan Room Master sudah membuat lobby.');
  const token = rid(12), id = rid(4);
  for (const side of ['host', 'guest']) {
    const got = await store.cmd(['SET', presKey(code, side), JSON.stringify({ id, s: 0, p: {} }), 'NX', 'EX', PRES_TTL]);
    if (got === 'OK') {
      await store.cmd(['SET', seatKey(code, side), token, 'EX', TTL]);
      return { code, side, token, id };
    }
  }
  throw fail(409, 'Lobby sudah penuh (Pemain 1 dan 2 sudah terisi).');
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
    ['GET', presKey(code, 'master')]
  ]);
  if (!r[2]) throw gone();
  const M = parsePres(r[3]);
  return { o: parsePres(r[1]), M, m: M ? 1 : 0 };   // M: presence Room Master (sinyal ronde), m: master hadir
}

async function actLeave(b) {
  const code = normCode(b.code), side = normSide(b.side), store = getStore();
  const seat = await store.cmd(['GET', seatKey(code, side)]);
  if (!seat || seat !== String(b.token || '')) return {};          // bukan pemilik kursi: abaikan
  if (side === 'master') {
    // Room Master keluar → lobby ditutup untuk semua
    await store.pipeline([['DEL', roomKey(code)],
      ['DEL', seatKey(code, 'master')], ['DEL', presKey(code, 'master')],
      ['DEL', seatKey(code, 'host')], ['DEL', presKey(code, 'host')],
      ['DEL', seatKey(code, 'guest')], ['DEL', presKey(code, 'guest')]]);
  } else {
    await store.pipeline([['DEL', seatKey(code, side)], ['DEL', presKey(code, side)]]);   // pemain keluar: kursi bebas
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
    const acts = { create: actCreate, join: actJoin, sync: actSync, leave: actLeave };
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
