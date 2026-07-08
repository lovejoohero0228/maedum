// 프로필 — 내 정보, 커플 정보, 로그아웃
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useConflictStore } from '@/store/conflictStore';
import { unpairCouple } from '@/services/conflictService';
import { showAlert, showConfirm } from '@/lib/alert';
import { Avatar } from '@/components/ui/Avatar';
import { colors, fonts } from '@/constants/colors';

export default function Profile() {
  const session = useConflictStore((s) => s.session);
  const profile = useConflictStore((s) => s.profile);
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
    const ok = await showConfirm(
      `${partnerName}님과의 연결을 해제할까요?`,
      '지금까지 함께 나눈 맺음 기록이 모두 삭제되고, 되돌릴 수 없어요.',
      '연결 해제',
    );
    if (!ok) return;
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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>프로필</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.card}>
        {profile ? (
          <View style={styles.me}>
            <Avatar name={profile.display_name} color={myColor()} size={56} />
            <Text style={styles.name}>{profile.display_name}</Text>
            <Text style={styles.email}>{session?.user.email}</Text>
          </View>
        ) : null}
      </View>

      <Pressable style={styles.card} onPress={() => router.push('/(main)/relationship-profile')}>
        <Text style={styles.cardLabel}>관계 정보</Text>
        <Text style={styles.pairLink}>관계 정보 수정 →</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>연결된 상대</Text>
        {couples.length > 0 ? (
          couples.map((c, i) => {
            const p = partners[c.id];
            return (
              <View
                key={c.id}
                style={[styles.partnerRow, i > 0 && styles.partnerRowDivider]}
              >
                <Avatar
                  name={p?.display_name ?? '?'}
                  color={myColor() === 'blue' ? 'coral' : 'blue'}
                  size={36}
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
            <Text style={styles.pairLink}>아직 연결 안 됨 → 연결하기</Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.push('/(main)/pair')} style={styles.addPartnerButton}>
          <Text style={styles.addPartnerButtonText}>＋ 새로운 상대 연결하기</Text>
        </Pressable>
      </View>

      <Pressable style={styles.logout} onPress={onLogout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  back: { fontSize: 22, color: colors.ink2 },
  title: { fontSize: 18, color: colors.ink, fontFamily: fonts.displayMedium },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
    marginBottom: 12,
  },
  me: { alignItems: 'center' },
  name: {
    fontSize: 18,
    color: colors.ink,
    marginTop: 10,
    fontFamily: fonts.displayMedium,
  },
  email: { fontSize: 13, color: colors.ink3, marginTop: 4, fontFamily: fonts.body },
  cardLabel: {
    fontSize: 12,
    color: colors.ink3,
    marginBottom: 10,
    fontFamily: fonts.body,
  },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  partnerRowDivider: { borderTopWidth: 1, borderTopColor: colors.line2 },
  partnerName: { fontSize: 15, color: colors.ink, fontFamily: fonts.bodyMedium, flex: 1 },
  pairLink: { fontSize: 14, color: colors.purpleText, fontFamily: fonts.body },
  addPartnerButton: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.purpleMid,
    paddingVertical: 11,
    alignItems: 'center',
  },
  addPartnerButtonText: { fontSize: 13, color: colors.purpleText, fontFamily: fonts.bodyMedium },
  unpairButton: { marginLeft: 'auto' },
  unpairLink: {
    fontSize: 12,
    color: colors.coralText,
    textDecorationLine: 'underline',
    fontFamily: fonts.body,
  },
  logout: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 13,
    alignItems: 'center',
  },
  logoutText: { fontSize: 14, color: colors.coralText, fontFamily: fonts.body },
});
