// Titik masuk: menyiapkan dunia 3D, menghubungkan ke server room, menerima state, dan memutar animasi efeknya.
import { $, toast, kilat, lsGet, lsSet, sleep } from './util.js';
import { app } from './app.js';
import { jalankan, progresKomet } from './engine/aturan.js';
import { buatRoom, lengkapiState, TARGET_WARGA } from './engine/state.js';
import { aturanById } from './data/kartu.js';
import { CIRI, PAPAN, LOKASI } from './data/peta.js';
import { initDunia, setSuasana, setKomet, arahkanKamera, pasangPilih, kilatan } from './scene/dunia.js';
import { buatPapan, perbarui, objekPilih, gerakPion, posisiDunia, efekLedak, efekSiaran, efekTemu, efekSenja } from './scene/papan.js';
import { cobaServer, pesanGalat } from './net/room.js';
import { renderHUD } from './ui/hud.js';
import { renderDok, aksiTersedia } from './ui/dok.js';
import { lemparDadu } from './ui/dadu.js';
import { lobi, renderLobby, aksiLobby, setOnMasuk, keluarRoom } from './ui/lobby.js';
import { bukaModal, tutupModal, modalKini, kartuKejadian, kartuPetunjuk, bukaPonsel, infoLokasi, bukaLog, bukaBantuan, renderSenja, detikSenja, renderAkhir, renderSkor } from './ui/kartu.js';

/* ---------- identitas perangkat ---------- */
// ?id=... di alamat dipakai untuk menguji dua pemain di satu browser
const idUrl = new URLSearchParams(location.search).get('id');
app.myId = idUrl || lsGet('bs_id') || (() => { const v = Math.random().toString(36).slice(2, 10); lsSet('bs_id', v); return v; })();

/* ---------- dunia 3D ---------- */
initDunia($('#stage'));
buatPapan();
pasangPilih(objekPilih, ketukObjek);

/* ---------- menerima state dari room ---------- */
let berhenti = null, antrian = [], memutar = false;
let dariLobi = false;   // state pertama setelah lobby: efeknya (kartu hari pertama) tetap diputar

setOnMasuk(kode => {
  if (berhenti) { berhenti(); berhenti = null; }
  antrian = []; app.S = null;
  if (!kode) { renderSemua(); renderLobby(); return; }
  berhenti = app.db.dengar(kode, terima);
});

function terima(data) {
  if (!data) return;
  const k = data.players.findIndex(p => p && p.id === app.myId);
  if (data.phase === 'lobby') {
    app.me = k >= 0 ? k : null; app.S = null; dariLobi = true;
    lobi.room = data; lobi.view = k >= 0 ? 'tunggu' : 'ambil';
    if (modalKini()) tutupModal();
    renderSemua(); renderLobby();
    return;
  }
  if (k < 0) { lobi.room = data; lobi.view = 'ambil'; renderLobby(); return; }
  app.me = k;
  if (lobi.view !== 'none') { lobi.view = 'none'; renderLobby(); }
  antrian.push(lengkapiState(data));
  putar();
}

async function putar() {
  if (memutar) return;
  memutar = true;
  while (antrian.length) {
    const st = antrian.shift();
    if (app.S && st.seq <= app.S.seq) continue;
    const lama = app.S, baruMasuk = !lama;
    // kalau banyak langkah menumpuk (mis. HP baru tersambung lagi), langkah lama dilewati tanpa animasi
    const tertinggal = antrian.length >= 2;
    if (!tertinggal && ((!baruMasuk && st.seq === lama.seq + 1) || (baruMasuk && dariLobi))) {
      app.sibuk = true; renderDok();
      if (baruMasuk) { perbarui(st, app.me); suasana(st); fokusPionku(st); }
      try { await putarEfek(st.fx || [], lama || st, st); } catch (e) { console.error(e); }
    }
    dariLobi = false;
    app.S = st;
    if (baruMasuk) fokusPionku();
    renderSemua();
  }
  app.sibuk = false;
  memutar = false;
  renderSemua();
}

const NAMA = k => (app.S && app.S.players[k] ? app.S.players[k].name : k === 0 ? 'Taki' : 'Mitsuha');

