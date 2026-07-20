// 프로필 — 내 정보, 커플 정보, 로그아웃
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useConflictStore } from '@/store/conflictStore';
import { unpairCouple } from '@/services/conflictService';
import { showAlert, showConfirm } from '@/lib/alert';
import { Avatar } from '@/components/ui/Avatar';
import { Wash } from '@/components/ui/Wash';
import { colors, fonts, ui } from '@/constants/colors';

export default function Profile() {
  const session = useConflictStore((s) => s.session);
  const profile = useConflictStore((s) => s.profile);
  const couple = useConflictStore((s) => s.couple);
  const couples = useConflictStore((s) => s.couples);
  const partners = useConflictStore((s) => s.partners);
  const myColor = useConflictStore((s) => s.myColor);
  const reset = useConflictStore((s) => s.reset);
  const loadCouples = useConflictStore((s) => s.loadCouples);
  const [unpairingId, setUnpairingId] = useState<string | null>(null);

  const onLogout = async () => {
    await supabase.auth.signOut();
    reset();
    router.replace('/(auth)/login');
  };

  const onUnpair = async (coupleId: string, partnerName: string) => {
    if (unpairingId) return;
    // 되돌릴 수 없는 파괴적 작업이라 두 번 확인한다
    const first = await showConfirm(
      `${partnerName}님과의 연결을 해제할까요?`,
      '지금까지 함께 나눈 맺음 기록이 모두 삭제돼요.\n상대에게는 따로 알림이 가지 않아요.',
      '계속',
    );
    if (!first) return;
    const second = await showConfirm(
      '정말 해제할까요?',
      '모든 맺음 기록이 삭제되고 복구할 수 없어요.',
      '연결 해제',
    );
    if (!second) return;
    setUnpairingId(coupleId);
    try {
      await unpairCouple(coupleId);
      await loadCouples();
    } catch (e) {
      showAlert('연결 해제 실패', String(e));
    } finally {
      setUnpairingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Wash />
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>←</Text>
        </Pressable>
      </View>

      <Text style={ui.statement}>프로필</Text>

      {profile ? (
        <Pressable
          style={[styles.card, styles.meCard]}
          onPress={() => router.push('/(main)/profile-setup')}
        >
          <Avatar
            name={profile.display_name}
            color={myColor()}
            size={52}
            characterKey={profile.character_key}
          />
          <View style={styles.meBody}>
            <Text style={styles.name}>{profile.display_name}</Text>
            <Text style={styles.email}>{session?.user.email}</Text>
            {profile.personality_tags?.length ? (
              <Text style={styles.tags} numberOfLines={1}>
                {profile.personality_tags.join(' · ')}
              </Text>
            ) : null}
          </View>
          <Text style={styles.arrow}>→</Text>
        </Pressable>
      ) : null}

      {couple ? (
        <Pressable
          style={[styles.card, styles.rowCard]}
          onPress={() => router.push('/(main)/relationship-profile')}
        >
          <View style={styles.rowBody}>
            <Text style={styles.cardLabel}>관계 정보</Text>
            <Text style={styles.rowTitle}>관계 정보 수정</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </Pressable>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>연결된 상대</Text>
        {couples.length > 0 ? (
          couples.map((c) => {
            const p = partners[c.id];
            return (
              <View key={c.id} style={styles.partnerRow}>
                <Avatar
                  name={p?.display_name ?? '?'}
                  color={myColor() === 'blue' ? 'coral' : 'blue'}
                  size={36}
                  characterKey={p?.character_key}
                />
                <Text style={styles.partnerName}>{p?.display_name ?? '상대'}</Text>
                <Pressable
                  onPress={() => onUnpair(c.id, p?.display_name ?? '상대')}
                  disabled={!!unpairingId}
                  hitSlop={8}
                  style={styles.unpairButton}
                >
                  <Text style={styles.unpairLink}>
                    {unpairingId === c.id ? '해제 중…' : '연결 해제'}
                  </Text>
                </Pressable>
              </View>
            );
          })
        ) : (
          <Pressable onPress={() => router.push('/(main)/pair')}>
            <Text style={styles.rowTitle}>아직 연결 안 됨 → 연결하기</Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.push('/(main)/pair')} hitSlop={8}>
          <Text style={styles.addPartnerLink}>＋ 새로운 상대 연결하기</Text>
        </Pressable>
      </View>

      <Pressable style={styles.logout} onPress={onLogout} hitSlop={8}>
        <Text style={ui.quietCta}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 64, paddingHorizontal: 24 },
  nav: { marginBottom: 20 },
  back: { fontSize: 22, color: colors.ink2 },
  card: {
    ...ui.card,
    marginTop: 16,
  },
  meCard: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  meBody: { flex: 1 },
  tags: { fontSize: 12, color: colors.ink3, marginTop: 4, fontFamily: fonts.body },
  name: {
    fontSize: 19,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
  },
  email: { fontSize: 13, color: colors.ink3, marginTop: 2, fontFamily: fonts.body },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBody: { flex: 1 },
  cardLabel: {
    fontSize: 13,
    color: colors.ink3,
    fontFamily: fonts.bodyMedium,
    marginBottom: 8,
  },
  rowTitle: { fontSize: 15, color: colors.ink, fontFamily: fonts.bodyMedium },
  arrow: { fontSize: 18, color: colors.ink2 },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  partnerName: { flex: 1, fontSize: 15, color: colors.ink, fontFamily: fonts.bodyMedium },
  unpairButton: { marginLeft: 12 },
  unpairLink: {
    fontSize: 12,
    color: colors.coralText,
    textDecorationLine: 'underline',
    fontFamily: fonts.body,
  },
  addPartnerLink: {
    fontSize: 13,
    color: colors.ink3,
    fontFamily: fonts.bodyMedium,
    marginTop: 14,
  },
  logout: { marginTop: 'auto', marginBottom: 48, alignItems: 'center' },
});
