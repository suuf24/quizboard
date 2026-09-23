# Arah desain 001: Lembar

Status: **usulan, belum diterapkan.** Tidak ada satu baris kode yang berubah karena dokumen ini.
Keputusan pemilik ada di bagian 7.

Provenance: disusun agent pada 2026-09-16 setelah membaca `src/App.css` (2244 baris), `src/App.tsx`,
`src/parser.ts`, `src/storage.ts`, `index.html`, `README.md`, `run.bat`, `DESIGN.md`, dan
`anti-slop/audit-001-2026-09-16.md`. Kalau arah ini diadopsi, isinya dipindahkan ke `DESIGN.md`;
selama belum diadopsi, `DESIGN.md` yang berlaku.

## 1. Brief

**Subjek**: QuizBoard, pemutar kuis kelas. Guru mengimpor berkas `.txt`, memeriksa soal, lalu
menampilkan satu soal per layar di proyektor.

**Audiens**: dua orang berbeda di satu ruangan.

- Siswa, di baris belakang, 3 sampai 8 meter dari layar, sering di ruang yang lampunya tidak dimatikan.
- Guru, berdiri di depan laptop, satu tangan di mouse atau keyboard, dan sedang mengajar, bukan
  sedang menjelajahi aplikasi.

**Pekerjaan utama layar ini**: membuat satu soal beserta pilihannya tidak mungkin salah baca dari
baris belakang, dan membuat guru bisa pindah soal tanpa mencari tombol.

**Bukan**: halaman marketing, bukan aplikasi siswa. Produk ini tidak punya klaim, statistik, atau
sosial proof, jadi bagian antislop tentang bahan itu tidak punya bahannya.

Asumsi yang belum dikonfirmasi: apakah siswa memang membuka URL LAN itu. Baris itu ada di `run.bat`
lama dan sudah dihapus di audit-002 karena tidak benar untuk `vite preview`. Kalau ternyata siswa
memang membuka aplikasi ini di ponsel, kalimat "dibaca dari baris belakang" perlu ditambah "dan dari
layar 5 inci", yang mengubah beberapa keputusan ukuran di bagian 3.5.

## 2. Design Read

> Lembar jawaban ujian di atas meja guru: soal bernomor di kolom tepi, garis tipis memisahkan baris,
> dan satu pena merah yang hanya keluar saat menilai.

Dial: **ENERGY 2 / RHYTHM 2 / MOTION 2**, tidak diubah. Ini dial pemilik di `DESIGN.md`; arah ini cara
mengeksekusinya, bukan dial baru.

## 3. Rencana

### 3.1 Warna: kertas, tinta, pena

Dua warna inti (kertas, tinta) plus satu aksen (pena). Netral tidak dihitung sebagai warna.

| Token | Nilai | Peran | Alasan satu baris |
|---|---|---|---|
| `paper` | `#F4F5F1` | latar ruang, layar presentasi | Kertas ujian netral: krem hangat bergeser kekuningan saat ditembak proyektor kelas, dan netral tidak mengubah warna soal yang biasanya berisi gambar atau teks berwarna |
| `sheet` | `#FFFFFF` | lembar soal, panel, kartu kunci | Satu tingkat lebih terang dari ruang: hierarki "kertas di atas meja" tercapai tanpa satu pun bayangan |
| `ink` | `#14181C` | teks utama, garis tegas | Tinta cetak biru-hitam, bukan hitam murni: hitam murni berhalo di proyektor murah, dan 16,29:1 di atas `paper` |
| `ink-soft` | `#5A6168` | teks sekunder, label, batas kontrol | 5,73:1 di atas `paper`: tetap AA di ukuran 15px, jadi tidak ada abu-abu tipis yang hilang di baris belakang |
| `rule` | `#9AA096` | pemisah antar baris | 2,45:1: terlihat sebagai garis, tidak berubah jadi kotak. Batas kontrol interaktif pakai `ink-soft` (syarat 3:1 untuk komponen) |
| `pen` | `#B4231C` | aksen tunggal | Pena merah guru: 6,00:1 di atas `paper`, 6,57:1 di atas `sheet`, dan hanya muncul saat penilaian muncul di layar |
| `pen-wash` | `#F4E4E1` | latar baris yang ditandai | Satu-satunya isian warna di lembar; dipakai sekali per soal, saat kunci dibuka. Tinta 14,47:1 dan pena 5,33:1 di atasnya |

Warna yang ditinggalkan, beserta alasannya:

