import type { Quiz } from './types.js';

export const demoQuiz: Quiz = {
  title: 'IPA - Sistem Pernapasan Manusia',
  originalQuestions: [
    {
      id: 1,
      type: 'multiple-choice',
      text: 'Organ tubuh utama yang berfungsi dalam sistem pernapasan manusia adalah?',
      options: ['Jantung', 'Paru-paru', 'Lambung', 'Ginjal'],
      correctAnswer: 1,
    },
    {
      id: 2,
      type: 'short-answer',
      text: 'Proses pertukaran oksigen dan karbon dioksida di dalam tubuh disebut?',
      acceptedAnswers: ['Pernapasan', 'Respirasi'],
    },
    {
      id: 3,
      type: 'multiple-choice',
      text: 'Bagian saluran pernapasan yang terletak di tenggorokan adalah?',
      options: ['Bronkus', 'Trakea', 'Alveoli', 'Diafragma'],
      correctAnswer: 1,
    },
    {
      id: 4,
      type: 'multiple-choice',
      text: 'Saat kita menghirup udara, udara akan masuk ke tubuh melalui?',
      options: ['Mulut saja', 'Hidung dan mulut', 'Telinga', 'Kulit'],
      correctAnswer: 1,
    },
    {
      id: 5,
      type: 'short-answer',
      text: 'Gas yang diperlukan oleh tubuh manusia untuk proses pernapasan adalah?',
      acceptedAnswers: ['Oksigen', 'O2'],
    },
    {
      id: 6,
      type: 'multiple-choice',
      text: 'Organ pernapasan pada burung yang berfungsi sebagai paru-paru adalah?',
      options: ['Trakea', 'Pleura', 'Tembolok', 'Kantung udara'],
      correctAnswer: 3,
    },
    {
      id: 7,
      type: 'multiple-choice',
      text: 'Otot yang berperan penting dalam proses pernapasan adalah?',
      options: ['Otot lengan', 'Otot punggung', 'Diafragma', 'Otot leher'],
      correctAnswer: 2,
    },
    {
      id: 8,
      type: 'short-answer',
      text: 'Organ pernapasan utama pada manusia adalah?',
      acceptedAnswers: ['Paru-paru', 'Paru paru', 'Paru-paru manusia'],
    },
    {
      id: 9,
      type: 'multiple-choice',
      text: 'Kantung udara pada burung berfungsi untuk?',
      options: ['Menyimpan makanan', 'Membantu proses pernapasan', 'Menjaga suhu tubuh', 'Menyimpan air'],
      correctAnswer: 1,
    },
    {
      id: 10,
      type: 'multiple-choice',
      text: 'Pada saat menarik napas, diafragma akan?',
      options: ['Mengecil dan mendatar', 'Membesar dan melengkung', 'Tetap diam', 'Bergetar'],
      correctAnswer: 0,
    },
    {
      id: 11,
      type: 'short-answer',
      text: 'Gas yang dikeluarkan tubuh saat menghembuskan napas dalam jumlah lebih banyak adalah?',
      acceptedAnswers: ['Karbon dioksida', 'CO2', 'Karbondioksida'],
    },
    {
      id: 12,
      type: 'multiple-choice',
      text: 'Apa yang terjadi pada rongga dada saat kita menghembuskan napas?',
      options: ['Membesar', 'Menyusut', 'Tetap sama', 'Menghilang'],
      correctAnswer: 1,
    },
    {
      id: 13,
      type: 'multiple-choice',
      text: 'Penyakit yang menyerang saluran pernapasan dan menyebabkan sesak napas adalah?',
      options: ['Diabetes', 'Asma', 'Anemia', 'Rematik'],
      correctAnswer: 1,
    },
    {
      id: 14,
      type: 'multiple-choice',
      text: 'Alveoli adalah struktur dalam paru-paru yang berfungsi untuk?',
      options: ['Menyaring udara', 'Pertukaran gas', 'Menyimpan oksigen', 'Membersihkan debu'],
      correctAnswer: 1,
    },
    {
      id: 15,
      type: 'short-answer',
      text: 'Ikan bernapas menggunakan organ yang disebut?',
      acceptedAnswers: ['Insang'],
    },
    {
      id: 16,
      type: 'multiple-choice',
      text: 'Proses pernapasan yang terjadi di dalam sel tubuh manusia menghasilkan?',
      options: ['Oksigen', 'Air dan karbon dioksida', 'Glukosa', 'Protein'],
      correctAnswer: 1,
    },
    {
      id: 17,
      type: 'multiple-choice',
      text: 'Bronkus adalah saluran pernapasan yang bercabang dari?',
      options: ['Hidung', 'Mulut', 'Trakea', 'Kerongkongan'],
      correctAnswer: 2,
    },
    {
      id: 18,
      type: 'multiple-choice',
      text: 'Serat otot diafragma merupakan jenis otot?',
      options: ['Otot lurik', 'Otot polos', 'Otot jantung', 'Otot rangka'],
      correctAnswer: 1,
    },
    {
      id: 19,
      type: 'short-answer',
      text: 'Sistem pernapasan pada serangga menggunakan organ yang disebut?',
      acceptedAnswers: ['Spirakel', 'Trakea'],
    },
    {
      id: 20,
      type: 'multiple-choice',
      text: 'Kapasitas vital paru-paru adalah?',
      options: ['Udara setelah tarik napas penuh', 'Udara maksimum yang dapat dikeluarkan setelah tarik napas penuh', 'Udara yang selalu ada di paru-paru', 'Udara saat bernapas normal'],
      correctAnswer: 1,
    },
    {
      id: 21,
      type: 'multiple-choice',
      text: 'Udara yang keluar dari tubuh saat menghembuskan napas mengandung lebih banyak?',
      options: ['Oksigen', 'Nitrogen', 'Karbon dioksida', 'Hidrogen'],
      correctAnswer: 2,
    },
    {
      id: 22,
      type: 'multiple-choice',
      text: 'Bagian dari saluran pernapasan yang berfungsi untuk menahan debu dan kotoran dari udara yang masuk adalah?',
      options: ['Alveoli', 'Bronkus', 'Rambut hidung dan lendir', 'Diafragma'],
      correctAnswer: 2,
    },
  ],
  get questions() {
    return this.originalQuestions;
  },
};

export function getDemoTemplate(): string {
  let template = `Title: IPA - Sistem Pernapasan Manusia\n\n`;
  demoQuiz.originalQuestions.forEach((q) => {
    template += `${q.id}. ${q.text}\n`;
    if (q.type === 'multiple-choice') {
      template += `A. ${q.options[0]}\n`;
      template += `B. ${q.options[1]}\n`;
      template += `C. ${q.options[2]}\n`;
      template += `D. ${q.options[3]}\n`;
      template += `Answer: ${String.fromCharCode(65 + q.correctAnswer)}\n\n`;
    } else {
      template += `Answer: ${q.acceptedAnswers.join(' | ')}\n\n`;
    }
  });
  return template;
}
