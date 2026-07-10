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
import { Wash } from '@/components/ui/Wash';
import { Maedeubi } from '@/components/ui/Maedeubi';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
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
      <Wash />
      <View style={styles.inner}>
        <View style={styles.hero}>
          <View style={styles.heroChar}>
            <Maedeubi size={72} />
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
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            placeholderTextColor={colors.ink3}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <View style={styles.footer}>
          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={onLogin}
            disabled={loading}
          >
            <Text style={ui.primaryPillText}>{loading ? '로그인 중…' : '로그인'}</Text>
          </Pressable>
          <SocialLoginButtons />
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
