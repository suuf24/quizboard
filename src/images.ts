import type { Question, QuestionImage } from './types.js';

/**
 * Berkas gambar untuk soal.
 *
 * Aplikasi ini tidak punya server, jadi dua jalan yang berbeda disatukan di sini:
 *
 * 1. Gambar online cuma alamat. Tidak ada yang perlu dibaca, tidak ada yang perlu disimpan.
 * 2. Gambar lokal harus dibaca dari PC guru dan diubah jadi Data URL supaya ia ikut tersimpan di
 *    sesi dan tetap tampil setelah aplikasi dibuka ulang. Nama berkas di template dicocokkan
 *    dengan berkas yang dipilih guru saat impor.
 *
 * Pengecilan di sini bukan hiasan: foto 4000 px dari ponsel akan menghabiskan kuota localStorage
 * (5 MB) dan membuat setiap penulisan sesi lambat. Batas 1600 px dipilih karena proyektor kelas
 * 1080p tidak butuh lebih, dan cetak pada lebar 15 cm masih sekitar 270 dpi.
 */

/** Lebih dari tiga gambar di satu slide tidak lagi terbaca dari baris belakang kelas. */
export const MAX_IMAGES_PER_QUESTION = 3;

/** Berkas lebih besar dari ini hampir pasti bukan gambar soal, dan menolaknya lebih cepat. */
export const MAX_LOCAL_IMAGE_BYTES = 25 * 1024 * 1024;

/** Batas jumlah gambar per impor; di atas ini guru hampir pasti salah menyeret folder. */
export const MAX_IMPORT_IMAGES = 40;

const MAX_FOLDER_DEPTH = 4;
const MAX_EDGE = 1600;
/** Di bawah batas ini berkas dipakai apa adanya, jadi GIF animasi dan PNG kecil tetap utuh. */
const KEEP_IMAGE_BYTES = 400 * 1024;

export type ImageOrigin = 'local' | 'remote';

/**
 * Soal lama (dan soal tanpa gambar) tidak menulis field `images`, jadi aksesnya lewat sini.
 * Menerima soal kosong juga karena pemanggilnya sering memegang soal yang belum tentu ada.
 */
export function imagesOf(question: Question | null): QuestionImage[] {
  return question?.images ?? [];
}

export function isRemoteSource(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

/** Skema apa pun (javascript:, file:, data:) bukan alamat online yang kita izinkan. */
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export function classifySource(source: string): ImageOrigin | 'invalid' {
  if (isRemoteSource(source)) return 'remote';
  if (SCHEME_RE.test(source)) return 'invalid';
  return 'local';
}

/**
 * Nama berkas dinormalkan supaya "Gambar/Paru-Paru.PNG" tetap ketemu "paru-paru.png":
 * huruf kecil, tanpa folder, dan bentuk Unicode yang sama.
 */
export function normalizeName(name: string): string {
  const base = name.trim().replace(/\\/g, '/').split('/').pop() ?? name;
  return base.normalize('NFC').toLowerCase();
}

export function isTemplateFile(file: File): boolean {
  return /\.(txt|text)$/i.test(file.name) || file.type === 'text/plain';
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i.test(file.name);
}

export interface ImportSelection {
  template: File | null;
  images: File[];
  /** Berkas yang dilewati karena bukan berkas soal dan bukan gambar. */
  skipped: number;
}

export function splitSelection(files: File[]): ImportSelection {
  const selection: ImportSelection = { template: null, images: [], skipped: 0 };

  for (const file of files) {
    if (!selection.template && isTemplateFile(file)) {
      selection.template = file;
      continue;
    }
    if (isImageFile(file)) {
      if (selection.images.length < MAX_IMPORT_IMAGES) selection.images.push(file);
      else selection.skipped += 1;
      continue;
    }
    selection.skipped += 1;
  }

  return selection;
}

// ===== MENGUMPULKAN BERKAS DARI SERETAN =====

/** `webkitGetAsEntry` harus dipanggil saat event masih berjalan, sebelum await pertama. */
function entryFromItem(item: DataTransferItem): FileSystemEntry | null {
  if (item.kind !== 'file') return null;
  const getEntry = (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null })
    .webkitGetAsEntry;
  if (typeof getEntry !== 'function') return null;
  try {
    return getEntry.call(item);
  } catch {
    return null;
  }
}

