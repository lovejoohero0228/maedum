// 선택지 버튼 그룹 (AGENT.md §7-1) — 밝은 알약형 선택지, 선택 시 먹색 채움
// 단일 선택(기본): 선택지는 2~4개, allowDirectInput이면 마지막에 "직접 입력할게요 →" 추가, 탭 즉시 onSelect fire.
// 복수 선택(multiple=true): 체크박스처럼 토글만 하고, "선택 완료" 버튼을 눌러야 onSubmit이 fire된다.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, userTheme, type UserColor } from '@/constants/colors';

export const DIRECT_INPUT = '__direct_input__';

interface ChoiceSelectorProps {
  choices: string[];
  selected: string | null;
  onSelect: (value: string) => void;
  allowDirectInput?: boolean;
  color: UserColor;
  multiple?: boolean;
  selectedValues?: string[];
  onToggle?: (value: string) => void;
  onSubmit?: () => void;
  // false면 이미 답변이 끝난 과거 턴 — 강조 표시만 유지하고 탭/직접입력/선택완료는 숨긴다.
  interactive?: boolean;
  // true면 여러 선택지 그룹을 한 화면에 모아 쓰는 모드 — single-select 그룹이라도 탭 즉시
  // 제출하지 않고 onToggle로 이 그룹 안에서만 선택 상태를 바꾼다. 제출은 상위에서 별도로 처리.
  groupMode?: boolean;
  // 여러 그룹을 모아 쓸 때 자체 제출/직접입력 행을 숨기고 싶으면 false (상위가 공용으로 하나만 그림)
  showFooter?: boolean;
}

export function ChoiceSelector({
  choices,
  selected,
  onSelect,
  allowDirectInput = true,
  color,
  multiple = false,
  selectedValues = [],
  onToggle,
  onSubmit,
  interactive = true,
  groupMode = false,
  showFooter = true,
}: ChoiceSelectorProps) {
  const theme = userTheme(color);
  return (
    <View style={styles.wrap}>
      {choices.map((choice) => {
        const isSelected = multiple ? selectedValues.includes(choice) : selected === choice;
        return (
          <Pressable
            key={choice}
            onPress={() =>
              interactive && (multiple || groupMode ? onToggle?.(choice) : onSelect(choice))
            }
            disabled={!interactive}
            style={[
              styles.choice,
              isSelected && { backgroundColor: colors.ink },
              !interactive && !isSelected && styles.choiceMuted,
            ]}
          >
            <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>
              {choice}
            </Text>
          </Pressable>
        );
      })}
      {!interactive || !showFooter
        ? null
        : multiple ? (
        <Pressable
          onPress={onSubmit}
          disabled={selectedValues.length === 0}
          style={styles.submit}
        >
          <Text
            style={[
              styles.submitText,
              { color: selectedValues.length === 0 ? colors.ink3 : theme.text },
            ]}
          >
            선택 완료
          </Text>
        </Pressable>
      ) : allowDirectInput ? (
        <Pressable onPress={() => onSelect(DIRECT_INPUT)} style={styles.direct} hitSlop={6}>
          <Text style={styles.directText}>직접 입력할게요 →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginVertical: 10, paddingLeft: 23, alignItems: 'flex-start' },
  choice: {
    backgroundColor: colors.bgCard,
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  choiceText: {
    fontSize: 14,
    color: colors.ink,
    fontFamily: fonts.body,
  },
  choiceTextSelected: { color: colors.bg, fontFamily: fonts.bodyMedium },
  choiceMuted: { opacity: 0.45 },
  direct: { paddingVertical: 6, paddingHorizontal: 4 },
  directText: {
    fontSize: 13,
    letterSpacing: 2,
    color: colors.ink3,
    fontFamily: fonts.bodyMedium,
  },
  submit: { paddingVertical: 8, paddingHorizontal: 4 },
  submitText: {
    fontSize: 13,
    letterSpacing: 2,
    fontFamily: fonts.bodyMedium,
  },
});
