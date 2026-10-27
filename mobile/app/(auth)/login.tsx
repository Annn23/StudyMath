import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors, Fonts, BorderRadius, Spacing } from '../../constants/theme';
import { signIn } from '../../lib/api';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!identifier.trim()) {
      newErrors.identifier = 'Email atau username wajib diisi';
    }
    if (!password) {
      newErrors.password = 'Password wajib diisi';
    } else if (password.length < 6) {
      newErrors.password = 'Password minimal 6 karakter';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data, error } = await signIn(identifier.trim(), password);
      if (error) {
        Alert.alert('Login Gagal', error.message || 'Email/username atau password salah. Coba lagi.');
      } else if (data?.user) {
        router.replace('/(tabs)/home');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#fce4f3', '#e8f7ff', '#fffbe6']}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleBadge}>
              <Text style={styles.studyText}>Study</Text>
            </View>
            <Text style={styles.matchText}>Match</Text>
            <Text style={styles.subtitle}>Selamat datang kembali! 👋</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Email / Username */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email atau Username</Text>
              <View style={[styles.inputWrapper, errors.identifier ? styles.inputError : null]}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@example.com atau @username"
                  placeholderTextColor={Colors.textMuted}
                  value={identifier}
                  onChangeText={(t) => { setIdentifier(t); setErrors(p => ({ ...p, identifier: undefined })); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.identifier && <Text style={styles.errorText}>{errors.identifier}</Text>}
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrapper, errors.password ? styles.inputError : null]}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="Masukkan password"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setErrors(p => ({ ...p, password: undefined })); }}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.inputIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Lupa password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.secondary, Colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.btnText}>Masuk</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Register Link */}
          <View style={styles.registerLink}>
            <Text style={styles.registerText}>Belum punya akun? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.registerLinkText}>Daftar Sekarang</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: { alignItems: 'center', marginBottom: Spacing.xl },
  titleBadge: {
    backgroundColor: '#3d27b0',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: 4,
  },
  studyText: {
    fontFamily: Fonts.bold,
    fontSize: 28,
    color: Colors.yellow,
    letterSpacing: 1,
  },
  matchText: {
    fontFamily: Fonts.extraBold,
    fontSize: 42,
    color: Colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  inputGroup: { marginBottom: Spacing.md },
  label: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f4ff',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(205,79,117,0.2)',
    paddingHorizontal: 14,
    height: 52,
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  inputFlex: { flex: 1 },
  errorText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
  forgotBtn: { alignItems: 'flex-end', marginBottom: Spacing.lg },
  forgotText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.primary,
  },
  loginBtn: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  btnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  registerText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  registerLinkText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.primary,
  },
});
