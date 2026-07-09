// 대화 시작 방법 3단계 가이드 + 하단 주의사항 (AGENT.md §4-4)
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
    <View style={styles.card}>
      <Text style={styles.title}>💬 대화, 이렇게 시작해보세요</Text>
      {steps
        .slice()
        .sort((x, y) => x.step - y.step)
        .map((s) => (
          <View key={s.step} style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>{s.step}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={[styles.stepWho, { color: whoColor(s.who) }]}>
                {whoLabel(s.who)}
                {s.title ? ` · ${s.title}` : ''}
              </Text>
              <Text style={styles.stepText}>{s.text}</Text>
              {s.listener ? (
                <View style={styles.listenerBox}>
                  <Text style={styles.listenerText}>👂 상대는: {s.listener}</Text>
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
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginVertical: 8,
  },
  title: {
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    marginBottom: 12,
  },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.purpleTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNum: { fontSize: 12, color: colors.purpleText, fontFamily: fonts.bodyMedium },
  stepBody: { flex: 1 },
  stepWho: { fontSize: 12, fontFamily: fonts.bodyMedium, marginBottom: 2 },
  stepText: { fontSize: 14, lineHeight: 21, color: colors.ink2, fontFamily: fonts.body },
  listenerBox: {
    backgroundColor: colors.line2,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 6,
  },
  listenerText: { fontSize: 12, lineHeight: 18, color: colors.ink3, fontFamily: fonts.body },
  note: {
    backgroundColor: colors.amberTint,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  noteText: { fontSize: 12, lineHeight: 18, color: colors.amberText, fontFamily: fonts.body },
});
