// Dok aksi di bawah layar: daftar aksi giliranku, kotak catatan, atau status menunggu pasangan.
import { $, esc } from '../util.js';
import { app } from '../app.js';
import { daftarAksi } from '../engine/aturan.js';
import { pionMilik } from '../engine/state.js';
import { LOKASI } from '../data/peta.js';
import { setSorot } from '../scene/papan.js';

const NAMA_PION = { taki:'Taki', mitsuha:'Mitsuha', tessie:'Tessie', sayaka:'Sayaka' };
let pilihanKini = [];

export function aksiTersedia() { return pilihanKini; }

export function renderDok() {
  const s = app.S, el = $('#dock');
  pilihanKini = [];
  if (!s || s.phase !== 'main' || app.me == null) { el.hidden = true; setSorot([]); return; }
  el.hidden = false;
  const me = app.me, giliranku = s.giliran === me;
  const namaLain = esc((s.players[1 - me] || {}).name || (me === 0 ? 'Mitsuha' : 'Taki'));

  if (!giliranku) {
    setSorot([]);
    const tahap = s.langkah === 'catatan' ? 'sedang menulis catatan' : `sedang bermain · sisa ${s.aksi} aksi`;
    el.innerHTML = `<div class="panel"><div class="tunggu"><span class="dots"><i></i><i></i><i></i></span><div><b>${namaLain}</b> ${tahap}</div></div></div>`;
    return;
  }

  if (s.langkah === 'catatan') {
    setSorot([]);
    const pasangan = me === 0 ? 'Mitsuha' : 'Taki';
    el.innerHTML = `<div class="panel">
      <div class="dock-head"><h3>✍️ Catatan untuk ${pasangan}</h3><span class="petunjuk" id="hitKata">0/5 kata</span></div>
      <textarea id="inCatatan" rows="2" maxlength="60" placeholder="Maksimal 5 kata, mis. &quot;jangan ke danau, nenek marah&quot;"></textarea>
      <div class="dock-foot"><button class="btn ghost" data-act="lewatiCatatan">Lewati</button><button class="btn utama lebar" data-act="kirimCatatan">Kirim catatan</button></div>
      <p class="petunjuk">Selain lewat catatan, kalian tidak boleh membicarakan strategi.</p></div>`;
    const ta = $('#inCatatan');
    ta.addEventListener('input', () => {
      const kata = ta.value.trim().split(/\s+/).filter(Boolean);
      if (kata.length > 5) ta.value = kata.slice(0, 5).join(' ');
      $('#hitKata').textContent = `${Math.min(5, kata.length)}/5 kata`;
    });
    return;
  }

  pilihanKini = daftarAksi(s, me);
  const pions = pionMilik(s, me).map(p => NAMA_PION[p]).join(' & ');
  let dots = '';
  for (let i = 0; i < Math.max(s.aksi, 3); i++) dots += `<i class="${i < s.aksi ? '' : 'off'}"></i>`;
  const urut = pilihanKini.slice().sort((x, y) => (x.a.t === 'jalan') - (y.a.t === 'jalan'));
  const tombol = urut.map(o => {
    const i = pilihanKini.indexOf(o), kelas = o.a.t === 'jalan' ? 'jalan' : ['sake', 'yakinkan', 'ledak', 'siar', 'berangkat'].includes(o.a.t) ? 'utama' : '';
    return `<button class="aksi ${kelas}" data-act="aksi" data-i="${i}"><span>${esc(o.label)}${o.ket ? `<small>${esc(o.ket)}</small>` : ''}</span><span class="biaya">${o.biaya} aksi</span></button>`;
  }).join('');
  const tempat = pionMilik(s, me).map(p => LOKASI[s.pos[p]] ? LOKASI[s.pos[p]].nama : s.pos[p] === 'hida' ? 'Hida' : 'Kuil Gunung').join(' · ');
  el.innerHTML = `<div class="panel">
    <div class="dock-head"><h3>Giliranmu · ${esc(pions)}</h3><div class="sisa" aria-label="Sisa ${s.aksi} aksi">${dots}</div></div>
    <div class="aksi-list">${tombol || '<p class="petunjuk">Tidak ada aksi yang cukup untuk sisa aksimu.</p>'}</div>
    <div class="dock-foot"><button class="btn ghost lebar" data-act="akhiriGiliran">Akhiri giliran</button></div>
    <p class="petunjuk">📍 ${esc(tempat)} · Ketuk lokasi yang bercahaya untuk berjalan.</p></div>`;

  // selama animasi atau pengiriman berjalan, tombol dinonaktifkan supaya ketukan tidak hilang diam-diam
  if (app.sibuk) el.querySelectorAll('button').forEach(b => { b.disabled = true; });

  const target = [];
  for (const o of pilihanKini) {
    if (o.a.t === 'jalan') target.push(o.a.ke);
    if (o.a.t === 'tanya') target.push('desa' + o.a.slot);
  }
  setSorot(target);
}
