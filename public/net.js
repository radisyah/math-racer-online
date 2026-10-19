'use strict';
/* Transport online Math Racer: polling ke /api/room (Vercel Function + Upstash Redis).
   Menyediakan API "room" kecil yang dipakai game: peers(), onPeers(), presence(), hot(), leave(), onClose().
   Satu request "sync" = kirim presence sendiri + terima presence pihak lain
   (master: Pemain 1 & 2; pemain: lawan & Room Master). */
(function (root) {
  const FAST = 350;      // ms antar sync saat balapan (hot)
  const IDLE = 900;      // ms antar sync saat menunggu/lobi
  const HIDDEN = 3000;   // ms bila tab tersembunyi
  const URGENT_GAP = 120;
  const MAX_FAILS = 10;

  function makeRM(opts) {
    opts = opts || {};
    const api = opts.api || '/api/room';
    const doFetch = opts.fetch || ((u, o) => fetch(u, o));
    const now = opts.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    const isHidden = opts.hidden || (() => typeof document !== 'undefined' && document.hidden);

    async function post(body, extra) {
      const r = await doFetch(api, Object.assign({
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      }, extra || {}));
      let j = null;
      try { j = await r.json(); } catch (e) { /* abaikan */ }
      return { status: r.status, ok: r.ok && j && j.ok, j: j || {} };
    }

    return {
      /* role "master": Room Master membuat lobby baru (kode dari server).
         role "player": pemain masuk dengan kode; server memberi kursi Pemain 1 ('host') atau Pemain 2 ('guest'). */
      async join(code, role) {
        let res;
        try {
          res = role === 'master' ? await post({ action: 'create' }) : await post({ action: 'join', code });
        } catch (e) {
          const err = new Error('Tidak bisa menjangkau server. Cek koneksi internetmu.');
          err.type = 'network';
          throw err;
        }
        if (!res.ok) {
          const err = new Error(res.j.error || 'Gagal terhubung (' + res.status + ').');
          err.type = res.status === 404 ? 'not-found' : res.status === 409 ? 'full' : 'server';
          throw err;
        }
        return build(res.j);
      }
    };

    function build(info) {
      const side = info.side, id = info.id, token = info.token, code = info.code;
      const mePeer = { peer: id, isMe: true, sameTab: true, presence: {} };
      const L = [], C = [];
      let seq = 0;
      // Slot lawan/pengamat. Room Master melihat 'host' (P1) & 'guest' (P2); pemain melihat lawannya & master.
      const isMaster = side === 'master';
      const keys = isMaster ? ['host', 'guest'] : [side === 'host' ? 'guest' : 'host', 'master'];
      const slots = {};
      keys.forEach(k => { slots[k] = { peer: null, seq: -1, rec: null }; });
      let masterOn = false, live = false;
      let inflight = false, again = false, timer = null, stopped = false, closed = false;
      let hot = false, fails = 0, lastStart = 0;

      const notify = () => L.slice().forEach(f => { try { f({}); } catch (e) { /* abaikan */ } });
      function close() {
        if (closed) return;
        closed = true; stopped = true; clearTimeout(timer);
        keys.forEach(k => { slots[k].rec = null; });
        C.slice().forEach(f => { try { f(); } catch (e) { /* abaikan */ } });
        notify();
      }
      function schedule(ms) {
        if (stopped) return;
        clearTimeout(timer);
        timer = setTimeout(sync, Math.max(0, ms));
      }
      function interval() { return isHidden() && !isMaster ? HIDDEN : (hot || (live && masterOn)) ? FAST : IDLE; }
      // true bila slot berubah
      function apply(k, o) {
        const sl = slots[k];
        if (!o) { if (sl.rec) { sl.rec = null; sl.peer = null; sl.seq = -1; return true; } return false; }
        if (!sl.rec || sl.peer !== o.id) {
          sl.peer = o.id; sl.seq = o.s;
          sl.rec = { peer: o.id, side: k, isMe: false, sameTab: false, presence: o.p || {}, at: now() };
          return true;
        }
        if (o.s !== sl.seq) {
          sl.seq = o.s;
          sl.rec = Object.assign({}, sl.rec, { presence: o.p || {}, at: now() });
          return true;
        }
        return false;
      }

      async function sync() {
        if (stopped) return;
        if (inflight) { again = true; return; }
        inflight = true; again = false; lastStart = now();
        let next = interval();
        try {
          const res = await post({ action: 'sync', code, side, id, s: seq, p: mePeer.presence });
          if (stopped) return;
          if (res.status === 404 || res.j.gone) { close(); return; }
          if (!res.ok) throw new Error('sync ' + res.status);
          fails = 0;
          let changed = false;
          if (isMaster) {
            changed = apply('host', res.j.h) | apply('guest', res.j.g);
          } else {
            masterOn = !!res.j.M;
            changed = apply(keys[0], res.j.o) | apply('master', res.j.M);
          }
          if (changed) notify();
        } catch (e) {
          if (++fails >= MAX_FAILS) { close(); return; }
          next = 1500; // gangguan jaringan sesaat: coba lagi, jangan anggap lawan keluar
        } finally {
          inflight = false;
        }
        if (stopped) return;
        if (again) next = Math.max(0, URGENT_GAP - (now() - lastStart));
        schedule(next);
      }

      const room = {
        code, side, id,
        get closed() { return closed; },
        peers: () => [mePeer].concat(keys.map(k => slots[k].rec).filter(Boolean)),
        /* true bila Room Master hadir (hanya relevan untuk pemain: posisi dikirim agar bisa ditonton) */
        watched: () => masterOn,
        /* live=true saat balapan: bila ada master, sync dipercepat agar tontonan mulus */
        live(v) { live = !!v; if (live && masterOn && !inflight) schedule(Math.min(FAST, Math.max(0, FAST - (now() - lastStart)))); },
        onPeers(f) {
          L.push(f);
          return () => { const i = L.indexOf(f); if (i >= 0) L.splice(i, 1); };
        },
        onClose(f) { C.push(f); },
        /* hot=true: sync cepat (saat balapan). Dipanggil game. */
        hot(v) {
          hot = !!v;
          if (hot && !inflight) schedule(Math.min(FAST, Math.max(0, FAST - (now() - lastStart))));
        },
        presence(patch) {
          let urgent = false;
          for (const k in patch) {
            if (patch[k] === null) delete mePeer.presence[k];
            else mePeer.presence[k] = patch[k];
            if (k === 'round' || k === 'seed' || k === 'opp' || k === 'role' || (k === 'ft' && patch[k] !== null)) urgent = true;
          }
          seq++;
          if (urgent && !stopped) {
            if (inflight) again = true;
            else schedule(URGENT_GAP - (now() - lastStart));
          }
          return Promise.resolve();
        },
        async leave() {
          if (stopped && closed) return;
          stopped = true; clearTimeout(timer); L.length = 0; C.length = 0;
          try { await post({ action: 'leave', code, side, token }, { keepalive: true }); } catch (e) { /* abaikan */ }
        },
        /* dipanggil saat halaman ditutup: beacon agar kursi langsung bebas */
        beacon() {
          if (stopped) return;
          try {
            const b = JSON.stringify({ action: 'leave', code, side, token });
            if (typeof navigator !== 'undefined' && navigator.sendBeacon)
              navigator.sendBeacon(api, new Blob([b], { type: 'application/json' }));
          } catch (e) { /* abaikan */ }
        }
      };
      schedule(0);
      return room;
    }
  }

  const api = { makeRM, FAST, IDLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MRNet = api;
})(typeof window !== 'undefined' ? window : globalThis);
