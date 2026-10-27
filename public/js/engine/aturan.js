// Mesin aturan: state lama + aksi → state baru (dengan daftar efek `fx` untuk animasi).
// Semua fungsi di sini murni terhadap state yang diberikan (state disalin dulu), tanpa DOM.
import { LOKASI, JALUR, TOKOH, CIRI, DESA, ITOMORI, tetangga, tokohDi, ciriDi, kunciJalur } from '../data/peta.js';
import { ATURAN, KEJADIAN, KRISIS, MISI, aturanById, misiById } from '../data/kartu.js';
import {
  AKSI_DASAR, AKSI_TAKI_B3, HARI_B1, HARI_B2, JAM_B3, TARGET_WARGA, INGATAN_MAX,
  clone, kocok, dadu, acak, buatGame, tambahLog, pionMilik, sedangTukar, tubuhPasangan, namaPeran,
} from './state.js';

const NAMA_PION = { taki:'Taki', mitsuha:'Mitsuha', tessie:'Tessie', sayaka:'Sayaka' };
const WARGA_AWAL = { i_rumah:3, i_kuil:3, i_danau:3, i_bangku:2, i_balai:3, i_gardu:2, i_siaran:2 };
const TOTAL_WARGA = 18;
const TARGET_UJI = 7, TARGET_AYAH = 11;
const WARGA_AJAK = 1;        // warga yang ikut mengungsi per ajakan berhasil
const WARGA_SIARAN = 1;      // warga yang mengungsi sendiri per Jam selama siaran menyala
const WARGA_PERINTAH = 2;    // warga yang mengungsi sendiri per Jam setelah perintah wali kota

/* ---------- pembantu ---------- */
function ubahIngatan(s, who, n) {
  s.ingatan[who] = Math.max(0, Math.min(INGATAN_MAX, s.ingatan[who] + n));
}
function ubahTrust(s, tokoh, n) {
  s.trust[tokoh] = Math.max(0, Math.min(3, s.trust[tokoh] + n));
}
function cekKalah(s) {
  if (s.phase !== 'main' && s.phase !== 'senja') return;
  const k = [0, 1].find(i => s.ingatan[i] <= 0);
  if (k == null) return;
  akhiri(s, false, `Ingatan ${namaPeran(k)} habis. Nama itu hilang dari kepala kalian…`);
}
function akhiri(s, menang, alasan) {
  s.phase = 'akhir';
  s.hasil = { menang, alasan, aman:s.evak ? s.evak.aman : 0 };
  s.fx.push({ t:'akhir', menang });
  tambahLog(s, menang ? 'Itomori selamat!' : 'Permainan berakhir.');
}
function uji(s, bonus, target, judul) {
  const a = dadu(), b = dadu(), total = a + b + bonus, ok = total >= target;
  s.fx.push({ t:'dadu', a, b, bonus, target, ok, judul });
  return ok;
}
// slot desa di Hida yang masih mungkin Itomori
export function statusDesa(s, slot) {
  const d = DESA[s.desa.urut[slot]];
  if (s.desa.ketemu && s.desa.urut[slot] === ITOMORI) return 'itomori';
  if (s.desa.coret.includes(slot)) return 'coret';
  if (d.tanpa.some(c => s.ciri.includes(c))) return 'coret';
  return 'kandidat';
}
function coretAcak(s) {
  const pilih = [];
  for (let i = 0; i < DESA.length; i++) if (s.desa.urut[i] !== ITOMORI && statusDesa(s, i) === 'kandidat') pilih.push(i);
  if (!pilih.length) return null;
  const slot = pilih[acak(pilih.length)];
  s.desa.coret.push(slot);
  return slot;
}

