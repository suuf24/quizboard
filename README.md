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
tipografi jatuh ke font sistem dan kuis tetap berjalan normal. Soal yang gambarnya berupa alamat
online juga butuh internet saat ditampilkan; gambar lokal dari PC tidak, karena isinya sudah ikut
masuk ke berkas kuis.

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

3. Perhatikan diagram berikut. Bagian yang ditunjuk anak panah disebut?
Image: alveolus.png | Diagram alveolus di dalam paru-paru
Image: https://contoh.sch.id/trakea.png
A. Bronkus
B. Alveolus
C. Trakea
D. Diafragma
Answer: B
```

Aturan yang ditegakkan parser:

- Soal pilihan ganda wajib punya 4 opsi (A sampai D) dan `Answer:` berisi satu huruf.
- Soal isian singkat langsung diikuti `Answer:` berisi teks, tanpa baris opsi.
- Beberapa jawaban alternatif dipisah tanda `|`, salah satu saja dianggap benar.
- Nomor soal boleh bolong.
- Kalau formatnya salah, impor gagal dan aplikasi menyebut soal nomor berapa yang bermasalah.

### Gambar pada soal

- Tulis `Image:` di bawah baris soal (`Gambar:` sama artinya). Barisnya boleh diletakkan di mana
  saja antara baris soal dan `Answer:`, dan satu soal boleh memuat maksimal 3 gambar.
- Isinya salah satu dari dua: alamat online yang diawali `http://` atau `https://`, atau nama
  berkas gambar di PC guru. Skema lain (mis. `file:`) ditolak dengan pesan yang menyebut nomor
  soalnya.
- Teks sesudah tanda `|` pertama jadi deskripsi gambar untuk pembaca layar. Tuliskan kalau gambar
  memuat informasi yang tidak ada di teks soal.
- Gambar lokal dipilih bersama berkas `.txt`-nya saat impor, lalu namanya dicocokkan otomatis
  sehingga huruf besar-kecil tidak masalah. Satu folder yang berisi soal beserta gambarnya boleh
  diseret sekaligus.
- Nama berkas yang belum ketemu bukan galat: kuis tetap terbuka, dan layar Siap menampilkan baris
  berapa gambar yang belum dipasang beserta panel untuk memasangnya satu per satu.
- Gambar lokal dikecilkan otomatis kalau perlu: sisi terpanjang menjadi 1600 px dan disimpan
  sebagai WebP. Berkas yang sudah muat dipakai apa adanya, jadi GIF animasi tetap bergerak.
- Gambar ikut tersimpan di sesi terakhir. Kalau totalnya melebihi kuota `localStorage` (sekitar
  5 MB), sesi disimpan tanpa isi gambarnya dan kartu "Lanjutkan kuis terakhir" menyebutkan itu.
- Gambar dari alamat online butuh internet saat ditampilkan. Kalau alamatnya tidak bisa dibuka,
  slide menampilkan keterangan "Gambar tidak bisa dimuat" beserta alamatnya, bukan kotak kosong.

Tombol "Unduh template" di layar impor menghasilkan file contoh yang bisa langsung diimpor
ulang.

## Membuat soal dengan AI

Kalau belum punya berkas soal, tombol "Buat soal" di layar impor membuka tab baru ke ChatGPT dengan
prompt pembuat soal yang sudah terisi. Prompt itu memandu ChatGPT bertanya satu per satu: mata
pelajaran, bab, sub bab, kelas, jumlah soal pilihan ganda, jumlah soal isian, status HOTS, lalu
persentase tingkat kesulitan. Sesudah datanya lengkap dan dikonfirmasi, ChatGPT menulis soalnya di
dalam satu code block: teks mentah untuk berkas `soal.txt`, dengan format yang sama seperti template
di atas.

Urutannya:

1. Klik "Buat soal". Layar impor langsung pindah ke tab "Tempel teks", dan kotak tempelnya sudah
   siap diisi.
2. Jawab pertanyaan ChatGPT satu per satu di tab yang terbuka.
3. Pakai tombol salin di sudut code block hasilnya, lalu tempel di kotak "Tempel teks" di layar impor
   dan klik "Baca soal". Kalau lebih suka lewat berkas, simpan isi code block itu sebagai satu berkas
   `.txt` dan pakai tab "Unggah berkas".
4. Periksa soalnya di "Preview Soal & Jawaban".

Soal bisa masuk lewat dua jalur, dipilih dengan sakelar di atas lembar impor:

