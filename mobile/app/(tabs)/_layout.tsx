import React, { useRef, useEffect } from 'react';
import { Tabs, router, useSegments } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';
import {
  HomeIcon,
  FriendsIcon,
  ChatIcon,
  ScheduleIcon,
  ProfileIcon,
} from '../../components/TabIcons';

const TAB_ORDER = ['home', 'matches', 'chat', 'schedule', 'profile'] as const;

const TAB_ITEMS: Record<
  string,
  { label: string; Icon: React.ComponentType<{ color: string; size?: number }> }
> = {
  home: { label: 'Temukan', Icon: HomeIcon },
  matches: { label: 'Teman', Icon: FriendsIcon },
  chat: { label: 'Chat', Icon: ChatIcon },
  schedule: { label: 'Jadwal', Icon: ScheduleIcon },
  profile: { label: 'Profil', Icon: ProfileIcon },
};

function CustomTabBar(props: any) {
  const { state, navigation, descriptors, onUpdateNav } = props;
  const insets = useSafeAreaInsets();
  // Jarak floating dock dari batas bawah layar agar pas dan tidak tertutup gesture bar
  const bottomMargin = Math.max(insets.bottom, 16);

  useEffect(() => {
    if (onUpdateNav && state) {
      const nav = navigation || (descriptors && (Object.values(descriptors)[0] as any)?.navigation);
      onUpdateNav(nav, state.index);
    }
  }, [state?.index, navigation, descriptors, onUpdateNav]);

  if (!state?.routes) return null;

  return (
    <View style={[styles.tabBarContainer, { bottom: bottomMargin }]}>
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;
        const item = TAB_ITEMS[route.name];
        if (!item) return null;

        const { Icon, label } = item;
        const iconColor = isFocused ? Colors.primary : '#94a3b8';

        const onPress = () => {
          const nav = navigation || descriptors?.[route.key]?.navigation;
          if (nav?.emit) {
            const event = nav.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (event?.defaultPrevented) return;
          }

          if (nav?.navigate) {
            nav.navigate(route.name);
          } else {
            router.push(`/(tabs)/${route.name}` as any);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabButton}
            onPress={onPress}
            activeOpacity={0.75}
          >
            {/* Kapsul Pink Icon - Terpusat persis di tengah atas & bawah */}
            <View style={[styles.iconPill, isFocused && styles.iconPillActive]}>
              <Icon color={iconColor} size={20} />
            </View>

            {/* Label Teks - Terpusat persis di bawah icon */}
            <Text
              style={[styles.tabLabel, isFocused && styles.tabLabelActive]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const segments = useSegments();
  const navigationRef = useRef<any>(null);
  const activeIndexRef = useRef<number>(0);
  const lastSwipeTimeRef = useRef<number>(0);

  // Sinkronkan indeks tab aktif ketika rute berubah
  useEffect(() => {
    const segs = segments as unknown as string[];
    const activeRouteName = segs[1];
    if (activeRouteName) {
      const idx = TAB_ORDER.indexOf(activeRouteName as any);
      if (idx !== -1) {
        activeIndexRef.current = idx;
      }
    }
  }, [segments]);

  const switchTab = (direction: 'next' | 'prev') => {
    const now = Date.now();
    if (now - lastSwipeTimeRef.current < 260) return; // Debounce gesekan bertubi-tubi

    const currentIndex = activeIndexRef.current;
    let targetIndex = currentIndex;

    if (direction === 'next') {
      // Geser jari ke kiri (swipe left) -> Pindah ke tab berikutnya di sebelah kanan
      if (currentIndex < TAB_ORDER.length - 1) {
        targetIndex = currentIndex + 1;
      }
    } else {
      // Geser jari ke kanan (swipe right) -> Pindah ke tab sebelumnya di sebelah kiri
      if (currentIndex > 0) {
        targetIndex = currentIndex - 1;
      }
    }

    if (targetIndex !== currentIndex) {
      lastSwipeTimeRef.current = now;
      activeIndexRef.current = targetIndex;
      const targetRoute = TAB_ORDER[targetIndex];

      const nav = navigationRef.current;
      if (nav?.navigate) {
        nav.navigate(targetRoute);
      } else {
        router.push(`/(tabs)/${targetRoute}` as any);
      }
    }
  };

  // PanResponder untuk menangkap gesture geser kiri & kanan seperti WhatsApp
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Abaikan gesture di area floating bottom tab bar
        const { height: screenHeight } = Dimensions.get('window');
        if (evt.nativeEvent.pageY > screenHeight - 110) {
          return false;
        }

        // Jika sedang di tab home dan di area filter chip horizontal, jangan tangkap
        const currentTab = TAB_ORDER[activeIndexRef.current];
        if (currentTab === 'home' && evt.nativeEvent.pageY >= 130 && evt.nativeEvent.pageY <= 210) {
          return false;
        }

        // Hanya klaim gesture jika murni horizontal (dx > dy * 1.5) dan jarak gerakan > 18px
        return (
          Math.abs(gestureState.dx) > 18 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
        );
      },

      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const { height: screenHeight } = Dimensions.get('window');
        if (evt.nativeEvent.pageY > screenHeight - 110) {
          return false;
        }

        const currentTab = TAB_ORDER[activeIndexRef.current];
        if (currentTab === 'home' && evt.nativeEvent.pageY >= 130 && evt.nativeEvent.pageY <= 210) {
          return false;
        }

        return (
          Math.abs(gestureState.dx) > 18 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
        );
      },

      onPanResponderRelease: (_evt, gestureState) => {
        // Cek arah dan kecepatan gesture geser
        if (gestureState.dx < -35 || (gestureState.dx < -15 && gestureState.vx < -0.35)) {
          // Swipe jari ke kiri -> Pindah ke tab kanan
          switchTab('next');
        } else if (gestureState.dx > 35 || (gestureState.dx > 15 && gestureState.vx > 0.35)) {
          // Swipe jari ke kanan -> Pindah ke tab kiri
          switchTab('prev');
        }
      },

      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Tabs
        tabBar={(props) => (
          <CustomTabBar
            {...props}
            onUpdateNav={(nav: any, index: number) => {
              navigationRef.current = nav;
              if (index !== undefined) {
                activeIndexRef.current = index;
              }
            }}
          />
        )}
        screenOptions={{
          headerShown: false,
          animation: 'shift',
        }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="matches" />
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="schedule" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  // Kotak putih luar (Floating Navigation Dock)
  tabBarContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(205, 79, 117, 0.12)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    paddingHorizontal: 6,
  },
  // Setiap tombol tab mengambil lebar sama rata (20% per tab) dan terpusat vertikal & horizontal
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Kapsul aksen pink di sekitar ikon saat aktif
  iconPill: {
    width: 42,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconPillActive: {
    backgroundColor: 'rgba(205, 79, 117, 0.12)',
  },
  // Label teks di bawah icon
  tabLabel: {
    fontFamily: Fonts.medium,
    fontSize: 10.5,
    lineHeight: 13,
    color: '#94a3b8',
    marginTop: 2,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: Colors.primary,
    fontFamily: Fonts.bold,
  },
});