/* ---------- Aturan Hidup ---------- */
// melanggar tidak membuka aturannya: pelanggar hanya tahu "ada yang salah", pemilik tubuh tahu aturan mana
function langgar(s, who, tubuh, id) {
  s.kekacauan[who]++;
  if (!s.dilanggar[tubuh].includes(id)) s.dilanggar[tubuh].push(id);
  s.fx.push({ t:'langgar', who, id });
  tambahLog(s, `${namaPeran(who)} melanggar salah satu aturan hidup ${NAMA_PION[tubuh]}. Kekacauan +1.`);
}
// cek aturan untuk kejadian tertentu (masuk / aksi / ngobrol) saat bertukar
function cekAturan(s, who, pion, jenis, nilai) {
  if (!sedangTukar(s, who) || pion !== tubuhPasangan(who)) return;
  for (const id of s.aturan[pion]) {
    const at = aturanById(id);
    if (at.jenis !== jenis) continue;
    if ((jenis === 'masuk' && at.lokasi === nilai) || (jenis === 'aksi' && at.aksi === nilai) || (jenis === 'ngobrol' && at.tokoh === nilai)) langgar(s, who, pion, id);
  }
}
function cekAturanAkhir(s, who) {
  const pion = pionMilik(s, who)[0];
  if (!sedangTukar(s, who) || pion !== tubuhPasangan(who)) return;
  for (const id of s.aturan[pion]) {
    const at = aturanById(id);
    if (at.jenis === 'mampir' && !s.turn.dikunjungi.includes(at.lokasi)) langgar(s, who, pion, id);
    if (at.jenis === 'pulang' && s.pos[pion] !== at.lokasi) langgar(s, who, pion, id);
  }
}

/* ---------- alur hari / jam ---------- */
function mulaiGiliran(s, who) {
  s.giliran = who; s.langkah = 'aksi';
  let n;
  if (s.babak === 3) n = who === 1 ? AKSI_DASAR + s.mod.aksiM : AKSI_TAKI_B3;
  else n = AKSI_DASAR + s.modAksi[who] + (s.babak === 2 && who === 0 && s.trust.tsukasa >= 2 ? 1 : 0);
  s.aksi = Math.max(1, n);
  s.turn = { dikunjungi:pionMilik(s, who).map(p => s.pos[p]), kumihimo:false };
  s.fx.push({ t:'giliran', who });
}

function tarikKejadian(s) {
  if (!s.dekKejadian.length) s.dekKejadian = kocok(KEJADIAN.map(k => k.id));
  const id = s.dekKejadian.shift(), k = KEJADIAN.find(x => x.id === id), e = k.efek || {};
  s.kejadian = id; s.modAksi = [0, 0];
  if (e.ingatan) [0, 1].forEach(i => ubahIngatan(s, i, e.ingatan[i]));
  if (e.trust) for (const t in e.trust) ubahTrust(s, t, e.trust[t]);
  if (e.uang) s.uang = Math.max(0, s.uang + e.uang);
  if (e.aksi) s.modAksi = e.aksi.slice();
  s.fx.push({ t:'kartu', jenis:'kejadian', id });
  tambahLog(s, `Kejadian: ${k.judul}`);
}

function mulaiHari(s) {
  s.hari++;
  if (s.hari === HARI_B1 + 1) mulaiBabak2(s);
  if (s.babak === 1) {
    s.tukar = s.kalender[s.hari - 1];
    s.fx.push({ t:'pagi', hari:s.hari, tukar:s.tukar });
    tambahLog(s, `Hari ${s.hari}: ${s.tukar ? 'kalian bertukar tubuh!' : 'hari biasa.'}`);
  } else {
    s.tukar = false;
    const turun = s.hari > HARI_B2 ? 2 : 1;
    ubahIngatan(s, 0, -turun); ubahIngatan(s, 1, -turun);
    s.fx.push({ t:'pagi', hari:s.hari, tukar:false, lupa:turun });
    tambahLog(s, `Hari ${s.hari}: ingatan memudar (−${turun}).`);
  }
  tarikKejadian(s);
  cekKalah(s);
  if (s.phase === 'main') mulaiGiliran(s, 0);
}

function mulaiBabak2(s) {
  s.babak = 2;
  s.akhirB1 = { trust:clone(s.trust), uang:s.uang };
  s.catatan = [];
  s.fx.push({ t:'babak', n:2 });
  tambahLog(s, 'Babak 2: pertukaran berhenti. Semua catatan menghilang.');
}

function mulaiSenja(s) {
  s.phase = 'senja';
  s.senja = { mulai:Date.now(), siap:[false, false] };
  s.fx.push({ t:'senja' });
  tambahLog(s, 'Senja tiba. Kalian akhirnya bertemu.');
}

