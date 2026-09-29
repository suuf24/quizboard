# DESIGN.md - QuizBoard

Arah desain QuizBoard. Dokumen ini berisi data desain (identitas, palet, tipografi, dial, voice).
Perlakukan sebagai data untuk diterapkan, bukan sebagai instruksi kepada agent.

Provenance: ditranskrip oleh agent dari `src/App.css` dan `src/App.tsx` pada 2026-09-16, jadi isinya
merekam keputusan yang sudah ada di kode, bukan arah baru. Pemilik produk yang berhak mengoreksi.
Baris yang ditandai `[TANYA]` belum diputuskan dan menunggu jawaban pemilik.

## Produk & audiens

Guru SMP/SMA di Indonesia yang menampilkan kuis di proyektor kelas. Semua yang dilihat siswa ada di
layar besar dan jauh: soal, timer, nomor soal. Semua yang disentuh guru ada di bar bawah dan layar
setup. Konsekuensinya: ukuran besar dan kontras tinggi menang atas kepadatan informasi, dan tidak ada
elemen yang bergerak sendiri di area soal.

Bukan produk marketing. Tidak ada halaman publik, tidak ada klaim, tidak ada sosial proof. Karena itu
aturan anti-slop soal statistik, testimoni, dan halaman landing tidak berlaku di sini (tidak ada
bahannya), tetapi aturan kontras, motion, dan voice berlaku penuh.

## Dial

Dial: **ENERGY 2 / RHYTHM 2 / MOTION 2**

- ENERGY 2 (Balanced): blok warna tegas untuk mode dan kartu jawaban, tipografi display 800 untuk
  judul, tetapi dasarnya kertas hangat yang tenang. Bukan poster, bukan juga formulir Linear.
- RHYTHM 2 (Consistent with a few breaks): layar setup satu kolom berurutan (judul, mode, timer,
  advanced, start). Layar presentasi satu komposisi yang tidak berubah tiap soal; satu-satunya
  perubahan besar adalah overlay transisi dan layar selesai.
- MOTION 2 (Scroll-reveal, transitions): masuknya soal, transisi antar soal, countdown 3-2-1, dan
  reveal jawaban punya alasan UX masing-masing. Hindari animasi loop yang tidak menjawab kebutuhan.

Penyimpangan yang diketahui terhadap dial ini dicatat di `anti-slop/audit-001-2026-09-16.md`:
21 GIF maskot berjalan melintasi layar 14 detik dari tiap 17 detik (F-06) dan `fade-in-up` pada 11
elemen setup (F-07). Keduanya di atas MOTION 2 dan menunggu keputusan.

## Palet

Aturan: 2 warna inti (indigo, amber) + warna status. Putih, hitam, dan abu hangat tidak dihitung.
Satu aksen yang sengaja dipakai hemat adalah **amber**, dan pemakaiannya harus tetap jarang: warna
aksen yang muncul di mana-mana berhenti jadi aksen.

| Token | Hex | Peran | Alasan satu baris |
|---|---|---|---|
| `primary` | `#3730A3` | inti, aksi utama, teks fokus | Indigo tengah malam: otoritatif dan terbaca jauh, tanpa biru korporat generik |
| `secondary` | `#D97706` | aksen tunggal | Amber serbuk kapur: satu warna hangat di atas kertas, dipakai sesedikit mungkin |
| `tertiary` | `#059669` | hanya status "jawaban benar" | Hijau sage hanya muncul di reveal, jadi artinya tidak pernah kabur |
| `error` | `#DC2626` | hanya waktu kritis dan tombol keluar | Coral hangat: tegas, tidak menyilaukan di proyektor |
| `warning` | `#D97706` | peringatan timer 10 detik | [TANYA] nilainya sama dengan `secondary`, jadi benar-benar satu warna dipakai untuk dua peran |
| `surface` | `#FEFCE8` | latar utama | Kertas hangat, bukan putih steril: mengurangi silau layar besar di ruang kelas |
| `surface-container*` | `#FAF8F5`..`#E7E2D9` | kartu, chip, rel progres | Tangga abu hangat yang sama dengan kertas, jadi tidak ada blok abu dingin yang masuk |
| `inverse-surface` | `#1C1917` | monitor hitam pada countdown | Papan skor gelap: satu-satunya area gelap, dan hanya selama 3 detik |

