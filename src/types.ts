export type QuestionType = 'multiple-choice' | 'short-answer';

export interface BaseQuestion {
  id: number;
  type: QuestionType;
  text: string;
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
