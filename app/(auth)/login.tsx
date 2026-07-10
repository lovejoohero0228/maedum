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
import { colors, fonts, ui } from '@/constants/colors';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      showAlert('로그인 실패', error.message);
      return;
    }
    router.replace('/(main)/home');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.hero}>
          <Text style={styles.mark}>❦</Text>
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
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            placeholderTextColor={colors.ink3}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={onLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? '로그인 중…' : '로그인'}</Text>
          </Pressable>
        </View>

        <Link href="/(auth)/register" style={styles.link}>
          아직 계정이 없어요
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  hero: { alignItems: 'center', marginBottom: 56 },
  mark: { fontSize: 26, color: colors.ink, marginBottom: 14 },
  logo: {
    fontSize: 38,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    textAlign: 'center',
  },
  tagline: {
    ...ui.statementSub,
    marginTop: 10,
  },
  form: { alignSelf: 'stretch' },
  input: {
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 2,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 18,
    fontFamily: fonts.body,
    textAlign: 'center',
  },
  button: {
    ...ui.primaryPill,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: ui.primaryPillText,
  link: {
    ...ui.quietCta,
    marginTop: 32,
    alignSelf: 'center',
  },
});
