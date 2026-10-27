// Bentuk state permainan dan pembantu kecil yang dipakai mesin aturan.
// Satu state = satu dokumen room di server. Indeks pemain: 0 = Pemain Taki, 1 = Pemain Mitsuha.
import { ATURAN, MISI, KEJADIAN, KRISIS } from '../data/kartu.js';
import { DESA } from '../data/peta.js';

export const AKSI_DASAR = 3;
export const AKSI_TAKI_B3 = 3;
export const HARI_B1 = 8;
export const HARI_B2 = 13;
export const JAM_B3 = 6;
export const TARGET_WARGA = 14;
export const INGATAN_MAX = 10;

export const clone = o => JSON.parse(JSON.stringify(o));
export const acak = n => Math.floor(Math.random() * n);
export function kocok(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = acak(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const dadu = () => 1 + acak(6);

export function buatRoom(pemain) {
  return { v:1, seq:1, phase:'lobby', players:[pemain[0] || null, pemain[1] || null], fx:[], log:[] };
}

export function buatGame(room) {
  const s = {
    v:1, seq:(room.seq || 0) + 1, phase:'main',
    players:room.players,
    babak:1, hari:0, jam:0,
    giliran:0, aksi:0, langkah:'aksi',
    tukar:false,
    kalender:[true].concat(kocok([true, true, true, true, false, false, false])),
    dekKejadian:kocok(KEJADIAN.map(k => k.id)),
    dekKrisis:kocok(KRISIS.map(k => k.id)),
    kejadian:null, krisis:null,
    modAksi:[0, 0],
    pos:{ taki:'t_apt', mitsuha:'i_rumah', tessie:'i_bangku', sayaka:'i_sekolah' },
    ingatan:[8, 8], kekacauan:[0, 0], uang:3,
    trust:{ tsukasa:0, okudera:0, nenek:0, yotsuha:0, tessie:0, sayaka:0, ayah:0 },
    aturan:{ taki:kocok(ATURAN.taki.map(a => a.id)).slice(0, 3), mitsuha:kocok(ATURAN.mitsuha.map(a => a.id)).slice(0, 3) },
    terbuka:{ taki:[], mitsuha:[] },
    misi:[kocok(MISI[0].map(m => m.id)).slice(0, 2), kocok(MISI[1].map(m => m.id)).slice(0, 2)],
    stat:{ okuderaTukar:0, kafeTukar:0, jejakDipasang:0 },
    ciri:[], jejak:0, selidik:[],
    desa:{ urut:kocok(DESA.map((d, i) => i)), coret:[], ketemu:false },
    sake:false, bahan:false, latihan:false,
    evak:null, mod:{ tutup:null, ajak:0, uji:0 },
    catatan:[],
    turn:null,
    akhirB1:null, senja:null, hasil:null, tebak:[null, null],
    fx:[], log:[],
  };
  return s;
}

export function tambahLog(s, teks) {
  s.log.push(teks);
  if (s.log.length > 40) s.log.splice(0, s.log.length - 40);
}

// tubuh (pion) yang dijalankan pemain `who` pada giliran ini
export function pionMilik(s, who) {
  if (s.babak === 3) return who === 1 ? ['mitsuha'] : ['tessie', 'sayaka'];
  const tukar = s.babak === 1 && s.tukar;
  if (who === 0) return [tukar ? 'mitsuha' : 'taki'];
  return [tukar ? 'taki' : 'mitsuha'];
}
// pemain sedang berada di tubuh pasangannya?
export const sedangTukar = (s, who) => s.babak === 1 && s.tukar;
export const tubuhPasangan = who => (who === 0 ? 'mitsuha' : 'taki');
export const tubuhSendiri = who => (who === 0 ? 'taki' : 'mitsuha');
export const namaPeran = who => (who === 0 ? 'Taki' : 'Mitsuha');
