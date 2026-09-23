# Tugas: Tambahkan Tipe Soal "Isian Singkat" + Dukungan Kuis Campuran (Pilihan Ganda & Isian Singkat)

## Konteks Project

QuizBoard adalah aplikasi presentasi kuis kelas berbasis **React 19 + TypeScript + Vite 8** (UI berbahasa Indonesia, tanpa library UI eksternal, styling di `src/App.css` dengan CSS variables Material-ish).

Alur aplikasi: **Import file .txt → Setup (mode/timer/shuffle/sound) → Presentasi fullscreen → Complete**.

File yang relevan:

| File | Isi |
|---|---|
| `src/types.ts` | Semua tipe domain (`Question`, `Quiz`, `QuizConfig`, dll) |
| `src/parser.ts` | Parser template teks `.txt` + `shuffleArray()` |
| `src/demo.ts` | Data kuis demo + `getDemoTemplate()` |
| `src/App.tsx` | Semua layar & logika (import, setup, presentasi, timer, keyboard shortcut, download template) |
| `src/App.css` | Seluruh styling |
| `src/audio.ts` | Sound effect (tidak perlu diubah) |

### Format template yang ADA sekarang (hanya pilihan ganda)

```
Title: IPA - Sistem Pernapasan

1. Organ tubuh yang berfungsi memompa darah adalah...
A. Jantung
B. Paru-paru
C. Lambung
D. Ginjal
Answer: A
```

Parser ada di `parseQuizTemplate()` di `src/parser.ts`. Saat ini soal WAJIB punya tepat 4 opsi A–D dan `Answer: <huruf>`, kalau tidak → error.

---

## Tujuan

1. **Tipe soal baru: Isian Singkat (short answer)** — tanpa pilihan ganda, siswa menjawab singkat; guru menampilkan jawaban benar di layar saat reveal.
2. **Kuis campuran** — satu file boleh berisi campuran soal pilihan ganda dan isian singkat, urutan bebas.
3. **Backward compatible** — template lama (semua pilihan ganda) HARUS tetap terbaca tanpa perubahan apa pun.

---

## 1. Desain Format Template (WAJIB ikuti persis)

Soal isian singkat = baris pertanyaan bernomor, **langsung** diikuti `Answer:` berisi teks jawaban (TANPA baris A–D). Parser mendeteksi tipenya dari ada/tidaknya baris opsi.

```
Title: IPA - Campuran Soal

# Baris yang diawali # adalah komentar, abaikan saja

1. Organ tubuh yang berfungsi memompa darah adalah...
A. Jantung
B. Paru-paru
C. Lambung
D. Ginjal
Answer: A

2. Lambang kimia air adalah...
Answer: H2O

3. Satuan turunan SI untuk gaya adalah...
Answer: Newton | N
```

Aturan spesifik:

- **Deteksi tipe**: setelah baris pertanyaan bernomor, jika baris berikutnya cocok pola `^[A-Da-d][.)]` → pilihan ganda; jika langsung `^answer\s*:` → isian singkat.
- **Beberapa jawaban alternatif** dipisah karakter `|` (pipe). Contoh `Answer: Newton | N` berarti "Newton" ATAU "N" sama-sama benar.
- **Normalisasi jawaban** saat simpan & bandingkan: trim spasi di awal/akhir, bandingkan secara case-insensitive. Simpan juga versi ternormalisasi atau normalisasi saat compare.
- **Komentar**: baris yang diawali `#` diabaikan parser (jangan sampai dianggap pertanyaan/jawaban).
- **Validasi isian singkat**: minimal 1 jawaban non-kosong setelah split `|`. Kalau kosong → error seperti validasi existing, dengan pesan spesifik, contoh: `"Soal 3 (isian singkat) belum punya jawaban. Tulis setelah 'Answer:'."`
- **Validasi pilihan ganda**: tetap seperti sekarang (harus tepat 4 opsi A–D + `Answer: huruf A–D`).
- Nomor soal boleh bolong (gap) — pertahankan perilaku parser existing yang skip baris tak dikenal antar soal.
- Perbarui doc comment di atas `parseQuizTemplate()` agar mendokumentasikan kedua format.

## 2. Perubahan `src/types.ts`

Ubah `Question` menjadi **discriminated union** (jangan biarkan opsional semua field, supaya TypeScript yang menjaga):

```ts
export type QuestionType = 'multiple-choice' | 'short-answer';

export interface BaseQuestion {
  id: number;
  type: QuestionType;
  text: string;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice';
  options: [string, string, string, string];
  correctAnswer: number; // 0-3
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: 'short-answer';
  acceptedAnswers: string[]; // sudah di-trim, minimal 1 item
}

export type Question = MultipleChoiceQuestion | ShortAnswerQuestion;
```

Konsekuensi: semua kode yang memakai `q.options` / `q.correctAnswer` harus mengecek `q.type` dulu (narrowing otomatis bekerja dengan union di atas).

## 3. Perubahan `src/parser.ts`

- Refactor loop parsing sesuai spesifikasi format di atas. Saran struktur:
  1. Baca baris nomor soal.
  2. Peek baris berikutnya: opsi? kumpulkan opsi A–D lalu wajib `Answer: huruf`.
  3. Jika tidak ada opsi → baca `Answer: teks`, split `|`, trim, filter kosong, validasi ≥ 1.
- Pesan error harus jelas menyebut nomor soal dan tipenya (lihat contoh di atas). Tetap isi `errorQuestion`.
- Tetap export `shuffleArray` tanpa perubahan perilaku.
- Pertimbangkan ekstrak helper kecil: `normalizeAnswer(s: string): string` (trim + toLowerCase) — akan dipakai untuk compare nanti jika ada fitur penilaian.

