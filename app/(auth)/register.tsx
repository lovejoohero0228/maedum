// 회원가입 — display_name은 metadata로 전달, 트리거가 profiles 생성
import { useState } from 'react';
import {
  Alert,
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
import { colors, fonts } from '@/constants/colors';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    if (!name.trim() || !email || password.length < 6) {
      Alert.alert('입력 확인', '이름, 이메일, 6자 이상 비밀번호를 입력해주세요.');
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
      Alert.alert('가입 실패', error.message);
      return;
    }
    router.replace('/(main)/pair');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>시작하기</Text>
        <Text style={styles.subtitle}>상대에게 보여질 이름을 알려주세요</Text>

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

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onRegister}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? '가입 중…' : '가입하기'}</Text>
        </Pressable>

        <Link href="/(auth)/login" style={styles.link}>
          이미 계정이 있어요 →
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  title: {
    fontSize: 26,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.ink3,
    marginBottom: 28,
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
