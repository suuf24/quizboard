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