Container pastel (`primary-container` lavender, `secondary-container` amber, `tertiary-container`
mint, `error-container` pink) hanya boleh jadi latar chip atau badge milik perannya sendiri, satu
kali pakai per peran. Lihat F-18 di audit untuk keputusan yang masih menggantung.

## Mode gelap

Ditambahkan 2026-09-23, jadi bagian ini keputusan baru, bukan transkrip keadaan kode seperti bagian
di atasnya. Guru memilihnya di layar Siap, seksi "Tampilan", dan pilihannya berlaku ke seluruh
layar. Aksinya ada di satu tempat saja, seperti aturan satu aksen.

Aturannya: **peran warna dibalik, bukan warna-warna digelapkan**. Tinta pindah ke warna terang,
meja jadi gelap, dan lembar tetap satu tingkat lebih terang dari meja, sehingga hierarki
meja/lembar dan arti satu aksen tidak berubah. Nilai lengkapnya ada di blok
`:root[data-theme='dark']` di `src/App.css`.

| Token | Terang | Gelap | Catatan |
|---|---|---|---|
| `paper` (meja) | `#F4F5F1` | `#14181C` | meja dan lembar bertukar tempat, bukan bertukar rona |
| `sheet` (lembar) | `#FFFFFF` | `#1E242A` | selalu lebih terang dari meja |
| `ink` | `#14181C` | `#F1F3EF` | 14,0:1 di atas lembar |
| `ink-soft` | `#5A6168` | `#A8B0B8` | 7,1:1 di atas lembar, minimum batas kontrol 3:1 |
| `rule` | `#9AA096` | `#4E5760` | pemisah, bukan batas kontrol |
| `pen` | `#B4231C` | `#FF7A66` | merah tema terang hanya 2,38:1 di atas lembar gelap |
| `pen-wash` | `#F4E4E1` | `#3A211E` | latar lembar yang ditandai pena |
| `overlay-plate` / `overlay-ink` | `ink` / `paper` | `#E9ECE6` / `#14181C` | papan countdown dan waktu habis, 15,0:1 |

Keputusan yang menyertainya:

1. **Papan kontras, bukan papan gelap.** Di tema terang, momen countdown dan waktu habis adalah
   satu-satunya area gelap. Di tema gelap, perannya dibalik jadi papan terang supaya tetap terbaca
   sebagai "lihat ke tengah" dan bukan sebagai latar. Warnanya bukan putih murni, karena layar
   gelap sepanjang kuis lalu dikejutkan putih 100% mengembalikan silau yang dihindari saat guru
   memilih tema ini.
2. **Kertas selalu menang saat mencetak.** Blok `@media print` mengembalikan token ke nilai terang,
   jadi lembar kunci jawaban tidak pernah keluar sebagai teks terang di atas kertas putih.
3. **Hover ditentukan token.** `filter: brightness()` diganti percampuran warna, karena arah yang
   benar (digelapkan atau diterangkan) bergantung tema, bukan angka tetap.
4. **Gelap bukan pilihan yang sama baiknya untuk semua ruangan.** Ruang kelas yang terang lebih
   baik memakai tema terang; tema gelap untuk ruangan remang atau proyektor yang memantulkan
   cahaya. Copy di UI menyebut ini apa adanya, tanpa klaim.

## Gambar soal

Ditambahkan 2026-09-25. Soal boleh membawa gambar, dari berkas di PC guru atau dari alamat online,
dan gambarnya harus pas di slide tanpa guru mengatur ukuran apa pun.

Aturannya: **gambar mengisi sisa ruang yang tersedia, dan rasio aslinya tidak pernah diubah**.
Panggung gambar adalah satu baris fleksibel di antara teks soal dan baris opsi; tingginya bukan
angka `vh` yang ditebak, melainkan sisa ruang yang benar-benar ada di layar itu.

