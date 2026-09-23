import type { Question, ParseResult } from './types.js';

/**
 * Template format (mixed quiz with multiple-choice & short-answer):
 *
 * Title: IPA - Campuran Soal
 *
 * # Lines starting with # are comments and are ignored
 *
 * 1. Organ tubuh yang berfungsi memompa darah adalah...
 * A. Jantung
 * B. Paru-paru
 * C. Lambung
 * D. Ginjal
 * Answer: A
 *
 * 2. Lambang kimia air adalah...
 * Answer: H2O
 *
 * 3. Satuan turunan SI untuk gaya adalah...
 * Answer: Newton | N
 *
 * Rules:
 * - A question is multiple-choice if its numbered line is followed by option
 *   lines matching ^[A-Da-d][.)], then a required "Answer: <letter A-D>".
 * - A question is short-answer if its numbered line is directly followed by
 *   "Answer: <text>" with NO option lines. Multiple accepted answers are
 *   separated by "|". Answers are trimmed; comparison is case-insensitive.
 * - Comment lines start with "#" and are ignored entirely.
 * - Question numbers may have gaps; unknown lines between questions are skipped.
 */

/** Trim + lowercase, used for accepted-answer comparison. */
export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase();
}

const QUESTION_RE = /^(\d+)[\.\)]\s*(.+)/;
const OPTION_RE = /^([A-Da-d])[\.\)]\s*(.+)/;
const ANSWER_LETTER_RE = /^answer\s*:\s*([A-Da-d])\s*$/i;
const ANSWER_TEXT_RE = /^answer\s*:\s*(.*)$/i;
const COMMENT_RE = /^#/;

export function parseQuizTemplate(content: string): ParseResult {
  try {
    const lines = content
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !COMMENT_RE.test(l));

    let title = 'Quiz';
    const titleMatch = lines.find(l => /^title\s*:/i.test(l));
    if (titleMatch) {
      title = titleMatch.replace(/^title\s*:\s*/i, '').trim();
    }

    const questions: Question[] = [];
    let i = 0;

    // Find first question
    while (i < lines.length) {
      const qMatch = lines[i].match(QUESTION_RE);
      if (qMatch) break;
      // Skip non-question lines (but capture title if found)
      if (!titleMatch && i === 0) {
        title = lines[i];
      }
      i++;
    }

    while (i < lines.length) {
      const qMatch = lines[i].match(QUESTION_RE);
      if (!qMatch) {
        i++;
        continue;
      }

      const questionNumber = qMatch[1];
      const questionText = qMatch[2].trim();
      const options: string[] = [];
      let correctIndex = -1;
      i++;

      // Peek: option lines → multiple-choice; otherwise short-answer
      const hasOptions = i < lines.length && OPTION_RE.test(lines[i]);

      if (hasOptions) {
        // ===== Multiple-choice =====
        while (i < lines.length && options.length < 4) {
          const optMatch = lines[i].match(OPTION_RE);
          if (optMatch) {
            options.push(optMatch[2].trim());
            i++;
          } else {
            break;
          }
        }

        // Read the answer letter
        while (i < lines.length) {
          const ansMatch = lines[i].match(ANSWER_LETTER_RE);
          if (ansMatch) {
            correctIndex = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
            i++;
            break;
          }
          // Check if we hit next question
          if (QUESTION_RE.test(lines[i])) break;
          i++;
        }

        if (options.length === 4 && correctIndex >= 0 && correctIndex <= 3) {
          questions.push({
            id: questions.length + 1,
            type: 'multiple-choice',
            text: questionText,
            options: options as [string, string, string, string],
            correctAnswer: correctIndex,
          });
        } else {
          return {
            success: false,
            error: `Question ${questionNumber} has an issue. Make sure it has 4 options (A-D) and an answer.`,
            errorQuestion: parseInt(questionNumber),
          };
        }
      } else {
        // ===== Short-answer =====
        let rawAnswer: string | null = null;
        while (i < lines.length) {
          const ansMatch = lines[i].match(ANSWER_TEXT_RE);
          if (ansMatch) {
            rawAnswer = ansMatch[1];
            i++;
            break;
          }
          // Check if we hit next question
          if (QUESTION_RE.test(lines[i])) break;
          i++;
        }

        const acceptedAnswers = (rawAnswer ?? '')
          .split('|')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        if (acceptedAnswers.length === 0) {
          return {
            success: false,
            error: `Soal ${questionNumber} (isian singkat) belum punya jawaban. Tulis setelah 'Answer:'.`,
            errorQuestion: parseInt(questionNumber),
          };
        }

        questions.push({
          id: questions.length + 1,
          type: 'short-answer',
          text: questionText,
          acceptedAnswers,
        });
      }
    }

    if (questions.length === 0) {
      return {
        success: false,
        error: 'No questions found. Please add at least one question to your template.',
      };
    }

    return {
      success: true,
      quiz: {
        title,
        questions,
        originalQuestions: [...questions],
      },
    };
  } catch {
    return {
      success: false,
      error: "We couldn't read this quiz. Please check the template format and try again.",
    };
  }
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
