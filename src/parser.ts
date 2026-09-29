import type { Question, ParseResult, QuestionImage } from './types.js';
import { MAX_IMAGES_PER_QUESTION, classifySource } from './images.js';

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
 * 4. Perhatikan diagram berikut. Bagian yang ditunjuk anak panah disebut...
 * Image: alveolus.png | Diagram alveolus di dalam paru-paru
 * A. Bronkus
 * B. Alveolus
 * C. Trakea
 * D. Diafragma
 * Answer: B
 *
 * Rules:
 * - A question is multiple-choice if its numbered line is followed by option
 *   lines matching ^[A-Da-d][.)], then a required "Answer: <letter A-D>".
 * - A question is short-answer if its numbered line is directly followed by
 *   "Answer: <text>" with NO option lines. Multiple accepted answers are
 *   separated by "|". Answers are trimmed; comparison is case-insensitive.
 * - A question may carry images: one or more "Image: <source>" lines ("Gambar:" also works)
 *   anywhere between its numbered line and its "Answer:" line. <source> is an http(s) URL, or
 *   the file name of a local image that the teacher picks together with the .txt file. Text
 *   after the first "|" becomes the description (alt text). At most 3 images per question.
 * - A local file that is not picked yet is not an error: the quiz still opens, and the setup
 *   screen lists which images are still missing and attaches them one by one.
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
const IMAGE_RE = /^(?:image|gambar)\s*:\s*(.+)$/i;
const COMMENT_RE = /^#/;

/**
 * "Image: alveolus.png | Diagram alveolus" jadi sumber + deskripsi. Mengembalikan pesan galat
 * (string) kalau barisnya tidak bisa dipakai, jadi pemanggilnya tidak perlu melempar apa pun.
 */
function readImageLine(line: string, questionNumber: string): QuestionImage | string {
  const match = line.match(IMAGE_RE);
  const raw = match ? match[1].trim() : '';
  const [source, ...description] = raw.split('|');
  const trimmedSource = source.trim();

  if (!trimmedSource) {
    return `Soal ${questionNumber}: baris Image: belum menulis nama berkas atau alamat gambarnya.`;
  }

  const origin = classifySource(trimmedSource);
  if (origin === 'invalid') {
    return `Soal ${questionNumber}: alamat gambar "${trimmedSource}" tidak bisa dibuka. Pakai alamat yang diawali http:// atau https://, atau tulis nama berkas gambarnya.`;
  }

  return {
    source: trimmedSource,
    origin,
    // Gambar online sudah lengkap alamatnya; gambar lokal baru punya isi setelah dipasang guru.
    src: origin === 'remote' ? trimmedSource : '',
    alt: description.join('|').trim(),
  };
}

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
      const images: QuestionImage[] = [];
      let imageError: string | null = null;
      let correctIndex = -1;
      i++;

      /**
       * Baris Image: boleh muncul di mana saja antara baris soal dan Answer:, jadi setiap loop yang
       * sedang membaca baris berikutnya memanggil ini dulu sebelum memutuskan baris itu apa.
       * Tanpa itu, baris gambar di bawah baris soal akan membuat soal terdeteksi sebagai isian
       * singkat, dan baris gambar di antara opsi akan hilang diam-diam.
       */
      const collectImage = (line: string): boolean => {
        if (!IMAGE_RE.test(line)) return false;
        if (imageError) return true;
        if (images.length >= MAX_IMAGES_PER_QUESTION) {
          imageError = `Soal ${questionNumber} memuat lebih dari ${MAX_IMAGES_PER_QUESTION} gambar. Satu soal cukup ${MAX_IMAGES_PER_QUESTION} gambar supaya tetap terbaca di proyektor.`;
          return true;
        }
        const parsed = readImageLine(line, questionNumber);
        if (typeof parsed === 'string') imageError = parsed;
        else images.push(parsed);
        return true;
      };

      while (i < lines.length && collectImage(lines[i])) i++;

      // Peek: option lines → multiple-choice; otherwise short-answer
      const hasOptions = i < lines.length && OPTION_RE.test(lines[i]);

      if (hasOptions) {
        // ===== Multiple-choice =====
        while (i < lines.length && options.length < 4) {
          const optMatch = lines[i].match(OPTION_RE);
          if (optMatch) {
            options.push(optMatch[2].trim());
            i++;
          } else if (collectImage(lines[i])) {
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
          if (collectImage(lines[i])) {
            i++;
            continue;
          }
          // Check if we hit next question
          if (QUESTION_RE.test(lines[i])) break;
          i++;
        }

        if (imageError) {
          return { success: false, error: imageError, errorQuestion: parseInt(questionNumber) };
        }

        if (options.length === 4 && correctIndex >= 0 && correctIndex <= 3) {
          questions.push({
            id: questions.length + 1,
            type: 'multiple-choice',
            text: questionText,
            options: options as [string, string, string, string],
            correctAnswer: correctIndex,
            images: images.length > 0 ? images : undefined,
          });
        } else {
          return {
            success: false,
            error: `Soal ${questionNumber} (pilihan ganda) belum lengkap. Perlu 4 opsi (A sampai D) dan satu baris Answer: berisi huruf.`,
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
          if (collectImage(lines[i])) {
            i++;
            continue;
          }
          // Check if we hit next question
          if (QUESTION_RE.test(lines[i])) break;
          i++;
        }

        if (imageError) {
          return { success: false, error: imageError, errorQuestion: parseInt(questionNumber) };
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
          images: images.length > 0 ? images : undefined,
        });
      }
    }

    if (questions.length === 0) {
      return {
        success: false,
        error:
          "Belum ada soal yang terbaca. Pastikan ada minimal satu soal, ditulis dengan nomor di depan seperti '1. Pertanyaan?'.",
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