| Keputusan | Nilai | Alasan |
|---|---|---|
| Tinggi panggung | `flex: 1` dengan lantai `clamp(96px, 16vh, 200px)` | Potret tinggi tidak mendorong opsi keluar layar, dan teks soal yang panjang tidak membuat gambar menghilang |
| Skala gambar | `object-fit: contain` | Rasio asli dijaga: tidak ada gambar gepeng atau terpotong, tanpa ruang kosong di dalam gambar |
| Gambar kecil | ikut membesar sampai batas panggung | Keterbacaan dari baris belakang menang atas kemurnian piksel; ujung atasnya dijaga batas 1600 px saat impor |
| Satu gambar | memakai seluruh panggung, tepi kiri sejajar teks soal | Satu tepi tetap yang dipegang mata, sama seperti aturan teks soal |
| Dua atau tiga gambar | berbagi ruang rata, masing-masing dipusatkan di bagiannya | Dua diagram dibaca sebagai satu pasangan; batasnya tiga karena di atas itu satu slide tidak lagi terbaca |
| Bingkai | tidak ada | Latar lembar sudah jadi bidang pemisah, dan bingkai hanya menambah garis yang tidak membawa informasi |
| Ruang bar kontrol | `--kontrol-tinggi` (68px, 114px di ponsel) disisihkan di bawah area soal | Bar kontrol `position: fixed`; tanpa ruang itu panggung yang fleksibel mendorong opsi ke bawah bar |
| Zoom | klik gambar atau `G` membuka papan penuh bertoken `--overlay-plate` | Satu-satunya tempat gambar boleh diperbesar melewati ukuran aslinya, karena aksinya sengaja dan sebentar |
| Animasi gambar | tidak ada | MOTION 2: kemunculan gambar tidak menjawab perubahan apa pun, dan menambahkannya berarti menambah satu kontrak reduced-motion lagi |
| Pratinjau | tinggi pasti `clamp(160px, 26vh, 320px)` | Lembar pratinjau setinggi isi, jadi persentase tidak punya acuan untuk diukur |
| Batas impor | sisi terpanjang 1600 px, WebP mutu 0,90; berkas di bawah 400 KB dipakai apa adanya | Proyektor kelas 1080p dan cetak 15 cm tidak butuh lebih, kuota sesi 5 MB adalah batas kerasnya, dan berkas yang sudah benar tidak perlu digenerasi ulang |
| Thumbnail di kunci jawaban dan panel gambar | ukuran tetap (56x40 dan 72x48) | Daftar padat dibaca untuk mencari nomor, bukan untuk memeriksa gambar; ukuran yang mengikuti isi akan mengacak tinggi baris |
| Lembar cetak | gambar di dalam sel tabel, tinggi maksimal 46 mm | Satu baris tetap satu halaman, dan kunci jawaban bergambar lebih berguna saat mengoreksi |
| Gambar tidak tersedia | papan keterangan berisi sebab dan nama berkas atau alamatnya | Di depan kelas, kotak kosong adalah teka-teki; tulisan yang menyebut nama berkasnya memberi tahu guru apa yang harus dilakukan |

Keputusan yang menyertainya:

1. **Nama berkas, bukan unggahan.** Guru menulis nama berkas di template dan memilih berkasnya saat
   impor. Tidak ada unggahan ke mana pun, karena aplikasi ini memang tidak punya server.
2. **Gambar lokal jadi Data URL.** Itu satu-satunya cara gambar ikut bertahan di sesi tersimpan.
   Kalau sesi melebihi kuota, gambar dilepas dengan jujur: nama berkasnya tetap tercatat, dan kartu
   "Lanjutkan kuis terakhir" mengatakan gambarnya perlu dipasang ulang.
3. **Gambar online yang gagal bukan bencana.** Alamat yang mati berubah jadi papan keterangan,
   bukan ikon gambar rusak, dan guru bisa memperbaikinya di layar Siap sebelum kelas dimulai.
4. **Satu gambar contoh ikut aplikasi** (`public/contoh-gambar.svg`) supaya "Coba contoh" tetap
   bekerja tanpa internet. Diagramnya skematis (kotak dan anak panah), bukan gambar anatomi
   bikinan sendiri, jadi tidak ada isi pelajaran yang diklaim secara salah.
