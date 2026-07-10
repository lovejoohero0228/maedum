// 소셜 로그인 버튼 묶음 (카카오/구글) — 로그인·회원가입 화면 공용
// 성공 시 홈으로 이동 — 온보딩 미완료면 (main) 레이아웃 가드가 profile-setup으로 보낸다
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { showAlert } from '@/lib/alert';
import { signInWithProvider, type SocialProvider } from '@/lib/socialAuth';
import { colors, fonts } from '@/constants/colors';

export function SocialLoginButtons() {
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  const onPress = async (provider: SocialProvider) => {
    if (busy) return;
    setBusy(provider);
    try {
      const ok = await signInWithProvider(provider);
      if (ok) router.replace('/(main)/home');
    } catch (e) {
      showAlert('로그인 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>또는</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        style={[styles.button, styles.kakao, busy && styles.disabled]}
        onPress={() => onPress('kakao')}
        disabled={!!busy}
      >
        <Text style={styles.kakaoText}>
          {busy === 'kakao' ? '카카오로 이동 중…' : '카카오로 시작하기'}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.button, styles.google, busy && styles.disabled]}
        onPress={() => onPress('google')}
        disabled={!!busy}
      >
        <Text style={styles.googleText}>
          {busy === 'google' ? 'Google로 이동 중…' : 'Google로 시작하기'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 18,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontSize: 12, color: colors.ink3, fontFamily: fonts.body },
  button: {
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  disabled: { opacity: 0.6 },
  kakao: { backgroundColor: '#FEE500' },
  kakaoText: { fontSize: 15, color: '#191919', fontFamily: fonts.bodyMedium },
  google: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.line,
  },
  googleText: { fontSize: 15, color: colors.ink, fontFamily: fonts.bodyMedium },
});
