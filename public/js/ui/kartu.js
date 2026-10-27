// Kartu-kartu modal: kejadian & krisis, ponsel (catatan, aturan hidup, misi, kota), log, aturan main,
// layar senja, tebakan akhir, dan skor.
import { $, esc } from '../util.js';
import { app } from '../app.js';
import { KEJADIAN, KRISIS, ATURAN, MISI, aturanById, misiById } from '../data/kartu.js';
import { TOKOH, CIRI, LOKASI, tokohDi } from '../data/peta.js';
import { tubuhSendiri, tubuhPasangan, TARGET_WARGA, JAM_B3 } from '../engine/state.js';

let modalJenis = null, tutupCb = null;
export const modalKini = () => modalJenis;

export function bukaModal(jenis, html, onTutup) {
  const el = $('#modal');
  el.innerHTML = html; el.hidden = false;
  modalJenis = jenis; tutupCb = onTutup || null;
}
export function tutupModal() {
  const el = $('#modal'), cb = tutupCb;
  el.hidden = true; el.innerHTML = '';
  modalJenis = null; tutupCb = null;
  if (cb) cb();
}

/* ---------- kartu kejadian / krisis / pergantian hari ---------- */
const IKON = { mimpi:'🌙', kabut:'🌫️', hujan:'🌧️', gerimis:'🌦️', semangat:'☀️', gaji:'💴', dompet:'👛', tari:'⛩️', usil:'😜', traktir:'🍝', curiga:'🤨',
  kafeTes:'☕', gosip:'💬', kampanye:'📣', benang:'🧶', jingga:'🌇', makan:'🍱', basket:'🏀',
  tenang:'🕯️', longsor:'🚧', putus:'📵', panik:'😱', polisi:'🚓', kabutB3:'🌫️', jatuh:'🤕', sukarela:'🙋', pecahan:'☄️', lari:'🏃‍♀️' };

export function kartuKejadian(jenis, id) {
  const k = (jenis === 'krisis' ? KRISIS : KEJADIAN).find(x => x.id === id);
  if (!k) return Promise.resolve();
  return new Promise(res => bukaModal('kartu', `<div class="sheet kartu-kejadian ${jenis === 'krisis' ? 'gelap' : ''}">
    <span class="label">${jenis === 'krisis' ? 'Kartu Krisis' : 'Kejadian Pagi'}</span>
    <div class="ikon">${IKON[id] || '✦'}</div><h2>${esc(k.judul)}</h2><p>${esc(k.teks)}</p>
    <div class="actions"><button class="btn utama lebar" data-act="tutup" autofocus>Lanjut</button></div></div>`, res));
}

