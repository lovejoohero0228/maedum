// 02단계: AI 재질문 입력 (AGENT.md §4-2)
// 채팅 형식 — AI 질문 → 답변(선택지/자유입력) → 재질문 or 다음 항목
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useConflictStore } from '@/store/conflictStore';
import { showAlert } from '@/lib/alert';
import { answerField, getMyInput, startField } from '@/services/aiInputService';
import { AIChatBubble } from '@/components/chat/AIChatBubble';
import { UserChatBubble } from '@/components/chat/UserChatBubble';
import { ChoiceSelector } from '@/components/chat/ChoiceSelector';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { colors, fonts } from '@/constants/colors';
import {
  FIELD_ORDER,
  type ChatEntry,
  type ChoiceGroup,
  type FieldKey,
  type FlagType,
  type GuideResponse,
} from '@/lib/types';

interface Bubble {
  role: 'user' | 'assistant';
  content: string;
  flag?: FlagType | null;
  flagText?: string | null;
  // assistant: 이 턴에서 제시한 선택지 그룹들
  choiceGroups?: ChoiceGroup[] | null;
  // user: 선택지에서 답한 경우 choiceGroups와 같은 순서의 선택값들 (직접 입력이면 null)
  selections?: string[][] | null;
}

// 저장된 입력에서 다음 수집 항목 계산
function nextFieldFrom(input: Awaited<ReturnType<typeof getMyInput>>): FieldKey {
  if (!input) return FIELD_ORDER[0];
  const done: Record<FieldKey, boolean> = {
    trigger_moment: !!input.trigger_moment,
    first_hurt_moment: !!input.first_hurt_moment,
    context: !!input.context_detail,
    scales: input.conflict_scale != null,
    emotion_words: !!input.emotion_words?.length,
    request: !!input.request_refined,
    partner_intention: !!input.partner_intention,
    partner_perspective: !!input.partner_perspective_words?.length,
    my_reflection: !!input.my_reflection,
  };
  return FIELD_ORDER.find((f) => !done[f]) ?? FIELD_ORDER[FIELD_ORDER.length - 1];
}

