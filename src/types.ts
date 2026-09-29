export type QuestionType = 'multiple-choice' | 'short-answer';

/**
 * Satu gambar milik soal. `origin` memisahkan dua jalan yang berbeda: gambar online dipakai
 * langsung dari alamatnya, sedangkan gambar lokal harus dibaca dari berkas di PC guru lebih dulu
 * (jadi ia bisa berstatus belum dipasang). Penyimpanan berkasnya ada di `src/images.ts`.
 */
export interface QuestionImage {
  /** Apa yang ditulis guru di template: nama berkas atau alamat online. */
  source: string;
  origin: 'local' | 'remote';
  /** '' kalau berkas lokalnya belum dipasang; Data URL untuk lokal, URL untuk online. */
  src: string;
  /** Deskripsi gambar (teks setelah tanda |), '' kalau guru tidak menulisnya. */
  alt: string;
}

export interface BaseQuestion {
  id: number;
  type: QuestionType;
  text: string;
  /** Opsional supaya soal tanpa gambar tidak perlu menulis field kosong di mana-mana. */
  images?: QuestionImage[];
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice';
  options: [string, string, string, string];
  correctAnswer: number; // 0-3 index
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: 'short-answer';
  acceptedAnswers: string[]; // already trimmed, at least 1 item
}

export type Question = MultipleChoiceQuestion | ShortAnswerQuestion;

export interface Quiz {
  title: string;
  questions: Question[];
  originalQuestions: Question[]; // before shuffle
}

export type QuizMode = 'daily' | 'practice';

/** Tampilan aplikasi. Pilihan guru, bukan turunan setelan sistem. */
export type Theme = 'light' | 'dark';

export type PresentationState =
  | 'idle'
  | 'countdown'
  | 'question-active'
  | 'time-warning'
  | 'time-up'
  | 'answer-reveal'
  | 'transitioning'
  | 'quiz-complete';

export interface QuizConfig {
  mode: QuizMode;
  timerDuration: number; // seconds, multiple-choice questions
  shortAnswerTimerDuration: number; // seconds, short-answer questions
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  soundEnabled: boolean;
  volume: number; // 0-1
  soundTransitions: boolean;
  soundWarning: boolean;
  soundTimeUp: boolean;
  soundComplete: boolean;
}

export interface QuizState {
  quiz: Quiz | null;
  config: QuizConfig;
  currentQuestionIndex: number;
  remainingTime: number;
  isPaused: boolean;
  presentationState: PresentationState;
  isFullscreen: boolean;
}

export type AppScreen = 'import' | 'setup' | 'presentation' | 'complete';

export interface ParseResult {
  success: boolean;
  quiz?: Quiz;
  error?: string;
  errorQuestion?: number;
}
