// 메인 영역 — 인증 가드 + 온보딩 가드 + 프로필/커플 로드 + 푸시 토큰 등록
import { useEffect } from 'react';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useConflictStore } from '@/store/conflictStore';
import { registerPushToken } from '@/lib/notifications';
import { colors } from '@/constants/colors';

export default function MainLayout() {
  const session = useConflictStore((s) => s.session);
  const profile = useConflictStore((s) => s.profile);
  const loadProfile = useConflictStore((s) => s.loadProfile);
  const loadCouples = useConflictStore((s) => s.loadCouples);
  const segments = useSegments();

  useEffect(() => {
    if (!session) return;
    loadProfile().catch((e) => console.error('loadProfile failed', e));
    loadCouples().catch((e) => console.error('loadCouples failed', e));
    registerPushToken(session.user.id).catch(() => {});
  }, [session, loadProfile, loadCouples]);

  if (!session) return <Redirect href="/(auth)/login" />;

  // 프로필 온보딩(이름/성격/캐릭터) 미완료면 먼저 완료시킨다
  // (profile이 아직 로드 전이면 null — 그때는 통과시키고 로드 후 리렌더에서 판정)
  const needsOnboarding = !!profile && !profile.onboarded_at;
  const onSetupScreen = segments[segments.length - 1] === 'profile-setup';
  if (needsOnboarding && !onSetupScreen) {
    return <Redirect href="/(main)/profile-setup" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
