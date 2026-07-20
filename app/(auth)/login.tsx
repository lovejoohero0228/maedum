// 로그인 (이메일)
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { authErrorMessage } from '@/lib/errors';
import { Wash } from '@/components/ui/Wash';
import { Maedeubi } from '@/components/ui/Maedeubi';
// 소셜 로그인 비활성화 — Supabase 대시보드에서 Kakao/Google provider 설정 후 다시 활성화
// import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { colors, fonts, ui } from '@/constants/colors';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email || !password) {
      showAlert('입력 확인', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      showAlert('로그인 실패', authErrorMessage(error));
      return;
    }
    router.replace('/(main)/home');
  };

  const onResetPassword = async () => {
    if (!email) {
      showAlert('이메일 입력', '가입한 이메일을 먼저 입력해주세요.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) {
      showAlert('메일 전송 실패', authErrorMessage(error));
      return;
    }
    showAlert(
      '재설정 메일을 보냈어요',
      '메일의 안내에 따라 비밀번호를 바꾼 뒤 다시 로그인해주세요.',
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Wash />
      <View style={styles.inner}>
        <View style={styles.hero}>
          <View style={styles.heroChar}>
            {/* 파랑·코랄 두 실을 잇는 키비주얼 — "다시 맺다"의 브랜드 컷 */}
            <Maedeubi size={88} variant="connect" />
          </View>
          <Text style={styles.logo}>맺음</Text>
          <Text style={styles.tagline}>다툼의 끝을, 다시 맺다</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="이메일"
            placeholderTextColor={colors.ink3}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            accessibilityLabel="이메일 입력"
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            placeholderTextColor={colors.ink3}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            accessibilityLabel="비밀번호 입력"
          />
          <Pressable
            onPress={onResetPassword}
            hitSlop={8}
            style={styles.forgot}
            accessibilityRole="button"
            accessibilityLabel="비밀번호 재설정 메일 보내기"
          >
            <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={onLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="로그인"
          >
            <Text style={ui.primaryPillText}>{loading ? '로그인 중…' : '로그인'}</Text>
          </Pressable>
          {/* <SocialLoginButtons /> */}
          <Link href="/(auth)/register" style={styles.link}>
            아직 계정이 없어요
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 100 },
  hero: { marginBottom: 40 },
  heroChar: { marginBottom: 14 },
  logo: {
    fontSize: 40,
    lineHeight: 52,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
  },
  tagline: {
    ...ui.statementSub,
    marginTop: 8,
  },
  form: { alignSelf: 'stretch' },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 12,
    fontFamily: fonts.body,
  },
  forgot: { alignSelf: 'flex-end', marginTop: 2 },
  forgotText: { ...ui.quietCta, fontSize: 13, color: colors.ink3 },
  footer: { marginTop: 'auto', marginBottom: 32 },
  button: {
    ...ui.primaryPill,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  link: {
    ...ui.quietCta,
    marginTop: 12,
    alignSelf: 'center',
  },
});
