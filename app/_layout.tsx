// 루트 레이아웃 — 폰트 로드 + 인증 세션 구독
import { useEffect } from 'react';
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

SplashScreen.preventAutoHideAsync();

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
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </>
  );
}
