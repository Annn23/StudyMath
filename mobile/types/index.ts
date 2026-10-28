export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  grade_level: 'Perkuliahan' | 'Kuliah' | 'SD' | 'SMP' | 'SMA' | 'Umum' | null;
  subjects: string[];
  study_style: 'visual' | 'auditory' | 'reading' | 'kinesthetic' | null;
  mbti?: string | null;
  university?: string | null;
  expo_push_token?: string | null;
  location: string | null;
  is_available: boolean;
  is_blocked: boolean;
  total_sessions: number;
  average_rating: number;
  created_at: string;
  updated_at: string;
};

export type Match = {
  id: string;
  user_id: string;
  target_user_id: string;
  action: 'like' | 'pass' | 'super_like';
  is_matched: boolean;
  created_at: string;
  profile?: Profile;
};

export type Conversation = {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  other_user?: Profile;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_url?: string | null;
  is_read: boolean;
  created_at: string;
};

export type StudySession = {
  id: string;
  title: string;
  description: string | null;
  organizer_id: string;
  partner_id: string;
  partner_ids?: string[];
  subject: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  meeting_link: string | null;
  created_at: string;
  updated_at: string;
  organizer?: Profile;
  partner?: Profile;
  participants?: Profile[];
};

export type SessionParticipant = {
  id: string;
  session_id: string;
  user_id: string;
  role: 'organizer' | 'participant';
  status: 'pending' | 'confirmed' | 'declined';
  created_at: string;
  profile?: Profile;
};

export type Review = {
  id: string;
  reviewer_id: string;
  reviewed_id: string;
  session_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: Profile;
};

export type Notification = {
  id: string;
  user_id: string;
  type: 'match' | 'message' | 'session_invite' | 'session_confirmed' | 'review' | 'system';
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

export type Report = {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: string;
};

export const SUBJECTS = [
  'Matematika',
  'Fisika',
  'Kimia',
  'Biologi',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'Sejarah',
  'Geografi',
  'Ekonomi',
  'Sosiologi',
  'Bahasa Arab',
  'Pendidikan Agama',
  'Seni Budaya',
  'Pemrograman',
  'Desain Grafis',
  'Akuntansi',
  'Manajemen',
  'Hukum',
  'Kedokteran',
  'Teknik',
];

export const GRADE_LEVELS = ['Perkuliahan'] as const;

export const UNIVERSITIES = [
  'Universitas Indonesia (UI)',
  'Institut Teknologi Bandung (ITB)',
  'Universitas Gadjah Mada (UGM)',
  'Institut Teknologi Sepuluh Nopember (ITS)',
  'Universitas Airlangga (UNAIR)',
  'Universitas Diponegoro (UNDIP)',
  'Universitas Brawijaya (UB)',
  'Universitas Padjadjaran (UNPAD)',
  'Universitas Sebelas Maret (UNS)',
  'Institut Pertanian Bogor (IPB)',
  'Universitas Hasanuddin (UNHAS)',
  'Universitas Negeri Yogyakarta (UNY)',
  'Universitas Pendidikan Indonesia (UPI)',
  'Universitas Negeri Malang (UM)',
  'Universitas Negeri Semarang (UNNES)',
  'Universitas Negeri Jakarta (UNJ)',
  'Universitas Udayana (UNUD)',
  'Universitas Sumatera Utara (USU)',
  'Universitas Andalas (UNAND)',
  'Universitas Sriwijaya (UNSRI)',
  'Universitas Telkom',
  'Binus University',
  'Universitas Trisakti',
  'Universitas Tarumanagara (UNTAR)',
  'Universitas Atma Jaya',
  'Universitas Islam Indonesia (UII)',
  'Universitas Muhammadiyah Yogyakarta (UMY)',
  'Universitas Muhammadiyah Surakarta (UMS)',
  'Universitas Kristen Petra',
  'Universitas Sanata Dharma',
  'Lainnya',
] as const;

export const STUDY_STYLES = [
  { value: 'visual', label: 'Visual', icon: '👁️', desc: 'Belajar dengan gambar & diagram' },
  { value: 'auditory', label: 'Auditori', icon: '👂', desc: 'Belajar dengan mendengarkan' },
  { value: 'reading', label: 'Membaca', icon: '📖', desc: 'Belajar dengan teks & catatan' },
  { value: 'kinesthetic', label: 'Kinestetik', icon: '✋', desc: 'Belajar dengan praktik langsung' },
] as const;

// ==================== STUDY SERVERS & GROUPS ====================

export type StudyServer = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  subject: string | null;
  owner_id: string;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender: string | null;
  created_at: string;
  updated_at: string;
  members_count?: number;
  is_owner?: boolean;
};

export type ServerMember = {
  id: string;
  server_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profile?: Profile;
};

export type ServerMessage = {
  id: string;
  server_id: string;
  sender_id: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  sender?: Profile;
};