function fileFromEntry(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      () => resolve(null)
    );
  });
}

/**
 * `readEntries` mengembalikan paling banyak 100 entri per panggilan, jadi ia harus dipanggil
 * berulang sampai batch kosong. Tanpa loop ini folder dengan lebih dari 100 berkas terpotong diam.
 */
function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    const all: FileSystemEntry[] = [];
    const step = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(all);
            return;
          }
          all.push(...batch);
          step();
        },
        () => resolve(all)
      );
    };
    step();
  });
}

async function walkEntry(entry: FileSystemEntry, depth: number, out: File[]): Promise<void> {
  if (out.length > MAX_IMPORT_IMAGES) return;

  if (entry.isFile) {
    const file = await fileFromEntry(entry as FileSystemFileEntry);
    if (file) out.push(file);
    return;
  }

  if (!entry.isDirectory || depth >= MAX_FOLDER_DEPTH) return;

  const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
  for (const child of children) await walkEntry(child, depth + 1, out);
}

/**
 * Satu folder biasanya berisi berkas soal dan gambarnya, jadi folder yang diseret harus bisa
 * dibaca isinya. Kalau browser tidak memberi akses entri, jatuh ke daftar berkas datar.
 */
export async function collectFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];
  const entries = items.map(entryFromItem);

  if (entries.every((entry) => entry === null)) return Array.from(dataTransfer.files);

  const files: File[] = [];
  for (const entry of entries) {
    if (entry) await walkEntry(entry, 0, files);
  }
  return files;
}

// ===== MEMBACA BERKAS GAMBAR =====

/** Pesan di kelas, bukan pesan teknis: guru yang membacanya harus tahu harus berbuat apa. */
export class ImageReadError extends Error {}

export interface NormalizedImage {
  src: string;
  originalBytes: number;
  finalBytes: number;
  scaled: boolean;
}

interface DecodedImage {
  width: number;
  height: number;
  drawable: CanvasImageSource;
  cleanup: () => void;
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ImageReadError('format gambar tidak dikenali'));
    image.src = url;
  });
}

/**
 * Dua jalur karena keduanya punya lubang masing-masing: `createImageBitmap` cepat dan menghormati
 * rotasi EXIF, tetapi SVG tanpa ukuran intrinsik bisa ditolaknya; elemen <img> menerima SVG itu,
 * jadi ia dipakai sebagai cadangan.
 */