## 4. Perubahan `src/demo.ts`

- Tambahkan beberapa soal isian singkat ke `demoQuiz.originalQuestions` (misal 4–5 soal isian diselingi antara soal PG; total tetap wajar ~20-an). Set `type` pada SEMUA soal demo.
- Update `getDemoTemplate()` supaya menghasilkan format campuran sesuai spesifikasi (soal isian = tanpa baris A–D, `Answer: teks`).

## 5. Perubahan `src/App.tsx`

Titik-titik yang HARUS disesuaikan (nomor baris kira-kira, bisa geser):

1. **Shuffle answers** (dalam `startQuiz`, sekitar baris 148–155): hanya jalankan logika shuffle opsi untuk soal `'multiple-choice'`. Soal isian singkat dilewati apa adanya.
2. **Area pertanyaan presentasi** (sekitar baris 880–901):
   - Pilihan ganda: render seperti sekarang (grid 4 kartu jawaban).
   - Isian singkat: JANGAN render grid. Render sebagai gantinya sebuah "kartu jawaban terbuka": kotak besar bergaya sama dengan kartu jawaban tapi berisi garis isian / placeholder, misal ikon ✏️ + teks samar `"Jawabanmu?"` (murni visual, bukan `<input>` — siswa menjawab lisan/di buku, layar ini hanya untuk guru menampilkan soal).
   - Saat reveal (practice mode: tombol 👁 / auto time-up; lihat logika existing `showCorrectAnswer` & `presState === 'answer-reveal'`), tampilkan **semua** `acceptedAnswers` besar & menonjol di dalam kartu tersebut (jika lebih dari satu, tampilkan dipisah " / "). Gunakan animasi reveal yang konsisten dengan kartu PG yang ada di `App.css`.
   - Mode `daily`: jawaban TIDAK pernah ditampilkan (sama seperti perilaku PG sekarang).
   - Tambahkan badge/chip kecil di dekat teks soal bertuliskan `"Isian Singkat"` atau `"Pilihan Ganda"` sesuai `q.type` — styling sederhana di `App.css`.
3. **Panel Answer Key 🔑** (sekitar baris 1000–1026): untuk soal isian singkat, kolom huruf diganti teks jawaban (join alternatif dengan `" / "`); untuk PG tetap huruf. Pastikan narrowing tipenya benar.
4. **`downloadTemplate()`** (sekitar baris 439): template yang didownload harus menampilkan CONTOH CAMPURAN (beberapa soal PG + 2 soal isian singkat, salah satunya pakai `|` untuk jawaban alternatif) plus baris komentar `#` singkat yang menjelaskan format isian singkat. Ingat: parser mengabaikan komentar `#` sehingga file contoh ini juga bisa langsung di-import.
5. **Layar import, pesan error** (blok `import-error__list`, sekitar baris 569): update hint menjadi netral tipe, misal: setiap soal PG punya 4 opsi A–D + `Answer:`; soal isian cukup `Answer: teks jawaban`; ikuti format template.
6. Keyboard shortcut, timer, mascot, audio: TIDAK berubah.

## 6. Perubahan `src/App.css`

- Style untuk kartu isian singkat (state biasa + state reveal), badge tipe soal, dan tampilan daftar jawaban alternatif. Ikuti konvensi naming BEM yang sudah dipakai (`answer-card__*`, dst) dan pakai CSS variables yang sudah ada (`var(--md-sys-color-*)`, `var(--md-sys-typescale-*)`). Responsif mengikuti layout presentasi existing.

---

## Batasan & Kualitas

- JANGAN menambah dependency baru.
- JANGAN mengubah perilaku yang tidak disebut (timer, audio, mascot, mode, dsb tetap identik).
- Manfaatkan narrowing TypeScript — dilarang cast paksa (`as`) untuk membypass union; biarkan compiler memvalidasi.
- Kode & identifier tetap English, copy UI tetap Bahasa Indonesia seperti existing.

## Acceptance Criteria (semua harus lolos)

1. Import template lama (semua PG) → sukses, tampilan & jalannya kuis 100% sama seperti sebelumnya.
2. Import template campuran (PG + isian, selingan acak) → sukses; jumlah soal terhitung benar; urutan tampil sesuai file.
3. Soal isian singkat di presentasi: tampil sebagai kartu isian (tanpa grid A–D), timer jalan normal, skip/pause/fullscreen normal.
4. Practice mode: tombol 👁 dan auto-reveal saat waktu habis menampilkan jawaban isian (termasuk semua alternatif `|`) dengan animasi; bisa di-hide lagi.
5. Daily mode: jawaban isian tidak pernah tampil; answer key 🔑 tetap menampilkan jawaban teks untuk guru.
6. Shuffle answers ON: soal PG ter-shuffle, soal isian tidak terpengaruh & tidak error.
7. Error handling: soal isian tanpa `Answer:`, atau `Answer:` kosong → gagal import dengan pesan jelas menyebut nomor soal.
8. `# komentar` diabaikan parser; file template hasil `downloadTemplate` bisa langsung di-import ulang tanpa error.
9. Demo (`Try Demo`) berisi campuran PG + isian dan berjalan mulus end-to-end.

## Verifikasi (jalankan semua, wajib lulus)

```powershell
npm run lint     # oxlint, 0 error
npm run build    # tsc -b && vite build, 0 error type
npm run dev      # uji manual sesuai acceptance criteria di atas
```

Uji manual minimal: import template campuran → mainkan practice mode → cek reveal isian → cek answer key → exit → mainkan daily mode → pastikan jawaban tidak bocor.
