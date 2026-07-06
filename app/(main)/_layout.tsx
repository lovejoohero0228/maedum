// 메인 영역 — 인증 가드 + 프로필/커플 로드 + 푸시 토큰 등록
import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useConflictStore } from '@/store/conflictStore';
import { registerPushToken } from '@/lib/notifications';
import { colors } from '@/constants/colors';

export default function MainLayout() {
  const session = useConflictStore((s) => s.session);
  const loadProfile = useConflictStore((s) => s.loadProfile);
  const loadCouple = useConflictStore((s) => s.loadCouple);

  useEffect(() => {
    if (!session) return;
    loadProfile();
    loadCouple();
    registerPushToken(session.user.id).catch(() => {});
  }, [session, loadProfile, loadCouple]);

  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
