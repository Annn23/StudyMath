-- StudyMatch Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================
-- PROFILES TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  username TEXT UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  grade_level TEXT, -- 'Perkuliahan' (Kuliah)
  subjects TEXT[] DEFAULT '{}',
  study_style TEXT, -- 'visual', 'auditory', 'reading', 'kinesthetic'
  location TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  is_blocked BOOLEAN DEFAULT FALSE,
  total_sessions INT DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- MATCHES TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT CHECK (action IN ('like', 'pass', 'super_like')),
  is_matched BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_user_id)
);

-- ===========================
-- CONVERSATIONS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  participant_1 UUID REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2 UUID REFERENCES profiles(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- MESSAGES TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- STUDY SESSIONS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  organizer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT DEFAULT 60,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  meeting_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- REVIEWS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reviewed_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES study_sessions(id) ON DELETE SET NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reviewer_id, session_id)
);

-- ===========================
-- NOTIFICATIONS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('match', 'message', 'session_invite', 'session_confirmed', 'review', 'system')),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- REPORTS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- ROW LEVEL SECURITY (RLS)
-- ===========================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- ===========================
-- TABLE PRIVILEGES (GRANT)
-- Project Supabase baru tidak otomatis memberi akses tabel ke role authenticated.
-- RLS di bawah tetap membatasi baris mana yang boleh diakses.
-- ===========================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- Profiles: user boleh membuat baris profilnya sendiri (fallback jika trigger belum jalan)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Profiles: viewable by everyone, editable by owner
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Matches: users can see their own matches, create and update
CREATE POLICY "Users can view their own matches"
  ON matches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = target_user_id);

CREATE POLICY "Users can create matches"
  ON matches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own matches" ON matches;
CREATE POLICY "Users can update their own matches"
  ON matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = target_user_id);

-- Conversations: participants can view, insert, and update
CREATE POLICY "Conversation participants can view"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Participants can insert conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Participants can update conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Messages: participants can view, send, and update (mark read)
CREATE POLICY "Participants can view messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Participants can update messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

-- Study Sessions: participants can view
CREATE POLICY "Session participants can view"
  ON study_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = organizer_id OR auth.uid() = partner_id);

CREATE POLICY "Users can create sessions"
  ON study_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizer can update sessions"
  ON study_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = organizer_id OR auth.uid() = partner_id);

-- Reviews: viewable by all authenticated
CREATE POLICY "Reviews are viewable by authenticated users"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

-- Notifications: own view & update, authenticated insert
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ===========================
-- FUNCTIONS & TRIGGERS
-- ===========================

-- Auto create profile on signup with complete metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, avatar_url, grade_level, university, study_style, location, subjects, bio, is_available
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'grade_level', 'Perkuliahan'),
    NEW.raw_user_meta_data->>'university',
    NEW.raw_user_meta_data->>'study_style',
    NEW.raw_user_meta_data->>'location',
    CASE
      WHEN NEW.raw_user_meta_data->'subjects' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'subjects') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'subjects'))
      ELSE '{}'::text[]
    END,
    NEW.raw_user_meta_data->>'bio',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    grade_level = COALESCE(EXCLUDED.grade_level, profiles.grade_level, 'Perkuliahan'),
    university = COALESCE(EXCLUDED.university, profiles.university),
    study_style = COALESCE(EXCLUDED.study_style, profiles.study_style),
    location = COALESCE(EXCLUDED.location, profiles.location),
    subjects = CASE WHEN EXCLUDED.subjects <> '{}' THEN EXCLUDED.subjects ELSE profiles.subjects END,
    bio = COALESCE(EXCLUDED.bio, profiles.bio);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update profile updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto create conversation & notifications when match/like happens
CREATE OR REPLACE FUNCTION handle_new_match()
RETURNS TRIGGER AS $$
DECLARE
  reverse_match matches%ROWTYPE;
  user_a profiles%ROWTYPE;
  user_b profiles%ROWTYPE;
  existing_conv_id UUID;