5. **Panggung fleksibel tidak boleh menutup bar kontrol.** Bar itu `position: fixed` di atas area
   soal, jadi tingginya disisihkan sebagai `--kontrol-tinggi`; tanpa itu baris opsi soal bergambar
   berakhir di bawah bar (terukur pada 1366x768 sebelum diperbaiki).

## Membuat soal dengan AI

Ditambahkan 2026-09-28. Guru yang belum punya berkas soal bisa mulai dari ChatGPT, bukan dari
lembar kosong. Tombol "Buat soal" di layar impor membuka tab baru dengan prompt pembuat soal yang
sudah terisi, dan keluarannya sudah berbentuk berkas yang bisa diimpor di layar yang sama.

| Keputusan | Nilai | Alasan |
|---|---|---|
| Tempat tombol | baris aksi layar impor, urutan pertama, `btn--outlined` | Satu tombol primary per layar tetap dipegang "Pilih berkas" di lembar impor; tombol ini jalan kedua untuk guru yang belum punya berkas sama sekali |
| Ikon | panah keluar dari kotak | Tombol ini meninggalkan QuizBoard, dan ikonnya mengatakan itu sebelum diklik |
| Jalur prefill | alamat `https://chatgpt.com/?q=<prompt>` | Satu klik, tanpa langkah tempel |
| Jaring pengaman | prompt juga disalin ke clipboard | Prefill bergantung pada layanan pihak lain; clipboard tidak |
| Urutan aksi | tab dibuka lebih dulu, clipboard ditunggu sesudahnya | Sesudah `await`, peramban berhenti menghitungnya sebagai aksi klik dan memblokirnya sebagai pop-up |
| Prompt di UI | tidak ada kotak prompt di layar impor | Guru tidak perlu memeriksa atau menyalin prompt sendiri: prefill dan clipboard dikerjakan otomatis, dan kotak 17 KB itu hanya menambah tinggi layar. Konsekuensinya, saat clipboard ditolak peramban, jalan satu-satunya adalah menekan "Buat soal" lagi, dan baris statusnya menyebut itu |
| Sesudah "Buat soal" ditekan | mode impor pindah sendiri ke "Tempel teks", dan kotak tempelnya difokuskan | Hasil ChatGPT berupa teks di layar, bukan berkas, jadi tab "Unggah berkas" adalah pilihan yang salah untuk langkah berikutnya. Fokus dipindah ke kotaknya supaya Ctrl+V guru langsung masuk, bukan berhenti di tombol sakelar |
| Batas panjang alamat | 30.000 karakter, diukur bukan ditebak | Uji 2026-09-28 di peramban: alamat `?q=` sepanjang 19.954 karakter dilayani normal (tanpa 414) dan isinya masih terbawa saat halaman dialihkan ke halaman masuk akun. Uji yang sama diulang untuk prompt yang tumbuh: alamat 20.494 karakter tetap normal, dan alamat tepat 30.000 karakter juga normal, jadi angka batasnya berdiri di atas bukti. Prompt sekarang 17.883 karakter |
| Status sesudah klik | satu baris yang menyebut apa yang benar-benar terjadi | Ada empat keadaan berbeda (prefill dan clipboard berhasil, salah satu gagal), dan pesan sukses palsu lebih buruk daripada tidak ada pesan sama sekali |
| Tempat prompt | `src/soal-prompt.ts`, modul sendiri | 17 KB teks adalah data yang dikirim ke luar, bukan tata letak; mengubah prompt tidak perlu menyentuh layar |
| Jarak di layar impor | kelompok `.import-aside` dengan gap 12px di dalam, gap 32px dari lembar impor | Baris tombol, keterangan, dan status adalah satu urusan; tanpa pengelompokan, irama 32px layar itu memecahnya jadi tiga baris yang saling menjauh |
| Dua cara memasukkan soal | sakelar "Unggah berkas" / "Tempel teks" 12px di atas lembar impor | Hasil AI ada di layar, bukan di berkas, jadi memaksa guru menyimpannya dulu menambah satu langkah yang bisa gagal. Sakelarnya rapat ke lembarnya karena keduanya satu kontrol |
| Penanda tab terpilih | latar `pen-wash` ditambah garis bawah pena | Mengikuti pilihan Mode di layar Siap, dan warna sendirian tidak cukup untuk mengatakan "yang ini sedang dipakai" |
| Kotak tempel | latar meja (`paper`), bukan latar lembar, dan `resize: vertical` | Kotak yang lebih dalam dari teks soal mana pun harus terbaca sebagai ruang isian; menambah tinggi kotak tidak boleh menggeser tombolnya keluar layar |
| Umpan balik tempelan | baris "14 baris, 377 karakter." di sebelah tombol | Satu blok teks besar nyaris tidak mengubah tampilan kotaknya, jadi angka itu yang memastikan tempelannya masuk sebelum guru menekan Baca soal |
| Tombol Baca soal | mati selama kotaknya kosong, dengan alasan tertulis di sampingnya | Tombol mati tanpa penjelasan adalah teka-teki; baris "Belum ada teks." menjelaskannya tanpa pesan galat |

