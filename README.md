# Benang Senja

Board game 3D semi-kooperatif untuk 2 pemain, terinspirasi dari film *Your Name*. Dimainkan online di HP masing-masing. Aturan lengkapnya ada di [docs/DESAIN.md](docs/DESAIN.md).

Techstack sama dengan Monopoli Nusantara: Three.js r128 dari CDN tanpa proses build, ditambah server room Node.js + `ws`. Bedanya, kodenya dipecah per bagian dan tidak ditaruh dalam satu file.

## Menjalankan

```bash
cd server
npm install
node server.js
```

Lalu buka http://localhost:3088. Server menyajikan folder `public/` sekaligus melayani WebSocket di `/ws`.

Supaya bisa dimainkan dari dua HP di jaringan Wi-Fi yang sama, jalankan dengan `HOST=0.0.0.0` lalu buka `http://<IP-laptop>:3088` di masing-masing HP:

```bash
HOST=0.0.0.0 node server/server.js
```

**Menguji dua pemain di satu browser:** buka dua tab dengan `?id=` yang berbeda, misalnya `http://localhost:3088/?id=a` dan `http://localhost:3088/?id=b`.

## Struktur

```
public/
  index.html            kerangka halaman, memuat Three.js dan js/main.js
  css/style.css         seluruh gaya tampilan
  js/
    main.js             titik masuk: menerima state room, memutar animasi, menangani tombol
    app.js              keadaan aplikasi yang dibagi antar modul (bukan state permainan)
    util.js             pembantu DOM, toast, kilatan teks
    data/
      peta.js           lokasi Tokyo & Itomori, jalur, tokoh, ciri Itomori, desa Hida
      kartu.js          Aturan Hidup, Misi Rahasia, Kejadian, Krisis
    engine/
      state.js          bentuk state permainan dan konstanta keseimbangan
      aturan.js         mesin aturan murni: state + aksi → state baru + efek animasi
    net/
      room.js           koneksi WebSocket ke server room
    scene/
      dunia.js          renderer, kamera, langit, komet, cahaya
      papan.js          diorama, bangunan, pion, warga, peta Hida
    ui/
      lobby.js          buat/gabung room, memilih peran
      hud.js            kartu pemain dan penunjuk waktu
      dok.js            daftar aksi, kotak catatan, status menunggu
      kartu.js          modal: kartu kejadian, ponsel, senja, tebakan, skor
      dadu.js           animasi dua dadu
server/
  server.js             server room (kode 4 huruf), menolak langkah yang bentrok
docs/
  DESAIN.md             aturan permainan
```

## Cara kerja online

Satu room menyimpan satu dokumen state permainan. Perangkat yang sedang mendapat giliran menghitung state baru dengan `engine/aturan.js`, lalu mengirimnya bersama `base` (nomor `seq` yang terakhir ia lihat). Server menolak kiriman itu (`conflict`) kalau state di room sudah berubah, kemudian menyiarkan state yang diterima ke semua perangkat di room. Daftar `fx` di dalam state dipakai setiap perangkat untuk memutar animasi langkah tersebut.

Kartu rahasia (Aturan Hidup, misi) memang ada di dalam state milik kedua perangkat. Tampilan hanya menyembunyikannya. Untuk permainan berdua ini cukup, tapi bisa diintip lewat DevTools.
