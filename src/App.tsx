import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import './App.css';
import type { Quiz, QuizConfig, QuizMode, PresentationState, AppScreen, ParseResult, Question, QuestionImage, Theme } from './types';
import { parseQuizTemplate, shuffleArray } from './parser.js';
import { demoQuiz } from './demo.js';
import { clearSession, describeSavedAt, loadSession, loadTheme, saveSession, saveTheme } from './storage.js';
import { SOAL_PROMPT, chatGptPlainUrl, chatGptPrefillUrl, copyText } from './soal-prompt.js';
import { fetchPastebinText, pastebinRawUrl } from './pastebin.js';
import type { SavedSession } from './storage.js';
import {
  ImageReadError,
  attachLocalImages,
  collectFromDataTransfer,
  describeResize,
  formatBytes,
  imagesOf,
  normalizeImage,
  splitSelection,
  withImageAt,
} from './images.js';
import {
  initAudio,
  playQuizStart,
  playQuestionStart,
  playWarningTick,
  playCountdownBeep,
  playTimeUp,
  playTransition,
  playComplete,
} from './audio.js';
import {
  IconAlert,
  IconCheck,
  IconChevronDown,
  IconClose,
  IconCollapse,
  IconDownload,
  IconExpand,
  IconExternal,
  IconEye,
  IconFolder,
  IconImage,
  IconKey,
  IconMute,
  IconNext,
  IconPause,
  IconPlay,
  IconPrint,
  IconSound,
} from './icons';

// ===== COMPLETION MASCOT =====
/* Satu karakter, dan hanya di layar selesai. Sebelumnya ada 21 GIF yang berjalan melintasi
   layar soal setiap 17 detik, dengan gerak 14 detik yang menyimpang dari dial MOTION 2 dan
   isi yang sebagian besar karakter milik pihak lain. */
const COMPLETION_MASCOT = '/mascot.gif';

/* ===== TRANSISI GANTI SOAL =====
   Satu angka untuk seluruh pergantian soal: overlay "Soal berikutnya" ditahan selama ini, lalu
   soal berikutnya masuk dengan animasi yang sama lamanya. Nilainya harus tetap sama dengan token
   `--md-sys-motion-duration-long3` di App.css; kalau salah satu berubah sendirian, overlay dan
   animasinya berhenti terasa sebagai satu gerakan. */
const TRANSISI_SOAL_MS = 750;

// ===== TIMER SETTINGS =====
const TIMER_MIN = 5;
const TIMER_MAX = 300;
const MC_TIMER_PRESETS = [15, 20, 30, 45, 60, 90, 120];
const SA_TIMER_PRESETS = [30, 45, 60, 90, 120, 180];

function clampTimer(value: number): number {
  return Math.max(TIMER_MIN, Math.min(TIMER_MAX, value));
}

/** Duration in seconds for a question. Short-answer questions use their own timer. */
function durationForQuestion(question: Question | null, config: QuizConfig): number {
  return question?.type === 'short-answer' ? config.shortAnswerTimerDuration : config.timerDuration;
}

// ===== DEFAULT CONFIG =====
const defaultConfig: QuizConfig = {
  mode: 'daily',
  timerDuration: 30,
  shortAnswerTimerDuration: 60,
  shuffleQuestions: false,
  shuffleAnswers: false,
  soundEnabled: true,
  volume: 0.6,
  soundTransitions: true,
  soundWarning: true,
  soundTimeUp: true,
  soundComplete: true,
};

// Catatan: kontrak prefers-reduced-motion sekarang hanya dipegang CSS di akhir App.css.
// Hook di JavaScript tidak lagi diperlukan sejak satu-satunya penggunanya (maskot berjalan)
// dihapus; tidak ada lagi gerak yang dijalankan dari sisi React.

// ===== PREVIEW PANEL (SETUP SCREEN) =====
interface QuizPreviewProps {
  title: string;
  questions: Question[];
  index: number;
  direction: 'next' | 'prev';
  duration: number;
  revealed: boolean;
  shuffleActive: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleReveal: () => void;
  onClose: () => void;
}

/**
 * Step-by-step preview of the quiz as it will appear on screen. Read-only: it never
 * touches quiz state or config, it only lets the teacher check questions and answers
 * (and the timer setting) before the quiz is shown to the class.
 */