- **Krem `#FEFCE8`**: bersama amber, ia membentuk komposisi krem hangat plus aksen tanah liat, yaitu
  kombinasi yang paling sering muncul di halaman buatan model bahasa. Selain itu warna hangat
  bergeser kekuningan di proyektor. Prinsip aslinya (bukan putih steril, mengurangi silau) tetap
  dipertahankan: `paper` sedikit lebih gelap dari krem lama, jadi silaunya tidak bertambah.
- **Amber `#D97706`**: 3,08:1 di atas krem lama, artinya ia tidak pernah layak jadi teks kecil dan
  selama ini aman hanya karena semua pemakaiannya kebetulan besar. Satu aksen yang boleh dipakai
  untuk apa saja lebih berguna daripada dua aksen yang salah satunya cuma boleh besar.
- **Sage `#059669` dan coral `#DC2626`**: dua warna status terpisah (benar, kritis) membuat empat
  hue hidup di satu layar. Perannya sekarang dipegang `pen` dan bobot tipografi, dengan aturan di 3.4.
- **Empat keluarga container pastel**: dihapus. Chip berwarna adalah permukaan yang tidak membawa
  informasi kecuali jenis soal, dan jenis soal bisa ditulis sebagai label.

Aturan pemakaian `pen`, satu paragraf yang bisa dipakai untuk memutuskan setiap pemakaian baru:
merah hanya keluar saat guru menilai. Di layar presentasi itu berarti tanda jawaban benar, baris
yang ditandai, tombol aksi utama di krom guru, dan sepuluh detik terakhir timer. Di luar itu `pen`
tidak muncul, termasuk di halaman setup, sehingga satu layar hanya punya satu titik merah.

### 3.2 Tipografi

| Peran | Font | Keputusan |
|---|---|---|
| Semua bahasa: soal, pilihan, judul, label, tombol | `Plus Jakarta Sans` | Dipertahankan. Dirancang perancang Indonesia, x-height tinggi, dan bobot 700 sampai 800 cukup tegas saat diproyeksikan. Satu keluarga untuk display dan body, sesuai prinsip "cukup satu atau dua keluarga" |
| Angka saja: timer, nomor soal, huruf kunci | `Space Mono` 700 | Dipertahankan, dengan alasan yang sudah tertulis: angka tabular mencegah timer menggeser tata letak saat menghitung mundur |
| Display judul soal | ~~`Outfit`~~ | **Dihapus.** Dua keluarga geometris ramah untuk peran yang sama membuat layar berganti wajah antara judul dan label. Satu keluarga untuk semua bahasa menyisakan tepat dua wajah: bahasa dan angka |

Skala, dengan alasan proyektor (bukan skala UI biasa):

| Nama | Nilai | Dipakai di |
|---|---|---|
| `soal` | `clamp(1.75rem, 3.4vw, 3.25rem)/1.25`, bobot 700 | teks soal |
| `pilihan` | `clamp(1.125rem, 1.9vw, 1.75rem)/1.35`, bobot 500, 700 saat ditandai | teks pilihan |
| `mesin` | `clamp(1.25rem, 1.9vw, 2rem)/1`, `Space Mono` 700, `tabular-nums` | timer, nomor soal, kunci |
| `label` | `0.8125rem/1.4`, bobot 600, `ink-soft` | label jenis soal, baris setup |

Tidak ada label huruf besar dengan tracking lebar. Label ditulis kalimat biasa: "Pilihan ganda",
"Isian singkat", bukan "PILIHAN GANDA". Ukuran teks soal dibatasi panjang baris 60 sampai 70
karakter; pilihan 45 sampai 55 karakter. Di bawah 80 karakter sesuai aturan keterbacaan, dan lebih
pendek lagi karena mata pembaca di sini sedang mengikuti baris dari jauh.

### 3.3 Bentuk

| Radius | Dipakai di |
|---|---|
| `0` | semua permukaan kertas: lembar soal, panel kunci, tabel, input |
| `4px` | kontrol yang disentuh guru: tombol, field waktu |
| `50%` | hanya gelembung jawaban |
| `9999px` | **dihapus dari sistem.** Tidak ada chip pil lagi |

Alasan satu baris: kertas tidak bersudut bulat, gelembung jawaban bulat karena memang bulat, dan
kontrol disentuh jari sehingga butuh sudut yang menandai "ini benda yang bisa ditekan". Sekarang
radius jadi informasi; sebelumnya satu keluarga bentuk dipakai untuk semua elemen sehingga tidak
membedakan apa pun.

