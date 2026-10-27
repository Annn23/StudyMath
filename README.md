# 📚 StudyMatch

> **Temukan Partner Belajarmu!** — Aplikasi untuk menghubungkan pelajar dengan partner belajar yang cocok.

## 🗂️ Struktur Project

```
studymatch/
├── mobile/          # 📱 Expo React Native (Android)
├── web/             # 🌐 Next.js Admin Dashboard
└── supabase/        # 🗄️ Database Schema SQL
```

---

## 🎨 Brand Identity

| Warna | Hex | Penggunaan |
|---|---|---|
| Deep Pink | `#cd4f75` | Primary, buttons |
| Light Pink | `#ffa9f9` | Secondary, gradients |
| Sky Blue | `#93dcfc` | Accent, partner card |
| Yellow | `#ffe479` | Badges, highlights |

---

## 🚀 Setup & Installation

### 1. Siapkan Supabase

1. Buat project baru di [supabase.com](https://supabase.com)
2. Buka **SQL Editor** dan jalankan isi file `supabase/schema.sql`
3. Aktifkan **Realtime** untuk tabel `messages` dan `notifications`
4. Di **Storage**, buat bucket `avatars` dengan akses public

### 2. Setup Mobile App (Expo)

```bash
cd mobile
cp .env.example .env.local
# Isi EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_ANON_KEY

# Install fonts (Outfit dari Google Fonts)
# Download dari https://fonts.google.com/specimen/Outfit
# Simpan di mobile/assets/fonts/

# Simpan logo di mobile/assets/images/logo.png

npm install
npx expo start
```

### 3. Setup Web Admin (Next.js)

```bash
cd web
cp .env.example .env.local
# Isi semua variabel di .env.local

npm install
npm run dev
# Buka http://localhost:3000
```

---

## 📱 Mobile App — Fitur

| Screen | Deskripsi |
|---|---|
| WelcomeScreen | Splash screen dengan animated gradient |
| LoginScreen | Login dengan email & password |
| RegisterScreen | Registrasi 3-langkah (data, profil, mapel) |
| HomeScreen | Cari partner belajar via username atau filter mapel |
| MatchesScreen | Daftar teman belajar |
| ChatScreen | Daftar percakapan |
| ChatDetailScreen | Pesan realtime via Supabase |
| ScheduleScreen | Jadwal sesi belajar |
| ProfileScreen | Profil, ganti foto, toggle ketersediaan |
| NotificationsScreen | Notifikasi pertemanan, pesan, sesi |

---

## 🌐 Web Admin — Fitur

| Halaman | Deskripsi |
|---|---|
| /login | Login admin |
| /admin | Dashboard dengan statistik |
| /admin/users | Manajemen pengguna, filter, blokir |
| /admin/sessions | Semua sesi belajar |
| /admin/reports | Laporan dari pengguna |
| /admin/notifications | Broadcast notifikasi |

---

## 🏗️ Deploy ke Vercel

### Web Admin:
```bash
cd web
npx vercel --prod
# Set environment variables di Vercel Dashboard
```

### Mobile (Android APK):
```bash
cd mobile
npx eas build --platform android --profile preview
```

---

## 🔧 Environment Variables

### Mobile (`mobile/.env.local`):
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Web (`web/.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 🛠️ Tech Stack

- **Mobile**: Expo (React Native) + TypeScript
- **Web**: Next.js 15 + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Realtime**: Supabase Realtime (WebSocket)
- **Storage**: Supabase Storage (foto profil)
- **Deployment**: Vercel (web) + Expo EAS (mobile)

---

> Dibuat dengan ❤️ menggunakan Antigravity AI