- **Unggah berkas** membawa berkas `.txt` beserta berkas gambarnya sekaligus.
- **Tempel teks** menerima teks apa adanya, tanpa berkas. Jalur ini yang paling cepat sesudah
  memakai ChatGPT, tetapi tidak bisa membawa gambar lokal: baris `Image:` yang menunjuk nama berkas
  di PC muncul di layar Siap sebagai gambar yang belum dipasang, dan bisa dipasang dari panel gambar
  di layar itu.

Prompt-nya juga disalin ke clipboard sebagai cadangan. Kalau kolom pesan ChatGPT kosong sesudah
tabnya terbuka, tempel dengan Ctrl+V. Kalau penyalinan itu pun ditolak peramban, tekan "Buat soal"
sekali lagi: tab baru akan terbuka dengan prompt terisi.

Dua hal yang perlu diketahui:

- Bagian ini butuh internet dan akun ChatGPT. Sisa aplikasi tetap berjalan tanpa internet.
- Promptnya hanya meminta soal pilihan ganda dan soal isian, dan hasilnya diminta berupa satu code
  block berisi teks mentah berkas `.txt`, tanpa kalimat pembuka atau penutup di luarnya.
- Promptnya juga meminta bentuk dan konteks soalnya bervariasi: kalimat pembuka tidak boleh terulang,
  bentuknya berganti antara definisi, contoh, penerapan, perbandingan, dan perhitungan, serta
  konteksnya berganti dari rumah, sekolah, kebun, sampai kejadian sehari-hari. Kalau
  ChatGPT menambah penjelasan di luar code block itu, bagian itu bisa diabaikan: impor tetap membaca
  isi bloknya.

## Yang bisa dilakukan guru

Layar impor:

- Sakelar "Unggah berkas" / "Tempel teks" memilih cara memasukkan soal.
- "Unggah berkas": tarik dan lepas file `.txt`, atau klik "Pilih berkas" untuk memilih berkas soal
  beserta gambar yang dipakainya. Satu folder yang berisi keduanya juga bisa diseret langsung.
- "Tempel teks": tempel hasil dari AI, atau teks soal dari mana pun, langsung ke kotaknya, lalu klik
  "Baca soal". Kotak itu menyebut jumlah baris dan karakter yang sudah masuk.
- "Coba contoh" memuat kuis contoh 23 soal IPA, termasuk satu soal bergambar.
- "Buat soal" membuka tab ChatGPT dengan prompt pembuat soal terisi, untuk guru yang belum punya
  berkas soal. Lihat bagian "Membuat soal dengan AI".
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
- Seksi Gambar: berapa gambar yang siap dan berapa yang belum dipasang, dengan panel untuk
  memeriksa, mengganti, atau melepas berkas gambar per soal.
- Timer terpisah untuk pilihan ganda dan isian singkat, opsi acak soal dan acak jawaban, setelan
  suara.

Saat presentasi, bar kontrol di bawah: jeda, lewati soal, tampilkan jawaban (mode latihan), kunci
jawaban, bisu, layar penuh, keluar. Gambar pada soal bisa diklik (atau tekan `G`) untuk dibuka
sebesar layar, lalu ditutup dengan klik lagi atau `Esc`.

Papan ketik: `F` layar penuh, `N` soal berikutnya, `Spasi` atau `P` jeda, `G` perbesar gambar,
`Esc` menutup lapisan teratas.

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
  types.ts        tipe domain (Question, Quiz, QuizConfig, QuestionImage)
  parser.ts       parser template .txt
  images.ts       gambar soal: pencocokan nama berkas, pengecilan otomatis, papan pengganti
  storage.ts      satu slot sesi tersimpan di localStorage
  audio.ts        efek suara Web Audio, tanpa file audio
  icons.tsx       ikon SVG gambar tangan, tanpa emoji
  demo.ts         kuis contoh
  soal-prompt.ts  prompt siap pakai untuk AI pembuat soal, alamat ChatGPT, dan penyalin teks
  App.tsx         semua layar dan state mesin
  App.css         token desain dan seluruh gaya
  index.css       reset dasar
```

Sebelum mengubah tampilan, baca `DESIGN.md` (arah desain: palet, tipografi, dial, voice) dan
`AGENTS.md` (aturan kerja agent, termasuk filter anti-slop). Arah desain dan temuan audit UI ada
di `anti-slop/`.