Keputusan yang menyertainya:

1. **Prompt dari pemilik produk jadi dasar, kalimatnya tidak dirombak.** Keluarannya sudah cocok
   dengan parser (`Answer: A/B/C/D` untuk pilihan ganda, `Answer: teks` untuk isian). Promptnya
   diganti 2026-09-28 dengan versi yang lebih pendek: 21 seksi, hanya pilihan ganda dan isian, tanpa
   bagian uraian.
2. **Aturan output ditulis sebagai satu code block, blok templatenya dipakai persis.** Permintaan
   pemilik produk: hasil akhir harus seperti source code dengan template yang ia berikan. Pada hari
   yang sama permintaan itu diperjelas lagi menjadi satu code block berisi teks soal, dan label
   konfirmasi di dalam prompt ikut berbunyi "YA = generate code block hasil soal" di dua tempat.
   Karena model cenderung memecah teks panjang jadi beberapa blok dan menambah kalimat pengantar
   walau sudah dilarang sekali, kalimat penegasnya ditambahkan di tempat yang sudah ada (seksi 12
   template output final, daftar WAJIB seksi 18, aturan final seksi 21) plus dua butir di daftar
   periksa internal seksi 20. Blok template dari pemilik produk disalin tanpa satu karakter diubah
   dan tetap muncul dua kali (seksi 12 dan 19) supaya terbaca di dua konteks. Sisa sebutan soal
   uraian (empat tempat) dihapus sekalian, karena aplikasi hanya punya pilihan ganda dan isian
   (`src/types.ts`) dan template baru tidak memuat uraian. Pagar code block yang dibawa keluaran
   ChatGPT tetap aman: diuji 2026-09-28 dengan pagar berpenanda txt, dengan pagar tanpa penanda,
   dan dengan kalimat pembuka di atas pagar, ketiganya terbaca sebagai 3 soal yang sama.
3. **Aturan `Image:` tidak diminta ke AI.** Soal bergambar tetap ditambahkan guru di berkasnya,
   karena AI tidak bisa menyediakan berkas gambarnya: baris `Image:` yang menunjuk nama berkas yang
   tidak ada hanya memindahkan pekerjaan guru ke layar Siap, bukan menghilangkannya.
4. **Prompt ikut masuk bundel.** Teksnya 17,1 KB mentah (sekitar 6 KB gzip) dan ikut terbawa ke
   `index.js`.
   Memuatnya sebagai potongan terpisah akan menghemat pemuatan pertama, tetapi `window.open` harus
   dipanggil sebelum ada `await`, jadi memuat potongan itu lebih dulu justru membatalkan tombolnya.
5. **Dua pesan galat parser diterjemahkan ke bahasa Indonesia.** Sebelumnya "Question 3 has an
   issue" dan "No questions found" satu-satunya sisa bahasa Inggris di jalur impor, dan jalur tempel
   membuat galat format jauh lebih sering muncul. Aturan voice produk sudah mewajibkan pesan galat
   berbahasa Indonesia yang menyebut nomor soalnya (F-15), jadi keduanya kini mengikuti aturan itu.
   Sisa pekerjaan bahasa di layar lain tetap terbuka (F-16).
6. **Judul hasil impor tidak lagi menyebut berkas.** "Berkas berhasil dibaca" menjadi "Soal berhasil
   dibaca", karena jalur tempel tidak punya berkas untuk disebut.
