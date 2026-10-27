export type MbtiDimension = 'EI' | 'SN' | 'TF' | 'JP';

export interface MbtiQuestion {
  id: number;
  dimension: MbtiDimension;
  question: string;
  optionA: {
    text: string;
    value: 'E' | 'S' | 'T' | 'J';
    trait: string;
  };
  optionB: {
    text: string;
    value: 'I' | 'N' | 'F' | 'P';
    trait: string;
  };
}

export interface MbtiTypeInfo {
  code: string;
  name: string;
  englishTitle: string;
  archetype: 'Diplomat' | 'Analis' | 'Pengawal' | 'Penjelajah';
  emoji: string;
  tagline: string;
  description: string;
  studyStyle: string;
  studyTips: string[];
  strengths: string[];
  compatibleMbti: string[];
  color: string;
  bgColor: string;
}

export const MBTI_TYPES: Record<string, MbtiTypeInfo> = {
  ENFJ: {
    code: 'ENFJ',
    name: 'Sang Protagonis',
    englishTitle: 'The Protagonist / The Teacher',
    archetype: 'Diplomat',
    emoji: '🌟',
    tagline: 'Pemimpin karismatik, empati tinggi & guru yang menginspirasi',
    description:
      'ENFJ adalah pribadi yang hangat, komunikatif, dan sangat peduli terhadap pertumbuhan orang lain. Mereka memiliki intuisi sosial yang tajam dan pandai mencairkan suasana belajar bersama.',
    studyStyle:
      'Sangat menyukai belajar kelompok kolaboratif dan metode "Teach-Back" (mengajarkan kembali materi ke teman). Pemahaman matematika ENFJ akan melonjak tinggi saat mereka menjelaskan konsep rumus tersebut kepada orang lain.',
    studyTips: [
      'Gunakan metode Peer-Tutoring: coba ajarkan rumus atau soal sulit ke partner belajarmu.',
      'Bentuk grup belajar server kecil yang suportif dan bebas dari konflik.',
      'Pahami "mengapa" dan dampak nyata suatu konsep matematika sebelum menghafalkan rumusnya.',
      'Jangan terlalu perfeksionis; beri apresiasi pada progres kecil belajarmu sendiri.',
    ],
    strengths: ['Komunikatif & hangat', 'Pemimpin kelompok alami', 'Mampu menyederhanakan konsep', 'Motivator ulung'],
    compatibleMbti: ['INFP', 'INTP', 'ISFP'],
    color: '#059669', // Emerald
    bgColor: '#ecfdf5',
  },
  INFP: {
    code: 'INFP',
    name: 'Sang Mediator',
    englishTitle: 'The Mediator',
    archetype: 'Diplomat',
    emoji: '🎨',
    tagline: 'Idealis, reflektif, penuh imajinasi & berhati tulus',
    description:
      'INFP adalah pembelajar reflektif yang tenang dan mengutamakan makna mendalam. Mereka suka mengeksplorasi konsep matematika dengan kecepatan mereka sendiri dalam suasana yang damai.',
    studyStyle:
      'Belajar mandiri di tempat yang hening atau sesi 1-on-1 dengan partner yang suportif. Mereka menyukai visualisasi konsep dan cerita analogi di balik teori matematika.',
    studyTips: [
      'Hubungkan konsep matematika abstrak dengan analogi kehidupan nyata.',
      'Hindari suasana belajar yang penuh tekanan atau bising.',
      'Buat rangkuman visual berwarna-warni atau mind-map.',
    ],
    strengths: ['Kreatif', 'Pemikir mendalam', 'Pendengar yang baik', 'Sangat suportif'],
    compatibleMbti: ['ENFJ', 'ENTJ', 'ENFP'],
    color: '#10b981',
    bgColor: '#f0fdf4',
  },
  INTJ: {
    code: 'INTJ',
    name: 'Sang Arsitek',
    englishTitle: 'The Architect',
    archetype: 'Analis',
    emoji: '🧠',
    tagline: 'Pemikir strategis, mandiri, analitis & berwawasan jauh',
    description:
      'INTJ memiliki rasa ingin tahu intelektual yang sangat tinggi. Mereka suka memecahkan masalah matematika yang kompleks dan membangun kerangka berpikir yang sistematis dan efisien.',
    studyStyle:
      'Belajar mandiri dengan target yang terstruktur ketat. Suka membongkar rumus untuk memahami logika dasarnya dan menyelesaikan soal-soal tingkat olimpiade atau penalaran tinggi.',
    studyTips: [
      'Buat peta konsep atau diagram logika untuk setiap bab matematika.',
      'Tantang dirimu dengan soal-soal pemecahan masalah non-rutin.',
      'Fokus pada efisiensi cara penyelesaian terpendek dan paling elegan.',
    ],
    strengths: ['Sangat logis', 'Strategis', 'Disiplin tinggi', 'Pemecah masalah rumit'],
    compatibleMbti: ['ENFP', 'ENTP', 'INFJ'],
    color: '#6d28d9', // Deep Purple
    bgColor: '#f5f3ff',
  },
  INTP: {
    code: 'INTP',
    name: 'Sang Logisi',
    englishTitle: 'The Logician',
    archetype: 'Analis',
    emoji: '🔬',
    tagline: 'Penemu ide orisinal, analitis mendalam & pecinta teori murni',
    description:
      'INTP selalu mempertanyakan bagaimana sesuatu bekerja. Dalam matematika, mereka tidak puas hanya diberi rumus jadi—mereka ingin menurunkan dan membuktikan kebenarannya.',
    studyStyle:
      'Eksplorasi bebas dan pembedahan teori matematika mendalam. Menyukai sesi diskusi debat logika dengan partner yang setara dalam pemikiran konseptual.',
    studyTips: [
      'Coba buktikan teorema secara mandiri sebelum melihat kunci jawaban.',
      'Gunakan platform komputasi atau grafik interaktif untuk memvalidasi rumus.',
      'Tetapkan tenggat waktu agar tidak terjebak dalam overthinking satu sub-bab.',
    ],
    strengths: ['Logika murni yang kuat', 'Objektif', 'Penemu cara alternatif', 'Berpikiran terbuka'],
    compatibleMbti: ['ENTJ', 'ENFJ', 'ESTJ'],
    color: '#7c3aed',
    bgColor: '#faf5ff',
  },
  ENTJ: {
    code: 'ENTJ',
    name: 'Sang Komandan',
    englishTitle: 'The Commander',
    archetype: 'Analis',
    emoji: '👑',
    tagline: 'Pemimpin visioner, tegas, efisien & berorientasi pada target tinggi',
    description:
      'ENTJ adalah pengambil keputusan yang percaya diri dan berenergi tinggi. Mereka memandang belajar matematika sebagai tantangan strategis yang harus ditaklukkan dengan skor tertinggi.',
    studyStyle:
      'Belajar dengan target waktu terukur (Pomodoro intensif) dan kompetisi sehat. Sangat bagus memimpin kelompok belajar dan membagi materi secara efisien.',
    studyTips: [
      'Gunakan sistem target harian: jumlah latihan soal yang harus dicapai per hari.',
      'Pimpin kelompok belajar untuk membahas bank soal ujian tahun-tahun lalu.',
      'Pantau statistik peningkatan kecepatan dan akurasi pengerjaan soal.',
    ],
    strengths: ['Kepemimpinan tegas', 'Manajemen waktu unggul', 'Fokus pada hasil', 'Percaya diri'],
    compatibleMbti: ['INTP', 'INFP', 'INTJ'],
    color: '#4c1d95',
    bgColor: '#f3e8ff',
  },
  ENTP: {
    code: 'ENTP',
    name: 'Sang Pendebat',
    englishTitle: 'The Debater',
    archetype: 'Analis',
    emoji: '💡',
    tagline: 'Cerdas, fleksibel, suka eksplorasi ide baru & debat seru',
    description:
      'ENTP suka menguji batas pemikiran konvensional. Mereka paling bersemangat ketika menemukan trik matematika cepat dan cara unik menyelesaikan soal matematika yang rumit.',
    studyStyle:
      'Brainstorming dinamis, debat konsep, dan memecahkan teka-teki logika matematika yang menantang. Cepat bosan dengan hafalan rumus rutin.',
    studyTips: [
      'Cari trik cepat (shortcut) matematika dan bagikan ke teman grup belajarmu.',
      'Ubah materi yang membosankan menjadi permainan logika atau kuis kompetisi.',
      'Pastikan kamu menyelesaikan satu bab tuntas sebelum loncat ke topik baru.',
    ],
    strengths: ['Cepat tanggap', 'Penuh inovasi', 'Pakar berpikir lateral', 'Antusias'],
    compatibleMbti: ['INFJ', 'INTJ', 'ENFP'],
    color: '#5b21b6',
    bgColor: '#ede9fe',
  },
  INFJ: {
    code: 'INFJ',
    name: 'Sang Advokat',
    englishTitle: 'The Advocate',
    archetype: 'Diplomat',
    emoji: '🔮',
    tagline: 'Visioner pendiam, berprinsip teguh & penuh wawasan intuitif',
    description:
      'INFJ adalah tipe yang langka, memiliki perpaduan antara empati mendalam dan visi konseptual yang kuat. Mereka suka memahami filosofi dan keteraturan alam semesta melalui matematika.',
    studyStyle:
      'Sesi belajar tenang dengan fokus terarah. Mereka suka merangkum esensi teori dan mencari harmoni dalam rumus-rumus aljabar maupun geometri.',
    studyTips: [
      'Belajarlah di lingkungan yang tenang dan estetik.',
      'Tulis catatan matematika dengan alur cerita atau hubungan sebab-akibat.',
      'Hindari sesi maraton mendadak; cicil materi dengan jadwal yang teratur.',
    ],
    strengths: ['Intuisi mendalam', 'Berwawasan luas', 'Berdedikasi', 'Penuh empati'],
    compatibleMbti: ['ENTP', 'ENFP', 'INTJ'],
    color: '#0d9488', // Teal
    bgColor: '#f0fdfa',
  },
  ENFP: {
    code: 'ENFP',
    name: 'Sang Juru Kampanye',
    englishTitle: 'The Campaigner',
    archetype: 'Diplomat',
    emoji: '🚀',
    tagline: 'Antusias, kreatif, ramah & penuh energi positif',
    description:
      'ENFP memandang dunia penuh kemungkinan. Mereka suka bergaul dan membawa energi ceria ke dalam sesi belajar bersama, membuat matematika terasa lebih menyenangkan dan tidak menakutkan.',
    studyStyle:
      'Belajar sosial interaktif dengan musik santai, visualisasi warna-warni, dan variasi topik agar tidak monoton. Sangat baik belajar bersama partner yang terstruktur.',
    studyTips: [
      'Gunakan teknik Pomodoro pendek (25m belajar, 5m rileks) agar tetap segar.',
      'Gunakan flashcard digital atau kuis gamifikasi.',
      'Pasangkan dirimu dengan partner tipe Judging (J) untuk menjaga jadwal tetap on-track.',
    ],
    strengths: ['Sangat kreatif', 'Menularkan semangat', 'Mudah beradaptasi', 'Komunikatif'],
    compatibleMbti: ['INTJ', 'INFJ', 'ENFJ'],
    color: '#0284c7', // Sky Blue
    bgColor: '#f0f9ff',
  },
  ISTJ: {
    code: 'ISTJ',
    name: 'Sang Logistikus',
    englishTitle: 'The Logistician',
    archetype: 'Pengawal',
    emoji: '📋',
    tagline: 'Praktis, sangat disiplin, teliti pada fakta & bertanggung jawab',
    description:
      'ISTJ adalah pilar keandalan. Dalam belajar matematika, mereka memiliki ketekunan luar biasa dalam mengerjakan latihan soal langkah demi langkah secara akurat tanpa ceroboh.',
    studyStyle:
      'Belajar terstruktur dengan metode yang sudah baku, jadwal ketat, dan bank soal lengkap. Mereka unggul dalam menghitung teliti dan mengikuti prosedur rumus.',
    studyTips: [
      'Gunakan buku latihan berjenjang dari tingkat dasar hingga mahir.',
      'Buat ringkasan rumus dalam kartu saku untuk diulang secara teratur.',
      'Pertahankan jadwal belajar harian pada jam yang sama setiap hari.',
    ],
    strengths: ['Ketelitian tinggi', 'Disiplin baja', 'Bisa diandalkan', 'Metodis'],
    compatibleMbti: ['ESFP', 'ESTP', 'ISFJ'],
    color: '#1e40af', // Blue
    bgColor: '#eff6ff',
  },
  ISFJ: {
    code: 'ISFJ',
    name: 'Sang Pembela',
    englishTitle: 'The Defender',
    archetype: 'Pengawal',
    emoji: '🛡️',
    tagline: 'Hangat, sangat telaten, setia & selalu siap membantu teman',
    description:
      'ISFJ adalah teman belajar yang luar biasa baik hati. Mereka sangat teliti dalam mencatat pelajaran dan senang berbagi catatan rapi mereka dengan teman sekelas.',
    studyStyle:
      'Belajar tenang dengan pengulangan rutin dan contoh soal bertahap. Menyukai suasana belajar yang harmonis, saling menghargai, dan tidak kompetitif.',
    studyTips: [
      'Susun catatan materi dengan warna pulpen yang berbeda untuk rumus utama.',
      'Latih pemahaman dengan mengerjakan soal yang memiliki pembahasan lengkap.',
      'Jangan ragu bertanya jika ada langkah pengerjaan yang belum dipahami.',
    ],
    strengths: ['Sangat teliti', 'Catatan super rapi', 'Sabar dan setia kawan', 'Konsisten'],
    compatibleMbti: ['ESFJ', 'ESTJ', 'ISTJ'],
    color: '#2563eb',
    bgColor: '#eff6ff',
  },
  ESTJ: {
    code: 'ESTJ',
    name: 'Sang Eksekutif',
    englishTitle: 'The Executive',
    archetype: 'Pengawal',
    emoji: '📊',
    tagline: 'Pengatur ulung, praktis, tegas & berorientasi pada aturan yang jelas',
    description:
      'ESTJ suka keteraturan dan fakta yang jelas. Dalam matematika, mereka menghargai kepastian jawaban pasti dan suka mengorganisir jadwal kelompok belajar agar tepat waktu.',
    studyStyle:
      'Belajar sistematis dengan target bab yang jelas, latihan soal berulang, dan simulasi tryout berkala untuk mengukur skor nyata.',
    studyTips: [
      'Buat simulasi ujian matematika dengan pembatasan waktu riil.',
      'Gunakan tabel ceklis target untuk setiap sub-materi yang sudah dikuasai.',
      'Ajak teman belajar yang fokus dan tidak suka menunda-nunda waktu.',
    ],
    strengths: ['Terorganisir rapi', 'Tegas dan fokus', 'Manajemen waktu tepat', 'Jujur'],
    compatibleMbti: ['ISFP', 'ISTP', 'ENTJ'],
    color: '#1d4ed8',
    bgColor: '#dbeafe',
  },
  ESFJ: {
    code: 'ESFJ',
    name: 'Sang Konsul',
    englishTitle: 'The Consul',
    archetype: 'Pengawal',
    emoji: '🤝',
    tagline: 'Hangat, ramah, suka bekerja sama & peduli pada kebutuhan kelompok',
    description:
      'ESFJ menciptakan rasa kebersamaan yang menyenangkan di mana pun mereka berada. Mereka memastikan semua anggota kelompok belajar merasa nyaman dan tidak tertinggal materi.',
    studyStyle:
      'Belajar kelompok dengan komunikasi aktif dan saling menyemangati. Membutuhkan konfirmasi bahwa mereka berada di jalur yang benar dalam memecahkan soal.',
    studyTips: [
      'Ajak teman belajar bersama di ruang video server atau kafe belajar yang nyaman.',
      'Bacakan dan diskusikan soal bersama partner belajar secara bergantian.',
      'Rayakan pencapaian belajar bersama teman untuk menjaga motivasi.',
    ],
    strengths: ['Pencipta keharmonisan', 'Sangat suportif', 'Pekerja keras', 'Ramah'],
    compatibleMbti: ['ISFJ', 'ISTJ', 'ENFJ'],
    color: '#3b82f6',
    bgColor: '#eff6ff',
  },
  ISTP: {
    code: 'ISTP',
    name: 'Sang Virtuoso',
    englishTitle: 'The Virtuoso',
    archetype: 'Penjelajah',
    emoji: '🛠️',
    tagline: 'Pragmatis, tenang di bawah tekanan, ahli instrumen & pemecah masalah langsung',
    description:
      'ISTP menyukai hal-hal yang memiliki fungsi praktis. Mereka belajar matematika dengan cara mencoba langsung rumus pada soal ketimbang membaca teori panjang lebar.',
    studyStyle:
      'Pendekatan hands-on: langsung lompat ke soal latihan dan mengotak-atik rumus sampai ketemu solusinya. Sangat tenang menghadapi ujian sulit.',
    studyTips: [
      'Gunakan aplikasi kalkulator grafik atau software simulasi matematika.',
      'Pelajari rumus lewat kasus aplikasi nyata (fisika, ekonomi, programming).',
      'Hindari sesi diskusi yang bertele-tele; fokus langsung pada pemecahan soal.',
    ],
    strengths: ['Tenang saat ujian', 'Praktis dan efisien', 'Penalaran spasial bagus', 'Cepat tanggap'],
    compatibleMbti: ['ESTJ', 'ESFJ', 'ENTJ'],
    color: '#d97706', // Amber
    bgColor: '#fffbeb',
  },
  ISFP: {
    code: 'ISFP',
    name: 'Sang Petualang',
    englishTitle: 'The Adventurer',
    archetype: 'Penjelajah',
    emoji: '🌿',
    tagline: 'Sensitif, ramah, menyukai keindahan & belajar dengan ritme tenang',
    description:
      'ISFP adalah jiwa bebas yang rendah hati. Mereka tidak menyukai tekanan kaku atau kompetisi agresif, dan lebih menikmati belajar matematika saat suasana hatinya sedang rileks.',
    studyStyle:
      'Belajar visual dengan gambar geometri yang indah, sketsa grafik, dan lingkungan belajar yang santai tanpa intimidasi.',
    studyTips: [
      'Gambar grafik fungsi dan bangun ruang dengan rapi dan berikan warna pembeda.',
      'Belajarlah diiringi musik instrumental lembut yang menenangkan pikiran.',
      'Beri jeda istirahat teratur saat mulai merasa lelah dengan hitungan angka.',
    ],
    strengths: ['Apresiasi visual tinggi', 'Fleksibel', 'Tidak menghakimi', 'Rendah hati'],
    compatibleMbti: ['ESTJ', 'ESFJ', 'ENFJ'],
    color: '#ea580c', // Orange
    bgColor: '#fff7ed',
  },
  ESTP: {
    code: 'ESTP',
    name: 'Sang Pengusaha',
    englishTitle: 'The Entrepreneur',
    archetype: 'Penjelajah',
    emoji: '⚡',
    tagline: 'Cekatan, energik, berani mengambil risiko & suka aksi nyata spontan',
    description:
      'ESTP penuh vitalitas dan suka tantangan cepat. Mereka tidak suka duduk diam mendengarkan ceramah teori panjang; mereka ingin langsung menguji kemampuan mereka di lapangan.',
    studyStyle:
      'Belajar cepat lewat kuis cepat (speed-quiz), tantangan duel matematika, dan belajar sambil bergerak aktif. Cepat menangkap logika praktis.',
    studyTips: [
      'Gunakan timer hitung mundur saat latihan soal untuk melatih kecepatan.',
      'Ikuti kuis interaktif atau lomba adu cepat menjawab di grup belajar.',
      'Ganti posisi belajar secara berkala agar tidak merasa terkekang.',
    ],
    strengths: ['Kecepatan reaksi tinggi', 'Penuh energi', 'Pandai bernegosiasi', 'Berani'],
    compatibleMbti: ['ISTJ', 'ISFJ', 'ISTP'],
    color: '#f59e0b',
    bgColor: '#fffbeb',
  },
  ESFP: {
    code: 'ESFP',
    name: 'Sang Penghibur',
    englishTitle: 'The Entertainer',
    archetype: 'Penjelajah',
    emoji: '🎭',
    tagline: 'Spontan, ceria, ramah & membuat suasana belajar jadi hidup',
    description:
      'ESFP adalah pribadi yang gemar bersosialisasi dan membawa keceriaan. Mereka membuat sesi belajar matematika yang tadinya menegangkan menjadi seru dan penuh tawa bersama teman.',
    studyStyle:
      'Belajar bersama teman (study group) dengan diskusi aktif, video animasi pembelajaran yang menarik, dan tidak kaku.',
    studyTips: [
      'Tonton video animasi matematika atau penjelasan konsep interaktif di YouTube.',
      'Ajak teman belajar sambil sesekali bercanda ringan agar otak tidak tegang.',
      'Gunakan analogi cerita menyenangkan saat menghafal rumus rumit.',
    ],
    strengths: ['Sangat ramah', 'Pencair suasana tegang', 'Antusias', 'Praktis'],
    compatibleMbti: ['ISTJ', 'ISFJ', 'ENFJ'],
    color: '#e11d48', // Rose
    bgColor: '#fff1f2',
  },
};