/* ---------- ponsel ---------- */
let tabPonsel = 'catatan';
export function bukaPonsel(tab) {
  if (tab) tabPonsel = tab;
  const s = app.S, me = app.me;
  if (!s || me == null || !s.misi) return;
  const tabs = [['catatan', 'Catatan'], ['hidup', 'Aturan'], ['misi', 'Misi'], ['kota', 'Kota']];
  let isi = '';
  if (tabPonsel === 'catatan') {
    app.dibaca = s.catatan.length;
    isi = s.catatan.length ? `<div class="pesan">${s.catatan.map(c => `<div class="bubble ${c.dari === me ? 'saya' : 'dia'}" style="--c:${c.dari === 0 ? 'var(--taki)' : 'var(--mitsuha)'}">${esc(c.teks)}<small>${c.dari === me ? 'kamu' : esc(namaPemain(1 - me))} · ${c.babak === 3 ? 'Jam' : 'Hari'} ${c.hari}</small></div>`).join('')}</div>`
      : `<p class="kosong">${s.babak >= 2 ? 'Semua catatan sudah menghilang…' : 'Belum ada catatan. Tulis catatan di akhir giliranmu.'}</p>`;
  } else if (tabPonsel === 'hidup') {
    const milik = tubuhSendiri(me), lain = tubuhPasangan(me);
    const item = (id, terbuka) => { const a = aturanById(id); return `<div class="aturan-item ${terbuka ? 'langgar' : ''}"><span class="tag2">${terbuka ? 'terbuka' : 'rahasia'}</span><span>${esc(a.teks)}</span></div>`; };
    isi = `<h3>Aturan hidup ${milik === 'taki' ? 'Taki' : 'Mitsuha'} (milikmu)</h3>
      <p class="kecil">Pasanganmu harus mematuhinya saat memakai tubuhmu. Beri tahu lewat catatan.</p>
      ${s.aturan[milik].map(id => item(id, s.terbuka[milik].includes(id))).join('')}
      <h3>Aturan hidup ${lain === 'taki' ? 'Taki' : 'Mitsuha'} yang sudah kamu ketahui</h3>
      ${s.terbuka[lain].length ? s.terbuka[lain].map(id => item(id, true)).join('') : '<p class="kosong">Belum ada. Ada 3 aturan rahasia; melanggarnya memberi Kekacauan.</p>'}
      <p class="kecil">Kekacauanmu: <b>${s.kekacauan[me]}</b> (masing-masing −1 Poin Kenangan)</p>`;
  } else if (tabPonsel === 'misi') {
    isi = `<p class="kecil">Misi ini rahasia. Di akhir permainan kalian akan saling menebak.</p>` +
      s.misi[me].map(id => { const m = misiById(id); return `<div class="misi"><b>+${m.poin} Poin Kenangan</b><br>${esc(m.teks)}</div>`; }).join('');
  } else {
    const hati = n => '♥'.repeat(n) + '♡'.repeat(3 - n);
    isi = `<div class="stat-grid"><div><span>💴 Uang Taki</span><b>${s.uang}</b></div><div><span>👣 Jejak</span><b>${s.jejak}</b></div>
      <div><span>🧨 Bahan</span><b>${s.bahan ? 'siap' : '–'}</b></div><div><span>📻 Latihan siaran</span><b>${s.latihan ? 'siap' : '–'}</b></div></div>
      <h3>Kepercayaan tokoh</h3><div class="stat-grid">${Object.keys(TOKOH).map(t => `<div><span>${esc(TOKOH[t].nama)}</span><span class="hati">${hati(s.trust[t])}</span></div>`).join('')}</div>
      <h3>Ciri Itomori (${s.ciri.length}/9)</h3><ul class="ciri-list">${Object.keys(CIRI).map(c => `<li class="${s.ciri.includes(c) ? 'ada' : 'belum'}">${s.ciri.includes(c) ? '✓ ' + esc(CIRI[c].nama) : '? ' + esc(LOKASI[CIRI[c].lokasi].nama)}</li>`).join('')}</ul>
      ${s.evak ? `<h3>Evakuasi</h3><div class="stat-grid"><div><span>Warga aman</span><b>${s.evak.aman}/${TARGET_WARGA}</b></div><div><span>Listrik</span><b>${s.evak.listrikMati ? 'padam' : 'menyala'}</b></div>
        <div><span>Siaran</span><b>${s.evak.siaran ? 'menyala' : '–'}</b></div><div><span>Perintah Ayah</span><b>${s.evak.perintah ? 'keluar' : '–'}</b></div></div>` : ''}`;
  }
  bukaModal('ponsel', `<div class="sheet"><span class="label">Ponsel</span>
    <div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${k === tabPonsel}" data-act="tabPonsel" data-tab="${k}">${n}</button>`).join('')}</div>
    ${isi}<div class="actions"><button class="btn lebar" data-act="tutup">Tutup</button></div></div>`);
}
const namaPemain = k => (app.S.players[k] || {}).name || (k === 0 ? 'Taki' : 'Mitsuha');

/* ---------- info lokasi ---------- */
export function infoLokasi(id) {
  const s = app.S, L = LOKASI[id];
  if (!L) return;
  const tk = tokohDi(id).map(t => `${esc(TOKOH[t].nama)} (${esc(TOKOH[t].ket)}) · Kepercayaan ${s ? s.trust[t] : 0}/3`);
  const w = s && s.evak && s.evak.warga[id] != null ? `<p>Warga menunggu: <b>${s.evak.warga[id]}</b></p>` : '';
  bukaModal('info', `<div class="sheet"><span class="label">${L.papan === 'tokyo' ? 'Tokyo' : 'Itomori'}</span><h2>${esc(L.nama)}</h2>
    ${tk.length ? `<ul>${tk.map(t => `<li>${t}</li>`).join('')}</ul>` : '<p class="kecil">Tidak ada tokoh di sini.</p>'}${w}
    <div class="actions"><button class="btn lebar" data-act="tutup">Tutup</button></div></div>`);
}

/* ---------- log ---------- */
export function bukaLog() {
  const s = app.S;
  bukaModal('log', `<div class="sheet"><span class="label">Catatan kejadian</span><h2>Yang sudah terjadi</h2>
    <ul>${(s ? s.log.slice().reverse() : []).map(l => `<li>${esc(l)}</li>`).join('') || '<li>Belum ada.</li>'}</ul>
    <div class="actions"><button class="btn lebar" data-act="tutup">Tutup</button></div></div>`);
}

/* ---------- aturan main singkat ---------- */
export function bukaBantuan() {
  bukaModal('bantuan', `<div class="sheet"><span class="label">Cara main</span><h2>Benang Senja</h2>
    <p>Kalian berdua <b>menang bersama</b> kalau minimal ${TARGET_WARGA} dari 18 warga Itomori selamat sebelum komet jatuh, dan <b>kalah bersama</b> kalau Ingatan salah satu dari kalian habis.</p>
    <h3>Babak 1 · Pertukaran (Hari 1–8)</h3>
    <p>Di hari tukar kamu menjalankan tubuh pasanganmu. Patuhi Aturan Hidupnya (rahasia, kirim lewat catatan maksimal 5 kata). Pemain Taki yang menyelidiki Itomori menemukan <b>Ciri</b>; Pemain Mitsuha yang menyelidiki Tokyo mendapat <b>Jejak</b>.</p>
    <h3>Babak 2 · Pencarian (Hari 9–13)</h3>
    <p>Ingatan berkurang setiap pagi. Taki mencari Itomori di peta Hida (tiket 2 Uang), lalu naik ke Kuil Gunung dan minum sake. Mitsuha memasang jejak dan menyiapkan bahan serta latihan siaran.</p>
    <h3>Senja</h3><p>60 detik bebas bicara apa saja.</p>
    <h3>Babak 3 · Evakuasi (Jam 1–${JAM_B3})</h3>
    <p>Mitsuha meyakinkan Ayah. Tessie meledakkan gardu, Sayaka menyiarkan peringatan, dan semua mengajak warga ke Sekolah.</p>
    <h3>Uji dadu</h3><p>2 dadu + bonus, berhasil kalau ≥ target (biasanya 7, meyakinkan Ayah 10).</p>
    <div class="actions"><button class="btn lebar" data-act="tutup">Mengerti</button></div></div>`);
}

/* ---------- senja ---------- */
export function renderSenja() {
  const s = app.S, me = app.me;
  const sisa = Math.max(0, 60 - Math.floor((Date.now() - s.senja.mulai) / 1000));
  const sudah = s.senja.siap[me], lain = s.senja.siap[1 - me];
  const html = `<div class="sheet gelap" style="text-align:center"><span class="label">Kataware-doki</span><h2>Senja</h2>
    <p>Di tepi kawah, untuk sesaat, kalian bisa saling melihat. <b>Bebas bicara apa saja</b>: rencana evakuasi, aturan rahasia, atau sekadar menyebut nama.</p>
    <div class="senja-timer" id="senjaTimer">${sisa}</div>
    <p class="kecil">Setelah senja, Ingatan kalian +2 dan evakuasi dimulai.${lain ? ' Pasanganmu sudah siap.' : ''}</p>
    <div class="actions"><button class="btn utama lebar" data-act="senjaSiap" ${sudah ? 'disabled' : ''}>${sudah ? 'Menunggu pasangan…' : 'Siap mengungsikan Itomori'}</button></div></div>`;
  if (modalJenis !== 'senja') bukaModal('senja', html); else $('#modal').innerHTML = html;
}
export function detikSenja() {
  const el = $('#senjaTimer');
  if (el && app.S && app.S.senja) el.textContent = Math.max(0, 60 - Math.floor((Date.now() - app.S.senja.mulai) / 1000));
}

/* ---------- akhir: tebak misi & nama ---------- */
export function renderAkhir() {
  const s = app.S, me = app.me, h = s.hasil;
  const lain = 1 - me, sudah = s.tebak[me];
  const judul = h.menang ? 'Itomori selamat' : 'Komet itu…';
  const pilihan = MISI[lain].map(m => `<label class="aturan-item"><input type="radio" name="tebakMisi" value="${m.id}"> <span>${esc(m.teks)}</span></label>`).join('');
  const html = `<div class="sheet ${h.menang ? '' : 'gelap'}"><span class="label">${h.menang ? 'Kalian menang bersama' : 'Kalian kalah bersama'}</span><h2>${judul}</h2>
    <p>${esc(h.alasan)}</p>
    ${sudah ? `<p class="kecil">Tebakanmu sudah terkirim. Menunggu pasanganmu…</p>` : `
    <h3>Tebak salah satu misi rahasia pasanganmu (+2 Poin Kenangan)</h3>${pilihan}
    <h3>Ketik nama orang yang tak ingin kamu lupakan</h3>
    <input type="text" id="inNamaAkhir" maxlength="24" placeholder="Namanya…">
    <div class="actions"><button class="btn utama lebar" data-act="kirimTebak">Kirim</button></div>`}</div>`;
  if (modalJenis !== 'akhir' || sudah) bukaModal('akhir', html);
}

export function renderSkor() {
  const s = app.S, me = app.me, h = s.hasil, pk = h.pk;
  const kolom = k => {
    const p = pk[k], misi = p.misi.map(id => esc(misiById(id).teks)).join('<br>') || 'Tidak ada misi tercapai';
    return `<div><div class="kecil">${esc(namaPemain(k))}</div><div class="total">${p.total}</div>
      <div class="rinci">Misi +${p.poinMisi}<br>Ingatan +${p.ingat}<br>Kekacauan −${p.kekacauan}<br>Tebakan +${p.tebak}</div>
      <div class="rinci" style="margin-top:6px">${misi}</div></div>`;
  };
  const menang = pk[0].total === pk[1].total ? 'Seri, ingatan kalian sama kuatnya' : `${esc(namaPemain(pk[0].total > pk[1].total ? 0 : 1))} paling mengingat 💕`;
  const nama = [0, 1].map(k => s.tebak[k] && s.tebak[k].nama ? `<div class="nama-besar">"${esc(s.tebak[k].nama)}"</div><p class="kecil" style="text-align:center">ditulis ${esc(namaPemain(k))}</p>` : '').join('');
  bukaModal('skor', `<div class="sheet"><span class="label">${h.menang ? 'Itomori selamat · ' + h.aman + ' warga' : 'Itomori tidak selamat'}</span><h2>Poin Kenangan</h2>
    <p><b>${menang}</b></p><div class="skor">${kolom(0)}${kolom(1)}</div>${nama}
    <div class="actions"><button class="btn ghost" data-act="keluar">Menu utama</button><button class="btn utama lebar" data-act="mainLagi">Main lagi</button></div></div>`);
}
