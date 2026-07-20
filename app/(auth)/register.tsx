// 회원가입 — display_name은 metadata로 전달, 트리거가 profiles 생성
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
import { showAlert, showConfirm } from '@/lib/alert';
import { authErrorMessage, isValidEmail } from '@/lib/errors';
import { Wash } from '@/components/ui/Wash';
import { Maedeubi } from '@/components/ui/Maedeubi';
// 소셜 로그인 비활성화 — Supabase 대시보드에서 Kakao/Google provider 설정 후 다시 활성화
// import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { colors, fonts, ui } from '@/constants/colors';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // 인증 메일을 보낸 주소 — 값이 있으면 폼 대신 안내 패널을 보여준다
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onRegister = async () => {
    if (!name.trim() || !email || password.length < 6) {
      showAlert('입력 확인', '이름, 이메일, 6자 이상 비밀번호를 입력해주세요.');
      return;
    }
    if (!isValidEmail(email)) {
      showAlert('입력 확인', '이메일 형식이 올바르지 않아요. 다시 확인해주세요.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    setLoading(false);
    if (error) {
      showAlert('가입 실패', authErrorMessage(error));
      return;
    }
    // 이미 가입된 이메일 — Supabase는 에러 대신 identities가 빈 가짜 유저를 돌려준다
    if (data.user && data.user.identities?.length === 0) {
      const goLogin = await showConfirm(
        '이미 가입된 이메일이에요',
        '로그인해주세요.',
        '로그인하러 가기',
      );
      if (goLogin) router.replace('/(auth)/login');
      return;
    }
    // 세션이 없으면 이메일 인증이 필요한 상태 — 홈으로 보내면 로그인으로 튕기므로 안내 패널을 보여준다
    if (!data.session) {
      setSentTo(email.trim());
      return;
    }
    // 세션이 있으면 (main) 가드가 프로필 온보딩 → 페어링으로 안내한다
    router.replace('/(main)/home');
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
            <Maedeubi size={56} variant={sentTo ? 'letter' : 'base'} />
          </View>
          <Text style={ui.statement}>{sentTo ? '인증 메일을 보냈어요' : '시작하기'}</Text>
          <Text style={styles.subtitle}>
            {sentTo ? '이제 딱 한 단계만 남았어요' : '상대에게 보여질 이름을 알려주세요'}
          </Text>
        </View>

        {sentTo ? (
          <>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmText}>
                <Text style={styles.confirmEmail}>{sentTo}</Text>
                {'로 인증 메일을 보냈어요.\n메일함에서 링크를 눌러 인증을 마친 뒤 로그인해주세요.'}
              </Text>
            </View>
            <View style={styles.footer}>
              <Pressable
                style={styles.button}
                onPress={() => router.replace('/(auth)/login')}
                accessibilityRole="button"
                accessibilityLabel="로그인하러 가기"
              >
                <Text style={ui.primaryPillText}>로그인하러 가기</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="이름 (예: 지수)"
                placeholderTextColor={colors.ink3}
                value={name}
                onChangeText={setName}
                accessibilityLabel="이름 입력"
              />
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
                placeholder="비밀번호 (6자 이상)"
                placeholderTextColor={colors.ink3}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                accessibilityLabel="비밀번호 입력"
              />
            </View>

            <View style={styles.footer}>
              <Pressable
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={onRegister}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="가입하기"
              >
                <Text style={ui.primaryPillText}>{loading ? '가입 중…' : '가입하기'}</Text>
              </Pressable>
              {/* <SocialLoginButtons /> */}
              <Link href="/(auth)/login" style={styles.link}>
                이미 계정이 있어요
              </Link>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 100 },
  hero: { marginBottom: 32 },
  heroChar: { marginBottom: 14 },
  subtitle: {
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
  confirmCard: {
    ...ui.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  confirmText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink2,
    fontFamily: fonts.body,
  },
  confirmEmail: {
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
  },
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
