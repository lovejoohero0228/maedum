// 커플 연결 — 초대 코드 생성 / 입력 (Phase 1)
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useConflictStore } from '@/store/conflictStore';
import { acceptInviteCode, createInviteCode } from '@/services/conflictService';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { colors, fonts } from '@/constants/colors';

export default function Pair() {
  const session = useConflictStore((s) => s.session);
  const loadCouple = useConflictStore((s) => s.loadCouple);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [busy, setBusy] = useState(false);

  // 상대 코드 수락 후 홈으로. 상대(초대자)는 realtime 대신 홈 재진입 시 couple을 발견한다.
  const onAccept = async () => {
    if (!inputCode.trim()) return;
    setBusy(true);
    try {
      await acceptInviteCode(inputCode);
      await loadCouple();
      router.replace('/(main)/home');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const friendly = msg.includes('invalid_or_expired')
        ? '코드가 올바르지 않거나 만료됐어요.'
        : msg.includes('already_paired')
          ? '이미 연결된 커플이 있어요.'
          : msg.includes('cannot_pair_with_self')
            ? '자신의 코드는 사용할 수 없어요.'
            : msg;
      showAlert('연결 실패', friendly);
    } finally {
      setBusy(false);
    }
  };

  const onCreate = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const code = await createInviteCode(session.user.id);
      setMyCode(code);
    } catch (e) {
      showAlert('오류', String(e));
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>둘을 연결할 차례예요</Text>
      <Text style={styles.subtitle}>
        한 명이 초대 코드를 만들고, 상대가 그 코드를 입력하면 연결돼요.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>초대 코드 만들기</Text>
        {myCode ? (
          <>
            <Text style={styles.code}>{myCode}</Text>
            <Text style={styles.hint}>
              이 코드를 상대에게 알려주세요. 상대가 입력하면 자동으로 연결돼요.
            </Text>
          </>
        ) : (
          <Pressable style={styles.button} onPress={onCreate} disabled={busy}>
            <Text style={styles.buttonText}>코드 생성</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>받은 코드 입력하기</Text>
        <TextInput
          style={styles.input}
          placeholder="예: A1B2C3"
          placeholderTextColor={colors.ink3}
          autoCapitalize="characters"
          value={inputCode}
          onChangeText={setInputCode}
        />
        <Pressable style={styles.button} onPress={onAccept} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? '연결 중…' : '연결하기'}</Text>
        </Pressable>
      </View>

      <Pressable onPress={onLogout}>
        <Text style={styles.logout}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 80 },
  title: { fontSize: 24, color: colors.ink, fontFamily: fonts.displayMedium },
  subtitle: {
    fontSize: 14,
    color: colors.ink3,
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    marginBottom: 12,
  },
  code: {
    fontSize: 32,
    letterSpacing: 6,
    color: colors.purpleText,
    fontFamily: fonts.displayMedium,
    textAlign: 'center',
    marginVertical: 8,
  },
  hint: { fontSize: 12, color: colors.ink3, lineHeight: 18, fontFamily: fonts.body },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 3,
    color: colors.ink,
    marginBottom: 10,
    fontFamily: fonts.body,
  },
  button: {
    backgroundColor: colors.purpleMid,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 14, fontFamily: fonts.bodyMedium },
  logout: {
    textAlign: 'center',
    color: colors.ink3,
    fontSize: 13,
    marginTop: 12,
    fontFamily: fonts.body,
  },
});