async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        width: bitmap.width,
        height: bitmap.height,
        drawable: bitmap,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // lanjut ke <img>
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(url);
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      drawable: image,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ImageReadError('berkas tidak bisa dibaca'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Berkas yang sudah muat dipakai apa adanya, byte per byte. Pengecilan hanya terjadi kalau perlu,
 * supaya gambar yang sudah benar tidak mengalami generasi ulang yang membuang ketajaman dan
 * mematikan animasi GIF.
 */
async function normalizeImageFile(file: File): Promise<NormalizedImage> {
  if (file.size > MAX_LOCAL_IMAGE_BYTES) {
    throw new ImageReadError('berkas lebih dari 25 MB');
  }

  const decoded = await decodeImage(file);
  try {
    if (decoded.width === 0 || decoded.height === 0) {
      throw new ImageReadError('gambar tidak punya ukuran yang bisa dibaca');
    }

    const longEdge = Math.max(decoded.width, decoded.height);
    if (longEdge <= MAX_EDGE && file.size <= KEEP_IMAGE_BYTES) {
      return { src: await readBlobAsDataUrl(file), originalBytes: file.size, finalBytes: file.size, scaled: false };
    }

    const scale = Math.min(1, MAX_EDGE / longEdge);
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new ImageReadError('gambar tidak bisa dikecilkan di peramban ini');
    context.imageSmoothingQuality = 'high';
    context.drawImage(decoded.drawable, 0, 0, width, height);

    // WebP dulu: mendukung transparansi dan jauh lebih kecil dari PNG untuk foto. PNG dipakai
    // kalau peramban tidak bisa meng-encode WebP, jadi tidak ada gambar yang hilang karena format.
    const webp = await canvasToBlob(canvas, 'image/webp', 0.9);
    const blob = webp && webp.type === 'image/webp' ? webp : await canvasToBlob(canvas, 'image/png');
    if (!blob) throw new ImageReadError('gambar tidak bisa dikecilkan di peramban ini');

    return { src: await readBlobAsDataUrl(blob), originalBytes: file.size, finalBytes: blob.size, scaled: true };
  } finally {
    decoded.cleanup();
  }
}

/** Di-cache supaya berkas yang dipakai dua soal hanya dibaca sekali. */
export function normalizeImage(file: File, cache?: Map<File, Promise<NormalizedImage>>): Promise<NormalizedImage> {
  const cached = cache?.get(file);
  if (cached) return cached;
  const task = normalizeImageFile(file);
  cache?.set(file, task);
  return task;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function describeResize(fileName: string, result: NormalizedImage): string {
  return `${fileName}: ${formatBytes(result.originalBytes)} jadi ${formatBytes(result.finalBytes)}, sisi terpanjang dikecilkan ke ${MAX_EDGE} px`;
}

// ===== MENCOCOKKAN GAMBAR DENGAN SOAL =====

export interface ImageAttachReport {
  attached: number;
  /** Satu kalimat per gambar yang gagal dibaca, siap ditampilkan di layar Siap. */
  failed: string[];
  /** Satu kalimat per gambar yang dikecilkan, supaya guru tahu berkasnya tidak rusak. */
  resized: string[];
}

function isUnresolvedLocal(image: QuestionImage): boolean {
  return image.origin === 'local' && image.src === '';
}

export function hasUnresolvedLocalImages(questions: Question[]): boolean {
  return questions.some((question) => imagesOf(question).some(isUnresolvedLocal));
}

export interface AttachedImages {
  questions: Question[];
  report: ImageAttachReport;
}

/**
 * Memasang berkas gambar yang dipilih guru ke soal yang menyebut namanya. Soal yang gambar lokalnya
 * tidak ketemu dibiarkan apa adanya, bukan digagalkan: kuis tetap bisa dibuka, dan layar Siap yang
 * memberi tahu guru gambar mana yang masih kurang.
 */
export async function attachLocalImages(questions: Question[], files: File[]): Promise<AttachedImages> {
  const report: ImageAttachReport = { attached: 0, failed: [], resized: [] };
  if (files.length === 0 || !hasUnresolvedLocalImages(questions)) return { questions, report };

  const index = new Map<string, File>();
  for (const file of files) {
    const key = normalizeName(file.name);
    if (!index.has(key)) index.set(key, file);
  }

  const cache = new Map<File, Promise<NormalizedImage>>();
  const next: Question[] = [];

  for (const question of questions) {
    const images = imagesOf(question);
    if (!images.some(isUnresolvedLocal)) {
      next.push(question);
      continue;
    }

    const updated = [...images];
    let changed = false;

    for (let i = 0; i < updated.length; i += 1) {
      const image = updated[i];
      if (!isUnresolvedLocal(image)) continue;

      const file = index.get(normalizeName(image.source));
      if (!file) continue;

      try {
        const result = await normalizeImage(file, cache);
        updated[i] = { ...image, src: result.src };
        changed = true;
        report.attached += 1;
        if (result.scaled) report.resized.push(describeResize(file.name, result));
      } catch (error) {
        report.failed.push(
          `${file.name}: ${error instanceof ImageReadError ? error.message : 'berkas ini tidak bisa dibaca sebagai gambar'}`
        );
      }
    }

    next.push(changed ? { ...question, images: updated } : question);
  }

  return { questions: next, report };
}

/**
 * Mengganti satu gambar pada satu soal tanpa mengubah array di tempat. Dua daftar soal
 * (`questions` dan `originalQuestions`) memakai objek soal yang sama selama guru masih di layar
 * Siap, jadi penggantian harus menghasilkan objek baru supaya React dan sesi tersimpan sama-sama
 * melihat perubahan yang sama.
 */
export function withImageAt(
  questions: Question[],
  questionIndex: number,
  imageIndex: number,
  patch: Partial<QuestionImage>
): Question[] {
  return questions.map((question, index) => {
    if (index !== questionIndex) return question;
    const images = imagesOf(question);
    if (imageIndex < 0 || imageIndex >= images.length) return question;
    return {
      ...question,
      images: images.map((image, i) => (i === imageIndex ? { ...image, ...patch } : image)),
    };
  });
}
