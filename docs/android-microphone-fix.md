# Perbaikan mikrofon panggilan Android

Tanggal pengujian: 28 Oktober 2026.

## Gejala

Saat masuk ke ruang telepon, layar berhenti di **Memeriksa akses mikrofon...**.
Izin `RECORD_AUDIO` di Android sudah aktif, tetapi `getUserMedia()` di WebView
tetap menunggu dan belum menghasilkan audio track.

## Penyebab

Kode sebelumnya memakai `PermissionsAndroid.requestMultiple()`. Pada pengujian
di Expo Go, izin Android tersebut belum cukup untuk memberikan akses ke proyek
StudyMatch. Expo Go juga mengelola izin per proyek. Dialog izin kamera yang muncul
saat pengujian mengonfirmasi bahwa izin untuk pengalaman Expo lain tidak otomatis
berlaku untuk StudyMatch.

Selain itu, `permissionsReady` dan `micGranted` sebelumnya langsung bernilai
`true`. Akibatnya, WebView sudah memulai `getUserMedia()` sebelum pemeriksaan izin
selesai. Hasil pemeriksaan `micGranted` juga belum dipakai untuk membatasi pemuatan
WebView.

## Perubahan

- Meminta izin mikrofon melalui `requestRecordingPermissionsAsync()` dari
  `expo-audio`, sehingga permintaan mengikuti pengelolaan izin Expo.
- Meminta izin kamera melalui `requestCameraPermissionsAsync()` dari
  `expo-image-picker` untuk panggilan video setelah izin mikrofon diberikan.
- Memuat WebView hanya setelah pemeriksaan selesai dan izin mikrofon diberikan.
- Menampilkan pilihan coba lagi, buka pengaturan, dan tutup panggilan jika akses
  mikrofon tidak tersedia. Tampilan berdering tidak menutupi pilihan tersebut.
- Menambahkan `expo-audio` beserta config plugin dan lockfile-nya.

Implementasi ada di [`mobile/app/call/[room].tsx`](../mobile/app/call/%5Broom%5D.tsx).
Engine WebRTC dan alur signaling panggilan tidak diubah.

## Hasil pengujian

Perangkat: realme RMX5171, Android 16, Expo Go 58.0.5, proyek Expo SDK 58.

- Login berhasil.
- Audio track mikrofon HP berstatus `live`, `enabled: true`, dan `muted: false`.
- Panggilan suara uji ke peserta simulasi di laptop berhasil terhubung melalui
  PeerJS. Laptop menerima paket RTP audio dengan energi suara terdeteksi.
- Tombol mute menonaktifkan audio track; unmute mengaktifkannya kembali dan
  pengiriman audio berlanjut.
- Pada mode video, akses mikrofon dan kamera tercatat aktif di Android.
- Setelah ruang uji ditutup, akses mikrofon dan kamera berhenti.
- `npx tsc --noEmit` dan `git diff --check` lolos.
- Pemeriksaan lint dengan konfigurasi bawaan Expo pada file telepon masih
  menemukan 4 error `react-hooks/refs` dan 1 warning `react-hooks/exhaustive-deps`.
  Error yang sama sudah ada sebelum perubahan; tidak ada error lint baru.

Pengujian ini belum mencakup APK mandiri, percakapan antara dua HP, penolakan izin,
atau kualitas suara pada jaringan yang berbeda.

## Cara menjalankan setelah menarik perubahan

```bash
cd mobile
npm ci
npx expo start
```

Buka proyek di Expo Go dan izinkan akses mikrofon untuk StudyMatch saat diminta.
Untuk APK atau development build mandiri, build ulang karena ada penambahan modul
native `expo-audio`. Pengujian hanya dengan reload JavaScript tidak menambahkan
modul tersebut ke APK lama.
