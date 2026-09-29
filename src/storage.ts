import type { Quiz, QuizConfig, Question, QuestionImage, Theme } from './types.js';

/**
 * One-slot session store: the quiz that was last open, its configuration, and the question the
 * teacher was on. It holds question content only, never student data, and it never leaves the
 * machine. Every access is guarded: a browser in private mode or a full quota must not break
 * the quiz, it only costs the teacher the resume card.
 */

const STORAGE_KEY = 'quizboard.session.v1';
const SESSION_VERSION = 1;

/**
 * Plafon ukuran JSON sesi, di bawah kuota localStorage (5 MB) yang dihitung per karakter.
 * Gambar lokal yang ikut ke dalam sesi adalah satu-satunya hal yang bisa mendekati batas ini,
 * dan itulah alasan pengecilan gambar di `src/images.ts` ada.
 */
const MAX_SESSION_CHARS = 3_000_000;

/**
 * Tema disimpan terpisah dari sesi kuis, bukan sebagai bagian `QuizConfig`.
 * Sesi hanya ditulis saat ada kuis terbuka, jadi tema yang dititipkan di sana akan hilang
 * begitu guru menutup aplikasi di layar impor. Tema ini pilihan perangkat proyektor, jadi ia
 * punya slotnya sendiri dan tidak pernah menunggu kuis dimuat.
 */
const THEME_KEY = 'quizboard.theme.v1';

export interface SavedSession {
  version: number;
  savedAt: number;
  quiz: Quiz;
  config: Partial<QuizConfig>;
  currentQuestion: number;
  wasPresenting: boolean;
  /** true kalau sebagian gambar tidak ikut tersimpan karena ukurannya. Dibaca kartu lanjutkan. */
  imagesOmitted?: boolean;
}

let storageBlocked = false;

function storageAvailable(): boolean {
  if (storageBlocked) return false;
  try {
    const probe = `quizboard.probe.${Date.now()}`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    storageBlocked = true;
    return false;
  }
}

function isQuestion(value: unknown): value is Question {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { id?: unknown; type?: unknown; text?: unknown };
  if (typeof candidate.id !== 'number' || typeof candidate.text !== 'string') return false;

  if (candidate.type === 'multiple-choice') {
    const mc = candidate as { options?: unknown; correctAnswer?: unknown };
    return (
      Array.isArray(mc.options) &&
      mc.options.length === 4 &&
      mc.options.every((option) => typeof option === 'string') &&
      typeof mc.correctAnswer === 'number' &&
      mc.correctAnswer >= 0 &&
      mc.correctAnswer <= 3
    );
  }

  if (candidate.type === 'short-answer') {
    const sa = candidate as { acceptedAnswers?: unknown };
    return (
      Array.isArray(sa.acceptedAnswers) &&
      sa.acceptedAnswers.length > 0 &&
      sa.acceptedAnswers.every((answer) => typeof answer === 'string')
    );
  }

  return false;
}

/**
 * Gambar yang bentuknya aneh dibuang satu per satu. Satu entri rusak tidak boleh menggagalkan
 * seluruh sesi: guru lebih butuh posisi soalnya kembali daripada gambar yang gagal dibaca.
 */
function readImages(value: unknown): QuestionImage[] {
  if (!Array.isArray(value)) return [];

  const images: QuestionImage[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const raw = entry as Record<string, unknown>;
    if (typeof raw.source !== 'string' || typeof raw.src !== 'string') continue;
    if (raw.origin !== 'local' && raw.origin !== 'remote') continue;

    images.push({
      source: raw.source,
      origin: raw.origin,
      src: raw.src,
      alt: typeof raw.alt === 'string' ? raw.alt : '',
    });
  }
  return images;
}

function sanitizeQuestion(question: Question): Question {
  if (question.images === undefined) return question;
  const images = readImages(question.images);
  return { ...question, images: images.length > 0 ? images : undefined };
}

/** Whitelist known config keys with a type check each, so a stale or edited payload cannot leak in. */
function pickConfig(value: unknown): Partial<QuizConfig> {
  if (typeof value !== 'object' || value === null) return {};
  const raw = value as Record<string, unknown>;
  const config: Partial<QuizConfig> = {};

  if (raw.mode === 'daily' || raw.mode === 'practice') config.mode = raw.mode;
  if (typeof raw.timerDuration === 'number' && Number.isFinite(raw.timerDuration)) {
    config.timerDuration = raw.timerDuration;
  }
  if (typeof raw.shortAnswerTimerDuration === 'number' && Number.isFinite(raw.shortAnswerTimerDuration)) {
    config.shortAnswerTimerDuration = raw.shortAnswerTimerDuration;
  }
  if (typeof raw.volume === 'number' && Number.isFinite(raw.volume)) config.volume = raw.volume;
  if (typeof raw.shuffleQuestions === 'boolean') config.shuffleQuestions = raw.shuffleQuestions;
  if (typeof raw.shuffleAnswers === 'boolean') config.shuffleAnswers = raw.shuffleAnswers;
  if (typeof raw.soundEnabled === 'boolean') config.soundEnabled = raw.soundEnabled;
  if (typeof raw.soundTransitions === 'boolean') config.soundTransitions = raw.soundTransitions;
  if (typeof raw.soundWarning === 'boolean') config.soundWarning = raw.soundWarning;
  if (typeof raw.soundTimeUp === 'boolean') config.soundTimeUp = raw.soundTimeUp;
  if (typeof raw.soundComplete === 'boolean') config.soundComplete = raw.soundComplete;

  return config;
}