BEGIN
  -- 1. Anti-rekursi: hentikan jika trigger dipanggil secara bersarang (kedalaman > 1)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- 2. Jika operasi UPDATE tapi kolom action tidak berubah dan sudah matched, abaikan
  IF TG_OP = 'UPDATE' THEN
    IF OLD.action = NEW.action AND OLD.is_matched = NEW.is_matched THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Data user pemrakarsa dan target
  SELECT * INTO user_a FROM profiles WHERE id = NEW.user_id;
  SELECT * INTO user_b FROM profiles WHERE id = NEW.target_user_id;

  -- Cek apakah target user sudah pernah like kita sebelumnya
  SELECT * INTO reverse_match
  FROM matches
  WHERE user_id = NEW.target_user_id
    AND target_user_id = NEW.user_id
    AND action IN ('like', 'super_like');

  IF FOUND THEN
    -- Match terjadi! Update kedua baris match menjadi true hanya jika belum true
    UPDATE matches 
    SET is_matched = TRUE
    WHERE ((user_id = NEW.user_id AND target_user_id = NEW.target_user_id)
       OR (user_id = NEW.target_user_id AND target_user_id = NEW.user_id))
      AND is_matched IS NOT TRUE;

    -- Cek apakah sudah ada conversation sebelumnya agar tidak duplikat
    SELECT id INTO existing_conv_id
    FROM conversations
    WHERE (participant_1 = NEW.user_id AND participant_2 = NEW.target_user_id)
       OR (participant_1 = NEW.target_user_id AND participant_2 = NEW.user_id)
    LIMIT 1;

    IF existing_conv_id IS NULL THEN
      -- Buat obrolan conversation baru
      INSERT INTO conversations (participant_1, participant_2)
      VALUES (NEW.user_id, NEW.target_user_id);
    END IF;

    -- Kirim notifikasi Match ke kedua belah pihak jika belum ada notifikasi serupa baru-baru ini
    IF NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE user_id = NEW.user_id 
        AND type = 'match' 
        AND (data->>'matched_user_id')::text = NEW.target_user_id::text
    ) THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES
        (
          NEW.user_id,
          'match',
          'Kalian Match! 🎉',
          'Kamu dan ' || COALESCE(user_b.full_name, 'teman belajarmu') || ' saling menyukai!',
          json_build_object('matched_user_id', NEW.target_user_id)
        ),
        (
          NEW.target_user_id,
          'match',
          'Kalian Match! 🎉',
          'Kamu dan ' || COALESCE(user_a.full_name, 'teman belajarmu') || ' saling menyukai!',
          json_build_object('matched_user_id', NEW.user_id)
        );
    END IF;
  ELSE
    -- Belum match, tapi user_a baru saja menyapa/like user_b
    IF NEW.action IN ('like', 'super_like') THEN
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = NEW.target_user_id
          AND type = 'match'
          AND (data->>'matched_user_id')::text = NEW.user_id::text
      ) THEN
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          NEW.target_user_id,
          'match',
          'Seseorang Menyukai Profilmu! 💞',
          COALESCE(user_a.full_name, 'Seseorang') || ' menyapamu dan ingin belajar bersama!',
          json_build_object('matched_user_id', NEW.user_id)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_match ON matches;
CREATE TRIGGER on_new_match
  AFTER INSERT OR UPDATE OF action ON matches
  FOR EACH ROW
  WHEN (NEW.action IN ('like', 'super_like'))
  EXECUTE FUNCTION handle_new_match();

-- Auto notifikasi saat ada pesan masuk baru
CREATE OR REPLACE FUNCTION handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  conv conversations%ROWTYPE;
  sender_prof profiles%ROWTYPE;
  recipient_id UUID;
