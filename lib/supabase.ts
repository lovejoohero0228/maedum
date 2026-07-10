// Supabase 클라이언트 (AGENT.md §2)
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 환경 변수 미설정 시 placeholder로 생성해 앱 부팅은 가능하게 한다.
// (실제 요청은 실패하므로 .env.local 설정 필수 — AGENT.md §10)
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key-placeholder';

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn(
    '[maedum] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다. .env.local을 확인하세요.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // 소셜 로그인(OAuth)용 — 네이티브는 lib/socialAuth.ts가 code를 직접 교환하고,
    // 웹은 리다이렉트 복귀 시 URL의 code를 자동 감지해 세션을 복원한다.
    flowType: 'pkce',
    detectSessionInUrl: Platform.OS === 'web',
  },
});
