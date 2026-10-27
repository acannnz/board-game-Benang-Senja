// Isi kartu: Aturan Hidup, Misi Rahasia, Kejadian harian (Babak 1–2), dan Krisis (Babak 3).

// Aturan Hidup tiap tubuh. Hanya berlaku saat tubuh itu dipakai pasangannya (hari tukar).
//   masuk: dilarang masuk lokasi · aksi: dilarang melakukan aksi · ngobrol: dilarang ngobrol dengan tokoh
//   mampir: wajib mampir ke lokasi selama giliran · pulang: wajib mengakhiri giliran di lokasi
export const ATURAN = {
  taki: [
    { id:'t_kerja',   teks:'Jangan bolos kerja di restoran',        jenis:'mampir', lokasi:'t_resto' },
    { id:'t_boros',   teks:'Jangan boros uang',                     jenis:'aksi',   aksi:'belanja' },
    { id:'t_okudera', teks:'Jangan sok akrab dengan Kak Okudera',   jenis:'ngobrol', tokoh:'okudera' },
    { id:'t_perpus',  teks:'Jangan ke perpustakaan, ada utang buku', jenis:'masuk', lokasi:'t_perpus' },
    { id:'t_pulang',  teks:'Pulang ke apartemen sebelum malam',     jenis:'pulang', lokasi:'t_apt' },
    { id:'t_sekolah', teks:'Jangan bolos sekolah',                  jenis:'mampir', lokasi:'t_sekolah' },
  ],
  mitsuha: [
    { id:'m_sekolah', teks:'Jangan bolos sekolah',                  jenis:'mampir', lokasi:'i_sekolah' },
    { id:'m_nenek',   teks:'Bantu Nenek di kuil',                   jenis:'mampir', lokasi:'i_kuil' },
    { id:'m_danau',   teks:'Jangan ke danau sendirian',             jenis:'masuk',  lokasi:'i_danau' },
    { id:'m_ayah',    teks:'Jangan datangi Ayah di balai kota',     jenis:'masuk',  lokasi:'i_balai' },
    { id:'m_pulang',  teks:'Pulang ke rumah sebelum malam',         jenis:'pulang', lokasi:'i_rumah' },
    { id:'m_heboh',   teks:'Jangan bikin heboh di depan Sayaka',    jenis:'ngobrol', tokoh:'sayaka' },
  ],
};
export const aturanById = id => ATURAN.taki.concat(ATURAN.mitsuha).find(a => a.id === id);

// benda tempat petunjuk aturan hidup disembunyikan di tiap lokasi (aksi Cari Petunjuk)
export const BENDA = {
  t_apt:'memo di pintu kulkas', t_stasiun:'kartu kereta di saku jaket', t_sekolah:'coretan di buku pelajaran',
  t_perpus:'surat peringatan perpustakaan', t_obs:'catatan di ponsel Taki', t_resto:'jadwal kerja di loker',
  t_kafe:'struk belanja yang dilipat', t_tangga:'sketsa di buku gambar',
  i_gunung:'tulisan di batu kuil', i_kuil:'pesan Nenek di altar', i_rumah:'buku harian Mitsuha',
  i_bangku:'chat dari Tessie', i_danau:'kertas basah di dermaga', i_gardu:'tempelan di tiang listrik',
  i_balai:'surat dari Ayah', i_siaran:'catatan Sayaka', i_sekolah:'tulisan di meja kelas',
};

// Misi Rahasia. Indeks pemain: 0 = Pemain Taki, 1 = Pemain Mitsuha.
// cek(s) dipanggil di akhir permainan; s.akhirB1 menyimpan keadaan saat Babak 1 berakhir.
export const MISI = [
  [
    { id:'k_populer', poin:3, teks:'Bikin Mitsuha populer: Kepercayaan Sayaka + Tessie minimal 4 di akhir Babak 1',
      cek:s => s.akhirB1 && s.akhirB1.trust.sayaka + s.akhirB1.trust.tessie >= 4 },
    { id:'k_hemat',   poin:2, teks:'Uang Taki minimal 4 di akhir Babak 1',
      cek:s => s.akhirB1 && s.akhirB1.uang >= 4 },
    { id:'k_sketsa',  poin:3, teks:'Temukan minimal 5 ciri Itomori',
      cek:s => s.ciri.length >= 5 },
    { id:'k_okudera', poin:2, teks:'Kepercayaan Kak Okudera mencapai 3',
      cek:s => s.trust.okudera >= 3 },
    { id:'k_ingat',   poin:3, teks:'Akhiri permainan dengan Ingatan minimal 6',
      cek:s => s.ingatan[0] >= 6 },
  ],
  [
    { id:'m_kencan', poin:3, teks:'Saat di tubuh Taki, berhasil ngobrol dengan Kak Okudera 2 kali',
      cek:s => s.stat.okuderaTukar >= 2 },
    { id:'m_kafe',   poin:3, teks:'Saat di tubuh Taki, belanja di kafe 2 kali',
      cek:s => s.stat.kafeTukar >= 2 },
    { id:'m_kakak',  poin:2, teks:'Kepercayaan Yotsuha mencapai 3',
      cek:s => s.trust.yotsuha >= 3 },
    { id:'m_nenek',  poin:2, teks:'Kepercayaan Nenek mencapai 3',
      cek:s => s.trust.nenek >= 3 },
    { id:'m_jejak',  poin:2, teks:'Pasang minimal 2 jejak di Babak 2',
      cek:s => s.stat.jejakDipasang >= 2 },
  ],
];
export const misiById = id => MISI[0].concat(MISI[1]).find(m => m.id === id);