/**
 * 12 Soal Tes MBTI Standar Khusus Gaya Belajar Matematika & Mahasiswa
 * (3 Soal per dimensi: E/I, S/N, T/F, J/P)
 */
export const MBTI_QUESTIONS: MbtiQuestion[] = [
  // ==================== DIMENSI 1: E vs I (3 Soal) ====================
  {
    id: 1,
    dimension: 'EI',
    question: 'Saat sedang mempersiapkan ujian matematika yang materinya sangat sulit, Anda lebih memilih:',
    optionA: {
      text: 'Belajar kelompok atau berdiskusi dengan teman agar lebih termotivasi dan bersemangat',
      value: 'E',
      trait: 'Ekstrovert (E)',
    },
    optionB: {
      text: 'Belajar sendirian di ruangan yang tenang dan hening untuk fokus memahami konsep',
      value: 'I',
      trait: 'Introvert (I)',
    },
  },
  {
    id: 2,
    dimension: 'EI',
    question: 'Setelah sesi belajar bersama selama berjam-jam dengan teman, kondisi energi Anda biasanya:',
    optionA: {
      text: 'Merasa berenergi dan masih bersemangat untuk lanjut mengobrol atau nongkrong',
      value: 'E',
      trait: 'Ekstrovert (E)',
    },
    optionB: {
      text: 'Merasa lelah secara sosial dan butuh waktu tenang sendirian ("me-time") untuk recharge',
      value: 'I',
      trait: 'Introvert (I)',
    },
  },
  {
    id: 3,
    dimension: 'EI',
    question: 'Di dalam ruang panggilan belajar server atau grup kelas, gaya komunikasi Anda adalah:',
    optionA: {
      text: 'Aktif menyapa, spontan bertanya, dan berani mengutarakan pendapat di depan semua orang',
      value: 'E',
      trait: 'Ekstrovert (E)',
    },
    optionB: {
      text: 'Cenderung mengamati dulu dan baru berbicara jika diminta atau benar-benar diperlukan',
      value: 'I',
      trait: 'Introvert (I)',
    },
  },

  // ==================== DIMENSI 2: S vs N (3 Soal) ====================
  {
    id: 4,
    dimension: 'SN',
    question: 'Saat mempelajari rumus matematika yang baru, Anda lebih cepat paham jika dijelaskan dengan:',
    optionA: {
      text: 'Contoh angka nyata, langkah-langkah bertahap yang terbukti, dan penerapan praktis',
      value: 'S',
      trait: 'Sensing (S)',
    },
    optionB: {
      text: 'Gambaran besar, konsep abstrak di balik rumusnya, dan hubungan teoritis di masa depan',
      value: 'N',
      trait: 'Intuition (N)',
    },
  },
  {
    id: 5,
    dimension: 'SN',
    question: 'Anda menganggap diri Anda sebagai tipe pembelajar yang:',
    optionA: {
      text: 'Realistis, teliti pada detail angka, dan berpijak pada metode yang sudah jelas',
      value: 'S',
      trait: 'Sensing (S)',
    },
    optionB: {
      text: 'Imajinatif, suka mencari pola tersembunyi, dan tertarik pada kemungkinan cara baru',
      value: 'N',
      trait: 'Intuition (N)',
    },
  },
  {
    id: 6,
    dimension: 'SN',
    question: 'Ketika membaca buku atau diktat catatan kuliah matematika:',
    optionA: {
      text: 'Membaca secara teratur halaman demi halaman dan detail pada rumus yang ada',
      value: 'S',
      trait: 'Sensing (S)',
    },
    optionB: {
      text: 'Suka membaca intisarinya dulu, melompat ke bab menarik, dan menghubungkan ide-ide besar',
      value: 'N',
      trait: 'Intuition (N)',
    },
  },

  // ==================== DIMENSI 3: T vs F (3 Soal) ====================
  {
    id: 7,
    dimension: 'TF',
    question: 'Ketika teman belajar Anda salah menerapkan rumus atau keliru dalam berhitung:',
    optionA: {
      text: 'Langsung menunjukkan kesalahannya secara jujur dan objektif agar cepat diperbaiki',
      value: 'T',
      trait: 'Thinking (T)',
    },
    optionB: {
      text: 'Menyampaikannya secara hati-hati dan mengapresiasi usahanya agar tidak melukai perasaannya',
      value: 'F',
      trait: 'Feeling (F)',
    },
  },
  {
    id: 8,
    dimension: 'TF',
    question: 'Pertimbangan utama Anda saat menentukan keputusan dalam tugas kelompok belajar adalah:',
    optionA: {
      text: 'Logika, efisiensi kerja, analisis untung-rugi, dan keadilan hasil yang objektif',
      value: 'T',
      trait: 'Thinking (T)',
    },
    optionB: {
      text: 'Kekompakan kelompok, keharmonisan suasana, dan kenyamanan perasaan setiap anggota',
      value: 'F',
      trait: 'Feeling (F)',
    },
  },
  {
    id: 9,
    dimension: 'TF',
    question: 'Apa yang membuat Anda paling puas saat berhasil menyelesaikan soal matematika yang sangat rumit?',
    optionA: {
      text: 'Rasa bangga karena analisis logika dan penalaran rasional Anda terbukti tepat dan akurat',
      value: 'T',
      trait: 'Thinking (T)',
    },
    optionB: {
      text: 'Rasa bahagia karena bisa membantu teman sekelompok memahami soal tersebut bersama-sama',
      value: 'F',
      trait: 'Feeling (F)',
    },
  },

  // ==================== DIMENSI 4: J vs P (3 Soal) ====================
  {
    id: 10,
    dimension: 'JP',
    question: 'Bagaimana cara Anda mengelola waktu belajar dan tugas-tugas kuliah?',
    optionA: {
      text: 'Membuat jadwal terstruktur (to-do list) dan berusaha menyelesaikannya tepat waktu sebelum deadline',
      value: 'J',
      trait: 'Judging (J)',
    },
    optionB: {
      text: 'Mengalir secara fleksibel dan spontan, sering kali baru bersemangat saat mendekati deadline',
      value: 'P',
      trait: 'Perceiving (P)',
    },
  },
  {
    id: 11,
    dimension: 'JP',
    question: 'Meja belajar atau susunan catatan materi Anda biasanya terlihat:',
    optionA: {
      text: 'Rapi, terorganisir per bab/folder, dan setiap buku memiliki tempatnya masing-masing',
      value: 'J',
      trait: 'Judging (J)',
    },
    optionB: {
      text: 'Cenderung bebas atau tampak berantakan, tetapi Anda tahu persis letak catatan yang dicari',
      value: 'P',
      trait: 'Perceiving (P)',
    },
  },
  {
    id: 12,
    dimension: 'JP',
    question: 'Jika tiba-tiba teman membatalkan atau mengubah rencana sesi belajar kelompok secara mendadak:',
    optionA: {
      text: 'Merasa kurang nyaman dan terganggu karena rencana yang sudah tersusun rapi jadi berantakan',
      value: 'J',
      trait: 'Judging (J)',
    },
    optionB: {
      text: 'Santai saja dan dengan mudah beradaptasi untuk mengganti aktivitas lain secara spontan',
      value: 'P',
      trait: 'Perceiving (P)',
    },
  },
];