BEGIN
  SELECT * INTO conv FROM conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Tentukan penerima
  IF conv.participant_1 = NEW.sender_id THEN
    recipient_id := conv.participant_2;
  ELSE
    recipient_id := conv.participant_1;
  END IF;

  -- Ambil nama pengirim
  SELECT * INTO sender_prof FROM profiles WHERE id = NEW.sender_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    recipient_id,
    'message',
    CASE
      WHEN NEW.content LIKE '[[CALL:video:%' THEN '📹 ' || COALESCE(sender_prof.full_name, 'Teman Belajar') || ' memanggilmu'
      WHEN NEW.content LIKE '[[CALL:voice:%' THEN '📞 ' || COALESCE(sender_prof.full_name, 'Teman Belajar') || ' memanggilmu'
      ELSE COALESCE(sender_prof.full_name, 'Teman Belajar') || ' mengirim pesan 💬'
    END,
    CASE
      WHEN NEW.content LIKE '[[CALL:video:%' THEN 'Panggilan video masuk — buka chat untuk bergabung'
      WHEN NEW.content LIKE '[[CALL:voice:%' THEN 'Panggilan suara masuk — buka chat untuk bergabung'
      ELSE LEFT(NEW.content, 120)
    END,
    json_build_object(
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'sender_name', COALESCE(sender_prof.full_name, 'Teman Belajar'),
      'sender_avatar', sender_prof.avatar_url,
      'is_call', (NEW.content LIKE '[[CALL:%'),
      'call_type', CASE WHEN NEW.content LIKE '[[CALL:video:%' THEN 'video' WHEN NEW.content LIKE '[[CALL:voice:%' THEN 'voice' ELSE NULL END,
      'room', CASE WHEN NEW.content LIKE '[[CALL:%' THEN split_part(replace(NEW.content, ']]', ''), ':', 3) ELSE NULL END
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_message_notification ON messages;
CREATE TRIGGER on_new_message_notification
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION handle_new_message_notification();

-- Auto notifikasi saat ada ulasan/rating baru masuk
CREATE OR REPLACE FUNCTION handle_new_review_notification()
RETURNS TRIGGER AS $$
DECLARE
  reviewer_prof profiles%ROWTYPE;
BEGIN
  SELECT * INTO reviewer_prof FROM profiles WHERE id = NEW.reviewer_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.reviewed_id,
    'review',
    'Kamu Menerima Ulasan Baru ⭐',
    COALESCE(reviewer_prof.full_name, 'Partner') || ' memberimu rating ' || NEW.rating || ' bintang!',
    json_build_object('reviewer_id', NEW.reviewer_id, 'review_id', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_review_notification ON reviews;
CREATE TRIGGER on_new_review_notification
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION handle_new_review_notification();

-- Auto notifikasi saat ada jadwal sesi belajar baru diajukan
CREATE OR REPLACE FUNCTION handle_new_session_notification()
RETURNS TRIGGER AS $$
DECLARE
  organizer_prof profiles%ROWTYPE;
BEGIN
  SELECT * INTO organizer_prof FROM profiles WHERE id = NEW.organizer_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.partner_id,
    'session_invite',
    'Undangan Sesi Belajar Baru 📅',
    COALESCE(organizer_prof.full_name, 'Partner') || ' mengajakmu belajar: ' || NEW.title,
    json_build_object('session_id', NEW.id, 'organizer_id', NEW.organizer_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_session_notification ON study_sessions;
CREATE TRIGGER on_new_session_notification
  AFTER INSERT ON study_sessions
  FOR EACH ROW EXECUTE FUNCTION handle_new_session_notification();

-- Update average rating when review is added, updated, or deleted
CREATE OR REPLACE FUNCTION update_average_rating()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  target_user_id := COALESCE(NEW.reviewed_id, OLD.reviewed_id);
  
  UPDATE profiles
  SET average_rating = (
    SELECT COALESCE(AVG(rating)::DECIMAL(3,1), 0.0)
    FROM reviews
    WHERE reviewed_id = target_user_id
  )
  WHERE id = target_user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_new_review ON reviews;
CREATE TRIGGER on_new_review
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_average_rating();

-- ===========================
-- INDEXES
-- ===========================
CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_target_user_id ON matches(target_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_organizer ON study_sessions(organizer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subjects ON profiles USING GIN(subjects);

-- ===========================
-- ACTIVE CALLS TABLE (Signaling Panggilan Video & Suara ala WhatsApp)
-- ===========================
CREATE TABLE IF NOT EXISTS active_calls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  caller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('video', 'voice')),
  status TEXT NOT NULL DEFAULT 'calling' CHECK (status IN ('calling', 'ringing', 'accepted', 'rejected', 'ended', 'timeout')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE active_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calls they are part of"
  ON active_calls FOR SELECT
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create calls as caller"
  ON active_calls FOR INSERT
  WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can update their calls"
  ON active_calls FOR UPDATE
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE INDEX IF NOT EXISTS idx_active_calls_receiver ON active_calls(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_active_calls_room ON active_calls(room_name);

-- ===========================
-- PUSH NOTIFICATIONS & REALTIME REPLICATION
-- ===========================

-- Kolom expo push token di tabel profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Pastikan tabel-tabel utama terdaftar dalam supabase_realtime publication
-- agar event realtime (pesan masuk, notifikasi, panggilan) terkirim ke HP lawan
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'active_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE active_calls;
  END IF;
END $$;

-- ===========================
-- RPC: GET EMAIL BY USERNAME (UNTUK LOGIN DENGAN USERNAME)
-- ===========================
-- Jalankan fungsi ini di Supabase SQL Editor agar pengguna bisa login menggunakan @username
CREATE OR REPLACE FUNCTION get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_clean TEXT;
BEGIN
  v_clean := LOWER(TRIM(LEADING '@' FROM TRIM(p_username)));
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  SELECT u.email INTO v_email
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE LOWER(p.username) = v_clean
  LIMIT 1;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION get_email_by_username(TEXT) TO anon, authenticated;

-- ====================================================
-- STUDY SERVERS (GRUP BELAJAR / SERVER CHAT SEPERTI WA & DISCORD)
-- ====================================================

CREATE TABLE IF NOT EXISTS study_servers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  subject TEXT DEFAULT 'Umum',
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_sender TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anggota Server (Server Members)
CREATE TABLE IF NOT EXISTS server_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  server_id UUID REFERENCES study_servers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(server_id, user_id)
);

-- Pesan Obrolan Server (Server Messages)
CREATE TABLE IF NOT EXISTS server_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  server_id UUID REFERENCES study_servers(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes untuk performa kueri
CREATE INDEX IF NOT EXISTS idx_study_servers_owner ON study_servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_study_servers_last_msg ON study_servers(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_members_server_id ON server_members(server_id);
CREATE INDEX IF NOT EXISTS idx_server_members_user_id ON server_members(user_id);
CREATE INDEX IF NOT EXISTS idx_server_messages_server_id ON server_messages(server_id);
CREATE INDEX IF NOT EXISTS idx_server_messages_created_at ON server_messages(created_at ASC);

-- Enable RLS
ALTER TABLE study_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_messages ENABLE ROW LEVEL SECURITY;

-- Hak Akses Tabel (Wajib dijalankan agar user dan service role tidak Permission Denied)
GRANT ALL ON TABLE study_servers TO authenticated, service_role, anon;
GRANT ALL ON TABLE server_members TO authenticated, service_role, anon;
GRANT ALL ON TABLE server_messages TO authenticated, service_role, anon;

-- 1. Policies: study_servers
DROP POLICY IF EXISTS "Members can view servers" ON study_servers;
DROP POLICY IF EXISTS "Anyone authenticated can view servers" ON study_servers;
CREATE POLICY "Anyone authenticated can view servers"
  ON study_servers FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create servers" ON study_servers;
CREATE POLICY "Authenticated users can create servers"
  ON study_servers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners and admins can update servers" ON study_servers;
DROP POLICY IF EXISTS "Owners can update servers" ON study_servers;
CREATE POLICY "Owners can update servers"
  ON study_servers FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete servers" ON study_servers;
CREATE POLICY "Owners can delete servers"
  ON study_servers FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- 2. Policies: server_members (Non-recursive agar tidak infinite recursion)
DROP POLICY IF EXISTS "Members can view server member list" ON server_members;
DROP POLICY IF EXISTS "Anyone authenticated can view server members" ON server_members;
CREATE POLICY "Anyone authenticated can view server members"
  ON server_members FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Owners and admins can add members" ON server_members;
DROP POLICY IF EXISTS "Users or owners can add members" ON server_members;
CREATE POLICY "Users or owners can add members"
  ON server_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM study_servers s
      WHERE s.id = server_members.server_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can leave or admins can remove" ON server_members;
DROP POLICY IF EXISTS "Members can leave or owners can remove" ON server_members;
CREATE POLICY "Members can leave or owners can remove"
  ON server_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM study_servers s
      WHERE s.id = server_members.server_id AND s.owner_id = auth.uid()
    )
  );

-- 3. Policies: server_messages
DROP POLICY IF EXISTS "Server members can view messages" ON server_messages;
DROP POLICY IF EXISTS "Anyone authenticated can view server messages" ON server_messages;
CREATE POLICY "Anyone authenticated can view server messages"
  ON server_messages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Server members can send messages" ON server_messages;
DROP POLICY IF EXISTS "Authenticated users can send server messages" ON server_messages;
CREATE POLICY "Authenticated users can send server messages"
  ON server_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Realtime publication untuk pesan server
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'server_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE server_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'study_servers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE study_servers;
  END IF;
END $$;

-- ===========================
-- MBTI PERSONALITY EXTENSION
-- ===========================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mbti TEXT;

-- ===========================
-- DEVICE PUSH NOTIFICATION EXTENSION
-- ===========================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- ===========================
-- NOTIFICATIONS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('match', 'message', 'session_invite', 'session_confirmed', 'review', 'system')),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users or system can insert notifications" ON notifications;
CREATE POLICY "Users or system can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Realtime publication for notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ===========================
-- UNIVERSITY EXTENSION
-- ===========================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS university TEXT;

-- ===========================
-- CHAT ATTACHMENTS & IMAGE EXTENSION
-- ===========================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE server_messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Bucket Storage untuk Foto & File Obrolan
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Kebijakan Akses Storage Chat Attachments & Avatars
DROP POLICY IF EXISTS "Public can view chat attachments" ON storage.objects;
CREATE POLICY "Public can view chat attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('chat-attachments', 'avatars'));

DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat attachments"
  ON storage.objects FOR INSERT
  TO authenticated, anon
  WITH CHECK (bucket_id IN ('chat-attachments', 'avatars'));

DROP POLICY IF EXISTS "Authenticated users can update chat attachments" ON storage.objects;
CREATE POLICY "Authenticated users can update chat attachments"
  ON storage.objects FOR UPDATE
  TO authenticated, anon
  USING (bucket_id IN ('chat-attachments', 'avatars'));

-- ===========================
-- UNIFORM GRADE LEVEL ('Perkuliahan')
-- ===========================
UPDATE profiles SET grade_level = 'Perkuliahan' WHERE grade_level IS NULL OR grade_level IN ('Kuliah', 'SD', 'SMP', 'SMA', 'Umum');

-- ===========================
-- STUDY PARTNERS / MATCHES MIGRATION
-- Update existing matches to is_matched = TRUE so past invitations are immediately connected
-- ===========================
UPDATE matches SET is_matched = TRUE WHERE action IN ('like', 'super_like') AND is_matched IS NOT TRUE;

-- ===========================
-- MULTI-PARTNER STUDY SESSIONS EXTENSION
-- Memungkinkan sesi belajar memiliki lebih dari 2 orang (organizer + banyak partner)
-- ===========================
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS partner_ids UUID[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS session_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES study_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'participant' CHECK (role IN ('organizer', 'participant')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- Enable RLS & Table Grants
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON session_participants TO authenticated;
GRANT SELECT ON session_participants TO anon;

DROP POLICY IF EXISTS "Session participants can view members" ON session_participants;
CREATE POLICY "Session participants can view members"
  ON session_participants FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert session participants" ON session_participants;
CREATE POLICY "Users can insert session participants"
  ON session_participants FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Participants or organizer can update member status" ON session_participants;
CREATE POLICY "Participants or organizer can update member status"
  ON session_participants FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    auth.uid() IN (SELECT organizer_id FROM study_sessions WHERE id = session_id)
  );

-- Perbarui kebijakan RLS study_sessions agar peserta grup bisa melihat & memperbarui sesi
DROP POLICY IF EXISTS "Session participants can view" ON study_sessions;
CREATE POLICY "Session participants can view"
  ON study_sessions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = organizer_id 
    OR auth.uid() = partner_id 
    OR (partner_ids IS NOT NULL AND auth.uid() = ANY(partner_ids))
    OR EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = study_sessions.id AND sp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Organizer can update sessions" ON study_sessions;
CREATE POLICY "Organizer can update sessions"
  ON study_sessions FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = organizer_id 
    OR auth.uid() = partner_id 
    OR (partner_ids IS NOT NULL AND auth.uid() = ANY(partner_ids))
    OR EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = study_sessions.id AND sp.user_id = auth.uid())
  );

-- Trigger auto notifikasi untuk multi-partner
CREATE OR REPLACE FUNCTION handle_new_session_notification()
RETURNS TRIGGER AS $$
DECLARE
  organizer_prof profiles%ROWTYPE;
  target_partner_id UUID;
BEGIN
  SELECT * INTO organizer_prof FROM profiles WHERE id = NEW.organizer_id;

  -- Jika partner_ids memiliki daftar partner, kirim notifikasi ke seluruh partner
  IF NEW.partner_ids IS NOT NULL AND array_length(NEW.partner_ids, 1) > 0 THEN
    FOREACH target_partner_id IN ARRAY NEW.partner_ids LOOP
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        target_partner_id,
        'session_invite',
        'Undangan Sesi Belajar Baru 📅',
        COALESCE(organizer_prof.full_name, 'Partner') || ' mengajakmu belajar bersama: ' || NEW.title,
        json_build_object('session_id', NEW.id, 'organizer_id', NEW.organizer_id)
      );
    END LOOP;
  ELSIF NEW.partner_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.partner_id,
      'session_invite',
      'Undangan Sesi Belajar Baru 📅',
      COALESCE(organizer_prof.full_name, 'Partner') || ' mengajakmu belajar: ' || NEW.title,
      json_build_object('session_id', NEW.id, 'organizer_id', NEW.organizer_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Realtime publication untuk session_participants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'session_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE session_participants;
  END IF;
END $$;

