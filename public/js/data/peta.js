// Peta dua kota, tokoh, ciri Itomori, dan desa-desa di Hida.
// Koordinat lokasi relatif terhadap pusat papan masing-masing (x ke kanan, z ke depan).

export const PAPAN = {
  tokyo:   { nama:'Tokyo',   pusat:[-7.5, 0] },
  itomori: { nama:'Itomori', pusat:[ 7.5, 0] },
  hida:    { nama:'Hida',    pusat:[ 0, 9.5] },
};

export const LOKASI = {
  // Tokyo
  t_apt:     { nama:'Apartemen Taki', papan:'tokyo', xz:[-3.4,-3.0], bentuk:'apartemen' },
  t_stasiun: { nama:'Stasiun',        papan:'tokyo', xz:[ 0.2,-2.2], bentuk:'stasiun' },
  t_sekolah: { nama:'Sekolah Taki',   papan:'tokyo', xz:[ 3.4,-3.4], bentuk:'sekolah' },
  t_perpus:  { nama:'Perpustakaan',   papan:'tokyo', xz:[ 3.6, 0.0], bentuk:'perpus' },
  t_obs:     { nama:'Menara Pandang', papan:'tokyo', xz:[ 3.0, 3.4], bentuk:'menara' },
  t_resto:   { nama:'Restoran',       papan:'tokyo', xz:[ 0.6, 1.0], bentuk:'resto' },
  t_kafe:    { nama:'Kafe Kue',       papan:'tokyo', xz:[-1.2, 3.6], bentuk:'kafe' },
  t_tangga:  { nama:'Tangga Kuil',    papan:'tokyo', xz:[-3.6, 0.6], bentuk:'tangga' },
  // Itomori
  i_gunung:  { nama:'Kuil Gunung',    papan:'itomori', xz:[-3.4,-4.0], bentuk:'gunung' },
  i_kuil:    { nama:'Kuil Miyamizu',  papan:'itomori', xz:[-3.6,-1.0], bentuk:'kuil' },
  i_rumah:   { nama:'Rumah Miyamizu', papan:'itomori', xz:[-3.8, 2.0], bentuk:'rumah' },
  i_bangku:  { nama:'Bangku & Mesin Minuman', papan:'itomori', xz:[-1.0, 3.8], bentuk:'bangku' },
  i_danau:   { nama:'Tepi Danau',     papan:'itomori', xz:[ 0.8, 2.2], bentuk:'dermaga' },
  i_gardu:   { nama:'Gardu Listrik',  papan:'itomori', xz:[ 3.0, 3.9], bentuk:'gardu' },
  i_balai:   { nama:'Balai Kota',     papan:'itomori', xz:[ 3.9, 0.9], bentuk:'balai' },
  i_siaran:  { nama:'Ruang Siaran',   papan:'itomori', xz:[ 3.9,-2.3], bentuk:'siaran' },
  i_sekolah: { nama:'Sekolah Itomori', papan:'itomori', xz:[ 1.4,-3.8], bentuk:'sekolah' },
};

// [a, b, biaya aksi]
export const JALUR = [
  ['t_apt','t_stasiun',1], ['t_apt','t_tangga',1], ['t_stasiun','t_sekolah',1], ['t_stasiun','t_resto',1],
  ['t_sekolah','t_perpus',1], ['t_perpus','t_obs',1], ['t_resto','t_obs',1], ['t_resto','t_kafe',1], ['t_tangga','t_kafe',1],
  ['i_gunung','i_kuil',2], ['i_kuil','i_rumah',1], ['i_kuil','i_sekolah',1], ['i_rumah','i_bangku',1], ['i_bangku','i_danau',1],
  ['i_danau','i_gardu',1], ['i_danau','i_balai',1], ['i_gardu','i_balai',1], ['i_balai','i_siaran',1], ['i_siaran','i_sekolah',1],
];

export const DANAU = { pusat:[0.5,-0.6], r:2.0 };   // danau kawah di tengah Itomori

export function tetangga(loc) {
  const out = [];
  for (const [a, b, c] of JALUR) {
    if (a === loc) out.push({ ke:b, biaya:c });
    else if (b === loc) out.push({ ke:a, biaya:c });
  }
  return out;
}
export const kunciJalur = (a, b) => [a, b].sort().join('|');

export const TOKOH = {
  tsukasa: { nama:'Tsukasa',  lokasi:'t_sekolah', ket:'Sahabat Taki' },
  okudera: { nama:'Kak Okudera', lokasi:'t_resto', ket:'Senior di restoran' },
  nenek:   { nama:'Nenek',    lokasi:'i_kuil',    ket:'Penjaga kuil' },
  yotsuha: { nama:'Yotsuha',  lokasi:'i_rumah',   ket:'Adik Mitsuha' },
  tessie:  { nama:'Tessie',   lokasi:'i_bangku',  ket:'Sahabat, tukang listrik' },
  sayaka:  { nama:'Sayaka',   lokasi:'i_sekolah', ket:'Sahabat, klub siaran' },
  ayah:    { nama:'Ayah',     lokasi:'i_balai',   ket:'Wali kota Itomori' },
};
export const tokohDi = loc => Object.keys(TOKOH).filter(k => TOKOH[k].lokasi === loc);

// Ciri Itomori: ditemukan Pemain Taki lewat aksi Selidiki di lokasi-lokasi Itomori
export const CIRI = {
  danau:    { nama:'Danau bulat bekas kawah', lokasi:'i_danau' },
  kuil:     { nama:'Kuil tua di lereng bukit', lokasi:'i_kuil' },
  sekolah:  { nama:'Sekolah menghadap danau', lokasi:'i_sekolah' },
  gardu:    { nama:'Gardu listrik dekat danau', lokasi:'i_gardu' },
  kumihimo: { nama:'Kerajinan tali kumihimo', lokasi:'i_rumah' },
  kereta:   { nama:'Rel kereta lokal satu jalur', lokasi:'i_bangku' },
  festival: { nama:'Festival musim gugur', lokasi:'i_balai' },
  shintai:  { nama:'Kuil kecil di dalam kawah gunung', lokasi:'i_gunung' },
  pengeras: { nama:'Pengeras suara di seluruh desa', lokasi:'i_siaran' },
};
export const ciriDi = loc => Object.keys(CIRI).find(k => CIRI[k].lokasi === loc) || null;

// 12 desa di Hida. Itomori punya semua ciri; desa lain hanya kehilangan 1–2 ciri,
// jadi butuh beberapa ciri (dan pertanyaan ke warga) untuk menyempitkan pilihan.
export const DESA = [
  { nama:'Itomori',   tanpa:[] },
  { nama:'Asagiri',   tanpa:['danau'] },
  { nama:'Fuyuno',    tanpa:['kuil','festival'] },
  { nama:'Haruka',    tanpa:['sekolah'] },
  { nama:'Kazami',    tanpa:['kumihimo','shintai'] },
  { nama:'Minase',    tanpa:['pengeras'] },
  { nama:'Nanao',     tanpa:['kereta','festival'] },
  { nama:'Sakuragi',  tanpa:['gardu'] },
  { nama:'Tsukimi',   tanpa:['shintai','sekolah'] },
  { nama:'Yamabuki',  tanpa:['kereta'] },
  { nama:'Hoshino',   tanpa:['danau','gardu'] },
  { nama:'Kirisame',  tanpa:['kumihimo'] },
];
export const ITOMORI = 0;