Elevasi: hanya satu tingkat, untuk panel yang menutup layar (kunci jawaban, dialog). Kartu tidak
punya bayangan sama sekali, semuanya garis. Di proyektor, tepi yang tegas terbaca jauh, bayangan
lembut tidak.

### 3.4 Gerak

MOTION 2, dua gerakan saja, keduanya punya pekerjaan:

1. **Pergantian soal**: satu momen teratur, bukan efek tersebar. Lembar lama naik 12px dan memudar
   (160ms), nomor soal di rel berputar seperti odometer `Space Mono` (240ms), pilihan masuk
   berurutan 40ms per baris, rel timer mengisi ulang ke penuh. Ini menjawab satu pertanyaan: "apa
   yang baru saja berubah". `fade-in-up` pada 11 elemen setup (F-07) dihapus karena tidak menjawab
   pertanyaan apa pun.
2. **Tanda pena saat kunci dibuka**: gelembung jawaban benar terisi `pen` dan garis centangnya
   digambar dengan `stroke-dashoffset` (200ms), baris lain turun ke `ink-soft`. Menggambar centang
   adalah cara paling langsung menjawab "apa yang guru baru saja tandai".

Kontrak `prefers-reduced-motion` di akhir `App.css` dipertahankan: semua gerakan jadi instan, centang
muncul tanpa digambar, roda nomor tidak berputar. Timer tetap satu-satunya hal yang bergerak tanpa
aksi guru, karena itu memang jam.

### 3.5 Layout

**Layar presentasi, pilihan ganda.** Dua rel vertikal (nomor soal, gelembung) dan tiga pita
(rel atas, lembar, krom guru). Garis atas lembar adalah rel timer itu sendiri, jadi tidak ada elemen
yang mengambang.

```
  07/22   Pilihan ganda     ███████████░ ░ ░ ░ ░ ░ ░ ░ ░    2:14     <- pita 1: rel timer
 ┌───────────────────────────────────────────────────────────────┐
 │   7 │  Apa ibu kota Provinsi Sulawesi Tengah?                  │
 │     │                                                          │
 │     │  (a)  Palu                                               │
 │     │  (b)  Manado                                             │
 │     │  (c)  Gorontalo                                          │
 │     │  (d)  Makassar                                           │
 │     │                                                          │
 └───────────────────────────────────────────────────────────────┘
   [<]   [||]   [>]   [Kunci]                    [Berhenti]   [x]     <- pita 3: krom guru
```

Setelah kunci dibuka, tanpa memindahkan satu pun elemen:

```
 │     │  (a)  Palu                    <- baris ditandai: gelembung terisi, centang digambar
 │     │  (b)  Manado                                                     (teks tetap gelap)
 │     │  (c)  Gorontalo                                                 (teks turun ke ink-soft)
```

**Layar presentasi, isian singkat.** Garis titik-titik adalah konvensi lembar ujian Indonesia, dan ia
menjawab pertanyaan yang nyata: siswa harus menulis di kertasnya sendiri, jadi layar menunjukkan
seberapa panjang jawaban yang diminta.

```
 │  12 │  Sebutkan ibu kota Provinsi Bali.
 │     │
 │     │  Jawaban  · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
```

**Layar setup.** Daftar bernomor untuk mode, bukan dua kartu besar. Baris terpilih ditandai centang
pena di kolom tepi, bukan dengan blok warna.

```
 ┌──────────────────────────────────────────────────────────────┐
 │  Mode kuis                                                   │
 │ ─────────────────────────────────────────────────────────────│
 │    Latihan       umpan balik langsung per soal               │
 │ ─────────────────────────────────────────────────────────────│
 │  ✓ Harian        tanpa umpan balik, kunci dibuka di akhir    │
 │ ─────────────────────────────────────────────────────────────│
 │                                                              │
 │  Waktu per soal                                              │
 │  ┌──────┬──────┬──────┬──────┐                               │
 │  │  30  │  45  │  60  │  90  │  detik                        │
 │  └──────┴──────┴──────┴──────┘                               │
```

**Layar impor.** Satu lembar kosong sebagai titik fokus, lalu baris sesi terakhir dengan dua aksi.

```
                    ┌────────────────────────────────────┐
                    │  Tarik berkas .txt ke sini         │
                    │  atau klik untuk memilih berkas    │
                    │                                    │
                    │  Format: nomor. soal / (a) pilihan │
                    └────────────────────────────────────┘
                    ─────────────────────────────────────────
                    22 soal   soal 2   12 menit lalu
                    Sesi terakhir   [Lanjutkan]  [Mulai baru]  [Lupakan]
```

