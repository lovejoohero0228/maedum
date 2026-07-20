// 1~10 스케일 전용 렌더러 — "N — 설명" 형태의 고정 보기(prompts/static_turns.ts)를
// 숫자 칩 한 줄로 보여주고, 고른 숫자의 설명을 아래에 띄운다. 단일 선택.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, userTheme, type UserColor } from '@/constants/colors';

interface ScaleSelectorProps {
  // "N — 설명" 문자열들. 선택값도 이 문자열 그대로 올라간다 (서버 룰 추출/히스토리 표시용).
  choices: string[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  color: UserColor;
}

const numberOf = (choice: string) => choice.split('—')[0].trim();
const descOf = (choice: string) => (choice.split('—')[1] ?? '').trim();

export function ScaleSelector({ choices, selectedValue, onSelect, color }: ScaleSelectorProps) {
  const theme = userTheme(color);
  // 양끝 앵커 — 누르기 전에 척도의 방향(1이 뭘 뜻하고 10이 뭘 뜻하는지)을 알 수 있게
  const lowAnchor = choices.length ? descOf(choices[0]) : '';
  const highAnchor = choices.length ? descOf(choices[choices.length - 1]) : '';
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {choices.map((choice) => {
          const isSelected = selectedValue === choice;
          return (
            <Pressable
              key={choice}
              onPress={() => onSelect(choice)}
              style={[styles.cell, isSelected && styles.cellSelected]}
              hitSlop={2}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${numberOf(choice)}점: ${descOf(choice)}`}
            >
              <Text style={[styles.cellText, isSelected && styles.cellTextSelected]}>
                {numberOf(choice)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {lowAnchor && highAnchor ? (
        <View style={styles.anchorRow}>
          <Text style={[styles.anchor, styles.anchorLeft]} numberOfLines={2}>
            {`${numberOf(choices[0])} · ${lowAnchor}`}
          </Text>
          <Text style={[styles.anchor, styles.anchorRight]} numberOfLines={2}>
            {`${numberOf(choices[choices.length - 1])} · ${highAnchor}`}
          </Text>
        </View>
      ) : null}
      <Text style={[styles.desc, selectedValue ? { color: theme.text } : null]}>
        {selectedValue ? descOf(selectedValue) : '숫자를 골라주세요'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 10, paddingLeft: 20, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    minWidth: 36,
    height: 36,
    borderRadius: 100,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cellSelected: {
    backgroundColor: colors.chipSelected,
    borderColor: colors.chipSelected,
  },
  cellText: {
    fontSize: 14,
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
  },
  cellTextSelected: { color: colors.ink },
  anchorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  anchor: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: colors.ink3,
    fontFamily: fonts.body,
  },
  anchorLeft: { textAlign: 'left' },
  anchorRight: { textAlign: 'right' },
  desc: {
    fontSize: 13,
    color: colors.ink3,
    fontFamily: fonts.body,
  },
});
