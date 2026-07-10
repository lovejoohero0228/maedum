// 관계 프로필 설정/수정 — 커플 페어링 후 최초 1회 필수, 이후 언제든 수정 가능
// 4단계: 관계 유형·기간 → 내 성격 → 상대 성격 → 자주 부딪히는 주제
// 완료 시 upsert 후 AI에게 개인화 레퍼런스 뱅크 생성을 요청한다 (02단계 선택지에 쓰임)
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useConflictStore } from '@/store/conflictStore';
import { upsertRelationshipProfile } from '@/services/relationshipProfileService';
import { requestReferenceBank } from '@/lib/ai';
import { showAlert } from '@/lib/alert';
import { ChoiceSelector, DIRECT_INPUT } from '@/components/chat/ChoiceSelector';
import { Wash } from '@/components/ui/Wash';
import { colors, fonts, ui } from '@/constants/colors';
import {
  RELATIONSHIP_TYPES,
  RELATIONSHIP_DURATION_PRESETS,
  PERSONALITY_TAGS,
  CONFLICT_TOPICS,
} from '@/constants/relationshipTags';
import type { RelationshipType } from '@/lib/types';

const NEEDS_DURATION: RelationshipType[] = ['연인', '부부', '썸'];
const TOTAL_STEPS = 4;