export interface SaveOutcome {
  saved: boolean;
  /** true kalau gambar lokal harus dilepas supaya sesi tetap muat disimpan. */
  imagesOmitted: boolean;
}

/**
 * Versi paling ringan dari kuis: isi berkas gambar lokal dilepas, nama berkasnya tetap ada.
 * Kalau sesi harus disimpan dalam bentuk ini, guru tetap melihat gambar mana yang perlu dipasang
 * ulang lewat panel Gambar, jadi kehilangannya kelihatan dan bisa diperbaiki, bukan hilang diam.
 */
function stripLocalImageData(quiz: Quiz): Quiz {
  const strip = (question: Question): Question => {
    const images = question.images;
    if (!images || !images.some((image) => image.origin === 'local' && image.src !== '')) return question;
    return {
      ...question,
      images: images.map((image) => (image.origin === 'local' ? { ...image, src: '' } : image)),
    };
  };

  return {
    ...quiz,
    questions: quiz.questions.map(strip),
    originalQuestions: quiz.originalQuestions.map(strip),
  };
}

/**
 * Menyimpan sesi, dan kalau terlalu besar, menyimpannya dalam bentuk yang lebih ringan.
 * Perilaku lama (satu galat kuota langsung memblokir semua penulisan berikutnya) membuat sesi
 * tidak pernah tersimpan lagi walau guru kemudian menghapus gambarnya.
 */
export function saveSession(session: Omit<SavedSession, 'version' | 'savedAt'>): SaveOutcome {
  if (!storageAvailable()) return { saved: false, imagesOmitted: false };

  const base = { ...session, version: SESSION_VERSION, savedAt: Date.now() };
  const candidates: SavedSession[] = [
    { ...base, imagesOmitted: session.imagesOmitted === true },
    { ...base, quiz: stripLocalImageData(base.quiz), imagesOmitted: true },
  ];

  for (const payload of candidates) {
    let json: string;
    try {
      json = JSON.stringify(payload);
    } catch {
      continue;
    }
    if (json.length > MAX_SESSION_CHARS) continue;

    try {
      window.localStorage.setItem(STORAGE_KEY, json);
      return { saved: true, imagesOmitted: payload.imagesOmitted === true };
    } catch {
      // Kemungkinan besar kuota penuh: coba kandidat yang lebih ringan. Akses storage yang
      // diblokir sudah tertangkap storageAvailable(), jadi di sini tidak ada gunanya memblokir
      // penyimpanan untuk sisa aplikasi.
    }
  }

  return { saved: false, imagesOmitted: false };
}

export function loadSession(): SavedSession | null {
  if (!storageAvailable()) return null;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    storageBlocked = true;
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SavedSession>;
    if (parsed.version !== SESSION_VERSION) return null;

    const quiz = parsed.quiz as Partial<Quiz> | undefined;
    if (!quiz || typeof quiz.title !== 'string') return null;

    const stored = quiz.questions;
    if (!Array.isArray(stored) || stored.length === 0 || !stored.every(isQuestion)) return null;
    const questions: Question[] = stored.map(sanitizeQuestion);

    const storedOriginal = quiz.originalQuestions;
    const originalQuestions =
      Array.isArray(storedOriginal) && storedOriginal.length > 0 && storedOriginal.every(isQuestion)
        ? storedOriginal.map(sanitizeQuestion)
        : questions;

    return {
      version: SESSION_VERSION,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      quiz: { title: quiz.title, questions, originalQuestions },
      imagesOmitted: parsed.imagesOmitted === true,
      config: pickConfig(parsed.config),
      currentQuestion:
        typeof parsed.currentQuestion === 'number' && parsed.currentQuestion >= 0
          ? Math.floor(parsed.currentQuestion)
          : 0,
      wasPresenting: parsed.wasPresenting === true,
    };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    storageBlocked = true;
  }
}

/**
 * Tema tersimpan, atau null kalau belum pernah dipilih atau storage tidak bisa dibaca.
 * Pemanggil yang memutuskan nilai awalnya, jadi fungsi ini tidak menebak.
 */
export function loadTheme(): Theme | null {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    storageBlocked = true;
    return null;
  }
}

export function saveTheme(theme: Theme): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    storageBlocked = true;
  }
}

/** Human age of the saved session, used on the resume card. */
export function describeSavedAt(savedAt: number, now: number = Date.now()): string {
  const minutes = Math.floor((now - savedAt) / 60000);
  if (minutes < 1) return 'disimpan beberapa detik lalu';
  if (minutes < 60) return `disimpan ${minutes} menit lalu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `disimpan ${hours} jam lalu`;

  const days = Math.floor(hours / 24);
  return `disimpan ${days} hari lalu`;
}
