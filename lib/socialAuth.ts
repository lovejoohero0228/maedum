// 소셜 로그인 (카카오/구글) — Supabase OAuth + PKCE
// 네이티브: 인앱 브라우저(openAuthSessionAsync)로 인증 → 딥링크(maedum://)로 복귀 →
//           code를 세션으로 교환. 웹: 전체 페이지 리다이렉트(detectSessionInUrl이 복원).
// Supabase 대시보드에서 provider별 클라이언트 키와 Redirect URL 등록이 선행돼야 한다.
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'kakao' | 'google';

export const PROVIDER_LABELS: Record<SocialProvider, string> = {
  kakao: '카카오로 시작하기',
  google: 'Google로 시작하기',
};

// 성공적으로 세션이 만들어졌으면 true, 사용자가 창을 닫는 등 중단하면 false
export async function signInWithProvider(provider: SocialProvider): Promise<boolean> {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return false; // 여기서 전체 페이지가 리다이렉트되므로 이후 코드는 실행되지 않음
  }

  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  const { queryParams } = Linking.parse(result.url);
  const errorDescription = queryParams?.error_description;
  if (typeof errorDescription === 'string' && errorDescription) {
    throw new Error(errorDescription);
  }
  const code = queryParams?.code;
  if (typeof code !== 'string' || !code) {
    throw new Error('로그인 응답에 인증 코드가 없어요. 잠시 후 다시 시도해주세요.');
  }
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return true;
}