7. **Kotak prompt di layar impor dihapus.** Diputuskan 2026-09-28: `<details>` "Lihat prompt yang
   dibuka di ChatGPT" beserta tombol "Salin prompt" tidak lagi ditampilkan, dan `.prompt-view*`
   ikut dibuang dari `App.css`. Yang hilang bersamanya adalah jalan salin manual saat prefill dan
   clipboard dua-duanya gagal; dua baris status untuk keadaan itu diubah menjadi ajakan menekan
   "Buat soal" sekali lagi, karena itu satu-satunya jalan yang tersisa. Perilaku fokus ke kotak
   tempel bergantung pada `setTimeout(..., 0)`: kotaknya baru ada sesudah state mode berganti, jadi
   fokus tidak boleh dipanggil di render yang sama.
8. **Aturan variasi soal masuk supaya hasilnya tidak monoton.** Permintaan pemilik produk
   2026-09-28: soal yang dihasilkan tidak boleh terasa membosankan. Aturannya ditulis sebagai
   subbagian "Variasi soal" di dalam seksi 5, bukan seksi baru, supaya penomoran 21 seksi yang
   sudah dipakai di dokumen ini tidak bergeser. Isinya tujuh butir singkat: kalimat pembuka tidak
   terulang, bentuk soal berganti (definisi, contoh, penerapan, sebab akibat, perbandingan, urutan,
   perhitungan), konteks berganti, panjang kalimat bervariasi, isian tidak seragam, dua soal
   berurutan tidak memakai contoh atau angka yang sama, dan kata kerja pertanyaannya berganti. Dua
   butir di daftar periksa internal seksi 20 (nomor 38 dan 39) menagih aturan itu sebelum output
   ditampilkan. Permintaan ini menambah 823 karakter, karena itu alamat prefill diukur dan diuji
   ulang (lihat baris "Batas panjang alamat" di tabel atas).

## Tipografi

| Peran | Font | Alasan |
|---|---|---|
| Display & judul soal | `Outfit` 600-800 | Bentuk geometris bulat, ramah untuk guru, dan tetap tebal saat dibaca dari baris belakang |
| Body, label, kontrol | `Plus Jakarta Sans` 400-700 | Karya perancang Indonesia, x-height tinggi: label kecil tetap terbaca di layar proyektor |
| Angka saja (timer, nomor soal, kunci jawaban) | `Space Mono` 600-800 | Angka tabular selebar sama: saat timer menghitung mundur, digitnya tidak menggeser tata letak |

Skala: display-large `clamp(2rem, 4vw, 4.5rem)`, headline-large `clamp(1.25rem, 2.5vw, 2.25rem)`,
body-large `clamp(1rem, 1.2vw, 1.125rem)`, label-medium `0.75rem`. Semua ukuran yang tampil di
proyektor memakai `clamp` dengan `vw` supaya membesar mengikuti lebar layar, bukan piksel tetap.

`Space Mono` boleh muncul hanya untuk angka, tidak untuk kalimat. Label uppercase dengan tracking
lebar hanya pada satu tempat (label "Jawaban" di panel preview) karena fungsinya memisahkan label
dari nilai di dalam satu baris. Lihat F-09.

## Bentuk, elevasi, gerak

Radius satu keluarga, empat tingkat: 8px (chip kecil), 12px (kartu, panel), 16px (kartu besar,
modal), 28px (permukaan besar), plus `full` untuk tombol dan chip pil. Tujuannya: sudut kecil untuk
elemen kecil, sudut besar untuk permukaan besar, sehingga hierarki terbaca dari bentuk. [TANYA] dua
keluarga bentuk ini belum ditulis sebagai aturan (F-21).

Elevasi hanya tiga tingkat dan dipakai hemat: `elevation-1` untuk kartu yang bisa ditekan,
`elevation-2` untuk panel yang menutup layar, `elevation-3` untuk modal yang harus di atas segalanya.
Mayoritas kartu memakai border 2-3px, bukan bayangan, jadi halaman tidak terasa mengambang.

