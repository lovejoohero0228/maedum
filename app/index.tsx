// 진입점 — 세션 유무에 따라 로그인/홈으로 분기
import { Redirect } from 'expo-router';
import { useConflictStore } from '@/store/conflictStore';

export default function Index() {
  const session = useConflictStore((s) => s.session);
  return session ? <Redirect href="/(main)/home" /> : <Redirect href="/(auth)/login" />;
}
