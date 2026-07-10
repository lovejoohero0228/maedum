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
import { showAlert } from '@/lib/alert';
import { Wash } from '@/components/ui/Wash';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { colors, fonts, ui } from '@/constants/colors';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    if (!name.trim() || !email || password.length < 6) {
      showAlert('입력 확인', '이름, 이메일, 6자 이상 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name.trim() } },
    });
    setLoading(false);
    if (error) {
      showAlert('가입 실패', error.message);
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
          <Text style={ui.statement}>시작하기</Text>
          <Text style={styles.subtitle}>상대에게 보여질 이름을 알려주세요</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="이름 (예: 지수)"
            placeholderTextColor={colors.ink3}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="이메일"
            placeholderTextColor={colors.ink3}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호 (6자 이상)"
            placeholderTextColor={colors.ink3}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <View style={styles.footer}>
          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={onRegister}
            disabled={loading}
          >
            <Text style={ui.primaryPillText}>{loading ? '가입 중…' : '가입하기'}</Text>
          </Pressable>
          <SocialLoginButtons />
          <Link href="/(auth)/login" style={styles.link}>
            이미 계정이 있어요
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 140 },
  hero: { marginBottom: 40 },
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
