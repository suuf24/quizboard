import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import './App.css';
import type { Quiz, QuizConfig, QuizMode, PresentationState, AppScreen, ParseResult, Question, Theme } from './types';
import { parseQuizTemplate, shuffleArray } from './parser.js';
import { demoQuiz } from './demo.js';
import { clearSession, describeSavedAt, loadSession, loadTheme, saveSession, saveTheme } from './storage.js';
import type { SavedSession } from './storage.js';
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
  IconEye,
  IconFolder,
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
              <td>{question.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
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
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseQuizTemplate(text);
      setParseResult(result);
      if (result.success && result.quiz) {
        setQuiz(result.quiz);
        setTimeout(() => setScreen('setup'), 1500);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

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
            }, 800);
          }, 4000);
        } else {
          // Daily mode: TIME'S UP overlay, then next question
          setPresState('time-up');
          if (config.soundEnabled && config.soundTimeUp) {
            playTimeUp(config.volume);
          }
          // Wait for mascot exit animation (0.75s) then transition
          setTimeout(() => {
            setPresState('transitioning');
            if (config.soundEnabled && config.soundTransitions) {
              playTransition(config.volume);
            }
            setTimeout(() => {
              goToNextQuestion();
            }, 800);
          }, 750);
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
    setPresState('transitioning');
    if (config.soundEnabled && config.soundTransitions) {
      playTransition(config.volume);
    }
    setTimeout(() => {
      goToNextQuestion();
    }, 500);
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
    setPresState('idle');
    setScreen('setup');
    setShowExitDialog(false);
    setShowAnswerKey(false);
    setShowCorrectAnswer(false);
    setShowPreview(false);
  }, []);

  const restartQuiz = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
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

      // Escape unwinds one layer at a time: the exit dialog, then the answer key, and only
      // then the presentation shortcuts. It never opens a new layer on top of an open one.
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
  useEffect(() => {
    if (!quiz) return;
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

# Soal isian singkat: tanpa opsi, langsung Answer: teks jawaban
3. Lambang kimia air adalah...
Answer: H2O

# Beberapa jawaban alternatif dipisah tanda | (salah satu saja sudah benar)
4. Satuan turunan SI untuk gaya adalah...
Answer: Newton | N

5. Bagian saluran pernapasan yang terletak di tenggorokan adalah?
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

            {!parseResult && savedSession && (
              <div className="resume-card">
                <div className="resume-card__body">
                  <div className="resume-card__title">Lanjutkan kuis terakhir</div>
                  <div className="resume-card__meta">
                    {savedSession.quiz.title}, {savedSession.quiz.questions.length} soal, berhenti di soal{' '}
                    {Math.min(savedSession.currentQuestion + 1, savedSession.quiz.questions.length)}.{' '}
                    Terakhir dibuka {describeSavedAt(savedSession.savedAt)}.
                  </div>
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

            {!parseResult ? (
              <>
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
                    Berkas .txt: nomor. soal, opsi (a) sampai (d), lalu Answer: huruf kunci
                  </div>
                  <input
                    id="file-input"
                    type="file"
                    accept=".txt"
                    style={{ display: 'none' }}
                    onChange={handleFileInput}
                  />
                </div>

                <div className="import-actions">
                  <button className="btn btn--outlined" onClick={downloadTemplate}>
                    <IconDownload size={18} /> Unduh template
                  </button>
                  <button className="btn btn--outlined" onClick={loadDemo}>
                    <IconPlay size={18} /> Coba contoh
                  </button>
                </div>
              </>
            ) : parseResult.success ? (
              <div className="import-result">
                <div className="import-success">
                  <div className="import-success__icon"><IconCheck size={32} /></div>
                  <div className="import-success__title">Berkas berhasil dibaca</div>
                  <div className="import-success__subtitle">
                    {quiz?.questions.length} soal siap ditampilkan
                  </div>
                </div>
              </div>
            ) : (
              <div className="import-result">
                <div className="import-error">
                  <div className="import-error__icon"><IconAlert size={32} /></div>
                  <div className="import-error__title">Berkas ini belum bisa dibaca</div>
                  <div className="import-error__message">{parseResult.error}</div>
                  <div className="import-error__list">
                    <li>Soal pilihan ganda punya 4 opsi (A, B, C, D) + Answer: huruf</li>
                    <li>Soal isian singkat cukup Answer: teks jawaban (alternatif dipisah |)</li>
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
    const isAnswerRevealed = showCorrectAnswer && currentQuestion;

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
              className={`question-area${presState === 'transitioning' || presState === 'time-up' ? ' question-area--leaving' : ''}`}
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
              {currentQuestion.type === 'multiple-choice' ? (
                <div className={`answer-grid question-area-enter ${presState === 'answer-reveal' ? 'answer-grid--reveal' : ''}`} key={`a-${currentQ}`}>
                  {currentQuestion.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isCorrect = i === currentQuestion.correctAnswer;
                    return (
                      <div
                        key={i}
                        className={`answer-card ${presState === 'answer-reveal' && isCorrect ? 'answer-card--center' : ''} ${presState === 'answer-reveal' && !isCorrect ? 'answer-card--fade-out' : ''}`}
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