export default function RelationshipProfileScreen() {
  const couple = useConflictStore((s) => s.couple);
  const session = useConflictStore((s) => s.session);
  const existing = useConflictStore((s) => s.relationshipProfile);
  const loadRelationshipProfile = useConflictStore((s) => s.loadRelationshipProfile);
  const myColor = useConflictStore((s) => s.myColor);

  const [step, setStep] = useState(1);
  const [relationshipType, setRelationshipType] = useState<RelationshipType | null>(
    existing?.relationship_type ?? null,
  );
  const [durationMonths, setDurationMonths] = useState<number | null>(
    existing?.relationship_duration_months ?? null,
  );
  const [showDurationInput, setShowDurationInput] = useState(false);
  const [durationText, setDurationText] = useState('');
  const [myTags, setMyTags] = useState<string[]>(existing?.my_personality_tags ?? []);
  const [partnerTags, setPartnerTags] = useState<string[]>(
    existing?.partner_personality_tags ?? [],
  );
  const [topics, setTopics] = useState<string[]>(existing?.frequent_conflict_topics ?? []);
  const [saving, setSaving] = useState(false);

  const needsDuration = relationshipType ? NEEDS_DURATION.includes(relationshipType) : false;
  const durationLabel =
    RELATIONSHIP_DURATION_PRESETS.find((p) => p.months === durationMonths)?.label ?? null;

  const toggle = (setter: typeof setMyTags, list: string[], value: string) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const onSelectDuration = (value: string) => {
    if (value === DIRECT_INPUT) {
      setShowDurationInput(true);
      return;
    }
    const preset = RELATIONSHIP_DURATION_PRESETS.find((p) => p.label === value);
    if (preset) {
      setDurationMonths(preset.months);
      setShowDurationInput(false);
    }
  };

  const canProceedStep1 = !!relationshipType && (!needsDuration || durationMonths != null);

  const onFinish = async () => {
    if (!couple || !session || saving) return;
    setSaving(true);
    const basePayload = {
      couple_id: couple.id,
      user_id: session.user.id,
      relationship_type: relationshipType!,
      relationship_duration_months: needsDuration ? durationMonths : null,
      my_personality_tags: myTags,
      partner_personality_tags: partnerTags,
      frequent_conflict_topics: topics,
    };
    try {
      // is_complete는 레퍼런스 뱅크 생성까지 성공해야 true로 커밋한다.
      // 여기서 실패하면 입력값은 저장된 채(is_complete: false) 남아 재시도할 수 있다.
      const profile = await upsertRelationshipProfile({ ...basePayload, is_complete: false });
      await requestReferenceBank(profile.id);
      await upsertRelationshipProfile({ ...basePayload, is_complete: true });
      await loadRelationshipProfile();
      router.replace('/(main)/home');
    } catch (e) {
      await loadRelationshipProfile().catch(() => {});
      showAlert('저장 실패', '레퍼런스 준비 중 문제가 생겼어요. 입력한 내용은 저장되어 있으니 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (saving) {
    return (
      <View style={styles.loadingContainer}>
        <Wash />
        <ActivityIndicator size="small" color={colors.ink2} />
        <Text style={styles.loadingText}>AI가 우리 관계에 맞는 질문지를 준비하고 있어요…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Wash />
      <View style={styles.header}>
        {step > 1 ? (
          <Pressable onPress={() => setStep(step - 1)} hitSlop={8}>
            <Text style={styles.back}>←</Text>
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 1 ? (
          <>
            <Text style={styles.question}>두 사람은 어떤 관계인가요?</Text>
            <ChoiceSelector
              choices={RELATIONSHIP_TYPES}
              selected={relationshipType}
              onSelect={(v) => setRelationshipType(v as RelationshipType)}
              allowDirectInput={false}
              color={myColor()}
            />
            {needsDuration ? (
              <>
                <Text style={[styles.question, styles.questionSpaced]}>
                  만난 지 얼마나 됐나요?
                </Text>
                <ChoiceSelector
                  choices={RELATIONSHIP_DURATION_PRESETS.map((p) => p.label)}
                  selected={showDurationInput ? null : durationLabel}
                  onSelect={onSelectDuration}
                  allowDirectInput
                  color={myColor()}
                />
                {showDurationInput ? (
                  <View style={styles.durationInputRow}>
                    <TextInput
                      style={styles.durationInput}
                      placeholder="개월 수"
                      placeholderTextColor={colors.ink3}
                      value={durationText}
                      onChangeText={setDurationText}
                      keyboardType="number-pad"
                    />
                    <Text style={styles.durationSuffix}>개월</Text>
                    <Pressable
                      style={styles.durationConfirm}
                      onPress={() => {
                        const n = Number(durationText);
                        if (n > 0) setDurationMonths(n);
                      }}
                    >
                      <Text style={styles.durationConfirmText}>확인</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.question}>나는 어떤 성격인 것 같나요?</Text>
            <Text style={styles.hint}>여러 개 골라도 돼요</Text>
            <ChoiceSelector
              choices={PERSONALITY_TAGS}
              selected={null}
              onSelect={() => {}}
              color={myColor()}
              multiple
              selectedValues={myTags}
              onToggle={(v) => toggle(setMyTags, myTags, v)}
              onSubmit={() => setStep(3)}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.question}>내가 보는 상대는 어떤 사람인가요?</Text>
            <Text style={styles.hint}>여러 개 골라도 돼요</Text>
            <ChoiceSelector
              choices={PERSONALITY_TAGS}
              selected={null}
              onSelect={() => {}}
              color={myColor()}
              multiple
              selectedValues={partnerTags}
              onToggle={(v) => toggle(setPartnerTags, partnerTags, v)}
              onSubmit={() => setStep(4)}
            />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Text style={styles.question}>자주 부딪히는 주제가 있다면?</Text>
            <Text style={styles.hint}>여러 개 골라도 돼요</Text>
            <ChoiceSelector
              choices={CONFLICT_TOPICS}
              selected={null}
              onSelect={() => {}}
              color={myColor()}
              multiple
              selectedValues={topics}
              onToggle={(v) => toggle(setTopics, topics, v)}
              onSubmit={onFinish}
            />
          </>
        ) : null}
      </ScrollView>

      {step === 1 ? (
        <Pressable
          style={[styles.nextButton, !canProceedStep1 && styles.nextDisabled]}
          onPress={() => canProceedStep1 && setStep(2)}
          disabled={!canProceedStep1}
        >
          <Text style={ui.primaryPillText}>다음</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  loadingText: {
    ...ui.statementSub,
    color: colors.ink2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  back: { fontSize: 22, color: colors.ink2 },
  progressTrack: {
    ...ui.progressTrack,
    flex: 1,
  },
  progressFill: ui.progressFill,
  content: { padding: 24, paddingTop: 36, paddingBottom: 40 },
  question: {
    ...ui.statement,
    marginBottom: 6,
  },
  questionSpaced: { marginTop: 40 },
  hint: {
    ...ui.statementSub,
    fontSize: 12,
    marginBottom: 10,
  },
  durationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  durationInput: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: 96,
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.body,
  },
  durationSuffix: { fontSize: 14, color: colors.ink2, fontFamily: fonts.body },
  durationConfirm: {
    ...ui.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  durationConfirmText: { ...ui.pillText, fontSize: 13 },
  nextButton: {
    ...ui.primaryPill,
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 28,
  },
  nextDisabled: { opacity: 0.4 },
});
