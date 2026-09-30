/**
 * Soal dari tautan Pastebin.
 *
 * Kenapa lewat pembaca pihak ketiga: pastebin.com tidak mengirim header CORS sama sekali, jadi
 * `fetch` dari peramban selalu diblokir. Diuji 2026-09-29 di peramban: `/raw/<id>`, `/dl/<id>`,
 * `raw.php?i=`, `embed_js/`, versi `www`, dan versi bertrailing slash semuanya gagal dibaca
 * (`mode: 'no-cors'` membalas opaque dengan status 0, artinya berkasnya ada dan hanya CORS yang
 * menghalangi). Delapan proxy publik diuji pada hari yang sama; hanya `r.jina.ai` yang menjawab.
 *
 * Dua hal yang ditemukan saat pengujian itu dan membentuk kode di bawah:
 *
 * 1. Pembaca membalas teks mentah apa adanya kalau header `X-Return-Format: text` dipasang (diuji:
 *    1.595 karakter, sama persis dengan isi paste-nya). Tanpa header itu, balasannya dibungkus
 *    empat baris metadata yang harus dipotong manual.
 * 2. Paste yang tidak ada BUKAN galat HTTP: pembaca tetap membalas `200` berisi halaman
 *    "Not Found (#404)" milik Pastebin. Jadi status saja tidak cukup untuk memutuskan berhasil,
 *    isinya harus diperiksa lebih dulu lewat `looksLikeQuizTemplate`.
 *
 * Gambar lokal tidak bisa ikut lewat jalur ini: yang berpindah hanya teksnya. Baris `Image:` yang
 * menunjuk alamat online tetap jalan, sedangkan nama berkas lokal muncul di layar Siap sebagai
 * gambar yang belum dipasang.
 */

/** Alamat pembaca yang dipakai. Dipisah sebagai konstanta supaya jelas ini satu ketergantungan luar. */
export const READER_PREFIX = 'https://r.jina.ai/';

/**
 * Batas tunggu pengambilan tautan. Paste berisi 20-an soal sekitar 2 KB, jadi 15 detik sudah
 * jauh di atas kebutuhan jaringan sekolah yang wajar, dan tanpa batas ini tombolnya bisa
 * menggantung tanpa kabar.
 */
export const FETCH_TIMEOUT_MS = 15000;

/** Panjang id Pastebin yang wajar. Id aslinya 8 karakter alfanumerik. */
const PASTE_ID_RE = /^[A-Za-z0-9]{6,12}$/;

/**
 * Satu baris soal bernomor. Bentuk ini yang dipakai parser (`^\d+[.)]`), jadi pemeriksaan di sini
 * dan di sana tidak bisa berbeda arti.
 */
const QUESTION_LINE_RE = /^\s*\d+[.)]\s*\S/m;

/** Tanpa baris `Answer:` tidak ada satu pun soal yang bisa dibaca parser, apa pun isi lainnya. */
const ANSWER_LINE_RE = /^\s*answer\s*:/im;

/**
 * Tautan Pastebin apa pun jadi alamat raw-nya, atau `null` kalau tautannya bukan Pastebin.
 *
 * Diterima: `pastebin.com/raw/<id>`, `pastebin.com/<id>`, `pastebin.com/dl/<id>`, dengan atau tanpa
 * `https://`, dengan atau tanpa `www.`, dan tahan query, hash, atau garis miring di ujung. Guru
 * biasanya menyalin tautan dari bilah alamat, bukan mengetik bentuk raw-nya, jadi kedua bentuk itu
 * harus sama-sama jalan.
 */
export function pastebinRawUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  // Tanpa skema, `new URL` menolaknya; guru sering menempel mulai dari "pastebin.com/...".
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'pastebin.com') return null;

  const segments = url.pathname.split('/').filter((segment) => segment !== '');
  // /raw/<id> dan /dl/<id> punya penanda di depan id-nya; /<id> langsung id.
  const id = segments[0] === 'raw' || segments[0] === 'dl' ? segments[1] : segments[0];
  if (!id || !PASTE_ID_RE.test(id)) return null;

  return `https://pastebin.com/raw/${id}`;
}

/**
 * Apakah teks ini benar-benar berisi soal? Dipakai sebelum parser dijalankan, supaya halaman 404
 * Pastebin atau halaman web biasa tidak berakhir sebagai "Belum ada soal yang terbaca" yang
 * menyesatkan. Syaratnya sengaja sama dengan syarat minimum parser: satu baris soal bernomor dan
 * satu baris `Answer:`.
 */
export function looksLikeQuizTemplate(text: string): boolean {
  return QUESTION_LINE_RE.test(text) && ANSWER_LINE_RE.test(text);
}

export type FetchPasteResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * Mengambil isi tautan raw lewat pembaca. Selalu mengembalikan hasil, tidak pernah melempar:
 * pemanggilnya adalah tombol di layar impor, dan satu kalimat galat yang jelas lebih berguna
 * daripada satu pengecualian yang tidak tertangkap.
 */
export async function fetchPastebinText(rawUrl: string): Promise<FetchPasteResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${READER_PREFIX}${rawUrl}`, {
      headers: { 'X-Return-Format': 'text' },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Pembaca tautan menolak permintaan ini (kode ${response.status}). Tunggu sebentar, lalu coba lagi.`,
      };
    }

    const text = await response.text();
    if (!looksLikeQuizTemplate(text)) {
      return {
        ok: false,
        error:
          'Tautan ini tidak berisi soal. Periksa apakah pastenya publik dan tautannya benar, contoh: https://pastebin.com/raw/nic0NZze.',
      };
    }

    return { ok: true, text };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        ok: false,
        error: `Pengambilan tautan melebihi ${Math.round(FETCH_TIMEOUT_MS / 1000)} detik. Coba lagi, atau buka tautannya lalu tempel isinya di tab Tempel teks.`,
      };
    }
    return {
      ok: false,
      error:
        'Tautan ini belum bisa diambil. Periksa sambungan internet, lalu coba lagi atau pakai tab Tempel teks.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
