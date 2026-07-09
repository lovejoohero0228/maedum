// 갈등 기록 목록 (AGENT.md §2, Phase 2)
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useConflictStore } from '@/store/conflictStore';
import { listConflicts } from '@/services/conflictService';
import { requestHistoryUpdate } from '@/lib/ai';
import { colors, fonts } from '@/constants/colors';
import type { Conflict } from '@/lib/types';

export default function History() {
  const couple = useConflictStore((s) => s.couple);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!couple) return;
      listConflicts(couple.id).then(setConflicts).catch(() => {});
      // 요약 도입 전에 마무리된 기록의 소급 통합 — 통합할 게 없으면 서버가 no-op
      requestHistoryUpdate(couple.id).catch(() => {});
    }, [couple]),
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>지난 기록</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={conflicts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>아직 기록이 없어요.</Text>
        }
        renderItem={({ item }) => {
          const dateText = new Date(item.created_at).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          return (
            <Pressable
              style={styles.item}
              onPress={() =>
                router.push({
                  pathname: '/(main)/conflict/record',
                  params: { id: item.id, title: item.title ?? '', date: dateText },
                })
              }
            >
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title ?? '이날의 맺음'}
                </Text>
                <Text style={styles.itemDate}>{dateText}</Text>
              </View>
              <Text
                style={[
                  styles.itemStatus,
                  item.status === 'resolved' ? styles.resolved : styles.ongoing,
                ]}
              >
                {item.status === 'resolved' ? '✓ 맺음 완료' : '진행 중'}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  back: { fontSize: 22, color: colors.ink2 },
  title: { fontSize: 18, color: colors.ink, fontFamily: fonts.displayMedium },
  list: { padding: 20, paddingTop: 8 },
  empty: {
    textAlign: 'center',
    color: colors.ink3,
    fontSize: 14,
    marginTop: 60,
    fontFamily: fonts.body,
  },
  item: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemBody: { flex: 1, marginRight: 10 },
  itemTitle: { fontSize: 15, color: colors.ink, fontFamily: fonts.bodyMedium },
  itemDate: { fontSize: 12, color: colors.ink3, marginTop: 3, fontFamily: fonts.body },
  itemStatus: { fontSize: 13, fontFamily: fonts.bodyMedium },
  chevron: { fontSize: 20, color: colors.ink3, marginLeft: 8 },
  resolved: { color: colors.tealText },
  ongoing: { color: colors.purpleText },
});