async function putarEfek(fx, lama, st) {
  const me = app.me;
  for (const f of fx) {
    switch (f.t) {
      case 'pagi':
        perbarui(st, me); suasana(st);
        await kilat(`Hari ${f.hari}`, st.babak === 1 ? (f.tukar ? 'Kalian bertukar tubuh!' : 'Hari biasa, di tubuh sendiri') : `Ingatan memudar (−${f.lupa})`);
        break;
      case 'kartu': await kartuKejadian(f.jenis, f.id); break;
      case 'giliran':
        if (f.who === me) { fokusPionku(st); toast('Giliranmu!'); }
        break;
      case 'jalan': perbarui(lama, me); await gerakPion(st, f.pion, f.dari, f.ke); break;
      case 'dadu': await lemparDadu(f); break;
      case 'langgar': {
        const a = aturanById(f.id);
        // pelanggar tidak diberi tahu aturan mana; pemilik tubuh tahu
        if (f.who === me) await kilat('Ada yang salah…', 'Sepertinya kamu melanggar aturan hidup pasanganmu · Kekacauan +1', 2200);
        else toast(`${NAMA(f.who)} melanggar aturan hidupmu: "${a.teks}"`, 3600);
        break;
      }
      case 'petunjuk':
        perbarui(st, me);
        if (f.who === me) { if (f.id) await kartuPetunjuk(f.loc, f.id); else toast(`${LOKASI[f.loc].nama}: tidak ada petunjuk di sini`, 2600); }
        else if (f.id) toast(`${NAMA(f.who)} menemukan aturan hidupmu: "${aturanById(f.id).teks}"`, 3600);
        break;
      case 'ciri': toast(`Ciri Itomori ditemukan: ${CIRI[f.id].nama}`, 3200); break;
      case 'jejak': toast('Jejak +1: Mitsuha meninggalkan kenangan di Tokyo', 2800); break;
      case 'babak':
        suasana(st);
        if (f.n === 2) { await kilat('Babak 2 · Pencarian', 'Pertukaran berhenti. Semua catatan menghilang.', 2600); if (me === 0) arahkanKamera(PAPAN.hida.pusat, 16); }
        if (f.n === 3) { perbarui(st, me); await kilat('Babak 3 · Evakuasi', `Selamatkan minimal ${TARGET_WARGA} warga sebelum komet jatuh!`, 2600); arahkanKamera(PAPAN.itomori.pusat, 17); }
        break;
      case 'senja': perbarui(st, me); suasana(st); efekSenja(); arahkanKamera(posisiDunia('i_gunung'), 11); await kilat('Kataware-doki', 'Senja: waktu di antara siang dan malam', 2600); break;
      case 'temu': perbarui(st, me); efekTemu(f.slot); await kilat('Itomori ditemukan', 'Desa itu hancur oleh komet tiga tahun lalu…', 2800); break;
      case 'sake': await kilat('Kuchikamizake', 'Benang waktu tersambung kembali…', 2400); break;
      case 'ledak': perbarui(st, me); efekLedak(); await kilat('BOOM!', 'Gardu meledak, Itomori gelap gulita', 1800); break;
      case 'siaran': efekSiaran(); toast('📢 Peringatan evakuasi menggema di seluruh desa', 3000); break;
      case 'perintah': await kilat('Perintah evakuasi!', 'Wali kota memerintahkan semua warga mengungsi', 2400); break;
      case 'warga': perbarui(st, me); await sleep(250); break;
      case 'catatan': if (f.dari !== me) toast(`📱 Catatan baru dari ${NAMA(f.dari)}`, 2600); break;
      case 'komet': kilatan(PAPAN.itomori.pusat, 0xffffff, 30); await sleep(900); break;
    }
  }
}

function suasana(s) {
  if (!s) return setSuasana('pagi');
  if (s.phase === 'senja') setSuasana('senja');
  else if (s.babak === 3 || s.phase === 'akhir' || s.phase === 'selesai') setSuasana('malam');
  else if (s.babak === 2) setSuasana('redup');
  else setSuasana('pagi');
  setKomet(progresKomet(s));
}

function fokusPionku(s = app.S) {
  if (!s || app.me == null || !s.pos) return;
  let pion;
  if (s.babak === 3) pion = app.me === 1 ? 'mitsuha' : 'tessie';
  else { const tukar = s.babak === 1 && s.tukar; pion = app.me === 0 ? (tukar ? 'mitsuha' : 'taki') : (tukar ? 'taki' : 'mitsuha'); }
  // titik bidik sedikit di depan pion supaya pion tampil di atas dok aksi
  const [x, z] = posisiDunia(s.pos[pion]);
  arahkanKamera([x, z + 2.6], 15);
}