**Panel kunci jawaban dan lembar cetak.** Sudah berupa tabel, jadi kali ini ia jadi gaya rumah, bukan
pengecualian lewat `@media print`.

```
 Kunci jawaban                                    22 soal    [Cetak]  [Tutup]
 ──────────────────────────────────────────────────────────────────────────
  1   (b)   Ibu kota Indonesia adalah ...                       Jakarta
  2   (c)   Hasil dari 7 x 8 adalah ...                         56
  3         Sebutkan tiga pulau terbesar di Indonesia ...       Sumatra, Jawa, Kalimantan
```

**Rata kiri, bukan rata tengah.** Alasan satu baris: teks rata tengah memindahkan titik mulai teks
ke posisi berbeda untuk setiap soal, sementara rata kiri memberi satu tepi tetap yang bisa dipegang
mata selama 22 soal. Soal rata kiri di lebar 60 sampai 70 karakter; di dalam lembar, bukan di tengah
layar, sehingga lembar itu punya tepi yang jelas.

### 3.6 Prinsip

1. **Setiap garis punya pekerjaan.** Garis memisahkan dua hal yang memang berbeda. Kalau tidak ada
   yang dipisahkan, tidak ada garis. Ini yang menggantikan kotak kartu.
2. **Satu hal yang berani, sisanya tenang.** Yang berani hanya gelembung yang ditandai pena. Semua
   elemen lain diam.
3. **Dua rel untuk mesin, satu lembar untuk isi.** Nomor soal dan timer adalah mesin dan hidup di
   rel; soal dan pilihan adalah isi dan hidup di lembar. Guru selalu tahu di mana mencari batas waktu.
4. **Pena hanya untuk penilaian.** Satu aksen, satu arti. Warna yang muncul di mana-mana berhenti
   jadi aksen.
5. **Tidak ada yang bergerak kecuali guru menggerakkannya.** Satu pengecualian: timer, karena itu jam.

## 4. Review terhadap cluster default

Saya tulis ulang tiga keputusan setelah memeriksa rencana awal terhadap pola yang paling sering
muncul di halaman buatan model:

1. **Rencana awal saya masih memakai krem hangat plus amber, hanya bentuknya yang berubah.** Itu
   cluster nomor satu (krem hangat, aksen tanah liat). Direvisi: latar pindah ke kertas netral, amber
   dihapus, aksen tunggal jadi pena merah, dan tidak ada serif display yang ditambahkan sebagai
   pengganti. Yang dipertahankan dari arah lama hanya prinsipnya, bukan warnanya.
2. **Rencana awal saya punya tiga rel dan garis ganda sebagai pemisah seksi.** Itu mendekati cluster
   broadsheet (garis rambut, sudut nol derajat, kolom padat). Direvisi: satu rel kiri saja, gelembung
   ditulis sebaris di dalam baris pilihan bukan sebagai rel kedua, dan garis ganda dihapus. Yang
   tersisa hanya garis pemisah yang memisahkan.
3. **Rencana awal saya tetap memakai emoji sebagai ikon.** Emoji adalah ikon improvvisasi: ia
   bergantung pada font emoji tiap sistem operasi, jadi tombol yang sama terlihat berbeda di laptop
   guru dan di PC lab, dan di proyektor beberapa di antaranya kecil dan pucat. Ini juga tell khas
   halaman hasil generator. Direvisi: satu set ikon SVG gambar tangan, kira-kira delapan glyph
   (putar, jeda, berikutnya, sebelumnya, kunci, berhenti, tutup, suara), stroke 1,5px, ujung persegi,
   satu warna `ink`, sehingga tampil identik di mana pun.

Yang **tidak** saya lakukan, karena arah ini memang harus di bawah kendali pemilik: tidak ada logo
baru, tidak ada maskot baru, tidak ada nama produk baru. Maskot yang ada adalah keputusan pemilik
(bagian 7).

Satu hal yang akan saya buang kalau diminta mengurangi satu aksesori: garis daftar di layar setup.
Presentasi butuh rel dan garis supaya terbaca dari jauh; setup dibaca dari 50cm dan bisa hidup tanpa
garis sebanyak itu.

## 5. Cakupan perubahan kalau disetujui

