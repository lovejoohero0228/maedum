// 대화 시작 방법 3단계 가이드 + 하단 주의사항 (AGENT.md §4-4) — 플랫, 세리프 제목, 헤어라인
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, userTheme, type UserColor } from '@/constants/colors';
import type { ConvoStep } from '@/lib/types';

interface ConvoGuideProps {
  steps: ConvoStep[];
  note: string | null;
  nameA: string;
  nameB: string;
  colorA: UserColor;
  colorB: UserColor;
}

export function ConvoGuide({ steps, note, nameA, nameB, colorA, colorB }: ConvoGuideProps) {
  const whoLabel = (who: ConvoStep['who']) =>
    who === 'a' ? nameA : who === 'b' ? nameB : '함께';
  const whoColor = (who: ConvoStep['who']) =>
    who === 'a' ? userTheme(colorA).text : who === 'b' ? userTheme(colorB).text : colors.purpleText;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>대화, 이렇게 시작해보세요</Text>
      {steps
        .slice()
        .sort((x, y) => x.step - y.step)
        .map((s) => (
          <View key={s.step} style={styles.stepRow}>
            <Text style={styles.stepNum}>{s.step}</Text>
            <View style={styles.stepBody}>
              <Text style={[styles.stepWho, { color: whoColor(s.who) }]}>
                {whoLabel(s.who)}
                {s.title ? ` · ${s.title}` : ''}
              </Text>
              <Text style={styles.stepText}>{s.text}</Text>
              {s.listener ? (
                <View style={styles.listenerBox}>
                  <Text style={styles.listenerText}>상대는: {s.listener}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))}
      {note ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 20,
    marginVertical: 10,
  },
  title: {
    fontSize: 17,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    marginBottom: 18,
  },
  stepRow: { flexDirection: 'row', gap: 14, marginBottom: 18 },
  stepNum: {
    fontSize: 16,
    color: colors.purpleText,
    fontFamily: fonts.displayMedium,
    width: 16,
    textAlign: 'center',
    marginTop: 1,
  },
  stepBody: { flex: 1 },
  stepWho: { fontSize: 12, letterSpacing: 0.5, fontFamily: fonts.bodyMedium, marginBottom: 3 },
  stepText: { fontSize: 14, lineHeight: 22, color: colors.ink2, fontFamily: fonts.body },
  listenerBox: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.line,
    paddingLeft: 10,
    marginTop: 8,
  },
  listenerText: { fontSize: 12, lineHeight: 18, color: colors.ink3, fontFamily: fonts.body },
  note: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 12,
    marginTop: 4,
  },
  noteText: { fontSize: 12, lineHeight: 19, color: colors.amberText, fontFamily: fonts.body },
});
