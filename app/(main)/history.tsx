// 갈등 기록 목록 (AGENT.md §2, Phase 2)
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useConflictStore } from '@/store/conflictStore';
import { listConflicts } from '@/services/conflictService';
import { requestHistoryUpdate } from '@/lib/ai';
import { Wash } from '@/components/ui/Wash';
import { colors, fonts, ui } from '@/constants/colors';
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
      <Wash />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>←</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>지난 기록</Text>

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
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 64 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  back: { fontSize: 22, color: colors.ink2 },
  title: {
    ...ui.statement,
    paddingHorizontal: 24,
  },
  list: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  empty: {
    ...ui.statementSub,
    marginTop: 80,
    textAlign: 'center',
  },
  item: {
    ...ui.card,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemBody: { flex: 1, marginRight: 10 },
  itemTitle: { fontSize: 16, color: colors.ink, fontFamily: fonts.displayMedium },
  itemDate: { fontSize: 12, color: colors.ink3, marginTop: 4, fontFamily: fonts.body },
  itemStatus: { fontSize: 12, fontFamily: fonts.bodyMedium },
  resolved: { color: colors.tealText },
  ongoing: { color: colors.ink3 },
});