// Kejadian pagi (Babak 1–2). efek: ingatan [P.Taki, P.Mitsuha], trust {tokoh:+n}, uang, aksi [P.Taki, P.Mitsuha]
export const KEJADIAN = [
  { id:'mimpi',    judul:'Mimpi yang hangat',   teks:'Kalian bangun dengan perasaan rindu yang aneh.', efek:{ ingatan:[1,1] } },
  { id:'kabut',    judul:'Kabut pikiran',       teks:'Pagi terasa kosong, seperti ada yang hilang.',  efek:{ ingatan:[-1,-1] } },
  { id:'hujan',    judul:'Hujan deras',         teks:'Payung tertinggal. Pemain Taki −1 aksi hari ini.', efek:{ aksi:[-1,0] } },
  { id:'gerimis',  judul:'Gerimis di Itomori',  teks:'Jalan desa licin. Pemain Mitsuha −1 aksi hari ini.', efek:{ aksi:[0,-1] } },
  { id:'semangat', judul:'Pagi yang cerah',     teks:'Kedua pemain +1 aksi hari ini.', efek:{ aksi:[1,1] } },
  { id:'gaji',     judul:'Uang lembur',         teks:'Restoran membayar lembur. Uang +1.', efek:{ uang:1 } },
  { id:'dompet',   judul:'Dompet tertinggal',   teks:'Uang −1.', efek:{ uang:-1 } },
  { id:'tari',     judul:'Latihan tari kuil',   teks:'Nenek senang dengan latihanmu. Kepercayaan Nenek +1.', efek:{ trust:{ nenek:1 } } },
  { id:'usil',     judul:'Yotsuha usil',        teks:'"Kakak aneh sekali kemarin." Kepercayaan Yotsuha −1.', efek:{ trust:{ yotsuha:-1 } } },
  { id:'traktir',  judul:'Kak Okudera mentraktir', teks:'Kepercayaan Kak Okudera +1.', efek:{ trust:{ okudera:1 } } },
  { id:'curiga',   judul:'Tsukasa curiga',      teks:'"Kamu kemarin kenapa?" Kepercayaan Tsukasa −1.', efek:{ trust:{ tsukasa:-1 } } },
  { id:'kafeTes',  judul:'Rencana kafe Tessie', teks:'Tessie bercerita panjang soal kafe impiannya. Kepercayaan Tessie +1.', efek:{ trust:{ tessie:1 } } },
  { id:'gosip',    judul:'Gosip di kelas',      teks:'Sayaka membelamu. Kepercayaan Sayaka +1.', efek:{ trust:{ sayaka:1 } } },
  { id:'kampanye', judul:'Kampanye wali kota',  teks:'Ayah sibuk dan dingin. Kepercayaan Ayah −1.', efek:{ trust:{ ayah:-1 } } },
  { id:'benang',   judul:'Benang baru',         teks:'Pemain Mitsuha +1 Ingatan.', efek:{ ingatan:[0,1] } },
  { id:'jingga',   judul:'Langit jingga',       teks:'Pemain Taki +1 Ingatan.', efek:{ ingatan:[1,0] } },
  { id:'makan',    judul:'Makan malam keluarga', teks:'Kepercayaan Ayah +1.', efek:{ trust:{ ayah:1 } } },
  { id:'basket',   judul:'Main basket',         teks:'Kepercayaan Tsukasa +1.', efek:{ trust:{ tsukasa:1 } } },
];

// Krisis (Babak 3), satu per Jam
export const KRISIS = [
  { id:'tenang',   judul:'Hening sesaat',        teks:'Tidak terjadi apa-apa. Manfaatkan waktumu.' },
  { id:'longsor',  judul:'Jalan tertutup',       teks:'Satu jalur tertutup selama Jam ini.', efek:{ tutup:true } },
  { id:'putus',    judul:'Siaran diputus',       teks:'Kalau siaran sedang menyala, siaran mati dan harus dinyalakan lagi.', efek:{ putus:true } },
  { id:'panik',    judul:'Warga panik',          teks:'Ajak warga −1 selama Jam ini.', efek:{ ajak:-1 } },
  { id:'polisi',   judul:'Polisi mencari Tessie', teks:'Tessie digiring ke Balai Kota.', efek:{ polisi:true } },
  { id:'kabutB3',  judul:'Kabut senja',          teks:'Semua uji dadu −1 selama Jam ini.', efek:{ uji:-1 } },
  { id:'jatuh',    judul:'Mitsuha tersandung',   teks:'Pemain Mitsuha −1 aksi Jam ini.', efek:{ aksiM:-1 } },
  { id:'sukarela', judul:'Warga sukarela',       teks:'Beberapa warga mulai berjalan sendiri: 2 warga dari lokasi terpadat pindah ke Sekolah.', efek:{ sukarela:2 } },
  { id:'pecahan',  judul:'Komet terbelah',       teks:'Warga melihat langit dan mulai percaya. Ajak warga +1 selama Jam ini.', efek:{ ajak:1 } },
  { id:'lari',     judul:'Lari sekuat tenaga',   teks:'Pemain Mitsuha +1 aksi Jam ini.', efek:{ aksiM:1 } },
];