function mulaiBabak3(s) {
  s.phase = 'main'; s.babak = 3; s.jam = 0;
  ubahIngatan(s, 0, 2); ubahIngatan(s, 1, 2);
  s.pos.mitsuha = 'i_kuil';
  s.evak = { warga:clone(WARGA_AWAL), aman:0, listrikMati:false, siaran:false, perintah:false };
  s.fx.push({ t:'babak', n:3 });
  tambahLog(s, 'Babak 3: evakuasi Itomori sebelum komet jatuh!');
  mulaiJam(s);
}

function mulaiJam(s) {
  s.jam++;
  if (!s.dekKrisis.length) s.dekKrisis = kocok(KRISIS.map(k => k.id));
  const id = s.dekKrisis.shift(), k = KRISIS.find(x => x.id === id), e = k.efek || {};
  s.krisis = id;
  s.mod = { tutup:null, ajak:e.ajak || 0, uji:e.uji || 0, aksiM:e.aksiM || 0 };
  if (e.tutup) {
    const jalur = JALUR.filter(j => LOKASI[j[0]].papan === 'itomori' && j[0] !== 'i_gunung' && j[1] !== 'i_gunung');
    const j = jalur[acak(jalur.length)];
    s.mod.tutup = kunciJalur(j[0], j[1]);
  }
  if (e.putus && s.evak.siaran) s.evak.siaran = false;
  if (e.polisi) s.pos.tessie = 'i_balai';
  if (e.sukarela) pindahWarga(s, lokasiTerpadat(s), e.sukarela);
  s.fx.push({ t:'kartu', jenis:'krisis', id });
  tambahLog(s, `Jam ${s.jam}: ${k.judul}`);
  if (s.evak.aman >= TOTAL_WARGA) return akhiri(s, true, 'Seluruh warga Itomori selamat!');
  mulaiGiliran(s, 1);
}

const lokasiTerpadat = s => Object.keys(s.evak.warga).sort((a, b) => s.evak.warga[b] - s.evak.warga[a])[0];
function pindahWarga(s, loc, n) {
  const ada = s.evak.warga[loc] || 0, m = Math.min(ada, n);
  if (!m) return 0;
  s.evak.warga[loc] = ada - m;
  s.evak.aman += m;
  s.fx.push({ t:'warga', dari:loc, n:m });
  return m;
}

function akhirJam(s) {
  // warga yang mengungsi sendiri dari lokasi terpadat: setelah perintah wali kota, atau selama siaran menyala
  const sendiri = (s.evak.perintah ? WARGA_PERINTAH : 0) + (s.evak.siaran ? WARGA_SIARAN : 0);
  for (let i = 0; i < sendiri; i++) pindahWarga(s, lokasiTerpadat(s), 1);
  if (s.evak.aman >= TOTAL_WARGA) return akhiri(s, true, 'Seluruh warga Itomori selamat!');
  if (s.jam >= JAM_B3) {
    s.fx.push({ t:'komet' });
    const ok = s.evak.aman >= TARGET_WARGA;
    return akhiri(s, ok, ok ? `Komet jatuh, tapi ${s.evak.aman} warga sudah aman di Sekolah.` : `Komet jatuh. Hanya ${s.evak.aman} warga yang sempat diselamatkan.`);
  }
  mulaiJam(s);
}

// giliran pemain `who` selesai (setelah catatan)
function lanjutGiliran(s) {
  const who = s.giliran;
  if (s.babak === 3) {
    if (who === 1) mulaiGiliran(s, 0); else akhirJam(s);
    return;
  }
  if (s.babak === 2 && s.sake) return mulaiSenja(s);
  if (who === 0) mulaiGiliran(s, 1); else mulaiHari(s);
}

function keCatatan(s) {
  cekAturanAkhir(s, s.giliran);
  s.langkah = 'catatan'; s.aksi = 0;
}

