// 커플 연결 — 초대 코드 생성 / 입력 (Phase 1)
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
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
import { colors, fonts, ui } from '@/constants/colors';

export default function Pair() {
  const session = useConflictStore((s) => s.session);
  const loadCouples = useConflictStore((s) => s.loadCouples);
  const selectCouple = useConflictStore((s) => s.selectCouple);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [busy, setBusy] = useState(false);

  // 초대 코드 생성 후, 상대가 수락하면 accept_couple_invite()가 couples row를
  // (user_a_id: 나=inviter, user_b_id: 상대)로 만든다. 예전엔 이 이벤트를 아무도
  // 구독하지 않아 초대자는 화면에 코드만 뜬 채로 멈춰 있었다 — 홈으로 직접
  // 돌아가야만 연결된 상태를 "발견"할 수 있었다. 여기서 실시간으로 감지해
  // 자동으로 홈에 들어가도록 한다.
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`pair-couple-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'couples',
          filter: `user_a_id=eq.${session.user.id}`,
        },
        async () => {
          try {
            await loadCouples();
            router.replace('/(main)/home');
          } catch (e) {
            console.error('loadCouples after pairing failed', e);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, loadCouples]);

  // 상대 코드 수락 후 홈으로 — 방금 연결된 커플을 활성 커플로 선택한다.
  const onAccept = async () => {
    if (!inputCode.trim()) return;
    setBusy(true);
    try {
      const coupleId = await acceptInviteCode(inputCode);
      await loadCouples();
      await selectCouple(coupleId);
      router.replace('/(main)/home');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const friendly = msg.includes('invalid_or_expired')
        ? '코드가 올바르지 않거나 만료됐어요.'
        : msg.includes('already_paired_with_this_person')
          ? '이미 그 사람과는 연결되어 있어요.'
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
      showAlert('코드 생성 실패', msg);
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>둘을 연결할 차례예요</Text>
      <Text style={styles.subtitle}>
        한 명이 초대 코드를 만들고,{'\n'}상대가 그 코드를 입력하면 연결돼요.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>초대 코드 만들기</Text>
        {myCode ? (
          <>
            <Text style={styles.code}>{myCode}</Text>
            <Text style={styles.hint}>
              이 코드를 상대에게 알려주세요.{'\n'}상대가 입력하면 자동으로 연결돼요.
            </Text>
          </>
        ) : (
          <Pressable style={styles.pillButton} onPress={onCreate} disabled={busy}>
            <Text style={ui.pillText}>코드 생성</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>받은 코드 입력하기</Text>
        <TextInput
          style={styles.input}
          placeholder="A1B2C3"
          placeholderTextColor={colors.ink3}
          autoCapitalize="characters"
          value={inputCode}
          onChangeText={setInputCode}
        />
        <Pressable style={styles.primaryButton} onPress={onAccept} disabled={busy}>
          <Text style={ui.primaryPillText}>{busy ? '연결 중…' : '연결하기'}</Text>
        </Pressable>
      </View>

      <Pressable onPress={onLogout}>
        <Text style={styles.logout}>로그아웃</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 28, paddingTop: 120, paddingBottom: 48, alignItems: 'center' },
  title: { ...ui.statement, fontSize: 24, lineHeight: 36 },
  subtitle: {
    ...ui.statementSub,
    marginTop: 12,
    marginBottom: 56,
  },
  section: { alignItems: 'center', alignSelf: 'stretch' },
  sectionLabel: {
    ...ui.quietCta,
    marginBottom: 20,
  },
  code: {
    fontSize: 34,
    letterSpacing: 8,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    textAlign: 'center',
    marginBottom: 12,
  },
  hint: {
    ...ui.statementSub,
    fontSize: 12,
    lineHeight: 19,
  },
  pillButton: {
    ...ui.pill,
    minWidth: 160,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    alignSelf: 'center',
    width: 48,
    marginVertical: 44,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 10,
    fontSize: 22,
    letterSpacing: 6,
    color: colors.ink,
    textAlign: 'center',
    minWidth: 200,
    marginBottom: 24,
    fontFamily: fonts.display,
  },
  primaryButton: {
    ...ui.primaryPill,
    minWidth: 200,
  },
  logout: {
    ...ui.quietCta,
    letterSpacing: 2,
    marginTop: 64,
  },
});
