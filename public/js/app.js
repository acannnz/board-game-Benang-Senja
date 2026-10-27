// Keadaan aplikasi yang dibagi antar modul UI (bukan state permainan).
export const app = {
  S:null,          // state permainan yang sedang ditampilkan
  me:null,         // indeks pemain di perangkat ini (0 = Taki, 1 = Mitsuha)
  myId:null,
  db:null,         // koneksi server room
  kode:null,       // kode room
  sibuk:false,     // sedang mengirim langkah atau memutar animasi
  kirim:null,      // fungsi kirim(aksi) diisi main.js
  dibaca:0,        // jumlah catatan yang sudah dilihat di ponsel
};