export default function Input() {
  const session = useConflictStore((s) => s.session);
  const conflict = useConflictStore((s) => s.conflict);
  const myColor = useConflictStore((s) => s.myColor);

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [field, setField] = useState<FieldKey>(FIELD_ORDER[0]);
  const [groups, setGroups] = useState<ChoiceGroup[] | null>(null);
  // groupSelections[i]는 groups[i]에서 고른 값들 — 그룹마다 1개 이상 골라야 제출 가능
  const [groupSelections, setGroupSelections] = useState<string[][]>([]);
  const [text, setText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const startedRef = useRef(false);

  const scrollToEnd = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

  const applyResponse = useCallback((res: GuideResponse) => {
    setBubbles((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: res.message,
        flag: res.flag,
        flagText: res.flag_text,
        choiceGroups: res.choice_groups,
      },
    ]);
    setGroups(res.choice_groups);
    setGroupSelections((res.choice_groups ?? []).map(() => []));
    setShowTextInput(!res.choice_groups || res.choice_groups.length === 0);
    scrollToEnd();

    if (res.all_complete) {
      // 모든 항목 완료 → 상대 대기 화면
      setTimeout(() => router.replace('/(main)/conflict/waiting'), 1200);
      return null;
    }
    return res.field_complete && res.next_field ? (res.next_field as FieldKey) : null;
  }, []);

  // 초기 로드: 저장된 대화 복원 + 현재 항목 첫 질문
  useEffect(() => {
    if (!conflict || !session || startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const saved = await getMyInput(conflict.id, session.user.id);
        if (saved?.is_complete) {
          router.replace('/(main)/conflict/waiting');
          return;
        }
        const chatLog = saved?.chat_log ?? [];
        if (chatLog.length) {
          setBubbles(
            chatLog.map((e: ChatEntry) => ({
              role: e.role,
              content: e.content,
              choiceGroups: e.choice_groups ?? null,
              selections: e.selections ?? null,
            })),
          );
        }
        const current = nextFieldFrom(saved);
        setField(current);

        // 이미 이 항목에 대한 대화가 시작된 상태라면(새로고침 등으로 재진입) —
        // startField를 다시 호출하면 AI가 "첫 질문"부터 새로 던져서 진행이 리셋된 것처럼 보인다.
        // 마지막 로그가 이미 AI의 질문(답변 대기 중)이면 그대로 두고 사용자 입력만 받는다 —
        // 선택지 그룹이 있던 질문이면 그룹도 함께 복원한다.
        const hasFieldHistory = chatLog.some((e: ChatEntry) => e.field === current);
        const lastEntry = chatLog[chatLog.length - 1];
        if (hasFieldHistory && lastEntry?.role === 'assistant') {
          if (lastEntry.choice_groups?.length) {
            setGroups(lastEntry.choice_groups);
            setGroupSelections(lastEntry.choice_groups.map(() => []));
            setShowTextInput(false);
          } else {
            setShowTextInput(true);
          }
          return;
        }

        setWaiting(true);
        const res = await startField(conflict.id, current);
        applyResponse(res);
      } catch (e) {
        showAlert('오류', String(e));
      } finally {
        setWaiting(false);
      }
    })();
  }, [conflict, session, applyResponse]);

  const send = async (answer: string, selections: string[][] | null = null) => {
    if (!conflict || waiting) return;
    setBubbles((prev) => [...prev, { role: 'user', content: answer, selections }]);
    setGroups(null);
    setGroupSelections([]);
    setShowTextInput(false);
    setText('');
    setWaiting(true);
    scrollToEnd();
    try {
      const res = await answerField(conflict.id, field, answer, selections);
      const next = applyResponse(res);
      if (next) {
        // 항목 완료 → 다음 항목 첫 질문 자동 요청
        setField(next);
        const first = await startField(conflict.id, next);
        applyResponse(first);
      }
    } catch (e) {
      showAlert('오류', String(e));
    } finally {
      setWaiting(false);
    }
  };

  // groupIndex번째 그룹에서 value를 토글 — multi_select면 여러 개, 아니면 하나만(라디오처럼) 유지
  const onToggleGroupChoice = (groupIndex: number, value: string) => {
    const group = groups?.[groupIndex];
    if (!group) return;
    setGroupSelections((prev) => {
      const next = prev.map((arr) => arr.slice());
      const current = next[groupIndex] ?? [];
      next[groupIndex] = group.multi_select
        ? current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value]
        : current.includes(value)
          ? []
          : [value];
      return next;
    });
  };

  const canSubmitGroups =
    !!groups?.length && groups.every((_, i) => (groupSelections[i]?.length ?? 0) > 0);

  const onSubmitGroups = () => {
    if (!groups || !canSubmitGroups) return;
    const answer = groups.map((g, i) => `${g.label}: ${groupSelections[i].join(', ')}`).join(' / ');
    send(answer, groupSelections);
  };

  const fieldIndex = FIELD_ORDER.indexOf(field) + 1;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ProgressSteps current={2} />
      <Text style={styles.fieldProgress}>
        {fieldIndex} / {FIELD_ORDER.length} 항목
      </Text>

      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={styles.chatContent}
      >
        {bubbles.map((b, i) => {
          if (b.role === 'assistant') {
            const isPending = i === bubbles.length - 1;
            const answeredBy = !isPending ? bubbles[i + 1] : null;
            return (
              <View key={i}>
                <AIChatBubble message={b.content} flag={b.flag} flagText={b.flagText} />
                {b.choiceGroups?.length && !isPending
                  ? b.choiceGroups.map((g, gi) => (
                      <View key={gi}>
                        <Text style={styles.groupLabel}>{g.label}</Text>
                        <ChoiceSelector
                          choices={g.choices}
                          selected={g.multi_select ? null : (answeredBy?.selections?.[gi]?.[0] ?? null)}
                          selectedValues={answeredBy?.selections?.[gi] ?? []}
                          multiple={g.multi_select}
                          interactive={false}
                          showFooter={false}
                          onSelect={() => {}}
                          color={myColor()}
                        />
                      </View>
                    ))
                  : null}
              </View>
            );
          }
          // 선택지 그룹에서 고른 답변이면 이미 강조된 칩으로 표시되므로 중복 말풍선을 생략
          if (b.selections?.length) return null;
          return <UserChatBubble key={i} message={b.content} color={myColor()} />;
        })}

        {waiting ? (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color={colors.purpleMid} />
            <Text style={styles.typingText}>생각 중…</Text>
          </View>
        ) : null}

        {!waiting && groups?.length ? (
          <>
            {groups.map((g, gi) => (
              <View key={gi}>
                <Text style={styles.groupLabel}>{g.label}</Text>
                <ChoiceSelector
                  choices={g.choices}
                  selected={g.multi_select ? null : (groupSelections[gi]?.[0] ?? null)}
                  selectedValues={groupSelections[gi] ?? []}
                  multiple={g.multi_select}
                  groupMode
                  showFooter={false}
                  onSelect={() => {}}
                  onToggle={(v) => onToggleGroupChoice(gi, v)}
                  color={myColor()}
                />
              </View>
            ))}
            <View style={styles.groupFooter}>
              <Pressable
                onPress={onSubmitGroups}
                disabled={!canSubmitGroups}
                style={[styles.groupSubmit, !canSubmitGroups && styles.groupSubmitDisabled]}
              >
                <Text
                  style={[
                    styles.groupSubmitText,
                    !canSubmitGroups && styles.groupSubmitTextDisabled,
                  ]}
                >
                  선택 완료
                </Text>
              </Pressable>
              <Pressable onPress={() => setShowTextInput(true)} hitSlop={8}>
                <Text style={styles.groupDirectText}>이 중에 없어요, 직접 입력할게요 →</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>

      {showTextInput && !waiting ? (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="내 마음을 적어주세요…"
            placeholderTextColor={colors.ink3}
            value={text}
            onChangeText={setText}
            multiline
          />
          <Pressable
            style={[styles.sendButton, !text.trim() && styles.sendDisabled]}
            onPress={() => text.trim() && send(text.trim())}
            disabled={!text.trim()}
          >
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 48 },
  fieldProgress: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.ink3,
    marginBottom: 4,
    fontFamily: fonts.body,
  },
  chat: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 24 },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 36,
    marginVertical: 8,
  },
  typingText: { fontSize: 13, color: colors.ink3, fontFamily: fonts.body },
  groupLabel: {
    fontSize: 12,
    color: colors.ink3,
    fontFamily: fonts.bodyMedium,
    marginTop: 10,
    paddingLeft: 36,
  },
  groupFooter: { gap: 8, marginTop: 8, paddingLeft: 36, alignItems: 'flex-start' },
  groupSubmit: {
    backgroundColor: colors.purpleMid,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 11,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  groupSubmitDisabled: { backgroundColor: colors.line2 },
  groupSubmitText: { color: '#fff', fontSize: 14, fontFamily: fonts.bodyMedium },
  groupSubmitTextDisabled: { color: colors.ink3 },
  groupDirectText: {
    fontSize: 13,
    color: colors.ink3,
    fontFamily: fonts.body,
    textDecorationLine: 'underline',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line2,
    backgroundColor: colors.bgCard,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.body,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.purpleMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontSize: 18 },
});
