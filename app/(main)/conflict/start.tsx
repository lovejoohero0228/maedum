// 01단계: 갈등 시작 (AGENT.md §4-1)
// "맺음 시작" → conflicts row 생성 → 상대에게 푸시 → 입력 화면으로
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useConflictStore } from '@/store/conflictStore';
import { startConflict, joinConflict } from '@/services/conflictService';
import { sendPushTo } from '@/lib/notifications';
import { showAlert } from '@/lib/alert';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { colors, fonts, ui } from '@/constants/colors';

export default function Start() {
  const session = useConflictStore((s) => s.session);
  const profile = useConflictStore((s) => s.profile);
  const couple = useConflictStore((s) => s.couple);
  const partner = useConflictStore((s) => s.partner);
  const conflict = useConflictStore((s) => s.conflict);
  const setConflict = useConflictStore((s) => s.setConflict);
  const [busy, setBusy] = useState(false);

  // 상대가 이미 시작한 갈등이 있으면 "참여", 없으면 "새로 시작"
  const partnerInitiated =
    conflict && session && conflict.initiator_id !== session.user.id;

  const onBegin = async () => {
    if (!session || !couple) return;
    setBusy(true);
    try {
      if (partnerInitiated && conflict) {
        // B의 진입: status → both_inputting (AGENT.md §4-1)
        await joinConflict(conflict.id);
      } else {
        const created = await startConflict(couple.id, session.user.id);
        setConflict(created);
        // 상대에게 알림: "지수가 대화를 시작하고 싶어해요"
        sendPushTo(
          partner?.push_token ?? null,
          '맺음',
          `${profile?.display_name ?? '상대'}가 대화를 시작하고 싶어해요`,
          { conflict_id: created.id },
        );
      }
      router.replace('/(main)/conflict/input');
    } catch (e) {
      showAlert('오류', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ProgressSteps current={1} />

      <View style={styles.body}>
        <Text style={styles.icon}>❦</Text>
        <Text style={styles.title}>
          {partnerInitiated
            ? `${partner?.display_name ?? '상대'}가 기다리고 있어요`
            : '마음을 정리할 준비가 됐나요?'}
        </Text>
        <Text style={styles.desc}>
          지금부터 AI가 몇 가지 질문을 드려요.{'\n'}
          누가 잘못했는지 따지지 않아요.{'\n'}
          내 마음을 상대가 이해할 수 있는 말로 바꾸는 과정이에요.
        </Text>

        <View style={styles.rules}>
          <Text style={styles.rule}>솔직하게, 구체적으로</Text>
          <Text style={styles.rule}>상대 험담이 아니라 내 마음 중심으로</Text>
          <Text style={styles.rule}>작성한 원문은 상대에게 그대로 전달되지 않아요</Text>
        </View>
      </View>

      <Pressable onPress={onBegin} disabled={busy} style={styles.begin} hitSlop={12}>
        <Text style={[styles.beginText, busy && styles.beginDisabled]}>
          {busy ? '준비 중…' : partnerInitiated ? '탭하여 함께 시작하기' : '탭하여 시작하기'}
        </Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>다음에 할게요</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 56 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  icon: { fontSize: 28, marginBottom: 24, color: colors.ink2, fontFamily: fonts.display },
  title: {
    ...ui.statement,
    marginBottom: 16,
  },
  desc: {
    ...ui.statementSub,
    marginBottom: 36,
  },
  rules: {
    alignSelf: 'stretch',
    gap: 6,
  },
  rule: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.ink3,
    fontFamily: fonts.body,
    textAlign: 'center',
  },
  begin: { paddingVertical: 10 },
  beginText: {
    ...ui.quietCta,
    color: colors.ink,
  },
  beginDisabled: { color: colors.ink3 },
  cancel: {
    textAlign: 'center',
    color: colors.ink3,
    fontSize: 13,
    marginTop: 18,
    marginBottom: 12,
    fontFamily: fonts.body,
  },
});