function renderSemua() {
  const s = app.S;
  renderHUD();
  renderDok();
  $('#side').hidden = !s || s.phase === 'lobby';
  if (!s) { setSuasana('pagi'); setKomet(0); return; }
  perbarui(s, app.me);
  suasana(s);
  const baru = s.catatan.filter(c => c.dari !== app.me).length;
  const badge = $('#badgeNote'), belum = Math.max(0, s.catatan.length - app.dibaca);
  badge.hidden = !(baru && belum); badge.textContent = belum;
  if (memutar && app.sibuk) return;
  // modal yang mengikuti fase permainan
  if (s.phase === 'senja') renderSenja();
  else if (s.phase === 'akhir') renderAkhir();
  else if (s.phase === 'selesai') renderSkor();
  else if (['senja', 'akhir', 'skor'].includes(modalKini())) tutupModal();
}

/* ---------- mengirim langkah ---------- */
async function kirim(aksi) {
  const s = app.S;
  if (!s || app.sibuk || memutar) return;
  const ns = jalankan(s, app.me, aksi);
  if (ns.error) { toast(ns.error); return; }
  app.sibuk = true; renderDok();
  try { await app.db.set(app.kode, ns, s.seq); }
  catch (e) {
    if (e.code === 'conflict') { toast('Permainan baru saja berubah. Coba lagi.'); if (e.data) terima(e.data); }
    else toast(pesanGalat(e, 'Langkah gagal terkirim. Cek koneksi lalu coba lagi.'));
  }
  app.sibuk = false;
  if (!memutar) renderDok();
}
app.kirim = kirim;

/* ---------- ketukan di papan 3D ---------- */
function ketukObjek(p) {
  if (!p || !app.S) return;
  const pilihan = aksiTersedia();
  if (p.jenis === 'lokasi') {
    const o = pilihan.find(x => x.a.t === 'jalan' && x.a.ke === p.id);
    if (o) return kirim(o.a);
    return infoLokasi(p.id);
  }
  if (p.jenis === 'desa') {
    const o = pilihan.find(x => x.a.t === 'tanya' && x.a.slot === p.slot);
    if (o) return kirim(o.a);
    toast(`Desa ${p.slot + 1}`);
  }
}

/* ---------- tombol ---------- */
const kameraUrut = ['tokyo', 'itomori', 'hida', 'semua'];
let kameraI = -1;
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act.startsWith('l:')) return aksiLobby(act.slice(2), b);
  switch (act) {
    case 'aksi': { const o = aksiTersedia()[+b.dataset.i]; if (o) kirim(o.a); break; }
    case 'akhiriGiliran': kirim({ t:'selesai' }); break;
    case 'kirimCatatan': kirim({ t:'catatan', teks:($('#inCatatan') || {}).value || '' }); break;
    case 'lewatiCatatan': kirim({ t:'catatan', teks:'' }); break;
    case 'tutup': tutupModal(); break;
    case 'tabPonsel': bukaPonsel(b.dataset.tab); renderSemua(); break;
    case 'ponsel': bukaPonsel(); renderSemua(); break;
    case 'log': bukaLog(); break;
    case 'bantuan': bukaBantuan(); break;
    case 'kamera': {
      const s = app.S;
      do kameraI = (kameraI + 1) % kameraUrut.length; while (kameraUrut[kameraI] === 'hida' && !(s && s.babak >= 2));
      const k = kameraUrut[kameraI];
      if (k === 'semua') arahkanKamera([0, 3], 34, 0.95); else arahkanKamera(PAPAN[k].pusat, 16);
      toast(k === 'semua' ? 'Seluruh papan' : PAPAN[k].nama, 1000);
      break;
    }
    case 'senjaSiap': kirim({ t:'senjaSiap' }); break;
    case 'kirimTebak': {
      const r = document.querySelector('input[name=tebakMisi]:checked');
      if (!r) { toast('Pilih satu misi untuk ditebak.'); break; }
      kirim({ t:'tebak', misi:r.value, nama:($('#inNamaAkhir') || {}).value || '' });
      break;
    }
    case 'keluar': tutupModal(); keluarRoom(); break;
    case 'mainLagi': {
      const s = app.S, room = buatRoom(s.players);
      room.seq = s.seq + 1;
      try { await app.db.set(app.kode, room, s.seq); } catch (err) { toast('Gagal membuat permainan baru. Coba lagi.'); }
      break;
    }
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ['ponsel', 'log', 'bantuan', 'info'].includes(modalKini())) tutupModal();
});
setInterval(detikSenja, 500);

/* ---------- mulai ---------- */
renderLobby();
renderSemua();
arahkanKamera([0, 3], 34, 0.95, 0.01);
(async () => {
  app.db = await cobaServer();
  lobi.online = app.db ? 'ready' : 'off';
  renderLobby();
})();
