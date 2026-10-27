// Koneksi ke server room lewat WebSocket (/ws di domain yang sama).
// Setiap `set` membawa `base` (seq yang terakhir kita lihat); server menolak dengan 'conflict' kalau sudah berubah.

export function hubungkan(url) {
  let ws = null, open = false, closed = false, everOpen = false, nextId = 1;
  const pending = {}, subs = {}, outbox = [];
  const opened = new Promise(res => {
    const connect = () => {
      if (closed) return;
      try { ws = new WebSocket(url); } catch (e) { res(false); return; }
      ws.onopen = () => {
        open = true; everOpen = true; res(true);
        for (const code in subs) ws.send(JSON.stringify({ t:'sub', code }));
        while (outbox.length) ws.send(outbox.shift());
      };
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'res' && pending[m.id]) {
          const p = pending[m.id]; delete pending[m.id]; clearTimeout(p.timer);
          m.ok ? p.resolve(m) : p.reject({ code:m.error || 'unavailable', data:m.data });
        } else if (m.t === 'snap' && subs[m.code]) {
          subs[m.code](m.data);
        }
      };
      // sambung ulang hanya jika sebelumnya pernah tersambung; kalau sejak awal gagal, berarti tidak ada server
      ws.onclose = () => { open = false; if (!everOpen) { closed = true; res(false); } else if (!closed) setTimeout(connect, 1500); };
    };
    connect();
  });
  const raw = msg => { const s = JSON.stringify(msg); open ? ws.send(s) : outbox.push(s); };
  const request = msg => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { delete pending[id]; reject({ code:'unavailable' }); }, 8000);
    pending[id] = { resolve, reject, timer };
    raw(Object.assign({ id }, msg));
  });
  return {
    opened,
    close() { closed = true; if (ws) ws.close(); },
    get: code => request({ t:'get', code }).then(r => (r.exists ? r.data : null)),
    set: (code, data, base) => request({ t:'set', code, data, base }).then(() => {}),
    dengar(code, cb) {
      subs[code] = cb; raw({ t:'sub', code });
      return () => { delete subs[code]; raw({ t:'unsub', code }); };
    },
  };
}

export async function cobaServer() {
  if (!/^https?:$/.test(location.protocol)) return null;
  const db = hubungkan((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  const ok = await Promise.race([db.opened, new Promise(r => setTimeout(() => r(false), 4000))]);
  if (!ok) { db.close(); return null; }
  return db;
}

export function pesanGalat(e, cadangan) {
  const code = e && e.code;
  if (code === 'server_full') return 'Server sedang penuh. Coba lagi beberapa saat lagi.';
  if (code === 'rate_limited') return 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.';
  if (code === 'too_large') return 'Data permainan terlalu besar untuk dikirim.';
  return cadangan;
}

export function buatKode() {
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let k = '';
  for (let i = 0; i < 4; i++) k += huruf[Math.floor(Math.random() * huruf.length)];
  return k;
}
