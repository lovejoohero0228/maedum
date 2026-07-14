// 루트 레이아웃 — 폰트 로드 + 인증 세션 구독
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  NotoSansKR_300Light,
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
} from '@expo-google-fonts/noto-sans-kr';
import {
  NotoSerifKR_300Light,
  NotoSerifKR_400Regular,
  NotoSerifKR_500Medium,
} from '@expo-google-fonts/noto-serif-kr';
import { supabase } from '@/lib/supabase';
import { useConflictStore } from '@/store/conflictStore';
import { colors } from '@/constants/colors';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

SplashScreen.preventAutoHideAsync();

// 아이폰 "홈 화면에 추가" 아이콘/이름 — output:'single' 웹 빌드는 +html.tsx를 쓰지 않으므로
// 런타임에 head 태그를 주입한다 (public/apple-touch-icon.png = 매듭이 실 연결 포즈)
function injectWebHomeScreenMeta() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.querySelector('link[rel="apple-touch-icon"]')) return;
  const link = document.createElement('link');
  link.rel = 'apple-touch-icon';
  link.href = '/apple-touch-icon.png';
  document.head.appendChild(link);
  const title = document.createElement('meta');
  title.name = 'apple-mobile-web-app-title';
  title.content = '맺음';
  document.head.appendChild(title);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    NotoSansKR_300Light,
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSerifKR_300Light,
    NotoSerifKR_400Regular,
    NotoSerifKR_500Medium,
  });

  const setSession = useConflictStore((s) => s.setSession);

  useEffect(() => {
    injectWebHomeScreenMeta();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => sub.subscription.unsubscribe();
  }, [setSession]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </ErrorBoundary>
  );
}
