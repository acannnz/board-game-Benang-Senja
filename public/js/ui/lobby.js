// Lobby: isi nama, buat room (pilih peran) atau gabung dengan kode, lalu menunggu pasangan.
import { $, esc, lsGet, lsSet, lsDel } from '../util.js';
import { app } from '../app.js';
import { buatRoom } from '../engine/state.js';
import { jalankan } from '../engine/aturan.js';
import { buatKode, pesanGalat } from '../net/room.js';

export const lobi = { view:'home', err:'', online:'checking', room:null };
const prefs = { nama:lsGet('bs_nama') || '', peran:+(lsGet('bs_peran') || 0) };
let onMasuk = null;    // dipanggil main.js saat room siap didengarkan

export function setOnMasuk(fn) { onMasuk = fn; }

const logo = `<div class="logo"><span class="l1">Benang Senja</span><span class="l2">PERMAINAN UNTUK BERDUA</span><span class="benang"></span></div>`;
const PERAN = [
  { k:0, nama:'Taki', ket:'Siswa SMA di Tokyo', c:'var(--taki)' },
  { k:1, nama:'Mitsuha', ket:'Gadis kuil di Itomori', c:'var(--mitsuha)' },
];

export function renderLobby() {
  const L = $('#lobby');
  if (lobi.view === 'none') { L.hidden = true; return; }
  L.hidden = false;
  const err = lobi.err ? `<p class="err">${esc(lobi.err)}</p>` : '';
  let h = '';
  if (lobi.view === 'home') {
    const simpan = lsGet('bs_room'), siap = lobi.online === 'ready';
    h = `${logo}<p class="tag">Dua orang asing yang bertukar tubuh, satu benang merah, dan komet yang akan jatuh. Selamatkan Itomori bersama, dan jangan lupakan namanya.</p>
      ${simpan && siap ? `<button class="tiket" data-act="l:lanjut"><b>Kembali ke room ${esc(simpan)}</b><span>Lanjutkan permainan terakhir</span></button>` : ''}
      <div class="field"><label for="inNama">Namamu</label><input type="text" id="inNama" maxlength="14" placeholder="Nama panggilan" value="${esc(prefs.nama)}"></div>
      <button class="tiket utama" data-act="l:keBuat" ${siap ? '' : 'disabled'}><b>Buat room baru</b><span>Pilih peran, lalu bagikan kode ke pasanganmu</span></button>
      <div class="field"><label for="inKode">Punya kode room?</label><input type="text" id="inKode" maxlength="4" placeholder="Mis. K7QH" style="text-transform:uppercase;letter-spacing:.2em"></div>
      <button class="tiket" data-act="l:gabung" ${siap ? '' : 'disabled'}><b>Gabung ke room</b><span>Masukkan kode dari pasanganmu</span></button>
      ${err}<p class="note">${lobi.online === 'checking' ? 'Menghubungkan ke server…' : lobi.online === 'off'
        ? 'Server room tidak ditemukan. Jalankan server (lihat README) lalu buka alamatnya di HP masing-masing.'
        : 'Main di HP masing-masing: satu orang membuat room, satunya memasukkan kode.'}</p>`;
  } else if (lobi.view === 'buat') {
    h = `${logo}<div class="field"><label>Kamu ingin menjadi siapa?</label><div class="peran-pilih">
      ${PERAN.map(p => `<button data-act="l:peran" data-k="${p.k}" aria-pressed="${prefs.peran === p.k}" style="--c:${p.c}"><b>${p.nama}</b><span>${p.ket}</span></button>`).join('')}</div></div>
      ${err}<button class="tiket utama" data-act="l:buat"><b>Buat room</b><span>Pasanganmu otomatis menjadi ${prefs.peran === 0 ? 'Mitsuha' : 'Taki'}</span></button>
      <button class="back" data-act="l:home">← Kembali</button>`;
  } else if (lobi.view === 'tunggu') {
    const r = lobi.room, penuh = r && r.players[0] && r.players[1];
    const kursi = r ? PERAN.map(p => { const pl = r.players[p.k]; return `<div class="seat"><span><span class="c" style="background:${p.c}"></span>${p.nama}</span><b>${pl ? esc(pl.name) + (pl.id === app.myId ? ' (kamu)' : '') : '<span class="dots"><i></i><i></i><i></i></span>'}</b></div>`; }).join('') : '';
    h = `${logo}<p class="tag">Bagikan kode ini ke pasanganmu</p><div class="kode" id="kodeTxt">${esc(app.kode)}</div>
      <button class="tiket" data-act="l:salin"><b>Salin kode</b><span>Pasanganmu membuka alamat yang sama lalu memasukkan kode</span></button>
      ${kursi}${err}
      ${penuh ? `<button class="tiket utama" data-act="l:mulai"><b>Mulai permainan</b><span>Sekitar 90–110 menit</span></button>` : '<p class="note">Menunggu pasanganmu bergabung…</p>'}
      <button class="back" data-act="l:keluar">← Keluar dari room</button>`;
  } else if (lobi.view === 'ambil') {
    const r = lobi.room;
    h = `${logo}<p class="tag">Room ${esc(app.kode)} sudah berjalan. Kamu siapa di permainan ini?</p>
      ${PERAN.map(p => `<button class="tiket" data-act="l:ambil" data-k="${p.k}"><b>${p.nama} · ${esc((r.players[p.k] || {}).name || '')}</b><span>Lanjutkan sebagai pemain ini di perangkat ini</span></button>`).join('')}
      ${err}<button class="back" data-act="l:home">← Kembali</button>`;
  }
  L.innerHTML = `<div class="lobby-box">${h}</div>`;
}