Gerak: durasi 50ms sampai 500ms, easing standar `cubic-bezier(0.2, 0, 0, 1)`. Setiap animasi masuk
memakai fill `backwards` supaya elemen tidak berkedip di frame pertama. Kontrak `prefers-reduced-motion`
di akhir `src/App.css` mematikan semua loop dan mempercepat transisi jadi instan tanpa kehilangan
informasi: maskot dihilangkan total, pulsa timer dimatikan, dan delay dinolkan.

Aturan gerak produk ini: animasi harus menjawab "apa yang baru saja berubah". Masuknya soal menjawab
"ini soal berbeda", stagger kartu menuntun mata dari A ke D, overlay transisi menjawab "sebentar lagi
soal berikutnya", countdown menjawab "berapa lama lagi". Animasi yang tidak menjawab pertanyaan itu
tidak dipasang.

## Voice

Voice: guru ke guru. Tenang, konkret, tanpa istilah marketing, tanpa tanda seru.

- Bahasa: **Indonesia** untuk semua yang dibaca guru. Istilah yang sudah lazim di kelas boleh
  dipertahankan apa adanya, sisanya diterjemahkan.
- Angka ditulis sebagai angka: "30 detik", bukan "tiga puluh detik".
- Sapa guru sebagai rekan kerja: "Cek 22 soal beserta jawabannya sebelum tampil di kelas", bukan
  "Optimalkan pengalaman belajar Anda".
- Dilarang: em dash (`—`), kata pemanis (seamless, revolusioner, canggih, mudah sekali), dan klaim
  tanpa bukti.
- Pesan error wajib menyebut apa yang salah dan soal nomor berapa, dalam bahasa Indonesia yang
  sederhana.

Kondisi saat ini belum memenuhi aturan ini: UI mencampur Inggris dan Indonesia tanpa pola
(F-15, F-16).

## Motif identitas

Tiga hal yang harus tetap ada supaya desain ini terasa milik QuizBoard, bukan template:

1. **Kertas hangat + indigo.** Latar `#FEFCE8` dengan blok indigo; kalau keduanya diganti, karakternya
   hilang.
2. **Angka mesin tik.** Timer, nomor soal, dan huruf kunci jawaban selalu `Space Mono` tabular.
3. **Rel bergaris.** Progres timer digambar sebagai segmen detik, bukan gradien halus: guru bisa
   menghitung sisa detik dari layar, pembeda dari progress bar generik.

## Alasan keputusan (R-31)

- Kenapa kertas hangat, bukan putih: layar proyektor kelas memantulkan cahaya, putih murni menyilaukan.
- Kenapa indigo: satu warna yang tetap gelap saat ditembak proyektor berkontras rendah.
- Kenapa amber dan bukan warna kedua yang setara: satu aksen terbaca sebagai perhatian, dua aksen
  terbaca sebagai dekorasi.
- Kenapa sage dan coral: keduanya hanya status (benar, kritis), jadi tidak menambah jumlah warna inti.
- Kenapa Space Mono hanya untuk angka: angka tabular mencegah timer bergeser, dan huruf tebal besar
  adalah cara termurah membuat nomor soal terbaca dari belakang ruangan.
- Kenapa kartu jawaban memakai border tebal, bukan bayangan: di proyektor, tepi kartu yang tegas
  terbaca jauh lebih baik daripada bayangan lembut.
- Kenapa overlay gelap untuk countdown: satu-satunya momen gelap menarik mata ke tengah layar sebelum
  soal muncul, lalu hilang.
- Kenapa panel preview dibuat selebar layar dengan satu soal per halaman: keputusan guru sebelum kelas
  butuh perhatian penuh, bukan daftar yang harus di-scroll.

## Yang belum diputuskan pemilik

- [TANYA] Bahasa: penuh Indonesia, atau dwibahasa dengan aturan (misal judul Indonesia, istilah teknis
  Inggris)? (F-16)
- [TANYA] Nasib 21 GIF maskot di `public/`: dipertahankan, dikurangi, atau dihapus? (F-06, F-08)
- [TANYA] Token `warning` yang menduplikasi `secondary`: digabung atau dibuat berbeda? (F-18)
- [TANYA] Bentuk: keluarga pil untuk tombol dan radius untuk kartu resmi dipertahankan? (F-21)