export interface MbtiCalculationResult {
  mbti: string;
  eScore: number;
  iScore: number;
  sScore: number;
  nScore: number;
  tScore: number;
  fScore: number;
  jScore: number;
  pScore: number;
  ePercent: number;
  iPercent: number;
  sPercent: number;
  nPercent: number;
  tPercent: number;
  fPercent: number;
  jPercent: number;
  pPercent: number;
  details: MbtiTypeInfo;
}

/**
 * Menghitung tipe kepribadian MBTI dan persentasenya berdasarkan jawaban
 */
export function calculateMbtiResult(answers: Record<number, 'A' | 'B'>): MbtiCalculationResult {
  let eCount = 0;
  let iCount = 0;
  let sCount = 0;
  let nCount = 0;
  let tCount = 0;
  let fCount = 0;
  let jCount = 0;
  let pCount = 0;

  MBTI_QUESTIONS.forEach((q) => {
    const choice = answers[q.id];
    if (choice === 'A') {
      if (q.optionA.value === 'E') eCount++;
      if (q.optionA.value === 'S') sCount++;
      if (q.optionA.value === 'T') tCount++;
      if (q.optionA.value === 'J') jCount++;
    } else if (choice === 'B') {
      if (q.optionB.value === 'I') iCount++;
      if (q.optionB.value === 'N') nCount++;
      if (q.optionB.value === 'F') fCount++;
      if (q.optionB.value === 'P') pCount++;
    }
  });

  const letter1 = eCount >= iCount ? 'E' : 'I';
  const letter2 = sCount >= nCount ? 'S' : 'N';
  const letter3 = tCount >= fCount ? 'T' : 'F';
  const letter4 = jCount >= pCount ? 'J' : 'P';

  const mbtiCode = `${letter1}${letter2}${letter3}${letter4}`;
  const totalDim = 3; // 3 soal per dimensi

  const ePercent = Math.round((eCount / totalDim) * 100);
  const iPercent = 100 - ePercent;
  const sPercent = Math.round((sCount / totalDim) * 100);
  const nPercent = 100 - sPercent;
  const tPercent = Math.round((tCount / totalDim) * 100);
  const fPercent = 100 - tPercent;
  const jPercent = Math.round((jCount / totalDim) * 100);
  const pPercent = 100 - jPercent;

  const details = MBTI_TYPES[mbtiCode] || MBTI_TYPES.ENFJ;

  return {
    mbti: mbtiCode,
    eScore: eCount,
    iScore: iCount,
    sScore: sCount,
    nScore: nCount,
    tScore: tCount,
    fScore: fCount,
    jScore: jCount,
    pScore: pCount,
    ePercent,
    iPercent,
    sPercent,
    nPercent,
    tPercent,
    fPercent,
    jPercent,
    pPercent,
    details,
  };
}

/**
 * Mendapatkan detail tipe MBTI dengan fallback aman
 */
export function getMbtiInfo(code: string | null | undefined): MbtiTypeInfo | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  return MBTI_TYPES[upper] || null;
}
