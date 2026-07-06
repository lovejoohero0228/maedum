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
import { colors, fonts } from '@/constants/colors';

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
        <Text style={styles.logo}>맺음</Text>
        <Text style={styles.tagline}>다툼의 끝을, 다시 맺다</Text>

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

        <Link href="/(auth)/register" style={styles.link}>
          아직 계정이 없어요 →
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logo: {
    fontSize: 40,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 40,
    fontFamily: fonts.body,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 10,
    fontFamily: fonts.body,
  },
  button: {
    backgroundColor: colors.purpleMid,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontFamily: fonts.bodyMedium },
  link: {
    textAlign: 'center',
    marginTop: 20,
    color: colors.purpleText,
    fontSize: 14,
    fontFamily: fonts.body,
  },
});