function QuizPreview({
  title,
  questions,
  index,
  direction,
  duration,
  revealed,
  shuffleActive,
  onPrev,
  onNext,
  onToggleReveal,
  onClose,
}: QuizPreviewProps) {
  const question = questions[index] ?? null;
  if (!question) return null;

  const mcCount = questions.filter((q) => q.type === 'multiple-choice').length;
  const saCount = questions.length - mcCount;
  const isFirst = index === 0;
  const isLast = index === questions.length - 1;
  const correctLetter = question.type === 'multiple-choice' ? String.fromCharCode(65 + question.correctAnswer) : '';

  return (
    <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Preview soal">
      <div className="preview-header">
        <div className="preview-header__text">
          <div className="preview-header__title">Preview Soal</div>
          <div className="preview-header__meta">
            {title} · {questions.length} soal · {mcCount} pilihan ganda · {saCount} isian singkat
          </div>
        </div>
        <button className="btn btn--icon-only" onClick={onClose} aria-label="Tutup pratinjau">
          <IconClose />
        </button>
      </div>

      {shuffleActive && (
        <div className="preview-note">
          Acak soal aktif. Pratinjau menampilkan urutan asli berkas; pengacakan baru terjadi saat kuis dimulai.
        </div>
      )}

      <div className="preview-body">
        <div className={`preview-slide preview-slide--${direction}`} key={index}>
          <div className="question-meta">
            <span className={`question-type-chip question-type-chip--${question.type}`}>
              {question.type === 'short-answer' ? 'Isian Singkat' : 'Pilihan Ganda'}
            </span>
            <span className="question-type-chip question-type-chip--timer">{duration} detik</span>
          </div>

          <div className="preview-question-text">{question.text}</div>

          <QuestionFigure
            key={`preview-figure-${index}`}
            images={imagesOf(question)}
            questionNumber={index + 1}
          />

          {question.type === 'multiple-choice' ? (
            <div className="answer-grid">
              {question.options.map((opt, i) => (
                <div
                  key={i}
                  className={`answer-card ${revealed && i === question.correctAnswer ? 'answer-card--reveal-correct' : ''}`}
                >
                  <div className="answer-card__letter">{String.fromCharCode(65 + i)}</div>
                  <div className="answer-card__text">{opt}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`short-answer-card ${revealed ? 'short-answer-card--reveal' : ''}`}>
              {revealed ? (
                <div className="short-answer-card__answer">
                  {question.acceptedAnswers.join(' / ')}
                </div>
              ) : (
                <div className="short-answer-card__placeholder">
                  <span>Jawaban</span>
                  <span className="short-answer-card__hint" aria-hidden="true" />
                </div>
              )}
            </div>
          )}

          {revealed && (
            <div className="preview-answer" key={`${index}-answer`}>
              <span className="preview-answer__label">Jawaban</span>
              <span className="preview-answer__value">
                {question.type === 'multiple-choice'
                  ? `${correctLetter}. ${question.options[question.correctAnswer]}`
                  : question.acceptedAnswers.join(' / ')}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="preview-footer">
        <div className="preview-footer__nav">
          <button className="btn btn--outlined" onClick={onPrev} disabled={isFirst} aria-label="Soal sebelumnya">
            ‹ Sebelumnya
          </button>
          <span className="preview-counter">
            {String(index + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
          </span>
          <button className="btn btn--outlined" onClick={onNext} disabled={isLast} aria-label="Soal berikutnya">
            Berikutnya ›
          </button>
        </div>
        <div className="preview-footer__actions">
          <button
            className={`btn ${revealed ? 'btn--secondary' : 'btn--primary'}`}
            onClick={onToggleReveal}
            aria-pressed={revealed}
          >
            {revealed ? '🙈 Sembunyikan Jawaban' : '👁 Lihat Jawaban'}
          </button>
          <div className="preview-hint">← → ganti soal · J lihat jawaban · Esc tutup</div>
        </div>
      </div>
    </div>
  );
}

// ===== PRINTABLE ANSWER KEY =====
/**
 * Print-only sheet, rendered through a portal so no fixed, overflow-hidden ancestor can clip it.
 * It mirrors the on-screen answer key panel: original file order, full question text.
 */
function AnswerKeySheet({ title, questions }: { title: string; questions: Question[] }) {
  const printedOn = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="print-sheet" aria-hidden="true">
      <header className="print-sheet__head">
        <div className="print-sheet__brand">QuizBoard</div>
        <h1 className="print-sheet__title">Kunci Jawaban</h1>
        <div className="print-sheet__meta">
          {title} · {questions.length} soal · dicetak {printedOn}
        </div>
        <p className="print-sheet__warning">Kunci jawaban. Jangan dibagikan ke siswa.</p>
      </header>

      <table className="print-sheet__table">
        <thead>
          <tr>
            <th className="print-sheet__cell--num">No</th>
            <th className="print-sheet__cell--type">Tipe</th>
            <th className="print-sheet__cell--answer">Jawaban</th>
            <th>Soal</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((question, index) => (
            <tr key={`print-${index}`}>
              <td className="print-sheet__cell--num">{index + 1}</td>
              <td className="print-sheet__cell--type">
                {question.type === 'multiple-choice' ? 'PG' : 'Isian'}
              </td>
              <td className="print-sheet__cell--answer">
                {question.type === 'multiple-choice'
                  ? `${String.fromCharCode(65 + question.correctAnswer)}. ${question.options[question.correctAnswer]}`
                  : question.acceptedAnswers.join(' / ')}
              </td>
              <td>
                {question.text}
                {/* Gambar tanpa isi tetap dicetak sebagai satu baris keterangan: lembar kunci yang
                    diam-diam kehilangan gambarnya akan terbaca sebagai soal yang lain. */}
                {question.images?.map((image, imageIndex) =>
                  image.src !== '' ? (
                    <div className="print-sheet__figure" key={`print-image-${imageIndex}`}>
                      <img src={image.src} alt={image.alt} />
                    </div>
                  ) : (
                    <div
                      className="print-sheet__figure print-sheet__figure--missing"
                      key={`print-image-${imageIndex}`}
                    >
                      Gambar tidak tersedia: {image.source}
                    </div>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ===== QUESTION FIGURE =====
interface QuestionFigureProps {
  images: QuestionImage[];
  questionNumber: number;
  /** Kalau ada, gambar bisa diklik supaya dibuka besar. Presentasi memakainya, pratinjau tidak. */
  onZoom?: (image: QuestionImage) => void;
}

/**
 * Panggung gambar soal. Tingginya bukan angka tetap: ia mengisi sisa ruang antara teks soal dan
 * baris opsi, jadi potret tinggi tidak mendorong opsi keluar layar dan gambar kecil tetap terbaca
 * dari baris belakang. Alasan lengkapnya ada di komentar `.question-figure` di App.css.
 *
 * Gambar yang belum dipasang atau gagal dimuat diganti papan keterangan, bukan ikon gambar rusak:
 * di depan kelas, satu kotak kosong tanpa penjelasan adalah teka-teki, sedangkan tulisan yang
 * menyebut nama berkasnya memberi tahu guru apa yang harus dilakukan.
 */
function QuestionFigure({ images, questionNumber, onZoom }: QuestionFigureProps) {
  // Nomor gambar yang gagal dimuat. Komponen ini dipasang dengan key per soal, jadi daftarnya
  // selalu mulai kosong saat soal berganti.
  const [failed, setFailed] = useState<number[]>([]);

  if (images.length === 0) return null;

  const markFailed = (index: number) => {
    setFailed((prev) => (prev.includes(index) ? prev : [...prev, index]));
  };

  return (
    <div className={`question-figure${images.length > 1 ? ' question-figure--multi' : ''}`}>
      {images.map((image, index) => (
        <div className="question-figure__frame" key={`${image.source}-${index}`}>
          {image.src && !failed.includes(index) ? (
            onZoom ? (
              <button
                type="button"
                className="question-figure__zoom"
                onClick={() => onZoom(image)}
                // Spasi dan Enter juga pintasan jeda; klik pada gambar tidak boleh ikut menjeda.
                onKeyDown={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') event.stopPropagation();
                }}
                title="Perbesar gambar (G)"
                aria-label={`Perbesar gambar soal ${questionNumber}`}
              >
                <img src={image.src} alt={image.alt} draggable={false} onError={() => markFailed(index)} />
              </button>
            ) : (
              <img
                className="question-figure__image"
                src={image.src}
                alt={image.alt}
                draggable={false}
                onError={() => markFailed(index)}
              />
            )
          ) : (
            <div className="question-figure__fallback">
              <div className="question-figure__fallback-title">
                {image.src ? 'Gambar tidak bisa dimuat' : 'Gambar belum dipasang'}
              </div>
              <div className="question-figure__fallback-source">{image.source}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ===== MEDIA PANEL (GAMBAR) =====
interface MediaPanelProps {
  questions: Question[];
  failures: string[];
  notes: string[];
  note: string | null;
  busy: boolean;
  onPick: (questionIndex: number, imageIndex: number) => void;
  onRemove: (questionIndex: number, imageIndex: number) => void;
  onClose: () => void;
}

function describeImageStatus(image: QuestionImage): string {
  if (image.origin === 'remote') return 'alamat online';
  return image.src !== '' ? 'berkas lokal, siap tampil' : 'belum dipasang';
}

/**
 * Daftar gambar kuis. Bentuknya sama dengan panel kunci jawaban (lembar samping dengan daftar
 * yang bisa digulir) karena tugasnya sama: satu daftar panjang yang dibaca sambil kuis masih di
 * layar Siap, tanpa menutupi seluruh layar.
 */
function MediaPanel({ questions, failures, notes, note, busy, onPick, onRemove, onClose }: MediaPanelProps) {
  const rows = questions
    .map((question, index) => ({ question, index }))
    .filter((row) => imagesOf(row.question).length > 0);

  // Thumbnail yang gagal dimuat jatuh ke kotak kosong yang sama dengan gambar yang belum
  // dipasang, jadi tidak ada ikon gambar rusak di daftar ini.
  const [failedThumbs, setFailedThumbs] = useState<string[]>([]);

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="answer-key-panel media-panel" role="dialog" aria-modal="true" aria-labelledby="media-panel-title">
        <div className="answer-key-header">
          <div className="answer-key-header__title" id="media-panel-title">
            Gambar soal
          </div>
          <div className="answer-key-header__actions">
            <button className="btn btn--icon-only" onClick={onClose} aria-label="Tutup daftar gambar">
              <IconClose />
            </button>
          </div>
        </div>

        <div className="answer-key-list">
          <p className="media-panel__hint">
            Nama berkas di baris Image: dicocokkan dengan berkas yang dipilih saat impor. Gambar yang
            belum ada bisa dipasang di sini, dan pilihan itu ikut tersimpan di sesi terakhir.
          </p>

          {rows.length === 0 ? (
            <p className="media-panel__hint">Belum ada soal yang memuat gambar di kuis ini.</p>
          ) : (
            rows.map(({ question, index }) => (
              <div className="media-item" key={index}>
                <div className="media-item__num">{String(index + 1).padStart(2, '0')}</div>
                <div className="media-item__body">
                  <div className="media-item__question">
                    {question.text.length > 70 ? `${question.text.slice(0, 70)}…` : question.text}
                  </div>
                  {imagesOf(question).map((image, imageIndex) => {
                    const thumbKey = `${index}-${imageIndex}`;
                    const thumbVisible = image.src !== '' && !failedThumbs.includes(thumbKey);

                    return (
                      <div className="media-item__row" key={`${image.source}-${imageIndex}`}>
                        {thumbVisible ? (
                          <img
                            className="media-item__thumb"
                            src={image.src}
                            alt=""
                            onError={() =>
                              setFailedThumbs((prev) => (prev.includes(thumbKey) ? prev : [...prev, thumbKey]))
                            }
                          />
                        ) : (
                          <div className="media-item__thumb media-item__thumb--empty" aria-hidden="true" />
                        )}
                        <div className="media-item__meta">
                          <div className="media-item__source">{image.source}</div>
                          <div className="media-item__status">{describeImageStatus(image)}</div>
                        </div>
                        {image.origin === 'local' && (
                          <div className="media-item__actions">
                            <button
                              className="btn btn--outlined btn--small"
                              onClick={() => onPick(index, imageIndex)}
                              disabled={busy}
                            >
                              {image.src !== '' ? 'Ganti' : 'Pilih berkas'}
                            </button>
                            {image.src !== '' && (
                              <button
                                className="btn btn--text btn--small"
                                onClick={() => onRemove(index, imageIndex)}
                              >
                                Lepas
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {note && <p className="media-panel__note">{note}</p>}

          {notes.length > 0 && (
            <ul className="media-panel__notes">
              {notes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          {failures.length > 0 && (
            <ul className="media-panel__failures">
              {failures.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

// ===== TIMER SETTING CONTROL =====
interface TimerSettingProps {
  label: string;
  hint: string;
  value: number;
  presets: number[];
  onChange: (value: number) => void;
}

function TimerSetting({ label, hint, value, presets, onChange }: TimerSettingProps) {
  return (
    <div className="timer-group">
      <div className="timer-group__label">{label}</div>
      <div className="timer-group__hint">{hint}</div>
      <div className="timer-input-row">
        <input
          type="text"
          inputMode="numeric"
          className="timer-input"
          value={value}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            if (raw === '') {
              onChange(TIMER_MIN);
              return;
            }
            const val = parseInt(raw, 10);
            if (!isNaN(val)) {
              onChange(Math.min(TIMER_MAX, val));
            }
          }}
          onBlur={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange(clampTimer(isNaN(val) ? value : val));
          }}
          aria-label={`${label} duration in seconds`}
        />
        <span style={{ font: 'var(--md-sys-typescale-body-large)', color: 'var(--md-sys-color-on-surface-variant)' }}>
          seconds
        </span>
      </div>
      <div className="timer-presets">
        {presets.map((t) => (
          <button
            key={t}
            type="button"
            className={`timer-preset ${value === t ? 'timer-preset--active' : ''}`}
            onClick={() => onChange(t)}
          >
            {t}s
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== MAIN APP =====
function App() {
  // --- App state ---
  const [screen, setScreen] = useState<AppScreen>('import');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [config, setConfig] = useState<QuizConfig>({ ...defaultConfig });
  // Tema dibaca sekali saat aplikasi dibuka. Skrip kecil di index.html sudah memasang atribut
  // yang sama sebelum paint pertama, jadi layar pertama tidak berkedip putih.
  const [theme, setTheme] = useState<Theme>(() => loadTheme() ?? 'light');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  // Catatan sesudah tombol "Buat soal" ditekan. Isinya berbeda menurut apa yang benar-benar
  // berhasil: prompt terisi di ChatGPT, prompt tersalin ke clipboard, atau keduanya.
  const [soalNote, setSoalNote] = useState<string | null>(null);
  // Tiga cara memasukkan soal. "Tempel teks" ada karena hasil ChatGPT berupa teks di layar, bukan
  // berkas, jadi memaksa guru menyimpannya dulu ke .txt hanya menambah satu langkah yang bisa gagal.
  // "Tautan" ada untuk soal yang dibagikan guru lain lewat Pastebin: yang berpindah cukup alamatnya.
  const [importMode, setImportMode] = useState<'file' | 'paste' | 'link'>('file');
  const [pastedText, setPastedText] = useState('');
  // Kotak tempel yang difokuskan sesudah "Buat soal" memindahkan layar ke mode tempel, supaya
  // Ctrl+V guru langsung masuk ke kotaknya, bukan ke tombol sakelarnya.
  const pasteInputRef = useRef<HTMLTextAreaElement | null>(null);

  // --- Impor dari tautan (Pastebin) ---
  const [linkInput, setLinkInput] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  // Nada dipisah dari teksnya karena dua keadaan itu memang berbeda artinya: satu kabar jalan,
  // satu galat. Kalimat sukses palsu lebih buruk daripada tidak ada kabar sama sekali.
  const [linkStatus, setLinkStatus] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  // --- Gambar ---
  const [importing, setImporting] = useState(false);
  const [imageFailures, setImageFailures] = useState<string[]>([]);
  const [imageResizes, setImageResizes] = useState<string[]>([]);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const [mediaNote, setMediaNote] = useState<string | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<QuestionImage | null>(null);

  // --- Presentation state ---
  const [presState, setPresState] = useState<PresentationState>('idle');
  const [currentQ, setCurrentQ] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const showTeacherControls = true;
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);

  // --- Saved session (one slot in localStorage) ---
  const [savedSession, setSavedSession] = useState<SavedSession | null>(() => loadSession());

  // --- Setup preview ---
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewDir, setPreviewDir] = useState<'next' | 'prev'>('next');
  const [previewReveal, setPreviewReveal] = useState(false);

  // --- Refs ---
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<number>(0);
  const lastWarningTickRef = useRef<number>(0);
  const presContainerRef = useRef<HTMLDivElement>(null);
  const audioInitialized = useRef(false);
  const exitDialogOpenerRef = useRef<HTMLButtonElement>(null);
  const exitDialogCancelRef = useRef<HTMLButtonElement>(null);
  const answerKeyOpenerRef = useRef<HTMLButtonElement>(null);
  const answerKeyCloseRef = useRef<HTMLButtonElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<{ question: number; image: number } | null>(null);

  // --- Derived ---
  const questions = useMemo(() => quiz?.questions ?? [], [quiz]);
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQ] ?? null;
  const progress = totalQuestions > 0 ? ((currentQ + 1) / totalQuestions) * 100 : 0;
  const currentDuration = durationForQuestion(currentQuestion, config);
  const timeProgress = currentDuration > 0 ? (remainingTime / currentDuration) * 100 : 0;

  // Preview always shows the file order; shuffling only happens when the quiz starts.
  const previewQuestions = useMemo(() => quiz?.originalQuestions ?? [], [quiz]);
  const previewQuestion = previewQuestions[previewIndex] ?? null;
  const previewDuration = durationForQuestion(previewQuestion, config);

  // Rendered into document.body: the app shells are position: fixed with overflow: hidden,
  // so a print sheet kept inside them would be clipped on paper.
  const answerKeySheet = quiz
    ? createPortal(<AnswerKeySheet title={quiz.title} questions={quiz.originalQuestions} />, document.body)
    : null;

  // ===== FILE HANDLING =====
  /**
   * Satu pintu masuk untuk semua cara impor: berkas soal beserta gambarnya, atau satu folder yang
   * berisi keduanya. Gambar dicocokkan lewat nama berkas di baris Image:; nama yang tidak ketemu
   * tidak menggagalkan impor, karena layar Siap punya tempat untuk memasangnya satu per satu.
   */
  const handleImport = useCallback(async (files: File[]) => {
    const selection = splitSelection(files);
    if (!selection.template) {
      setParseResult({
        success: false,
        error:
          'Belum ada berkas soal yang dipilih. Pilih berkas .txt berisi soal; berkas gambarnya boleh dipilih sekaligus.',
      });
      return;
    }

    setImporting(true);
    setImageFailures([]);
    setImageResizes([]);
    setMediaNote(null);

    try {
      const text = await selection.template.text();
      const result = parseQuizTemplate(text);
      if (!result.success || !result.quiz) {
        setParseResult(result);
        return;
      }

      const attached = await attachLocalImages(result.quiz.originalQuestions, selection.images);
      const imported: Quiz = {
        ...result.quiz,
        questions: attached.questions,
        originalQuestions: attached.questions,
      };

      setImageFailures(attached.report.failed);
      setImageResizes([
        ...attached.report.resized,
        // Berkas yang bukan .txt dan bukan gambar disebut, bukan dibuang diam-diam: guru yang
        // salah menyeret satu dokumen lain perlu tahu kenapa dokumen itu tidak muncul.
        ...(selection.skipped > 0
          ? [`${selection.skipped} berkas dilewati karena bukan berkas .txt dan bukan gambar.`]
          : []),
      ]);
      setQuiz(imported);
      setParseResult({ success: true, quiz: imported });
      setTimeout(() => setScreen('setup'), 1500);
    } catch {
      setParseResult({
        success: false,
        error: 'Berkas ini belum bisa dibaca. Periksa berkasnya sebentar, lalu impor ulang.',
      });
    } finally {
      setImporting(false);
    }
  }, []);

  /**
   * Satu jalur untuk semua teks soal, dari mana pun asalnya: hasil tempel maupun hasil ambil dari
   * tautan. Parse, pembersihan sisa impor sebelumnya, dan perpindahan ke layar Siap karena itu
   * hanya ada di satu tempat. Mengembalikan hasil parse apa adanya, jadi pemanggilnya bisa
   * menampilkan galat yang menyebut soal nomor berapa.
   */
  const importFromText = useCallback((text: string): ParseResult => {
    setImageFailures([]);
    setImageResizes([]);
    setMediaNote(null);

    const result = parseQuizTemplate(text);
    if (!result.success || !result.quiz) {
      setParseResult(result);
      return result;
    }

    setQuiz(result.quiz);
    setParseResult({ success: true, quiz: result.quiz });
    setTimeout(() => setScreen('setup'), 1500);
    return result;
  }, []);

  /**
   * Impor dari teks yang ditempel. Jalurnya sengaja lebih pendek dari impor berkas: tidak ada
   * berkas gambar yang ikut, jadi tidak ada yang perlu dicocokkan. Baris `Image:` yang menunjuk
   * alamat online tetap jalan, sedangkan yang menunjuk nama berkas lokal muncul di layar Siap
   * sebagai gambar yang belum dipasang, lengkap dengan panel untuk memasangnya.
   */
  const importPastedText = useCallback(() => {
    // Kotak kosong tidak pernah sampai ke sini: tombolnya mati selama belum ada teks, dan baris
    // "Belum ada teks." di sampingnya mengatakan kenapa.
    const result = importFromText(pastedText.trim());
    if (result.success) setPastedText('');
  }, [pastedText, importFromText]);

  /**
   * Impor dari tautan Pastebin. Yang berpindah hanya teksnya, jadi konsekuensi gambarnya sama
   * dengan jalur tempel: baris `Image:` berisi alamat online tetap jalan, nama berkas lokal
   * menunggu dipasang di layar Siap.
   *
   * Tautannya tidak diambil langsung dari pastebin.com, karena pastebin.com tidak mengirim header
   * CORS sama sekali. Jalur dan bukti pengujiannya ada di `src/pastebin.ts`.
   */
  const importFromLink = useCallback(async () => {
    const rawUrl = pastebinRawUrl(linkInput);
    if (!rawUrl) {
      setLinkStatus({
        tone: 'error',
        text: 'Tautan ini bukan tautan Pastebin. Contoh yang benar: https://pastebin.com/raw/nic0NZze.',
      });
      return;
    }

    setLinkBusy(true);
    setLinkStatus({ tone: 'info', text: 'Mengambil teks dari tautan…' });

    const fetched = await fetchPastebinText(rawUrl);
    setLinkBusy(false);

    if (!fetched.ok) {
      setLinkStatus({ tone: 'error', text: fetched.error });
      return;
    }

    const result = importFromText(fetched.text);
    if (!result.success) {
      // Teksnya berhasil diambil tapi isinya bukan template yang sah, jadi galat parse yang
      // menyebut soal nomor berapa tetap ditampilkan apa adanya, bukan ditelan pesan umum.
      setLinkStatus({
        tone: 'error',
        text: `Teks dari tautan ini belum bisa dibaca. ${result.error ?? ''}`.trim(),
      });
      return;
    }

    setLinkInput('');
    setLinkStatus({
      tone: 'info',
      text: `Soal dari tautan berhasil dibaca: ${result.quiz?.questions.length ?? 0} soal.`,
    });
  }, [linkInput, importFromText]);

  /* Kotak yang menerima satu blok teks tidak memberi tanda apa pun bahwa tempelannya masuk, jadi
     angka ini yang memberi tanda itu sebelum guru menekan Baca soal. */
  const pasteSummary = useMemo(() => {
    const text = pastedText.trim();
    if (text === '') return 'Belum ada teks.';
    const lines = text.split('\n').filter((line) => line.trim() !== '').length;
    return `${lines} baris, ${text.length} karakter.`;
  }, [pastedText]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Entri folder harus diambil saat event masih berjalan, jadi pengumpulan berkas dimulai
      // lebih dulu, baru hasilnya diimpor.
      void collectFromDataTransfer(e.dataTransfer).then((files) => {
        if (files.length > 0) void handleImport(files);
      });
    },
    [handleImport]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      // Dikosongkan supaya berkas yang sama bisa dipilih lagi setelah impornya gagal.
      e.target.value = '';
      if (files.length > 0) void handleImport(files);
    },
    [handleImport]
  );

  // ===== MEDIA PANEL (GAMBAR) =====
  /** Slot yang sedang menunggu berkas, diisi sebelum dialog berkas dibuka. */
  const pickImageFile = useCallback((questionIndex: number, imageIndex: number) => {
    pendingSlotRef.current = { question: questionIndex, image: imageIndex };
    mediaInputRef.current?.click();
  }, []);

  const handleMediaFileInput = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const slot = pendingSlotRef.current;
    event.target.value = '';
    pendingSlotRef.current = null;
    if (!file || !slot) return;

    setMediaBusy(true);
    setMediaNote(null);
    try {
      const result = await normalizeImage(file);
      const patch = { src: result.src };
      setQuiz((prev) =>
        prev
          ? {
              ...prev,
              questions: withImageAt(prev.questions, slot.question, slot.image, patch),
              originalQuestions: withImageAt(prev.originalQuestions, slot.question, slot.image, patch),
            }
          : prev
      );
      setImageFailures((prev) => prev.filter((item) => !item.startsWith(`${file.name}:`)));
      setMediaNote(
        result.scaled
          ? describeResize(file.name, result)
          : `${file.name} dipakai apa adanya (${formatBytes(result.finalBytes)}).`
      );
    } catch (error) {
      const reason =
        error instanceof ImageReadError ? error.message : 'berkas ini tidak bisa dibaca sebagai gambar';
      setImageFailures((prev) => [
        ...prev.filter((item) => !item.startsWith(`${file.name}:`)),
        `${file.name}: ${reason}.`,
      ]);
    } finally {
      setMediaBusy(false);
    }
  }, []);

  /**
   * Melepas gambar dari soal tanpa menghapus slotnya: nama berkasnya tetap tertulis, jadi guru tahu
   * apa yang harus dipasang kembali, dan sesi yang tersimpan ikut mengecil.
   */
  const removeImage = useCallback((questionIndex: number, imageIndex: number) => {
    setMediaNote(null);
    setQuiz((prev) =>
      prev
        ? {
            ...prev,
            questions: withImageAt(prev.questions, questionIndex, imageIndex, { src: '' }),
            originalQuestions: withImageAt(prev.originalQuestions, questionIndex, imageIndex, { src: '' }),
          }
        : prev
    );
  }, []);

  const loadDemo = useCallback(() => {
    const demo = { ...demoQuiz };
    demo.questions = [...demo.originalQuestions];
    setQuiz(demo);
    setParseResult({ success: true, quiz: demo });
    setTimeout(() => setScreen('setup'), 1500);
  }, []);

  // ===== QUIZ SETUP =====
  const startQuiz = useCallback(() => {
    if (!quiz) return;

    // Initialize audio on user interaction
    if (!audioInitialized.current) {
      initAudio();
      audioInitialized.current = true;
    }

    // Apply shuffle if enabled
    let questionsToUse = [...quiz.originalQuestions];
    if (config.shuffleQuestions) {
      questionsToUse = shuffleArray(questionsToUse);
    }
    if (config.shuffleAnswers) {
      questionsToUse = questionsToUse.map((q) => {
        if (q.type !== 'multiple-choice') return q;
        const originalCorrect = q.options[q.correctAnswer];
        const shuffledOptions = shuffleArray([...q.options]);
        const newCorrectIndex = shuffledOptions.indexOf(originalCorrect);
        return { ...q, options: shuffledOptions as [string, string, string, string], correctAnswer: newCorrectIndex };
      });
    }

    // Re-number
    questionsToUse = questionsToUse.map((q, i) => ({ ...q, id: i + 1 }));

    setQuiz({ ...quiz, questions: questionsToUse });
    setCurrentQ(0);
    setRemainingTime(durationForQuestion(questionsToUse[0] ?? null, config));
    setIsPaused(false);
    setShowCorrectAnswer(false);
    setShowAnswerKey(false);
    setShowPreview(false);
    setZoomedImage(null);
    setPresState('countdown');
    setScreen('presentation');
    setCountdownValue(3);

    // Request fullscreen
    try {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } catch {}

    if (config.soundEnabled) {
      playQuizStart(config.volume);
    }
  }, [quiz, config]);

  // ===== SETUP PREVIEW =====
  const openPreview = useCallback(() => {
    setPreviewIndex(0);
    setPreviewDir('next');
    setPreviewReveal(false);
    setShowPreview(true);
  }, []);

  const closePreview = useCallback(() => setShowPreview(false), []);

  const previewGo = useCallback((delta: number) => {
    const next = previewIndex + delta;
    if (next < 0 || next >= previewQuestions.length) return;
    setPreviewDir(delta > 0 ? 'next' : 'prev');
    setPreviewIndex(next);
    // Never carry a revealed answer over to the next question.
    setPreviewReveal(false);
  }, [previewIndex, previewQuestions.length]);

  // ===== COUNTDOWN =====
  useEffect(() => {
    if (presState !== 'countdown') return;

    if (countdownValue <= 0) {
      const countdownDuration = durationForQuestion(questions[currentQ] ?? null, config);
      setPresState('question-active');
      setRemainingTime(countdownDuration);
      endTimeRef.current = Date.now() + countdownDuration * 1000;
      if (config.soundEnabled && config.soundTransitions) {
        playQuestionStart(config.volume);
      }
      return;
    }

    if (config.soundEnabled && config.soundWarning) {
      playCountdownBeep(config.volume);
    }

    const timeout = setTimeout(() => {
      setCountdownValue((v) => v - 1);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [presState, countdownValue, config, currentQ, questions]);

  // ===== TIMER =====
  useEffect(() => {
    if (presState !== 'question-active' && presState !== 'time-warning') return;
    if (isPaused) return;

    // Use setInterval as primary timer (works even when tab is hidden)
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));

      setRemainingTime(remaining);

      // Warning at 10s
      if (remaining <= 10 && remaining > 5) {
        if (presState !== 'time-warning') {
          setPresState('time-warning');
        }
        // Play warning tick every second
        if (remaining !== lastWarningTickRef.current) {
          lastWarningTickRef.current = remaining;
          if (config.soundEnabled && config.soundWarning) {
            playWarningTick(config.volume);
          }
        }
      }

      // Critical at 5s
      if (remaining <= 5 && remaining > 0) {
        if (remaining !== lastWarningTickRef.current) {
          lastWarningTickRef.current = remaining;
          if (config.soundEnabled && config.soundWarning) {
            playCountdownBeep(config.volume);
          }
        }
      }

      // Time up
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);

        if (config.mode === 'practice') {
          // Practice mode: skip TIME'S UP, show answer directly
          setPresState('answer-reveal');
          setShowCorrectAnswer(true);
          if (config.soundEnabled && config.soundTimeUp) {
            playTimeUp(config.volume);
          }

          // After 4 seconds, transition to next question
          setTimeout(() => {
            setPresState('transitioning');
            if (config.soundEnabled && config.soundTransitions) {
              playTransition(config.volume);
            }
            setTimeout(() => {
              goToNextQuestion();
            }, TRANSISI_SOAL_MS);
          }, 4000);
        } else {
          // Daily mode: TIME'S UP overlay, then next question
          setPresState('time-up');
          if (config.soundEnabled && config.soundTimeUp) {
            playTimeUp(config.volume);
          }
          // "Waktu habis" dibaca guru dan kelas dulu, baru berpindah soal.
          setTimeout(() => {
            setPresState('transitioning');
            if (config.soundEnabled && config.soundTransitions) {
              playTransition(config.volume);
            }
            setTimeout(() => {
              goToNextQuestion();
            }, TRANSISI_SOAL_MS);
          }, TRANSISI_SOAL_MS);
        }
        return;
      }
    }, 250); // tick every 250ms for smooth updates

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [presState, isPaused, config]);

  // ===== NAVIGATION =====
  const goToNextQuestion = useCallback(() => {
    if (currentQ + 1 >= totalQuestions) {
      // Quiz complete
      setPresState('quiz-complete');
      if (config.soundEnabled && config.soundComplete) {
        playComplete(config.volume);
      }
      return;
    }

    const nextDuration = durationForQuestion(questions[currentQ + 1] ?? null, config);
    // Gambar yang sedang diperbesar tidak boleh ikut ke soal berikutnya.
    setZoomedImage(null);
    setCurrentQ((prev) => prev + 1);
    setRemainingTime(nextDuration);
    endTimeRef.current = Date.now() + nextDuration * 1000;
    lastWarningTickRef.current = 0;
    setShowCorrectAnswer(false);
    setPresState('question-active');

    if (config.soundEnabled && config.soundTransitions) {
      playQuestionStart(config.volume);
    }
  }, [currentQ, totalQuestions, config, questions]);

  const skipToNext = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    // Leaving the pause flag set would stop the next question's timer from ever starting.
    setIsPaused(false);
    setZoomedImage(null);
    setPresState('transitioning');
    if (config.soundEnabled && config.soundTransitions) {
      playTransition(config.volume);
    }
    setTimeout(() => {
      goToNextQuestion();
    }, TRANSISI_SOAL_MS);
  }, [goToNextQuestion, config]);

  const togglePause = useCallback(() => {
    if (isPaused) {
      // Resume - recalculate end time
      endTimeRef.current = Date.now() + remainingTime * 1000;
      setIsPaused(false);
      setPresState(remainingTime <= 10 ? 'time-warning' : 'question-active');
    } else {
      setIsPaused(true);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [isPaused, remainingTime]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    setConfig((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  }, []);

  const exitPresentation = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);
    setZoomedImage(null);
    setPresState('idle');
    setScreen('setup');
    setShowExitDialog(false);
    setShowAnswerKey(false);
    setShowCorrectAnswer(false);
    setShowPreview(false);
  }, []);

  const restartQuiz = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setZoomedImage(null);
    setCurrentQ(0);
    setRemainingTime(durationForQuestion(questions[0] ?? null, config));
    setIsPaused(false);
    setShowCorrectAnswer(false);
    setPresState('countdown');
    setCountdownValue(3);
    if (config.soundEnabled) {
      playQuizStart(config.volume);
    }
  }, [config, questions]);

  const closeExitDialog = useCallback(() => {
    setShowExitDialog(false);
    // Focus goes back to the control that opened the dialog, once it is on screen again.
    requestAnimationFrame(() => exitDialogOpenerRef.current?.focus());
  }, []);

  const closeAnswerKey = useCallback(() => {
    setShowAnswerKey(false);
    requestAnimationFrame(() => answerKeyOpenerRef.current?.focus());
  }, []);

  // Move focus into whichever dialog just opened, so keyboard users are not left behind it.
  useEffect(() => {
    if (showExitDialog) exitDialogCancelRef.current?.focus();
  }, [showExitDialog]);

  useEffect(() => {
    if (showAnswerKey) answerKeyCloseRef.current?.focus();
  }, [showAnswerKey]);

  // ===== KEYBOARD SHORTCUTS =====
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (screen !== 'presentation') return;

      const key = e.key.toLowerCase();

      // Escape unwinds one layer at a time: the zoomed picture, then the exit dialog, then the
      // answer key, and only then the presentation shortcuts. It never opens a new layer on top
      // of an open one, and no shortcut reaches the quiz while a layer is up.
      if (zoomedImage) {
        if (key === 'escape') {
          e.preventDefault();
          setZoomedImage(null);
        }
        return;
      }

      if (showExitDialog) {
        if (key === 'escape') {
          e.preventDefault();
          closeExitDialog();
        }
        return;
      }

      // While the answer key is open it acts as a modal: other shortcuts stay out of the quiz.
      if (showAnswerKey) {
        if (key === 'escape') {
          e.preventDefault();
          closeAnswerKey();
        }
        return;
      }

      switch (key) {
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'g': {
          // Hanya gambar yang benar-benar ada yang bisa dibuka; tanpa itu tombolnya diam.
          const first = imagesOf(currentQuestion).find((image) => image.src !== '');
          if (first) {
            e.preventDefault();
            setZoomedImage(first);
          }
          break;
        }
        case 'escape':
          if (presState === 'question-active' || presState === 'time-warning' || isPaused) {
            setShowExitDialog(true);
          }
          break;
        case ' ':
        case 'p':
        case 'enter':
          e.preventDefault();
          if (presState === 'question-active' || presState === 'time-warning' || isPaused) {
            togglePause();
          }
          break;
        case 'n':
          if ((presState === 'question-active' || presState === 'time-warning') && !isPaused) {
            skipToNext();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    screen,
    presState,
    isPaused,
    zoomedImage,
    currentQuestion,
    showExitDialog,
    showAnswerKey,
    toggleFullscreen,
    togglePause,
    skipToNext,
    closeExitDialog,
    closeAnswerKey,
  ]);

  // ===== PREVIEW KEYBOARD SHORTCUTS =====
  useEffect(() => {
    if (screen !== 'setup' || !showPreview) return;

    const handlePreviewKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          previewGo(1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          previewGo(-1);
          break;
        case 'Escape':
          e.preventDefault();
          closePreview();
          break;
        default:
          if (e.key.toLowerCase() === 'j') {
            e.preventDefault();
            setPreviewReveal((prev) => !prev);
          }
      }
    };

    window.addEventListener('keydown', handlePreviewKey);
    return () => window.removeEventListener('keydown', handlePreviewKey);
  }, [screen, showPreview, previewGo, closePreview]);

  // Panel gambar di layar Siap juga modal: Esc menutupnya dan tidak ada pintasan lain yang aktif
  // selama ia terbuka.
  useEffect(() => {
    if (screen !== 'setup' || !showMediaPanel) return;

    const handleMediaKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMediaPanel(false);
      }
    };

    window.addEventListener('keydown', handleMediaKey);
    return () => window.removeEventListener('keydown', handleMediaKey);
  }, [screen, showMediaPanel]);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // When reduced motion is preferred the mascots never render, so do not cycle them either.

  // ===== THEME =====
  // Satu tempat untuk dua akibat: atribut data-theme di <html> supaya token gelap berlaku ke
  // seluruh dokumen (termasuk panel kunci jawaban yang di-portal ke body), dan satu penulisan
  // ke storage. Efek ini tidak menyentuh state, jadi tidak ada render tambahan.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  // ===== SAVED SESSION =====
  // One slot: the quiz last open, its config, and where the teacher was. remainingTime is left
  // out on purpose, otherwise the 250ms timer tick would write to storage four times a second.
  //
  // Ada jeda 500 ms karena soal bergambar membawa datanya sendiri: tanpa jeda ini, setiap langkah
  // slider volume akan menulis ulang seluruh gambar ke localStorage.
  useEffect(() => {
    if (!quiz) return;
    const timeout = setTimeout(() => {
      saveSession({
        quiz,
        config,
        currentQuestion: currentQ,
        wasPresenting:
          screen === 'presentation' &&
          (presState === 'question-active' ||
            presState === 'time-warning' ||
            presState === 'answer-reveal' ||
            isPaused),
      });
    }, 500);

    return () => clearTimeout(timeout);
  }, [quiz, config, currentQ, screen, presState, isPaused]);

  const resumeSavedSession = useCallback(
    (intoPresentation: boolean) => {
      if (!savedSession) return;

      const mergedConfig: QuizConfig = { ...defaultConfig, ...savedSession.config };
      const savedQuestions = savedSession.quiz.questions;
      const storedIndex = Math.min(Math.max(savedSession.currentQuestion, 0), savedQuestions.length - 1);
      const startIndex = intoPresentation ? storedIndex : 0;

      if (!audioInitialized.current) {
        initAudio();
        audioInitialized.current = true;
      }

      setQuiz(savedSession.quiz);
      setConfig(mergedConfig);
      setParseResult(null);
      setCurrentQ(startIndex);
      setRemainingTime(durationForQuestion(savedQuestions[startIndex] ?? null, mergedConfig));
      setIsPaused(false);
      setShowCorrectAnswer(false);
      setShowAnswerKey(false);
      setShowExitDialog(false);
      setShowPreview(false);

      if (!intoPresentation) {
        setPresState('idle');
        setScreen('setup');
        return;
      }

      // The question timer starts over from full. Nobody can tell how long the tab stayed closed,
      // so continuing the exact second would be a guess dressed up as precision.
      setPresState('countdown');
      setCountdownValue(3);
      setScreen('presentation');

      try {
        document.documentElement.requestFullscreen?.();
        setIsFullscreen(true);
      } catch {}
    },
    [savedSession]
  );

  const forgetSavedSession = useCallback(() => {
    clearSession();
    setSavedSession(null);
  }, []);

  const printAnswerKey = useCallback(() => {
    // The sheet sits in document.body, hidden on screen and revealed only by @media print.
    window.print();
  }, []);

  // ===== TEMPLATE DOWNLOAD =====
  const downloadTemplate = useCallback(() => {
    const template = `Title: IPA - Campuran Soal

# Baris yang diawali # adalah komentar, abaikan saja

# Gambar: tulis di baris Image: sesudah baris soal. Isinya boleh alamat online
#   (Image: https://...) atau nama berkas gambar di PC yang kamu pilih bersama
#   berkas .txt ini saat impor (Image: diagram.png). Nama berkasnya dicocokkan
#   otomatis, jadi huruf besar-kecil tidak masalah. Teks sesudah tanda | jadi
#   deskripsi gambar untuk pembaca layar. Maksimal 3 gambar per soal.

# Soal pilihan ganda: 4 opsi A-D + Answer: huruf
1. Organ tubuh utama yang berfungsi dalam sistem pernapasan manusia adalah?
A. Jantung
B. Paru-paru
C. Lambung
D. Ginjal
Answer: B

2. Proses pertukaran oksigen dan karbon dioksida di dalam tubuh disebut?
A. Pencernaan
B. Peredaran darah
C. Pernapasan
D. Pembuangan
Answer: C

# Soal bergambar. Baris Image: di bawah ini sengaja dikomentari supaya template ini
# bisa langsung diimpor tanpa berkas gambar apa pun. Hapus tanda # di depannya
# kalau kamu sudah punya gambarnya.
3. Perhatikan gambar berikut. Bagian yang ditunjuk anak panah adalah?
# Image: alveolus.png | Diagram alveolus di dalam paru-paru
A. Bronkus
B. Alveolus
C. Trakea
D. Diafragma
Answer: B

# Soal isian singkat: tanpa opsi, langsung Answer: teks jawaban
4. Lambang kimia air adalah...
Answer: H2O

# Beberapa jawaban alternatif dipisah tanda | (salah satu saja sudah benar)
5. Satuan turunan SI untuk gaya adalah...
Answer: Newton | N

6. Bagian saluran pernapasan yang terletak di tenggorokan adalah?
A. Bronkus
B. Trakea
C. Alveoli
D. Diafragma
Answer: B`;
    const blob = new Blob([template], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quiz-template.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ===== BUAT SOAL DENGAN AI =====
  /* Tombol ini keluar dari aplikasi: ia membuka ChatGPT dengan prompt pembuat soal, dan sekaligus
     memindahkan layar impor ke kotak Tempel teks, karena hasilnya berupa teks di layar ChatGPT,
     bukan berkas. Dua jalur prompt dikerjakan sekaligus dengan sengaja. Prompt di alamat `?q=`
     adalah jalur satu klik, dan clipboard adalah jaring pengamannya: kalau kolom pesan ChatGPT
     ternyata kosong, prompt yang sudah tersalin tinggal ditempel guru.
     Urutannya penting. Tabnya dibuka lebih dulu, sebelum penyalinan ditunggu, supaya peramban
     masih menghitungnya sebagai aksi klik dan tidak memblokirnya sebagai pop-up. */
  const createSoalWithAi = useCallback(() => {
    const prefilled = chatGptPrefillUrl();
    window.open(prefilled ?? chatGptPlainUrl(), '_blank', 'noopener,noreferrer');

    setImportMode('paste');
    // Kotak tempelnya baru ada sesudah render mode tempel, jadi fokusnya menunggu satu putaran.
    setTimeout(() => pasteInputRef.current?.focus(), 0);

    void copyText(SOAL_PROMPT).then((copied) => {
      if (prefilled && copied) {
        setSoalNote('Tab ChatGPT sudah terbuka dengan prompt terisi, dan kotak Tempel teks sudah dibuka di sini. Kalau kolom pesan ChatGPT kosong, tempel dengan Ctrl+V, karena prompt ini juga sudah tersalin.');
      } else if (prefilled) {
        setSoalNote('Tab ChatGPT sudah terbuka dengan prompt terisi. Kalau kolom pesannya kosong, coba tekan Buat soal sekali lagi.');
      } else if (copied) {
        setSoalNote('Prompt sudah tersalin. Tempel di kolom pesan ChatGPT dengan Ctrl+V, lalu kirim.');
      } else {
        setSoalNote('Prompt belum bisa tersalin otomatis, dan tab ChatGPT terbuka tanpa prompt terisi. Coba tekan Buat soal sekali lagi.');
      }
    });
  }, []);

  // ===== RENDER: IMPORT SCREEN =====
  if (screen === 'import') {
    return (
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header__logo">
            <div>
              <div className="app-header__title">QuizBoard</div>
              <div className="app-header__subtitle">Presentasi kuis kelas</div>
            </div>
          </div>
        </header>

        <main className="main-content">
          <div className="import-screen">
            <div className="import-hero">
              <h1 className="import-hero__title">QuizBoard</h1>
              <p className="import-hero__subtitle">
                Impor berkas soal, periksa sebentar, lalu tampilkan di proyektor.
              </p>
            </div>

            {!parseResult && !importing && savedSession && (
              <div className="resume-card">
                <div className="resume-card__body">
                  <div className="resume-card__title">Lanjutkan kuis terakhir</div>
                  <div className="resume-card__meta">
                    {savedSession.quiz.title}, {savedSession.quiz.questions.length} soal, berhenti di soal{' '}
                    {Math.min(savedSession.currentQuestion + 1, savedSession.quiz.questions.length)}.{' '}
                    Terakhir dibuka {describeSavedAt(savedSession.savedAt)}.
                  </div>
                  {savedSession.imagesOmitted && (
                    <div className="resume-card__note">
                      Gambar soal tidak ikut tersimpan karena ukuran sesi. Impor ulang berkas soal
                      beserta gambarnya supaya gambar kembali.
                    </div>
                  )}
                </div>
                <div className="resume-card__actions">
                  <button className="btn btn--primary" onClick={() => resumeSavedSession(true)}>
                    <IconPlay size={18} /> Lanjutkan
                  </button>
                  <button className="btn btn--outlined" onClick={() => resumeSavedSession(false)}>
                    Mulai dari awal
                  </button>
                  <button className="btn btn--text" onClick={forgetSavedSession}>
                    Lupakan
                  </button>
                </div>
              </div>
            )}

            {importing ? (
              <div className="import-result">
                <div className="import-progress" role="status">
                  Membaca berkas soal dan menyiapkan gambar…
                </div>
              </div>
            ) : !parseResult ? (
              <>
                <div className="import-entry">
                  <div className="import-modes" role="group" aria-label="Cara memasukkan soal">
                    <button
                      className={`import-mode ${importMode === 'file' ? 'import-mode--selected' : ''}`}
                      onClick={() => setImportMode('file')}
                      aria-pressed={importMode === 'file'}
                    >
                      Unggah berkas
                    </button>
                    <button
                      className={`import-mode ${importMode === 'paste' ? 'import-mode--selected' : ''}`}
                      onClick={() => setImportMode('paste')}
                      aria-pressed={importMode === 'paste'}
                    >
                      Tempel teks
                    </button>
                    <button
                      className={`import-mode ${importMode === 'link' ? 'import-mode--selected' : ''}`}
                      onClick={() => setImportMode('link')}
                      aria-pressed={importMode === 'link'}
                    >
                      Tautan
                    </button>
                  </div>

                  {importMode === 'link' ? (
                    // Tautan Pastebin: yang dibutuhkan guru cuma satu baris alamat. Kotak teks besar
                    // tidak dipakai di sini, karena tidak ada yang perlu ditempel guru sendiri.
                    <div className="link-panel">
                      <label className="link-panel__label" htmlFor="link-input">
                        Tautan Pastebin
                      </label>
                      <div className="link-panel__hint">
                        Tempel tautan Pastebin yang berisi berkas soal, contoh:
                        https://pastebin.com/raw/nic0NZze. Pastenya harus publik.
                      </div>
                      <input
                        id="link-input"
                        type="url"
                        className="link-panel__input"
                        value={linkInput}
                        onChange={(e) => setLinkInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && linkInput.trim() !== '' && !linkBusy) {
                            void importFromLink();
                          }
                        }}
                        placeholder="https://pastebin.com/raw/nic0NZze"
                        spellCheck={false}
                        autoComplete="off"
                        disabled={linkBusy}
                        aria-describedby="link-status"
                      />
                      <div className="link-panel__actions">
                        <button
                          className="btn btn--primary"
                          onClick={() => void importFromLink()}
                          disabled={linkInput.trim() === '' || linkBusy}
                        >
                          {linkBusy ? 'Mengambil…' : 'Ambil soal'}
                        </button>
                        {/* Satu baris untuk semua keadaan: sedang mengambil, berhasil, atau
                            gagal. Warnanya ikut nada, dan teksnya mengatakan apa yang benar-benar
                            terjadi, termasuk kewajiban pastenya publik. */}
                        <span
                          className={`link-panel__status${linkStatus?.tone === 'error' ? ' link-panel__status--error' : ''}`}
                          id="link-status"
                          role="status"
                        >
                          {linkStatus?.text ?? 'Belum ada tautan.'}
                        </span>
                      </div>
                    </div>
                  ) : importMode === 'file' ? (
                    <div
                      className="drop-zone"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => document.getElementById('file-input')?.click()}
                      role="button"
                      tabIndex={0}
                      aria-label="Tarik berkas soal ke sini, atau klik untuk memilih berkas"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          document.getElementById('file-input')?.click();
                        }
                      }}
                    >
                      <div className="drop-zone__text">
                        Tarik berkas soal ke sini
                      </div>
                      <div className="drop-zone__or">atau</div>
                      <button className="btn btn--primary" onClick={(e) => { e.stopPropagation(); document.getElementById('file-input')?.click(); }}>
                        <IconFolder size={18} /> Pilih berkas
                      </button>
                      <div className="drop-zone__hint">
                        Berkas .txt: nomor. soal, opsi (a) sampai (d), lalu Answer: huruf kunci. Gambar
                        ikut dipilih sekaligus, dicocokkan lewat baris Image:. Folder yang berisi
                        keduanya juga bisa diseret ke sini.
                      </div>
                      <input
                        id="file-input"
                        type="file"
                        accept=".txt,image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleFileInput}
                      />
                    </div>
                  ) : (
                    // Berkas yang diseret ke panel ini tetap diimpor, jadi guru yang sengaja pindah
                    // ke tab ini tidak perlu kembali dulu untuk melepas berkasnya.
                    <div className="paste-panel" onDrop={handleDrop} onDragOver={handleDragOver}>
                      <label className="paste-panel__label" htmlFor="paste-input">
                        Tempel hasil dari AI di sini
                      </label>
                      <div className="paste-panel__hint">
                        Tempel seluruh hasilnya apa adanya, termasuk baris Title: dan Answer:.
                      </div>
                      <textarea
                        id="paste-input"
                        ref={pasteInputRef}
                        className="paste-panel__text"
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        spellCheck={false}
                        aria-describedby="paste-summary"
                      />
                      <div className="paste-panel__actions">
                        {/* Tanpa `role="status"`: pembaca layar tidak perlu mendengar ulang hitungan
                            baris setiap kali satu huruf diketik. Angka itu dibaca saat kotaknya
                            difokuskan, karena kotak itu menunjuk ke sini lewat aria-describedby. */}
                        <span className="paste-panel__summary" id="paste-summary">
                          {pasteSummary}
                        </span>
                        <div className="paste-panel__buttons">
                          {pastedText.trim() !== '' && (
                            <button className="btn btn--text btn--small" onClick={() => setPastedText('')}>
                              Kosongkan
                            </button>
                          )}
                          <button
                            className="btn btn--primary"
                            onClick={importPastedText}
                            disabled={pastedText.trim() === ''}
                          >
                            <IconCheck size={18} /> Baca soal
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="import-aside">
                  <div className="import-actions">
                    <button className="btn btn--outlined" onClick={createSoalWithAi}>
                      <IconExternal size={18} /> Buat soal
                    </button>
                    <button className="btn btn--outlined" onClick={downloadTemplate}>
                      <IconDownload size={18} /> Unduh template
                    </button>
                    <button className="btn btn--outlined" onClick={loadDemo}>
                      <IconPlay size={18} /> Coba contoh
                    </button>
                  </div>

                  <p className="import-aside__hint">
                    Buat soal membuka tab ChatGPT dengan prompt pembuat soal, lalu memindahkan layar
                    ini ke kotak Tempel teks. Jawab pertanyaannya satu per satu, tekan tombol salin
                    di code block hasilnya, lalu tempel di situ dan klik Baca soal.
                  </p>

                  {soalNote && (
                    <p className="import-aside__note" role="status">
                      {soalNote}
                    </p>
                  )}
                </div>
              </>
            ) : parseResult.success ? (
              <div className="import-result">
                <div className="import-success">
                  <div className="import-success__icon"><IconCheck size={32} /></div>
                  <div className="import-success__title">Soal berhasil dibaca</div>
                  <div className="import-success__subtitle">
                    {quiz?.questions.length} soal siap ditampilkan
                  </div>
                </div>
              </div>
            ) : (
              <div className="import-result">
                <div className="import-error">
                  <div className="import-error__icon"><IconAlert size={32} /></div>
                  <div className="import-error__title">Soal ini belum bisa dibaca</div>
                  <div className="import-error__message">{parseResult.error}</div>
                  <div className="import-error__list">
                    <li>Soal pilihan ganda punya 4 opsi (A, B, C, D) + Answer: huruf</li>
                    <li>Soal isian singkat cukup Answer: teks jawaban (alternatif dipisah |)</li>
                    <li>
                      Gambar ditulis di baris Image: berisi alamat online atau nama berkas gambar
                      lokal, maksimal 3 gambar per soal
                    </li>
                    <li>Ikuti format template</li>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn--primary" onClick={() => setParseResult(null)}>
                      Coba lagi
                    </button>
                    <button className="btn btn--outlined" onClick={downloadTemplate}>
                      <IconDownload size={18} /> Lihat template
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ===== RENDER: SETUP SCREEN =====
  if (screen === 'setup' && quiz) {
    const hasMultipleChoice = quiz.questions.some((q) => q.type === 'multiple-choice');
    const hasShortAnswer = quiz.questions.some((q) => q.type === 'short-answer');
    // Layar Siap selalu memakai urutan asli berkas, sama seperti pratinjau dan lembar cetak, jadi
    // nomor baris di panel gambar sama dengan nomor soal yang diingat guru.
    const imageSlots = quiz.originalQuestions.flatMap((question) => imagesOf(question));
    const imageMissingCount = imageSlots.filter(
      (image) => image.origin === 'local' && image.src === ''
    ).length;

    return (
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header__logo">
            <div>
              <div className="app-header__title">QuizBoard</div>
              <div className="app-header__subtitle">Presentasi kuis kelas</div>
            </div>
          </div>
          <button className="btn btn--text btn--small" onClick={() => { setParseResult(null); setQuiz(null); setScreen('import'); }}>
            Impor berkas lain
          </button>
        </header>

        <main className="main-content">
          <div className="setup-screen">
            {/* Header */}
            <div className="setup-header">
              <div className="setup-header__label">Siap ditampilkan</div>
              <h1 className="setup-header__title">{quiz.title}</h1>
              <div className="setup-header__count">{quiz.questions.length} soal</div>
            </div>

            {/* Gambar: baris tenang saat semuanya siap, baris yang meminta perhatian saat ada yang
                belum dipasang. Soal bergambar tanpa gambarnya adalah soal yang tidak bisa dijawab,
                jadi kekurangannya harus terlihat sebelum kuis dimulai, bukan di tengah presentasi. */}
            {(imageSlots.length > 0 || imageFailures.length > 0) && (
              <div className="media-section">
                <div className="section-label">Gambar</div>
                <div className="media-summary">
                  <div className="media-summary__text">
                    {imageSlots.length === 0
                      ? 'Berkas gambar ikut terpilih, tetapi belum ada baris Image: di soal.'
                      : imageMissingCount > 0
                        ? `${imageMissingCount} dari ${imageSlots.length} gambar belum dipasang. Soal seperti ini belum bisa dijawab siswa.`
                        : `${imageSlots.length} gambar siap ditampilkan.`}
                  </div>
                  <button className="btn btn--outlined btn--small" onClick={() => setShowMediaPanel(true)}>
                    <IconImage size={18} />
                    {imageMissingCount > 0 ? 'Lengkapi gambar' : 'Periksa gambar'}
                  </button>
                </div>
                {imageFailures.length > 0 && (
                  <div className="media-summary__warning">
                    {imageFailures.length} berkas gambar tidak bisa dibaca. Rinciannya ada di panel
                    Gambar.
                  </div>
                )}
              </div>
            )}

            {/* Mode Selection */}
            <div className="mode-section">
              <div className="section-label">Mode</div>
              <div className="mode-cards">
                <button
                  className={`mode-card ${config.mode === 'daily' ? 'mode-card--selected' : ''}`}
                  onClick={() => setConfig((p) => ({ ...p, mode: 'daily' as QuizMode }))}
                  aria-pressed={config.mode === 'daily'}
                >
                  <div className="mode-card__title">Penilaian harian</div>
                  <div className="mode-card__desc">
                    Jawaban tidak ditampilkan kepada siswa. Cocok untuk ujian harian.
                  </div>
                </button>
                <button
                  className={`mode-card ${config.mode === 'practice' ? 'mode-card--selected' : ''}`}
                  onClick={() => setConfig((p) => ({ ...p, mode: 'practice' as QuizMode }))}
                  aria-pressed={config.mode === 'practice'}
                >
                  <div className="mode-card__title">Latihan di kelas</div>
                  <div className="mode-card__desc">
                    Jawaban dapat ditampilkan setelah setiap soal untuk diskusi.
                  </div>
                </button>
              </div>
            </div>

            {/* Tampilan: dua baris, sama bentuknya dengan pilihan Mode karena keduanya
                keputusan karakter tampilan, bukan setelan teknis yang perlu dibuka dulu. */}
            <div className="mode-section">
              <div className="section-label">Tampilan</div>
              <div className="mode-cards">
                <button
                  className={`mode-card ${theme === 'light' ? 'mode-card--selected' : ''}`}
                  onClick={() => setTheme('light')}
                  aria-pressed={theme === 'light'}
                >
                  <div className="mode-card__title">Terang</div>
                  <div className="mode-card__desc">
                    Kertas putih dan tinta hitam, untuk ruangan yang terang.
                  </div>
                </button>
                <button
                  className={`mode-card ${theme === 'dark' ? 'mode-card--selected' : ''}`}
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  <div className="mode-card__title">Gelap</div>
                  <div className="mode-card__desc">
                    Latar gelap dengan tinta terang, mengurangi silau di ruangan remang.
                  </div>
                </button>
              </div>
            </div>

            {/* Timer: satu durasi per tipe soal */}
            <div className="timer-section">
              <div className="section-label">Waktu per soal</div>
              <div className="timer-groups">
                {hasMultipleChoice && (
                  <TimerSetting
                    label="Pilihan Ganda"
                    hint="Soal pilihan ganda dengan opsi A-D"
                    value={config.timerDuration}
                    presets={MC_TIMER_PRESETS}
                    onChange={(value) => setConfig((p) => ({ ...p, timerDuration: value }))}
                  />
                )}
                {hasShortAnswer && (
                  <TimerSetting
                    label="Isian Singkat"
                    hint="Siswa butuh waktu lebih untuk menjawab"
                    value={config.shortAnswerTimerDuration}
                    presets={SA_TIMER_PRESETS}
                    onChange={(value) => setConfig((p) => ({ ...p, shortAnswerTimerDuration: value }))}
                  />
                )}
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="advanced-section">
              <button
                className="advanced-toggle"
                onClick={() => {
                  const el = document.querySelector('.advanced-content') as HTMLElement;
                  const arrow = document.querySelector('.advanced-toggle__arrow');
                  if (el) {
                    el.style.display = el.style.display === 'none' ? 'flex' : 'none';
                    arrow?.classList.toggle('advanced-toggle__arrow--open');
                  }
                }}
                aria-expanded="false"
              >
                <span>Pengaturan lanjutan</span>
                <span className="advanced-toggle__arrow">
                  <IconChevronDown size={18} />
                </span>
              </button>
              <div className="advanced-content" style={{ display: 'none' }}>
                {/* Shuffle */}
                <div className="toggle-row">
                  <div>
                    <div className="toggle-row__label">Acak urutan soal</div>
                    <div className="toggle-row__desc">Urutan soal diacak setiap kali kuis dimulai</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={config.shuffleQuestions}
                      onChange={(e) => setConfig((p) => ({ ...p, shuffleQuestions: e.target.checked }))}
                    />
                    <span className="toggle-switch__track"></span>
                    <span className="toggle-switch__thumb"></span>
                  </label>
                </div>

                <div className="toggle-row">
                  <div>
                    <div className="toggle-row__label">Acak pilihan jawaban</div>
                    <div className="toggle-row__desc">Urutan pilihan A sampai D tidak tetap</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={config.shuffleAnswers}
                      onChange={(e) => setConfig((p) => ({ ...p, shuffleAnswers: e.target.checked }))}
                    />
                    <span className="toggle-switch__track"></span>
                    <span className="toggle-switch__thumb"></span>
                  </label>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--rule)', margin: '4px 0' }} />

                {/* Sound */}
                <div className="toggle-row">
                  <div>
                    <div className="toggle-row__label">Bunyi</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={config.soundEnabled}
                      onChange={(e) => setConfig((p) => ({ ...p, soundEnabled: e.target.checked }))}
                    />
                    <span className="toggle-switch__track"></span>
                    <span className="toggle-switch__thumb"></span>
                  </label>
                </div>

                {config.soundEnabled && (
                  <div className="sound-settings">
                    <div>
                      <div className="toggle-row__label" style={{ marginBottom: '6px' }}>Volume</div>
                      <input
                        type="range"
                        className="volume-slider"
                        min={0}
                        max={1}
                        step={0.1}
                        value={config.volume}
                        onChange={(e) => setConfig((p) => ({ ...p, volume: parseFloat(e.target.value) }))}
                        aria-label="Volume"
                      />
                    </div>
                    <div className="sound-checkbox-row">
                      <input
                        type="checkbox"
                        className="sound-checkbox"
                        checked={config.soundTransitions}
                        onChange={(e) => setConfig((p) => ({ ...p, soundTransitions: e.target.checked }))}
                      />
                      <span className="sound-checkbox-label">Pergantian soal</span>
                    </div>
                    <div className="sound-checkbox-row">
                      <input
                        type="checkbox"
                        className="sound-checkbox"
                        checked={config.soundWarning}
                        onChange={(e) => setConfig((p) => ({ ...p, soundWarning: e.target.checked }))}
                      />
                      <span className="sound-checkbox-label">Peringatan waktu</span>
                    </div>
                    <div className="sound-checkbox-row">
                      <input
                        type="checkbox"
                        className="sound-checkbox"
                        checked={config.soundTimeUp}
                        onChange={(e) => setConfig((p) => ({ ...p, soundTimeUp: e.target.checked }))}
                      />
                      <span className="sound-checkbox-label">Waktu habis</span>
                    </div>
                    <div className="sound-checkbox-row">
                      <input
                        type="checkbox"
                        className="sound-checkbox"
                        checked={config.soundComplete}
                        onChange={(e) => setConfig((p) => ({ ...p, soundComplete: e.target.checked }))}
                      />
                      <span className="sound-checkbox-label">Kuis selesai</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Preview Soal & Jawaban */}
            <div className="preview-section">
              <button className="btn btn--outlined btn--large preview-open-btn" onClick={openPreview}>
                <IconEye size={18} /> Lihat soal dan jawaban
              </button>
              <button className="btn btn--outlined btn--large preview-open-btn" onClick={printAnswerKey}>
                <IconPrint size={18} /> Cetak kunci jawaban
              </button>
              <div className="preview-section__hint">
                Cek {quiz.questions.length} soal beserta jawabannya sebelum tampil di kelas. Lembar
                cetak untuk penilaian di atas kertas.
              </div>
            </div>

            {/* Start Button */}
            <div className="start-section">
              <button className="start-btn" onClick={startQuiz}>
                <IconPlay size={20} /> Mulai kuis
              </button>
            </div>
          </div>
        </main>

        {answerKeySheet}

        {/* Panel gambar hanya ada di layar Siap: guru memutuskan di sini, bukan saat presentasi
            sudah berjalan di depan kelas. */}
        {showMediaPanel && (
          <MediaPanel
            questions={quiz.originalQuestions}
            failures={imageFailures}
            notes={imageResizes}
            note={mediaNote}
            busy={mediaBusy}
            onPick={pickImageFile}
            onRemove={removeImage}
            onClose={() => setShowMediaPanel(false)}
          />
        )}

        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleMediaFileInput}
        />

        {showPreview && (
          <QuizPreview
            title={quiz.title}
            questions={previewQuestions}
            index={previewIndex}
            direction={previewDir}
            duration={previewDuration}
            revealed={previewReveal}
            shuffleActive={config.shuffleQuestions}
            onPrev={() => previewGo(-1)}
            onNext={() => previewGo(1)}
            onToggleReveal={() => setPreviewReveal((prev) => !prev)}
            onClose={closePreview}
          />
        )}
      </div>
    );
  }

  // ===== RENDER: PRESENTATION MODE =====
  if (screen === 'presentation' && quiz) {
    /* Satu syarat untuk semua bentuk reveal: tombol mata di bar kontrol dan reveal otomatis saat
       waktu habis dua-duanya menyalakan `showCorrectAnswer`, jadi keduanya tampil sama.
       Sebelum 2026-09-29 jalur pilihan ganda hanya membaca `presState === 'answer-reveal'`,
       yang cuma dinyalakan jalur otomatis: tombol mata di mode latihan adalah tombol mati untuk
       soal pilihan ganda (barisnya tidak pernah naik ke tengah), padahal README
       menjanjikannya dan soal isian singkat sudah bekerja. Syaratnya kini disamakan dengan
       jalur isian singkat, dan latar blur memakai syarat yang sama supaya latar itu tidak
       pernah muncul tanpa jawaban di atasnya. */
    const isAnswerRevealed = showCorrectAnswer && currentQuestion !== null;
    const currentFigures = imagesOf(currentQuestion);
    const hasFigure = currentFigures.some((image) => image.src !== '');

    return (
      <>
        <div className="presentation" ref={presContainerRef}>
          {/* Header */}
          <div className="pres-header">
            <div className="pres-title">{quiz.title}</div>
            <div className="pres-counter counter-tick" key={`counter-${currentQ}`}>
              {String(currentQ + 1).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}
            </div>
          </div>

          {/* Countdown */}
          {presState === 'countdown' && (
            <div className="overlay countdown-overlay">
              <div className="countdown-overlay__number" key={countdownValue}>
                {countdownValue > 0 ? countdownValue : 'Mulai'}
              </div>
            </div>
          )}

          {/* Timer */}
          <div className="timer-area">
            <div
              className={`timer-display ${
                remainingTime <= 5 ? 'timer-display--critical' :
                remainingTime <= 10 ? 'timer-display--warning' : ''
              }`}
              aria-live="polite"
              aria-atomic="true"
              aria-label={`${remainingTime} detik tersisa`}
            >
              {String(Math.floor(remainingTime / 60)).padStart(2, '0')}:{String(remainingTime % 60).padStart(2, '0')}
            </div>
            {/* --seg-count gives the rail one notch per second: a 60 second question draws 60
                segments, so the class can count remaining seconds off the screen. */}
            <div
              className="timer-progress"
              style={{ '--seg-count': Math.max(1, currentDuration) } as CSSProperties}
            >
              <div
                className={`timer-progress__bar ${
                  remainingTime <= 5 ? 'timer-progress__bar--critical' :
                  remainingTime <= 10 ? 'timer-progress__bar--warning' : ''
                }`}
                style={{ transform: `scaleX(${timeProgress / 100})` }}
              />
            </div>
          </div>

          {/* Question */}
          {(presState === 'question-active' || presState === 'time-warning' || presState === 'time-up' || presState === 'answer-reveal' || presState === 'transitioning' || showCorrectAnswer) && currentQuestion && (
            <div
              className={`question-area${hasFigure ? ' question-area--figure' : ''}${presState === 'transitioning' || presState === 'time-up' ? ' question-area--leaving' : ''}`}
              data-num={`${currentQ + 1}.`}
            >
              <div className="question-meta question-enter-up" key={`meta-${currentQ}`}>
                <span className={`question-type-chip question-type-chip--${currentQuestion.type}`}>
                  {currentQuestion.type === 'short-answer' ? 'Isian singkat' : 'Pilihan ganda'}
                </span>
                <span className="question-type-chip question-type-chip--timer">
                  {currentDuration} detik
                </span>
              </div>
              <div className="question-text question-enter" key={`q-${currentQ}`}>
                {currentQuestion.text}
              </div>
              <QuestionFigure
                key={`figure-${currentQ}`}
                images={currentFigures}
                questionNumber={currentQ + 1}
                onZoom={setZoomedImage}
              />
              {currentQuestion.type === 'multiple-choice' ? (
                <div className={`answer-grid question-area-enter ${isAnswerRevealed ? 'answer-grid--reveal' : ''}`} key={`a-${currentQ}`}>
                  {currentQuestion.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isCorrect = i === currentQuestion.correctAnswer;
                    return (
                      <div
                        key={i}
                        className={`answer-card ${isAnswerRevealed && isCorrect ? 'answer-card--center' : ''} ${isAnswerRevealed && !isCorrect ? 'answer-card--fade-out' : ''}`}
                      >
                        <div className="answer-card__letter">{letter}</div>
                        <div className="answer-card__text">{opt}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={`short-answer-card question-area-enter-sa ${isAnswerRevealed ? 'short-answer-card--reveal' : ''}`} key={`a-${currentQ}`}>
                  {isAnswerRevealed ? (
                    <div className="short-answer-card__answer" key={`sa-${currentQ}`}>
                      {currentQuestion.acceptedAnswers.join(' / ')}
                    </div>
                  ) : (
                    <div className="short-answer-card__placeholder">
                      <span>Jawaban</span>
                      <span className="short-answer-card__hint" aria-hidden="true" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Latar jawaban. Satu-satunya elemen ber-blur di aplikasi, dan alasannya ada di
              DESIGN.md: kelas sedang membaca satu jawaban, bukan sepuluh baris soal sekaligus.
              Letaknya di luar .question-area supaya ia tidak ikut terpotong `overflow: hidden`,
              dan z-index-nya di bawah kartu jawaban (1050) serta bar kontrol guru (1050), jadi
              guru masih bisa menekan tombol mata untuk menutup jawabannya lagi. */}
          {isAnswerRevealed && <div className="reveal-backdrop" aria-hidden="true" />}

          {/* Progress bar */}
          <div className="pres-progress">
            <div className="pres-progress__bar" style={{ transform: `scaleX(${progress / 100})` }} />
          </div>

          {/* Time's Up Overlay */}
          {presState === 'time-up' && (
            <div className="overlay timeup-overlay">
              <div className="timeup-overlay__text">Waktu habis</div>
            </div>
          )}

          {/* Transition Overlay */}
          {presState === 'transitioning' && (
            <div className="overlay transition-overlay">
              <div className="transition-overlay__content">
                <div className="transition-overlay__label">Soal berikutnya</div>
                <div className="transition-overlay__number">
                  {String(Math.min(currentQ + 2, totalQuestions)).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}
                </div>
              </div>
            </div>
          )}

          {/* Pause Overlay */}
          {isPaused && (presState === 'question-active' || presState === 'time-warning') && (
            <div
              className="overlay pause-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pause-title"
            >
              <div className="pause-overlay__icon" aria-hidden="true">
                <IconPause size={48} />
              </div>
              <div className="pause-overlay__text" id="pause-title">
                Dijeda
              </div>
              <div className="pause-overlay__sub">
                Tekan Spasi atau tombol di bawah untuk melanjutkan
              </div>
              <button className="btn btn--primary btn--large" onClick={togglePause}>
                <IconPlay size={18} /> Lanjutkan
              </button>
            </div>
          )}

          {/* Teacher Controls */}
          {showTeacherControls && (
            <div className="teacher-controls">
              <div className="teacher-controls__group">
                <button
                  className="control-btn"
                  onClick={togglePause}
                  title={isPaused ? 'Lanjutkan (Spasi)' : 'Jeda (Spasi)'}
                  aria-label={isPaused ? 'Lanjutkan' : 'Jeda'}
                >
                  {isPaused ? <IconPlay /> : <IconPause />}
                </button>
                <button className="control-btn" onClick={skipToNext} title="Soal berikutnya (N)" aria-label="Soal berikutnya">
                  <IconNext />
                </button>
                {config.mode === 'practice' && (
                  <button
                    className={`control-btn ${showCorrectAnswer ? 'control-btn--active' : ''}`}
                    onClick={() => setShowCorrectAnswer(!showCorrectAnswer)}
                    title="Tampilkan atau sembunyikan jawaban"
                    aria-label="Tampilkan atau sembunyikan jawaban"
                  >
                    <IconEye />
                  </button>
                )}
              </div>
              <div className="teacher-controls__group">
                <button
                  ref={answerKeyOpenerRef}
                  className="control-btn"
                  onClick={() => setShowAnswerKey(true)}
                  title="Kunci jawaban"
                  aria-label="Buka kunci jawaban"
                >
                  <IconKey />
                </button>
                <span className="control-label">{config.mode === 'daily' ? 'Mode harian' : 'Mode latihan'}</span>
                <button
                  className={`control-btn ${!config.soundEnabled ? 'control-btn--danger' : ''}`}
                  onClick={toggleMute}
                  title={config.soundEnabled ? 'Bisukan bunyi' : 'Nyalakan bunyi'}
                  aria-label={config.soundEnabled ? 'Bisukan bunyi' : 'Nyalakan bunyi'}
                >
                  {config.soundEnabled ? <IconSound /> : <IconMute />}
                </button>
                <button className="control-btn" onClick={toggleFullscreen} title="Layar penuh (F)" aria-label="Layar penuh">
                  {isFullscreen ? <IconCollapse /> : <IconExpand />}
                </button>
                <button
                  ref={exitDialogOpenerRef}
                  className="control-btn control-btn--danger"
                  onClick={() => setShowExitDialog(true)}
                  title="Keluar dari presentasi"
                  aria-label="Keluar dari presentasi"
                >
                  <IconClose />
                </button>
              </div>
            </div>
          )}
        </div>



        {answerKeySheet}

        {/* Zoom gambar. Satu-satunya tempat gambar boleh diperbesar melewati ukuran aslinya,
            karena aksinya sengaja dan sebentar: guru sedang menunjukkan satu detail ke kelas. */}
        {zoomedImage && (
          <div
            className="zoom-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Gambar soal diperbesar"
            onClick={() => setZoomedImage(null)}
          >
            <img className="zoom-overlay__image" src={zoomedImage.src} alt={zoomedImage.alt} draggable={false} />
            <div className="zoom-overlay__hint">Soal {currentQ + 1} · klik atau Esc untuk menutup</div>
          </div>
        )}

        {/* Exit Dialog */}
        {showExitDialog && (
          <>
            <div className="backdrop" onClick={closeExitDialog} />
            <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="exit-dialog-title">
              <div className="dialog__title" id="exit-dialog-title">Keluar dari presentasi?</div>
              <div className="dialog__body">
                Kuis akan berhenti dan kamu kembali ke layar persiapan. Soal yang sudah tampil tetap
                tersimpan sebagai sesi terakhir.
              </div>
              <div className="dialog__actions">
                <button ref={exitDialogCancelRef} className="btn btn--text" onClick={closeExitDialog}>
                  Batal
                </button>
                <button className="btn btn--primary" onClick={exitPresentation}>
                  Keluar
                </button>
              </div>
            </div>
          </>
        )}

        {/* Answer Key Panel */}
        {showAnswerKey && (
          <>
            <div className="backdrop" onClick={closeAnswerKey} />
            <div className="answer-key-panel" role="dialog" aria-modal="true" aria-labelledby="answer-key-title">
              <div className="answer-key-header">
                <div className="answer-key-header__title" id="answer-key-title">Kunci jawaban</div>
                <div className="answer-key-header__actions">
                  <button className="btn btn--outlined btn--small" onClick={printAnswerKey}>
                    <IconPrint size={16} /> Cetak
                  </button>
                  <button
                    ref={answerKeyCloseRef}
                    className="btn btn--icon-only"
                    onClick={closeAnswerKey}
                    aria-label="Tutup kunci jawaban"
                  >
                    <IconClose />
                  </button>
                </div>
              </div>
              <div className="answer-key-list">
                {quiz.originalQuestions.map((q, i) => (
                  <div key={i} className="answer-key-item">
                    <div className="answer-key-item__num">{String(i + 1).padStart(2, '0')}</div>
                    <div className={`answer-key-item__letter${q.type === 'short-answer' ? ' answer-key-item__letter--text' : ''}`}>
                      {q.type === 'multiple-choice'
                        ? String.fromCharCode(65 + q.correctAnswer)
                        : q.acceptedAnswers.join(' / ')}
                    </div>
                    {/* Satu thumbnail per soal bergambar, hanya yang pertama: di daftar padat ini
                        guru cuma perlu mengenali soalnya. Kalau gambarnya gagal dimuat ia
                        menghilang, bukan berubah jadi ikon rusak di depan kelas. */}
                    {imagesOf(q)[0]?.src ? (
                      <img
                        className="answer-key-item__thumb"
                        src={imagesOf(q)[0].src}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.style.visibility = 'hidden';
                        }}
                      />
                    ) : null}
                    <div style={{ font: 'var(--md-sys-typescale-body-medium)', color: 'var(--md-sys-color-on-surface)', flex: 1, lineHeight: 1.4 }}>
                      {q.text.length > 60 ? q.text.substring(0, 60) + '…' : q.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Completion Screen */}
        {presState === 'quiz-complete' && (
          <div className="completion-screen">
            <img src={COMPLETION_MASCOT} alt="" className="completion-mascot" draggable={false} />
            {config.mode === 'daily' ? (
              <>
                <h1 className="completion-title">Penilaian selesai</h1>
                <p className="completion-subtitle">
                  {totalQuestions} soal sudah ditampilkan.
                  <br />
                  Lanjutkan ke pemeriksaan lembar jawaban.
                </p>
              </>
            ) : (
              <>
                <h1 className="completion-title">Kuis selesai</h1>
                <p className="completion-subtitle">
                  {totalQuestions} soal sudah dibahas bersama kelas.
                </p>
              </>
            )}
            <div className="completion-actions">
              {config.mode === 'practice' && (
                <button className="btn btn--primary btn--large" onClick={restartQuiz}>
                  Ulangi dari awal
                </button>
              )}
              <button className="btn btn--secondary btn--large" onClick={exitPresentation}>
                <IconClose size={18} /> Keluar
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback
  return null;
}

export default App;
