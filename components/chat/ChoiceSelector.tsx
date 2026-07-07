// 선택지 버튼 그룹 (AGENT.md §7-1)
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
}: ChoiceSelectorProps) {
  const theme = userTheme(color);
  return (
    <View style={styles.wrap}>
      {choices.map((choice) => {
        const isSelected = multiple ? selectedValues.includes(choice) : selected === choice;
        return (
          <Pressable
            key={choice}
            onPress={() => (multiple ? onToggle?.(choice) : onSelect(choice))}
            style={[
              styles.choice,
              { borderColor: isSelected ? theme.mid : colors.line },
              isSelected && { backgroundColor: theme.tint },
            ]}
          >
            <Text style={[styles.choiceText, isSelected && { color: theme.text }]}>
              {multiple ? `${isSelected ? '☑' : '☐'} ${choice}` : choice}
            </Text>
          </Pressable>
        );
      })}
      {multiple ? (
        <Pressable
          onPress={onSubmit}
          disabled={selectedValues.length === 0}
          style={[
            styles.choice,
            styles.submit,
            { backgroundColor: selectedValues.length === 0 ? colors.line2 : theme.mid },
          ]}
        >
          <Text
            style={[
              styles.submitText,
              { color: selectedValues.length === 0 ? colors.ink3 : '#fff' },
            ]}
          >
            선택 완료
          </Text>
        </Pressable>
      ) : allowDirectInput ? (
        <Pressable
          onPress={() => onSelect(DIRECT_INPUT)}
          style={[styles.choice, styles.direct]}
        >
          <Text style={styles.directText}>직접 입력할게요 →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginVertical: 8, paddingLeft: 36 },
  choice: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: colors.bgCard,
  },
  choiceText: {
    fontSize: 14,
    color: colors.ink2,
    fontFamily: fonts.body,
  },
  direct: { borderStyle: 'dashed' },
  directText: {
    fontSize: 14,
    color: colors.ink3,
    fontFamily: fonts.body,
  },
  submit: { borderWidth: 0, alignItems: 'center' },
  submitText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
  },
});