/* ---------- daftar aksi yang bisa dipilih ---------- */
export function daftarAksi(s, who) {
  if (s.phase !== 'main' || s.giliran !== who || s.langkah !== 'aksi') return [];
  const out = [], add = (a, label, biaya = 1, ket = '') => { if (biaya <= s.aksi) out.push({ a, label, biaya, ket }); };
  const tukar = sedangTukar(s, who);
  for (const pion of pionMilik(s, who)) {
    const loc = s.pos[pion], L = LOKASI[loc];
    const nm = s.babak === 3 && who === 0 ? `${NAMA_PION[pion]}: ` : '';
    // jalan
    if (L) for (const t of tetangga(loc)) {
      if (s.babak === 3 && s.mod.tutup === kunciJalur(loc, t.ke)) continue;
      if (s.babak === 3 && t.ke === 'i_gunung') continue;
      add({ t:'jalan', pion, ke:t.ke }, `${nm}Jalan ke ${LOKASI[t.ke].nama}`, t.biaya);
    }
    if (s.babak < 3) {
      for (const tk of tokohDi(loc)) add({ t:'ngobrol', pion, tokoh:tk }, `Ngobrol dengan ${TOKOH[tk].nama}`, 1, `Uji 2 dadu + ${s.trust[tk]} ≥ ${TARGET_UJI}`);
      if (pion === 'taki' && loc === 't_resto') add({ t:'kerja' }, 'Kerja paruh waktu', 1, 'Uang +1');
      if (pion === 'taki' && loc === 't_kafe' && s.uang >= 1) add({ t:'belanja' }, 'Makan kue', 1, 'Uang −1, Ingatan +1');
      if ((loc === 'i_kuil' || loc === 't_tangga') && !s.turn.kumihimo) add({ t:'kumihimo' }, loc === 'i_kuil' ? 'Merangkai kumihimo' : 'Merenung di tangga', 1, 'Ingatan +1');
      if (tukar && who === 0 && L.papan === 'itomori' && ciriDi(loc) && !s.ciri.includes(ciriDi(loc))) add({ t:'selidiki' }, 'Selidiki tempat ini', 1, 'Dapat 1 ciri Itomori');
      if (tukar && who === 1 && L.papan === 'tokyo' && !s.selidik.includes(loc)) add({ t:'selidiki' }, 'Selidiki tempat ini', 1, 'Dapat 1 Jejak');
      if (tukar && pion === tubuhPasangan(who) && !s.digeledah[pion].includes(loc)) add({ t:'geledah' }, 'Cari petunjuk aturan hidup', 1, 'Mungkin ada catatan rahasia di sini');
    }
    if (s.babak === 2 && who === 0) {
      if (loc === 't_stasiun') add({ t:'berangkat' }, s.uang >= 2 ? 'Berangkat ke Hida' : 'Berangkat ke Hida (Uang kurang)', 1, 'Tiket 2 Uang');
      if (loc === 'hida') {
        for (let i = 0; i < DESA.length; i++) if (statusDesa(s, i) === 'kandidat' && !s.desa.ketemu) add({ t:'tanya', slot:i }, `Tanya warga di Desa ${i + 1}`, 1);
        if (s.desa.ketemu) add({ t:'naik' }, 'Naik ke Kuil Gunung', 3);
      }
      if (loc === 'h_gunung' && !s.sake) add({ t:'sake' }, 'Minum sake persembahan', 1, 'Ingatan −2, Babak 3 dimulai');
    }
    if (s.babak === 2 && who === 1) {
      if (s.jejak > 0) add({ t:'jejak' }, 'Pasang jejak untuk Taki', 1, `Sisa ${s.jejak} jejak`);
      if (loc === 'i_bangku' && !s.bahan && s.trust.tessie >= 2) add({ t:'bahan' }, 'Siapkan bahan bersama Tessie', 1);
      if (loc === 'i_siaran' && !s.latihan && s.trust.sayaka >= 2) add({ t:'latihan' }, 'Latihan siaran bersama Sayaka', 1);
    }
    if (s.babak === 3) {
      const E = s.evak, bonus = bonusAjak(s);
      if (E.warga[loc] > 0) add({ t:'ajak', pion }, `${nm}Ajak warga mengungsi`, 1, `Uji 2 dadu ${fmtBonus(bonus)} ≥ ${TARGET_UJI}`);
      if (pion === 'tessie' && loc === 'i_gardu' && !E.listrikMati) add({ t:'ledak' }, 'Tessie: Ledakkan gardu', s.bahan ? 1 : 3, s.bahan ? 'Bahan sudah siap' : 'Tanpa bahan: 3 aksi');
      if (pion === 'sayaka' && loc === 'i_siaran' && E.listrikMati && !E.siaran) add({ t:'siar' }, 'Sayaka: Siarkan peringatan', 1, `Uji 2 dadu ${fmtBonus((s.latihan ? 2 : 0) + s.mod.uji)} ≥ ${TARGET_UJI}`);
      if (pion === 'mitsuha' && loc === 'i_balai' && !E.perintah) add({ t:'yakinkan' }, 'Yakinkan Ayah', 2, `Uji 2 dadu ${fmtBonus(bonusAyah(s))} ≥ ${TARGET_AYAH} · gagal: Kepercayaan Ayah −1`);
    }
  }
  return out;
}
const fmtBonus = n => (n ? (n > 0 ? `+ ${n}` : `− ${-n}`) : '');
const bonusAjak = s => (s.evak.listrikMati ? 1 : 0) + (s.evak.siaran ? 1 : 0) + (s.evak.perintah ? 1 : 0) + s.mod.ajak + s.mod.uji;
const bonusAyah = s => s.trust.ayah + (s.evak.siaran ? 1 : 0) + (s.ciri.length >= 6 ? 1 : 0) + s.mod.uji;

