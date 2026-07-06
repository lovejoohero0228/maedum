// 프로필 — 내 정보, 커플 정보, 로그아웃
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useConflictStore } from '@/store/conflictStore';
import { Avatar } from '@/components/ui/Avatar';
import { colors, fonts } from '@/constants/colors';

export default function Profile() {
  const session = useConflictStore((s) => s.session);
  const profile = useConflictStore((s) => s.profile);
  const partner = useConflictStore((s) => s.partner);
  const myColor = useConflictStore((s) => s.myColor);
  const reset = useConflictStore((s) => s.reset);

  const onLogout = async () => {
    await supabase.auth.signOut();
    reset();
    router.replace('/(auth)/login');
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

      <View style={styles.card}>
        <Text style={styles.cardLabel}>연결된 상대</Text>
        {partner ? (
          <View style={styles.partnerRow}>
            <Avatar
              name={partner.display_name}
              color={myColor() === 'blue' ? 'coral' : 'blue'}
              size={36}
            />
            <Text style={styles.partnerName}>{partner.display_name}</Text>
          </View>
        ) : (
          <Pressable onPress={() => router.push('/(main)/pair')}>
            <Text style={styles.pairLink}>아직 연결 안 됨 → 연결하기</Text>
          </Pressable>
        )}
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
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  partnerName: { fontSize: 15, color: colors.ink, fontFamily: fonts.bodyMedium },
  pairLink: { fontSize: 14, color: colors.purpleText, fontFamily: fonts.body },
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
