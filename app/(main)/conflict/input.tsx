// 02단계: AI 재질문 입력 (AGENT.md §4-2)
// 채팅 형식 — AI 질문 → 답변(선택지/자유입력) → 재질문 or 다음 항목
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import { showAlert, showConfirm } from '@/lib/alert';
import { friendlyErrorMessage } from '@/lib/errors';
import { answerField, getMyInput, restartFromField, startField } from '@/services/aiInputService';
import { Wash } from '@/components/ui/Wash';
import { Maedeubi } from '@/components/ui/Maedeubi';
import { AIChatBubble } from '@/components/chat/AIChatBubble';
import { UserChatBubble } from '@/components/chat/UserChatBubble';
import { ChoiceSelector } from '@/components/chat/ChoiceSelector';
import { ScaleSelector } from '@/components/chat/ScaleSelector';
import { colors, fonts, ui, userTheme } from '@/constants/colors';
import {
  FIELD_LABELS,
  FIELD_ORDER,
  type ChatEntry,
  type ChoiceGroup,
  type FieldKey,
  type FlagType,
  type GuideEnvelope,
  type GuideResponse,
} from '@/lib/types';

const NONE_OF_ABOVE = '해당 없음';

// 자유서술 턴의 입력창 안내 — 사실 수집 단계에서 감정을 유도하지 않도록 항목별로 다르게 쓴다
const FREE_TEXT_PLACEHOLDER: Record<FieldKey, string> = {
  trigger_moment: '그때 오간 말이나 행동을 그대로 적어주세요…',
  hurt_context: '그때 오간 말이나 행동을 그대로 적어주세요…',
  feelings: '내 마음을 적어주세요…',
  partner_mind: '상대의 마음을 헤아려 적어주세요…',
  request: '상대가 해줬으면 하는 말이나 행동을 적어주세요…',
  my_reflection: '스스로 아쉬웠던 부분을 편하게 적어주세요…',
};

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

function bubblesFromLog(chatLog: ChatEntry[]): Bubble[] {
  // 앱이 죽는 등으로 같은 질문이 로그에 연달아 두 번 남았으면 화면에는 한 번만 보여준다
  const out: Bubble[] = [];
  let prevKept: ChatEntry | null = null;
  for (const e of chatLog) {
    if (
      prevKept &&
      e.role === 'assistant' &&
      prevKept.role === 'assistant' &&
      e.content === prevKept.content &&
      e.field === prevKept.field
    ) {
      continue;
    }
    out.push({
      role: e.role,
      content: e.content,
      choiceGroups: e.choice_groups ?? null,
      selections: e.selections ?? null,
    });
    prevKept = e;
  }
  return out;
}