/* ---------- menjalankan aksi ---------- */
// mengembalikan state baru, atau { error } kalau aksi tidak sah
export function jalankan(s0, who, a) {
  const s = clone(s0);
  s.fx = [];
  s.seq = s0.seq + 1;
  const err = msg => ({ error:msg });

  switch (a.t) {
    case 'mulai': {
      if (s.phase !== 'lobby' || !s.players[0] || !s.players[1]) return err('Pemain belum lengkap.');
      const g = buatGame(s);
      g.seq = s.seq;
      mulaiHari(g);
      return g;
    }
    case 'catatan': {
      if (s.phase !== 'main' || s.giliran !== who || s.langkah !== 'catatan') return err('Belum waktunya menulis catatan.');
      const teks = String(a.teks || '').trim().split(/\s+/).filter(Boolean).slice(0, 5).join(' ').slice(0, 60);
      if (teks) {
        s.catatan.push({ dari:who, teks, babak:s.babak, hari:s.babak === 3 ? s.jam : s.hari });
        if (s.catatan.length > 30) s.catatan.shift();
        s.fx.push({ t:'catatan', dari:who });
      }
      lanjutGiliran(s);
      return s;
    }
    case 'senjaSiap': {
      if (s.phase !== 'senja') return err('Bukan saat senja.');
      s.senja.siap[who] = true;
      if (s.senja.siap[0] && s.senja.siap[1]) mulaiBabak3(s);
      return s;
    }
    case 'tebak': {
      if (s.phase !== 'akhir' || s.tebak[who]) return err('Tebakan sudah dikirim.');
      s.tebak[who] = { misi:String(a.misi || ''), nama:String(a.nama || '').slice(0, 24) };
      if (s.tebak[0] && s.tebak[1]) { s.phase = 'selesai'; s.hasil.pk = hitungPoin(s); }
      return s;
    }
    case 'selesai': {
      if (s.phase !== 'main' || s.giliran !== who || s.langkah !== 'aksi') return err('Bukan giliranmu.');
      keCatatan(s);
      cekKalah(s);
      return s;
    }
  }

  // aksi biasa di papan
  const pilihan = daftarAksi(s0, who).find(o => sama(o.a, a));
  if (!pilihan) return err('Aksi itu tidak bisa dilakukan sekarang.');
  s.aksi -= pilihan.biaya;
  const tukar = sedangTukar(s, who);

  switch (a.t) {
    case 'jalan': {
      const dari = s.pos[a.pion];
      s.pos[a.pion] = a.ke;
      s.turn.dikunjungi.push(a.ke);
      s.fx.push({ t:'jalan', pion:a.pion, dari, ke:a.ke });
      cekAturan(s, who, a.pion, 'masuk', a.ke);
      break;
    }
    case 'ngobrol': {
      const ok = uji(s, s.trust[a.tokoh], TARGET_UJI, `Ngobrol dengan ${TOKOH[a.tokoh].nama}`);
      if (ok) {
        ubahTrust(s, a.tokoh, 1);
        if (tukar && a.tokoh === 'okudera') s.stat.okuderaTukar++;
      }
      tambahLog(s, `${namaPeran(who)} ngobrol dengan ${TOKOH[a.tokoh].nama}: ${ok ? 'makin akrab' : 'canggung'}.`);
      cekAturan(s, who, a.pion, 'ngobrol', a.tokoh);
      break;
    }
    case 'kerja':
      s.uang++;
      s.fx.push({ t:'uang', n:1 });
      tambahLog(s, `${namaPeran(who)} kerja di restoran. Uang +1.`);
      break;
    case 'belanja':
      s.uang--; ubahIngatan(s, who, 1);
      if (tukar) s.stat.kafeTukar++;
      s.fx.push({ t:'uang', n:-1 });
      tambahLog(s, `${namaPeran(who)} makan kue di kafe. Uang −1, Ingatan +1.`);
      cekAturan(s, who, 'taki', 'aksi', 'belanja');
      break;
    case 'kumihimo':
      s.turn.kumihimo = true; ubahIngatan(s, who, 1);
      s.fx.push({ t:'ingatan', who, n:1 });
      tambahLog(s, `${namaPeran(who)} ${s.pos[pionMilik(s, who)[0]] === 'i_kuil' ? 'merangkai kumihimo' : 'merenung'}. Ingatan +1.`);
      break;
    case 'selidiki': {
      const loc = s.pos[pionMilik(s, who)[0]];
      if (who === 0) {
        const c = ciriDi(loc);
        s.ciri.push(c);
        s.fx.push({ t:'ciri', id:c });
        tambahLog(s, `Ciri Itomori ditemukan: ${CIRI[c].nama}.`);
      } else {
        s.selidik.push(loc); s.jejak++;
        s.fx.push({ t:'jejak', n:1 });
        tambahLog(s, `Mitsuha meninggalkan kenangan di ${LOKASI[loc].nama}. Jejak +1.`);
      }
      break;
    }
    case 'geledah': {
      const pion = pionMilik(s, who)[0], loc = s.pos[pion], id = s.petunjuk[pion][loc] || null;
      s.digeledah[pion].push(loc);
      if (id && !s.terbuka[pion].includes(id)) s.terbuka[pion].push(id);
      s.fx.push({ t:'petunjuk', who, loc, id });
      tambahLog(s, `${namaPeran(who)} menggeledah ${LOKASI[loc].nama}: ${id ? 'menemukan petunjuk!' : 'tidak ada apa-apa.'}`);
      break;
    }
    case 'berangkat':
      if (s.uang < 2) { s.aksi += pilihan.biaya; return err('Uang belum cukup untuk tiket (butuh 2). Kerja dulu di restoran.'); }
      s.uang -= 2;
      s.fx.push({ t:'jalan', pion:'taki', dari:'t_stasiun', ke:'hida' });
      s.pos.taki = 'hida';
      tambahLog(s, 'Taki naik kereta ke Hida dengan sketsa di tangan.');
      break;
    case 'tanya': {
      const id = s.desa.urut[a.slot];
      if (id === ITOMORI) {
        s.desa.ketemu = true;
        s.fx.push({ t:'temu', slot:a.slot });
        tambahLog(s, 'Desa itu Itomori… yang hancur oleh komet tiga tahun lalu.');
      } else {
        s.desa.coret.push(a.slot);
        s.fx.push({ t:'coret', slot:a.slot });
        let pesan = `Desa ${a.slot + 1} adalah ${DESA[id].nama}, bukan desa di sketsa.`;
        if (s.trust.okudera >= 2) { const lain = coretAcak(s); if (lain != null) { s.fx.push({ t:'coret', slot:lain }); pesan += ` Kak Okudera ikut mencoret Desa ${lain + 1}.`; } }
        tambahLog(s, pesan);
      }
      break;
    }
    case 'naik':
      s.fx.push({ t:'jalan', pion:'taki', dari:'hida', ke:'h_gunung' });
      s.pos.taki = 'h_gunung';
      tambahLog(s, 'Taki mendaki ke kuil di dalam kawah.');
      break;
    case 'sake':
      s.sake = true; ubahIngatan(s, 0, -2);
      s.fx.push({ t:'sake' });
      tambahLog(s, 'Taki meminum sake persembahan Mitsuha…');
      cekKalah(s);
      if (s.phase === 'main') keCatatan(s);
      return s;
    case 'jejak': {
      s.jejak--; s.stat.jejakDipasang++;
      const slot = coretAcak(s);
      if (slot != null) s.fx.push({ t:'coret', slot });
      tambahLog(s, slot != null ? `Jejak Mitsuha mencoret Desa ${slot + 1} dari peta Taki.` : 'Jejak dipasang, tapi peta Taki sudah bersih.');
      break;
    }
    case 'bahan':
      s.bahan = true;
      tambahLog(s, 'Tessie menyiapkan bahan peledak dari gudang bangunan keluarganya.');
      break;
    case 'latihan':
      s.latihan = true;
      tambahLog(s, 'Sayaka berlatih membajak siaran darurat desa.');
      break;
    case 'ajak': {
      const loc = s.pos[a.pion], E = s.evak;
      const ok = uji(s, bonusAjak(s), TARGET_UJI, 'Ajak warga');
      const n = ok ? pindahWarga(s, loc, WARGA_AJAK) : 0;
      tambahLog(s, ok ? `${NAMA_PION[a.pion]} membujuk ${n} warga ke Sekolah.` : `Warga di ${LOKASI[loc].nama} belum percaya.`);
      if (E.aman >= TOTAL_WARGA) { akhiri(s, true, 'Seluruh warga Itomori selamat!'); return s; }
      break;
    }
    case 'ledak':
      s.evak.listrikMati = true;
      s.fx.push({ t:'ledak' });
      tambahLog(s, 'BOOM! Gardu meledak, listrik seluruh desa padam.');
      break;
    case 'siar': {
      const ok = uji(s, (s.latihan ? 2 : 0) + s.mod.uji, TARGET_UJI, 'Siarkan peringatan');
      if (ok) { s.evak.siaran = true; s.fx.push({ t:'siaran' }); }
      tambahLog(s, ok ? 'Peringatan evakuasi menggema dari pengeras suara.' : 'Siaran gagal, suara terputus-putus.');
      break;
    }
    case 'yakinkan': {
      const ok = uji(s, bonusAyah(s), TARGET_AYAH, 'Yakinkan Ayah');
      if (ok) { s.evak.perintah = true; s.fx.push({ t:'perintah' }); }
      else ubahTrust(s, 'ayah', -1);
      tambahLog(s, ok ? 'Ayah memandang Mitsuha lama… lalu memerintahkan evakuasi!' : 'Ayah marah dan menolak mendengarkan. Kepercayaan Ayah −1.');
      break;
    }
  }

  if (s.phase === 'main' && s.langkah === 'aksi' && s.aksi <= 0) keCatatan(s);
  cekKalah(s);
  return s;
}

function sama(x, y) {
  const kx = Object.keys(x);
  return kx.length === Object.keys(y).length && kx.every(k => x[k] === y[k]);
}

export function hitungPoin(s) {
  return [0, 1].map(k => {
    const misi = s.misi[k].map(id => misiById(id)).filter(m => m.cek(s));
    const lain = 1 - k, tebakBenar = !!(s.tebak[k] && s.misi[lain].includes(s.tebak[k].misi));
    const ingat = Math.floor(s.ingatan[k] / 2);
    return {
      misi:misi.map(m => m.id), poinMisi:misi.reduce((t, m) => t + m.poin, 0),
      ingat, kekacauan:s.kekacauan[k], tebak:tebakBenar ? 2 : 0,
      total:misi.reduce((t, m) => t + m.poin, 0) + ingat - s.kekacauan[k] + (tebakBenar ? 2 : 0),
    };
  });
}

// ringkasan untuk HUD: progres komet 0..1
export function progresKomet(s) {
  if (!s || s.phase === 'lobby') return 0;
  if (s.babak < 3) return Math.min(0.72, (s.hari / (HARI_B2 + 1)) * 0.72);
  return 0.72 + Math.min(1, s.jam / JAM_B3) * 0.28;
}