function simpanNama() {
  const el = $('#inNama');
  if (el) { prefs.nama = el.value.trim().slice(0, 14); lsSet('bs_nama', prefs.nama); }
}
const aku = () => ({ id:app.myId, name:prefs.nama || 'Kamu' });

export async function aksiLobby(act, el) {
  lobi.err = '';
  switch (act) {
    case 'home': lobi.view = 'home'; break;
    case 'keBuat':
      simpanNama();
      if (!prefs.nama) { lobi.err = 'Isi namamu dulu.'; break; }
      lobi.view = 'buat'; break;
    case 'peran': prefs.peran = +el.dataset.k; lsSet('bs_peran', prefs.peran); break;
    case 'buat': {
      const kode = buatKode(), pemain = [null, null];
      pemain[prefs.peran] = aku();
      try { await app.db.set(kode, buatRoom(pemain), null); }
      catch (e) { lobi.err = pesanGalat(e, 'Room gagal dibuat. Cek koneksi lalu coba lagi.'); break; }
      app.kode = kode; lsSet('bs_room', kode);
      lobi.view = 'tunggu'; onMasuk(kode); break;
    }
    case 'gabung': {
      simpanNama();
      const kode = (($('#inKode') || {}).value || '').trim().toUpperCase();
      if (!prefs.nama) { lobi.err = 'Isi namamu dulu.'; break; }
      if (!/^[A-Z0-9]{4}$/.test(kode)) { lobi.err = 'Kode room terdiri dari 4 huruf/angka.'; break; }
      await gabung(kode); return;
    }
    case 'lanjut': await gabung(lsGet('bs_room')); return;
    case 'salin':
      try { await navigator.clipboard.writeText(app.kode); el.querySelector('b').textContent = 'Tersalin!'; } catch (e) { el.querySelector('b').textContent = 'Salin manual: ' + app.kode; }
      return;
    case 'mulai': {
      const ns = jalankan(lobi.room, app.me, { t:'mulai' });
      if (ns.error) { lobi.err = ns.error; break; }
      try { await app.db.set(app.kode, ns, lobi.room.seq); } catch (e) { lobi.err = e.code === 'conflict' ? 'Room baru saja berubah, coba lagi.' : pesanGalat(e, 'Gagal memulai.'); }
      break;
    }
    case 'keluar': keluarRoom(); break;
    case 'ambil': {
      const r = JSON.parse(JSON.stringify(lobi.room)), k = +el.dataset.k;
      r.players[k] = Object.assign({}, r.players[k], { id:app.myId });
      r.seq++;
      try { await app.db.set(app.kode, r, lobi.room.seq); lsSet('bs_room', app.kode); onMasuk(app.kode); }
      catch (e) { lobi.err = 'Gagal masuk ke room. Coba lagi.'; break; }
      return;
    }
  }
  renderLobby();
}

async function gabung(kode) {
  if (!kode) return;
  let r;
  try { r = await app.db.get(kode); }
  catch (e) { lobi.err = 'Tidak bisa terhubung. Coba lagi sebentar.'; lobi.view = 'home'; return renderLobby(); }
  if (!r) { lobi.err = `Room ${kode} tidak ditemukan.`; if (lsGet('bs_room') === kode) lsDel('bs_room'); lobi.view = 'home'; return renderLobby(); }
  app.kode = kode;
  const k = r.players.findIndex(p => p && p.id === app.myId);
  if (k >= 0) { lsSet('bs_room', kode); onMasuk(kode); return; }
  if (r.phase === 'lobby') {
    const kosong = r.players.findIndex(p => !p);
    if (kosong < 0) { lobi.room = r; lobi.view = 'ambil'; return renderLobby(); }
    const baru = JSON.parse(JSON.stringify(r));
    baru.players[kosong] = aku(); baru.seq++;
    try { await app.db.set(kode, baru, r.seq); }
    catch (e) { lobi.err = e.code === 'conflict' ? 'Room baru saja berubah, coba lagi.' : pesanGalat(e, 'Gagal bergabung.'); lobi.view = 'home'; return renderLobby(); }
    lsSet('bs_room', kode); onMasuk(kode); return;
  }
  lobi.room = r; lobi.view = 'ambil'; renderLobby();
}

export function keluarRoom() {
  lsDel('bs_room');
  app.kode = null; app.S = null; app.me = null;
  lobi.view = 'home'; lobi.room = null;
  if (onMasuk) onMasuk(null);
}