// 저장된 입력에서 다음 수집 항목 계산
function nextFieldFrom(input: Awaited<ReturnType<typeof getMyInput>>): FieldKey {
  if (!input) return FIELD_ORDER[0];
  // 섹션의 컬럼들은 field_complete 시 한꺼번에 저장되므로 대표 컬럼 하나로 판단해도 안전
  const done: Record<FieldKey, boolean> = {
    trigger_moment: !!input.trigger_moment,
    hurt_context: !!input.context_detail,
    feelings: input.conflict_scale != null,
    request: !!input.request_refined,
    partner_mind: !!input.partner_intention,
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
  // groupSelections[i]는 groups[i]에서 고른 값들(직접 입력한 값 포함) — 그룹마다 1개 이상 골라야 제출 가능
  const [groupSelections, setGroupSelections] = useState<string[][]>([]);
  // customChoices[i]는 groups[i]에서 사용자가 직접 입력해 추가한 값들 (칩으로 함께 표시하기 위해 보관)
  const [customChoices, setCustomChoices] = useState<string[][]>([]);
  const [directInputOpen, setDirectInputOpen] = useState<Record<number, boolean>>({});
  const [directInputText, setDirectInputText] = useState<Record<number, string>>({});
  const [text, setText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [waiting, setWaiting] = useState(false);
  // 초기 로드/복원이 실패했을 때 채팅 안에 "다시 시도"를 띄우기 위한 상태
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const startedRef = useRef(false);

  const scrollToEnd = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

  const pushAssistant = useCallback(
    (env: {
      message: string;
      flag?: FlagType | null;
      flag_text?: string | null;
      choice_groups?: ChoiceGroup[] | null;
    }) => {
      setBubbles((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: env.message,
          flag: env.flag ?? null,
          flagText: env.flag_text ?? null,
          choiceGroups: env.choice_groups ?? null,
        },
      ]);
    },
    [],
  );

  // AI 말풍선 추가 + 선택지 그룹/입력창 상태 세팅 (봉투 단위 공통 처리)
  const applyEnvelope = useCallback(
    (env: GuideEnvelope) => {
      pushAssistant(env);
      setGroups(env.choice_groups);
      setGroupSelections((env.choice_groups ?? []).map(() => []));
      setCustomChoices((env.choice_groups ?? []).map(() => []));
      setDirectInputOpen({});
      setDirectInputText({});
      setShowTextInput(!env.choice_groups || env.choice_groups.length === 0);
      scrollToEnd();
    },
    [pushAssistant],
  );

  const applyResponse = useCallback(
    (res: GuideResponse) => {
      applyEnvelope(res);
      if (res.all_complete) {
        // 모든 항목 완료 → 상대 대기 화면
        setShowTextInput(false);
        setTimeout(() => router.replace('/(main)/conflict/waiting'), 1200);
        return null;
      }
      return res.field_complete && res.next_field ? (res.next_field as FieldKey) : null;
    },
    [applyEnvelope],
  );

  // 응답 전체 처리: 항목 완료 시 서버가 실어 보낸 다음 질문(next_question)과 0턴 완료
  // 멘트(skipped)를 그대로 반영한다. 피기백이 없으면 startField로 폴백 (왕복 1회 추가).
  const handleResponse = useCallback(
    async (res: GuideResponse): Promise<void> => {
      const next = applyResponse(res);
      if (!next || !conflict) return;
      for (const s of res.skipped ?? []) pushAssistant({ message: s.message });
      setField(next);
      if (res.next_question) {
        applyEnvelope(res.next_question);
        return;
      }
      const first = await startField(conflict.id, next);
      await handleResponse(first);
    },
    [applyResponse, applyEnvelope, pushAssistant, conflict],
  );

  // 초기 로드: 저장된 대화 복원 + 현재 항목 첫 질문.
  // 실패해도 막다른 화면이 되지 않도록 loadError를 세팅하고, "다시 시도"에서 재호출한다.
  const loadConversation = useCallback(async () => {
    if (!conflict || !session) return;
    setLoadError(null);
    try {
      const saved = await getMyInput(conflict.id, session.user.id);
      if (saved?.is_complete) {
        router.replace('/(main)/conflict/waiting');
        return;
      }
      const chatLog = saved?.chat_log ?? [];
      setBubbles(bubblesFromLog(chatLog));
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
          setCustomChoices(lastEntry.choice_groups.map(() => []));
          setShowTextInput(false);
        } else {
          setShowTextInput(true);
        }
        return;
      }

      setWaiting(true);
      const res = await startField(conflict.id, current);
      await handleResponse(res);
    } catch (e) {
      setLoadError(friendlyErrorMessage(e, '대화를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'));
    } finally {
      setWaiting(false);
    }
  }, [conflict, session, handleResponse]);

  useEffect(() => {
    if (!conflict || !session || startedRef.current) return;
    startedRef.current = true;
    loadConversation();
  }, [conflict, session, loadConversation]);

  const send = async (answer: string, selections: string[][] | null = null) => {
    if (!conflict || waiting) return;
    // 전송 실패 시 복원할 스냅샷 — 낙관적으로 말풍선을 추가하고 입력을 비우기 전에 떠둔다
    const snapshot = {
      field,
      text,
      groups,
      groupSelections,
      customChoices,
      showTextInput,
      bubbleCount: bubbles.length,
    };
    setBubbles((prev) => [...prev, { role: 'user', content: answer, selections }]);
    setGroups(null);
    setGroupSelections([]);
    setCustomChoices([]);
    setDirectInputOpen({});
    setDirectInputText({});
    setShowTextInput(false);
    setText('');
    setWaiting(true);
    scrollToEnd();
    try {
      const res = await answerField(conflict.id, field, answer, selections);
      await handleResponse(res);
    } catch (e) {
      // 낙관적으로 붙인 내 말풍선을 걷어내고, 적었던 답(자유 입력/선택지)을 그대로 복원한다
      setBubbles((prev) => prev.slice(0, snapshot.bubbleCount));
      setField(snapshot.field);
      setText(snapshot.text);
      setGroups(snapshot.groups);
      setGroupSelections(snapshot.groupSelections);
      setCustomChoices(snapshot.customChoices);
      setShowTextInput(snapshot.showTextInput);
      showAlert('전송하지 못했어요', friendlyErrorMessage(e));
    } finally {
      setWaiting(false);
    }
  };

  // target 항목부터(포함) 내 응답을 초기화하고 그 항목의 첫 질문부터 다시 시작.
  // 뒤 항목의 질문은 앞 답변을 근거로 생성되므로 target 이후의 답변도 함께 지워진다.
  const restartFrom = async (target: FieldKey) => {
    if (!conflict || !session || waiting) return;
    const isFullRestart = target === FIELD_ORDER[0];
    const ok = await showConfirm(
      isFullRestart ? '내 응답을 처음부터 다시 시작할까요?' : `'${FIELD_LABELS[target]}' 항목부터 다시 답할까요?`,
      (isFullRestart
        ? '지금까지 내가 답한 내용이 모두 초기화돼요.'
        : '이 항목과 그 이후 항목의 내 답변이 초기화돼요.') + ' 상대의 응답에는 영향이 없어요.',
      '다시 시작',
    );
    if (!ok) return;
    setWaiting(true);
    setGroups(null);
    setGroupSelections([]);
    setCustomChoices([]);
    setDirectInputOpen({});
    setDirectInputText({});
    setShowTextInput(false);
    setText('');
    try {
      const keptLog = await restartFromField(conflict.id, session.user.id, target);
      setBubbles(bubblesFromLog(keptLog));
      setField(target);
      scrollToEnd();
      const res = await startField(conflict.id, target);
      await handleResponse(res);
    } catch (e) {
      showAlert('다시 시작하지 못했어요', friendlyErrorMessage(e));
      // 입력 수단이 사라진 채 남지 않도록 서버 상태 기준으로 화면을 되살린다
      await loadConversation();
    } finally {
      setWaiting(false);
    }
  };

  // groupIndex번째 그룹에서 value를 토글.
  // single 그룹(스케일/의도 인식 등)은 하나만 유지하고, "해당 없음"은 다른 선택과 배타적이다.
  const onToggleGroupChoice = (groupIndex: number, value: string, single = false) => {
    setGroupSelections((prev) => {
      const next = prev.map((arr) => arr.slice());
      const current = next[groupIndex] ?? [];
      if (single) {
        next[groupIndex] = current.includes(value) ? [] : [value];
      } else if (value === NONE_OF_ABOVE) {
        next[groupIndex] = current.includes(NONE_OF_ABOVE) ? [] : [NONE_OF_ABOVE];
      } else {
        const withoutNone = current.filter((v) => v !== NONE_OF_ABOVE);
        next[groupIndex] = withoutNone.includes(value)
          ? withoutNone.filter((v) => v !== value)
          : [...withoutNone, value];
      }
      return next;
    });
  };

  // groupIndex번째 그룹에 직접 입력한 값을 칩으로 추가하고 곧바로 선택 상태로 만든다.
  const addCustomChoice = (groupIndex: number) => {
    const value = (directInputText[groupIndex] ?? '').trim();
    if (!value) return;
    setCustomChoices((prev) => {
      const next = prev.map((arr) => arr.slice());
      if (!next[groupIndex]) next[groupIndex] = [];
      if (!next[groupIndex].includes(value)) next[groupIndex] = [...next[groupIndex], value];
      return next;
    });
    setGroupSelections((prev) => {
      const next = prev.map((arr) => arr.slice());
      const withoutNone = (next[groupIndex] ?? []).filter((v) => v !== NONE_OF_ABOVE);
      next[groupIndex] = withoutNone.includes(value) ? withoutNone : [...withoutNone, value];
      return next;
    });
    setDirectInputText((prev) => ({ ...prev, [groupIndex]: '' }));
    setDirectInputOpen((prev) => ({ ...prev, [groupIndex]: false }));
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
      <Wash height={180} />
      {/* 상단 내비 — ← + 얇은 진행 바 + 다시 시작 (EMBr 온보딩 상단 바) */}
      <View style={styles.topNav}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View style={styles.progressWrap}>
          <View style={ui.progressTrack}>
            <View
              style={[ui.progressFill, { width: `${(fieldIndex / FIELD_ORDER.length) * 100}%` }]}
            />
          </View>
        </View>
        <Pressable
          onPress={() => restartFrom(FIELD_ORDER[0])}
          disabled={waiting}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="처음부터 다시 시작하기"
        >
          <Text style={[styles.restartAll, waiting && styles.chipDisabledText]}>
            처음부터
          </Text>
        </Pressable>
      </View>
      {/* 중간에 나가도 데이터가 날아가지 않는다는 안심 문구 — 뒤로가기 불안 완화 */}
      <Text style={styles.saveHint}>나가도 진행 상황은 저장돼요</Text>
      {/* 항목 네비게이터 — 이미 지나온 항목을 탭하면 그 항목부터 다시 답할 수 있다 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.fieldChips}
        contentContainerStyle={styles.fieldChipsContent}
      >
        {FIELD_ORDER.map((f, i) => {
          const isCurrent = f === field;
          const isPast = i < fieldIndex - 1;
          return (
            <Pressable
              key={f}
              disabled={!isPast || waiting}
              onPress={() => restartFrom(f)}
              accessibilityRole="button"
              accessibilityLabel={
                isPast ? `${FIELD_LABELS[f]} 항목으로 되돌아가기` : `${FIELD_LABELS[f]} 항목`
              }
              accessibilityState={{ disabled: !isPast || waiting, selected: isCurrent }}
              style={[
                styles.chip,
                isCurrent && {
                  borderColor: userTheme(myColor()).mid,
                  backgroundColor: colors.bgCard,
                },
                !isPast && !isCurrent && styles.chipFuture,
              ]}
              hitSlop={4}
            >
              <Text
                style={[
                  styles.chipText,
                  isCurrent && { color: userTheme(myColor()).text },
                  isPast && styles.chipPastText,
                  !isPast && !isCurrent && styles.chipDisabledText,
                ]}
              >
                {isPast ? `${FIELD_LABELS[f]} ↺` : FIELD_LABELS[f]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
                <AIChatBubble
                  message={b.content}
                  flag={b.flag}
                  flagText={b.flagText}
                  // 연속된 매듭이 말풍선에는 이름표를 한 번만
                  showName={i === 0 || bubbles[i - 1].role !== 'assistant'}
                />
                {/* 답변이 끝난 그룹은 고른 값만 남긴다 — 안 고른 칩까지 전부 남기면
                    히스토리가 미선택 칩으로 뒤덮여 "내가 한 말"을 되짚기 어렵다 */}
                {b.choiceGroups?.length && !isPending && answeredBy?.role === 'user'
                  ? b.choiceGroups.map((g, gi) => {
                      const picked = answeredBy?.selections?.[gi] ?? [];
                      if (!picked.length) return null;
                      return (
                        <View key={gi}>
                          <Text style={styles.groupLabel}>{g.label}</Text>
                          <ChoiceSelector
                            choices={picked}
                            selected={null}
                            selectedValues={picked}
                            multiple
                            interactive={false}
                            showFooter={false}
                            onSelect={() => {}}
                            color={myColor()}
                          />
                        </View>
                      );
                    })
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
            <Maedeubi size={22} breathe variant="think" />
            <Text style={styles.typingText}>매듭이가 생각하는 중…</Text>
          </View>
        ) : null}

        {!waiting && loadError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable
              onPress={loadConversation}
              style={styles.retryButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="다시 시도"
            >
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        {!waiting && groups?.length ? (
          <>
            {groups.map((g, gi) => {
              const isScale = g.kind === 'scale';
              const single = isScale || g.select === 'single';
              const noneAllowed = !isScale && g.allow_none !== false;
              const customAllowed = !isScale && g.allow_custom !== false;
              const answered = (groupSelections[gi]?.length ?? 0) > 0;
              return (
                <View key={gi}>
                  <Text style={styles.groupLabel}>
                    {g.label}
                    {answered ? ' ✓' : ''}
                  </Text>
                  {isScale ? (
                    <ScaleSelector
                      choices={g.choices}
                      selectedValue={groupSelections[gi]?.[0] ?? null}
                      onSelect={(v) => onToggleGroupChoice(gi, v, true)}
                      color={myColor()}
                    />
                  ) : (
                    <ChoiceSelector
                      choices={[
                        ...g.choices,
                        ...(customChoices[gi] ?? []),
                        ...(noneAllowed ? [NONE_OF_ABOVE] : []),
                      ]}
                      selected={single ? (groupSelections[gi]?.[0] ?? null) : null}
                      selectedValues={groupSelections[gi] ?? []}
                      multiple={!single}
                      groupMode
                      showFooter={false}
                      onSelect={() => {}}
                      onToggle={(v) => onToggleGroupChoice(gi, v, single)}
                      color={myColor()}
                    />
                  )}
                  {!customAllowed ? null : directInputOpen[gi] ? (
                    <View style={styles.groupDirectInputRow}>
                      <TextInput
                        style={styles.groupDirectInput}
                        placeholder="직접 입력…"
                        placeholderTextColor={colors.ink3}
                        value={directInputText[gi] ?? ''}
                        onChangeText={(t) => setDirectInputText((prev) => ({ ...prev, [gi]: t }))}
                        onSubmitEditing={() => addCustomChoice(gi)}
                      />
                      <Pressable
                        onPress={() => addCustomChoice(gi)}
                        style={styles.groupDirectAdd}
                        accessibilityRole="button"
                        accessibilityLabel="직접 입력한 답 추가"
                      >
                        <Text style={styles.groupDirectAddText}>추가</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setDirectInputOpen((prev) => ({ ...prev, [gi]: true }))}
                      style={styles.groupDirectToggle}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`${g.label}에 직접 입력하기`}
                    >
                      <Text style={styles.groupDirectToggleText}>+ 직접 입력</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
            <View style={styles.groupFooter}>
              <Pressable
                onPress={onSubmitGroups}
                disabled={!canSubmitGroups}
                accessibilityRole="button"
                accessibilityLabel="선택 완료"
                accessibilityState={{ disabled: !canSubmitGroups }}
                style={[styles.groupSubmit, !canSubmitGroups && styles.groupSubmitDisabled]}
              >
                <Text
                  style={[
                    styles.groupSubmitText,
                    !canSubmitGroups && styles.groupSubmitTextDisabled,
                  ]}
                >
                  {canSubmitGroups
                    ? '선택 완료'
                    : `${groups.filter((_, i) => (groupSelections[i]?.length ?? 0) === 0).length}개 그룹을 골라주세요`}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>

      {showTextInput && !waiting ? (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={FREE_TEXT_PLACEHOLDER[field]}
            placeholderTextColor={colors.ink3}
            value={text}
            onChangeText={setText}
            multiline
          />
          <Pressable
            style={[styles.sendButton, !text.trim() && styles.sendDisabled]}
            onPress={() => text.trim() && send(text.trim())}
            disabled={!text.trim()}
            accessibilityRole="button"
            accessibilityLabel="보내기"
            accessibilityState={{ disabled: !text.trim() }}
          >
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 60 },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  back: { fontSize: 20, color: colors.ink },
  progressWrap: { flex: 1 },
  saveHint: {
    fontSize: 11,
    color: colors.ink3,
    fontFamily: fonts.body,
    textAlign: 'center',
    marginBottom: 10,
    opacity: 0.9,
  },
  restartAll: {
    fontSize: 13,
    color: colors.ink2,
    fontFamily: fonts.body,
  },
  fieldChips: { flexGrow: 0, marginBottom: 4 },
  fieldChipsContent: { paddingHorizontal: 24, gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: colors.bgCard,
  },
  chipFuture: { backgroundColor: 'transparent', borderColor: colors.line2 },
  chipText: { fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.ink2 },
  chipPastText: { color: colors.ink2 },
  chipDisabledText: { color: colors.ink3, opacity: 0.6 },
  chat: { flex: 1 },
  chatContent: { padding: 24, paddingTop: 16, paddingBottom: 24 },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 36,
    marginVertical: 8,
  },
  typingText: { fontSize: 13, color: colors.ink3, fontFamily: fonts.body },
  errorBox: {
    paddingLeft: 36,
    marginTop: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  errorText: { fontSize: 13, lineHeight: 20, color: colors.ink2, fontFamily: fonts.body },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.bgCard,
  },
  retryText: { fontSize: 13, color: colors.ink, fontFamily: fonts.bodyMedium },
  groupLabel: {
    fontSize: 12,
    color: colors.ink3,
    fontFamily: fonts.bodyMedium,
    marginTop: 10,
    paddingLeft: 36,
  },
  groupFooter: { gap: 8, marginTop: 8, paddingLeft: 36, alignItems: 'flex-start' },
  groupSubmit: {
    backgroundColor: colors.ink,
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  groupSubmitDisabled: { backgroundColor: colors.line2 },
  groupSubmitText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.bodyMedium },
  groupSubmitTextDisabled: { color: colors.ink3 },
  groupDirectToggle: { paddingLeft: 36, marginTop: 6 },
  groupDirectToggleText: {
    fontSize: 12,
    color: colors.ink3,
    fontFamily: fonts.body,
    textDecorationLine: 'underline',
  },
  groupDirectInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 36,
    marginTop: 6,
  },
  groupDirectInput: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.ink,
    fontFamily: fonts.body,
  },
  groupDirectAdd: {
    backgroundColor: colors.ink,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  groupDirectAddText: { color: '#FFFFFF', fontSize: 12, fontFamily: fonts.bodyMedium },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.body,
    backgroundColor: colors.bgCard,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: '#FFFFFF', fontSize: 18 },
});