| Berkas | Perubahan | Perkiraan |
|---|---|---|
| `src/App.css` | blok token diganti; semua permukaan kertas dibuat tanpa radius dan tanpa bayangan; chip pil jadi label; kontrol jadi 44px persegi sudut 4px; rel timer jadi garis atas lembar; tanda pena saat kunci; garis titik untuk isian singkat; media cetak diseragamkan | perubahan besar, kira-kira 60 persen dari 2244 baris |
| `src/App.tsx` | markup rel dan gelembung, tanda centang SVG, ikon SVG menggantikan emoji, label jadi kalimat biasa, garis titik untuk isian singkat, maskot sesuai keputusan | sedang |
| `src/icons.tsx` | berkas baru: kira-kira delapan ikon SVG gambar tangan | kecil |
| `index.html` | font: sesuai keputusan pemilik di bagian 7 | kecil |
| `DESIGN.md` | diisi ulang dengan arah yang diadopsi, versi pemilik yang mengoreksi | sedang |
| Tidak berubah | `parser.ts`, `storage.ts`, `audio.ts`, timer, pintasan keyboard, portal cetak, kontrak reduced-motion, dan lima perbaikan Hard Gate dari audit-002 |  |

Dua hal yang berubah perilakunya, bukan hanya tampilannya:

- Kunci jawaban tidak lagi memakai hijau sebagai status benar, jadi reveal tidak lagi bisa dibaca
  dari warna saja. Karena itu baris yang ditandai juga mendapat centang SVG dan teks pilihan yang
  ditandai naik ke bobot 700. Ini perbaikan aksesibilitas, bukan pengurangan.
- Timer kritis tidak lagi memakai merah kedua. Sepuluh detik terakhir memakai `pen` (yang di sini
  berarti "pena keluar"), ditambah bobot angka naik dan segmen terakhir berhenti berkedip-terus
  menerus, hanya berdenyut sekali per detik mengikuti detik yang benar-benar lewat.

## 6. Bukti dan yang belum diverifikasi

Kontras dihitung dengan rumus WCAG terhadap nilai hex final, bukan diperkirakan:

| Pasangan | Rasio | Status |
|---|---|---|
| `ink` di `paper` | 16,29 | AA |
| `ink` di `sheet` | 17,84 | AA |
| `ink-soft` di `paper` | 5,73 | AA |
| `ink-soft` di `sheet` | 6,28 | AA |
| `pen` di `paper` | 6,00 | AA |
| `pen` di `sheet` | 6,57 | AA |
| putih di `pen` | 6,57 | AA |
| `ink` di `pen-wash` | 14,47 | AA |
| `pen` di `pen-wash` | 5,33 | AA |
| `rule` di `paper` | 2,45 | garis, bukan teks |

Yang belum diverifikasi dan tidak boleh diklaim selesai:

- Semua ini masih usulan. Tidak ada halaman yang pernah dirender dengan token ini, jadi tidak ada
  satu pun klaim "terlihat lebih baik" di dokumen ini.
- Rendering di proyektor sungguhan belum diuji. Alasan warna netral dan hitam bukan murni berasal
  dari pengalaman umum proyektor kelas, bukan dari pengukuran di ruangan ini.
- Berkas font belum dihosting sendiri, jadi sampai keputusan di bagian 7 diambil, satu-satunya sumber
  `Outfit`, `Plus Jakarta Sans`, dan `Space Mono` adalah `fonts.googleapis.com`. Di PC lab tanpa
  internet, seluruh identitas tipografi saat ini jatuh ke `sans-serif` sistem, dan `dist/` yang bisa
  jalan offline tetap terlihat berbeda dari `dev`.
- Lembar cetak belum pernah keluar di kertas (terbuka dari audit-002).
- Layout lembar dengan empat pilihan panjang pada proyektor 1280x720 belum diukur; pada ukuran itu
  satu kolom empat baris pilihan adalah komposisi paling padat di rencana ini.

## 7. Keputusan yang menunggu pemilik

1. **Cakupan**: adopsi penuh (semua layar), hanya layar presentasi, atau hanya perubahan struktur
   tanpa mengganti palet.
2. **Maskot**: 21 GIF berisi karakter milik Nintendo, Sega, Shueisha, dan Disney, berjalan melintasi
   layar kelas. Dua alasan untuk memutuskan sekarang: identitas visual produk ini sebagian besar
   berisi karakter milik orang lain, dan gerak 14 detik dari 17 detik itu sendiri sudah tercatat
   sebagai penyimpangan dial (F-06, F-08).
3. **Font**: host sendiri berkas `woff2` supaya identitas tipografi hidup tanpa internet, atau tetap
   ambil dari CDN dan terima jatuh ke `sans-serif` di kelas yang offline.
