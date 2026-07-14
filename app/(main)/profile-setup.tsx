// 가입 온보딩 — 내 프로필 만들기 (이름 → 성격 → 캐릭터)
// 최초 1회 필수((main) 레이아웃 가드가 안내), 이후 프로필 화면에서 언제든 수정 가능
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { useConflictStore } from '@/store/conflictStore';
import { Maedeubi } from '@/components/ui/Maedeubi';
import { Wash } from '@/components/ui/Wash';
import { colors, fonts, ui } from '@/constants/colors';
import { PERSONALITY_TAGS } from '@/constants/relationshipTags';
import { CHARACTER_PRESETS } from '@/constants/characters';

const TOTAL_STEPS = 3;

export default function ProfileSetup() {
  const session = useConflictStore((s) => s.session);
  const profile = useConflictStore((s) => s.profile);
  const loadProfile = useConflictStore((s) => s.loadProfile);

  const isEdit = !!profile?.onboarded_at;
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [characterKey, setCharacterKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 프로필이 늦게 로드돼도 초기값을 반영한다 (소셜 로그인 직후 이름 prefill 포함)
  useEffect(() => {
    if (!profile) return;
    setName((prev) => prev || (profile.display_name === '이름없음' ? '' : profile.display_name));
    setTags((prev) => (prev.length ? prev : (profile.personality_tags ?? [])));
    setCharacterKey((prev) => prev ?? profile.character_key);
  }, [profile]);

  const toggleTag = (tag: string) =>
    setTags((list) => (list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]));

  const canProceed =
    step === 1 ? name.trim().length > 0 : step === 2 ? tags.length > 0 : !!characterKey;

  const onNext = async () => {
    if (!canProceed || saving) return;
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    if (!session) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: name.trim(),
          personality_tags: tags,
          character_key: characterKey,
          onboarded_at: profile?.onboarded_at ?? new Date().toISOString(),
        })
        .eq('id', session.user.id);
      if (error) throw error;
      await loadProfile();
      // 최초 가입이면 홈 대신 튜토리얼부터 보여준다 (스킵 가능)
      router.replace(isEdit ? '/(main)/profile' : '/(main)/tutorial');
    } catch (e) {
      showAlert('저장 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onBack = () => {
    if (step > 1) setStep(step - 1);
    else if (isEdit) router.back();
  };

  return (
    <View style={styles.container}>
      <Wash />
      <View style={styles.header}>
        {step > 1 || isEdit ? (
          <Pressable onPress={onBack} hitSlop={8}>
            <Text style={styles.back}>←</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={ui.progressTrack}>
          <View style={[ui.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <>
            <View style={styles.charWrap}>
              <Maedeubi size={72} />
            </View>
            <Text style={styles.greeting}>
              안녕하세요, 두 마음을 잇는 매듭이예요.
            </Text>
            <Text style={ui.statement}>어떻게 불러드릴까요?</Text>
            <Text style={styles.sub}>상대에게 보여질 이름이에요.</Text>
            <TextInput
              style={styles.input}
              placeholder="이름 (예: 지수)"
              placeholderTextColor={colors.ink3}
              value={name}
              onChangeText={setName}
              autoFocus={!isEdit}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={ui.statement}>나는 어떤 사람인가요?</Text>
            <Text style={styles.sub}>가까운 것들을 골라주세요. 여러 개도 좋아요.</Text>
            <View style={styles.chipWrap}>
              {PERSONALITY_TAGS.map((tag) => {
                const selected = tags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    style={[ui.pill, selected && ui.pillSelected]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text style={ui.pillText}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={ui.statement}>나와 닮은 캐릭터를 골라주세요</Text>
            <Text style={styles.sub}>맺음 안에서 나를 대신할 얼굴이에요.</Text>
            <View style={styles.charGrid}>
              {CHARACTER_PRESETS.map((c) => {
                const selected = characterKey === c.key;
                return (
                  <Pressable
                    key={c.key}
                    style={[styles.charCard, selected && styles.charCardSelected]}
                    onPress={() => setCharacterKey(c.key)}
                  >
                    <Text style={styles.charEmoji}>{c.emoji}</Text>
                    <Text style={styles.charLabel}>{c.label}</Text>
                    <Text style={styles.charHint}>{c.hint}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.button, (!canProceed || saving) && styles.buttonDisabled]}
          onPress={onNext}
          disabled={!canProceed || saving}
        >
          <Text style={ui.primaryPillText}>
            {saving ? '저장 중…' : step < TOTAL_STEPS ? '다음' : isEdit ? '저장하기' : '시작하기'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 64 },
  header: { paddingHorizontal: 24, gap: 16, marginBottom: 24 },
  back: { fontSize: 22, color: colors.ink2 },
  scroll: { paddingHorizontal: 24, paddingBottom: 24 },
  charWrap: { marginBottom: 16 },
  greeting: {
    fontSize: 13,
    color: colors.purpleText,
    fontFamily: fonts.bodyMedium,
    marginBottom: 10,
  },
  sub: {
    ...ui.statementSub,
    marginTop: 8,
    marginBottom: 28,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.ink,
    fontFamily: fonts.body,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  charGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  charCard: {
    ...ui.card,
    width: '47.5%',
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  charCardSelected: {
    borderColor: colors.ink,
    backgroundColor: colors.chipSelected,
  },
  charEmoji: { fontSize: 34, marginBottom: 8 },
  charLabel: { fontSize: 15, color: colors.ink, fontFamily: fonts.bodyMedium },
  charHint: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.ink3,
    fontFamily: fonts.body,
    textAlign: 'center',
    marginTop: 4,
  },
  footer: { paddingHorizontal: 24, paddingBottom: 32 },
  button: { ...ui.primaryPill, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
});
