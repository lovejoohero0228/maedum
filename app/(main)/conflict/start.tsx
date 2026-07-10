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
import { Wash } from '@/components/ui/Wash';
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
      <Wash />
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View style={styles.progressWrap}>
          <ProgressSteps current={1} />
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.skip}>다음에</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>
          {partnerInitiated
            ? `${partner?.display_name ?? '상대'}가\n기다리고 있어요`
            : '마음을 정리할\n준비가 됐나요?'}
        </Text>
        <Text style={styles.desc}>
          지금부터 AI가 몇 가지 질문을 드려요. 누가 잘못했는지 따지지 않아요.
          내 마음을 상대가 이해할 수 있는 말로 바꾸는 과정이에요.
        </Text>

        <View style={styles.rules}>
          <Text style={styles.rule}>솔직하게, 구체적으로</Text>
          <Text style={styles.rule}>상대 험담이 아니라 내 마음 중심으로</Text>
          <Text style={styles.rule}>작성한 원문은 상대에게 그대로 전달되지 않아요</Text>
        </View>
      </View>

      <Pressable
        onPress={onBegin}
        disabled={busy}
        style={[styles.begin, busy && styles.beginBusy]}
      >
        <Text style={ui.primaryPillText}>
          {busy ? '준비 중…' : partnerInitiated ? '함께 시작하기' : '시작하기'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 56 },
  topNav: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  back: { fontSize: 20, color: colors.ink },
  progressWrap: { flex: 1 },
  skip: { fontSize: 14, color: colors.ink2, fontFamily: fonts.body },
  body: { flex: 1, paddingTop: 36 },
  title: {
    ...ui.statement,
    fontSize: 28,
    lineHeight: 42,
    marginBottom: 14,
  },
  desc: {
    ...ui.statementSub,
    marginBottom: 32,
  },
  rules: {
    ...ui.card,
    gap: 10,
  },
  rule: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink2,
    fontFamily: fonts.body,
  },
  begin: { ...ui.primaryPill, marginBottom: 12 },
  beginBusy: { opacity: 0.6 },
});
