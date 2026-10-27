import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, BorderRadius, Spacing } from '../constants/theme';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const blob1Anim = useRef(new Animated.Value(0)).current;
  const blob2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animated blobs
    Animated.loop(
      Animated.sequence([
        Animated.timing(blob1Anim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(blob1Anim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(blob2Anim, { toValue: 1, duration: 5000, useNativeDriver: true }),
        Animated.timing(blob2Anim, { toValue: 0, duration: 5000, useNativeDriver: true }),
      ])
    ).start();

    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  const blob1TranslateY = blob1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });
  const blob2TranslateY = blob2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Gradient Background */}
      <LinearGradient
        colors={['#fce4f3', '#e8f7ff', '#fef9e7', '#fce4f3']}
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated Blobs */}
      <Animated.View
        style={[
          styles.blob,
          styles.blob1,
          { transform: [{ translateY: blob1TranslateY }] },
        ]}
      >
        <LinearGradient
          colors={[Colors.secondary + 'CC', Colors.primary + '88']}
          style={styles.blobInner}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.blob,
          styles.blob2,
          { transform: [{ translateY: blob2TranslateY }] },
        ]}
      >
        <LinearGradient
          colors={[Colors.accent + 'CC', Colors.yellow + '88']}
          style={styles.blobInner}
        />
      </Animated.View>

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* App Name */}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
          <Text style={styles.appName}>StudyMatch</Text>
          <Text style={styles.appEmoji}>🎓</Text>
        </Animated.View>

        {/* Tagline */}
        <Text style={styles.tagline}>Find Your Study Partner</Text>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.signUpButton}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.secondary, Colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.signUpText}>Sign Up</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.4)']}
              style={styles.buttonGradient}
            >
              <Text style={styles.loginText}>Log In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fce4f3',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
  },
  blob1: {
    width: 280,
    height: 280,
    top: -80,
    left: -60,
    opacity: 0.6,
  },
  blob2: {
    width: 240,
    height: 240,
    bottom: 80,
    right: -60,
    opacity: 0.5,
  },
  blobInner: {
    flex: 1,
    borderRadius: 999,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  appName: {
    fontSize: 52,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -1,
    marginBottom: 8,
  },
  appEmoji: {
    fontSize: 64,
  },
  tagline: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    letterSpacing: 0.5,
  },
  buttonContainer: {
    width: '100%',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  signUpButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...{
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 8,
    },
  },
  loginButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    ...{
      shadowColor: Colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 4,
    },
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpText: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  loginText: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
});
