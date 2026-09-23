# QuizBoard - Classroom Quiz Player

Alat bantu guru untuk menampilkan kuis di kelas. Impor soal dari satu file `.txt`, periksa soal
beserta jawabannya, lalu tampilkan satu soal per layar di proyektor atau TV dengan timer dan bar
kontrol guru.

Semua yang dilihat siswa ada di layar besar: teks soal, nomor soal, timer. Siswa menjawab lisan
atau di buku, aplikasi ini tidak menilai jawaban.

## Menjalankan

Klik dua kali `run.bat`. Skrip itu memeriksa Node.js, memasang dependensi kalau `node_modules`
belum ada, lalu:

- **kalau folder `dist` sudah ada**, menjalankan versi build di http://localhost:4173 (ini yang
  disarankan untuk mengajar)
- **kalau belum ada**, menjalankan dev server di http://localhost:5173

Syarat: Node.js terpasang dari https://nodejs.org. Pemasangan dependensi pertama kali butuh
internet. Setelah `node_modules` dan `dist` tersedia, aplikasi berjalan tanpa internet.

## Memakai build di PC kelas

1. `npm install`
2. `npm run build`
3. Salin seluruh folder `dist` ke PC tujuan, lalu jalankan `run.bat` di sana.

Catatan yang mudah menjebak: `dist/index.html` **tidak bisa** dibuka dengan klik ganda. Browser
memblokir skrip modul dari alamat `file://`, jadi tetap butuh server berkas statis, dan `run.bat`
sudah mengurus itu selama Node.js ada di PC tersebut. Semua path aset relatif (`base: './'`), jadi
`dist` boleh diletakkan di subfolder mana pun.

Dua hal bergantung pada internet saat pemuatan pertama: font (Outfit, Plus Jakarta Sans, Space
Mono) diambil dari Google Fonts, dan GIF maskot dimuat dari aplikasi itu sendiri. Tanpa internet,
tipografi jatuh ke font sistem dan kuis tetap berjalan normal.

Butuh akses dari ponsel guru di jaringan yang sama? Tutup `run.bat`, lalu:

```bash
npm run preview -- --host
```

Vite secara default hanya membuka localhost, jadi alamat LAN tidak aktif sebelum `--host` dipakai.

## Deploy ke Vercel

Repositori ini belum perlu Git. Konfigurasi Vercel sudah ada di `vercel.json`, jadi cukup jalankan
CLI dari folder ini:

```bash
npx vercel        # login, tautkan project, terima setelan yang terdeteksi
npx vercel --prod # naikkan ke alamat produksi
```

Yang perlu diketahui sebelum menekan deploy:

- Build-nya statis: `npm run build` menghasilkan `dist`, dan Vercel menyajikannya apa adanya. Tidak
  ada server, fungsi, atau basis data yang perlu disiapkan.
- Tidak ada variabel lingkungan dan tidak ada kunci API. Berkas kuis dibaca di peramban guru dan
  tidak pernah dikirim ke mana pun, jadi versi online dan versi offline berperilaku sama.
- Syarat Node ada di `package.json` (`engines`), jadi Vercel memakai versi yang cocok dengan Vite 8
  tanpa perlu diatur di dashboard.
- `base: './'` di `vite.config.ts` membuat alamat aset relatif, sehingga `dist` tetap bisa disalin ke
  flashdisk atau subfolder PC sekolah seperti sebelumnya.
- Alamat preview dan alamat produksi memakai berkas yang sama. Tema Gelap yang dipilih guru ikut
  tersimpan di peramban, bukan di server.

## Format file soal

```
Title: IPA - Sistem Pernapasan Manusia

# Baris yang diawali # adalah komentar dan diabaikan

1. Organ tubuh utama yang berfungsi dalam sistem pernapasan manusia adalah?
A. Jantung
B. Paru-paru
C. Lambung
D. Ginjal
Answer: B

2. Proses pertukaran oksigen dan karbon dioksida di dalam tubuh disebut?
Answer: Pernapasan | Respirasi
```

Aturan yang ditegakkan parser:

- Soal pilihan ganda wajib punya 4 opsi (A sampai D) dan `Answer:` berisi satu huruf.
- Soal isian singkat langsung diikuti `Answer:` berisi teks, tanpa baris opsi.
- Beberapa jawaban alternatif dipisah tanda `|`, salah satu saja dianggap benar.
- Nomor soal boleh bolong.
- Kalau formatnya salah, impor gagal dan aplikasi menyebut soal nomor berapa yang bermasalah.

Tombol "Download Template" di layar impor menghasilkan file contoh yang bisa langsung diimpor
ulang.

## Yang bisa dilakukan guru

Layar impor:

- Tarik dan lepas file `.txt`, atau klik "Choose File" untuk memilih file.
- "Try Demo" memuat kuis contoh 22 soal IPA.
- Kartu "Lanjutkan kuis terakhir" muncul kalau ada sesi tersimpan: lanjutkan di soal terakhir,
  mulai dari awal, atau lupakan.

Layar pengaturan:

- "Preview Soal & Jawaban": memeriksa semua soal satu per satu, termasuk durasi timer yang akan
  dipakai, tanpa menampilkan apa pun ke siswa.
- "Cetak Kunci Jawaban": satu lembar kunci (nomor, tipe, jawaban, teks soal) untuk penilaian di
  atas kertas.
- Mode Penilaian Harian (jawaban tidak pernah tampil) atau Latihan (jawaban bisa dibuka).
- Tampilan Terang atau Gelap untuk seluruh layar. Lembar kunci jawaban yang dicetak tetap keluar
  hitam di atas kertas putih, apa pun tema yang dipilih.
- Timer terpisah untuk pilihan ganda dan isian singkat, opsi acak soal dan acak jawaban, setelan
  suara.

Saat presentasi, bar kontrol di bawah: jeda, lewati soal, tampilkan jawaban (mode latihan), kunci
jawaban, bisu, layar penuh, keluar.

Papan ketik: `F` layar penuh, `N` soal berikutnya, `Spasi` atau `P` jeda, `Esc` menutup dialog
teratas.

Sesi terakhir (kuis, setelan, dan posisi soal) disimpan di `localStorage` peramban, satu slot saja.
Pilihan tema disimpan di slot terpisah supaya tetap berlaku walau belum ada kuis yang terbuka.
Tidak ada data siswa yang disimpan dan tidak ada yang dikirim ke mana pun.

## Pengembangan

```bash
npm run dev      # dev server di port 5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

```
src/
  types.ts     tipe domain (Question, Quiz, QuizConfig)
  parser.ts    parser template .txt
  storage.ts   satu slot sesi tersimpan di localStorage
  audio.ts     efek suara Web Audio, tanpa file audio
  demo.ts      kuis contoh
  App.tsx      semua layar dan state mesin
  App.css      token desain dan seluruh gaya
  index.css    reset dasar
```

Sebelum mengubah tampilan, baca `DESIGN.md` (arah desain: palet, tipografi, dial, voice) dan
`AGENTS.md` (aturan kerja agent, termasuk filter anti-slop). Arah desain dan temuan audit UI ada
di `anti-slop/`.
