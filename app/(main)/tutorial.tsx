// 튜토리얼 — 맺음의 흐름과 6개 입력 단계를 페이지별로 소개
// 가입 온보딩(profile-setup) 직후 자동 진입, 홈 하단 '튜토리얼' 링크로 언제든 다시 볼 수 있다
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Maedeubi, type MaedeubiVariant } from '@/components/ui/Maedeubi';
import { Wash } from '@/components/ui/Wash';
import { colors, fonts, ui } from '@/constants/colors';

interface TutorialPage {
  variant: MaedeubiVariant;
  chip: string | null; // 입력 단계 표시 (예: "입력 1단계 · 상황")
  title: string;
  body: string;
  example?: { label: string; text: string };
}

const PAGES: TutorialPage[] = [
  {
    variant: 'connect',
    chip: null,
    title: '맺음은 이렇게 흘러가요',
    body:
      '서운한 일이 생기면 한 사람이 맺음을 시작하고, 두 사람이 각자 매듭이와 대화하며 속마음을 정리해요.\n\n'
      + '둘 다 정리를 마치면 매듭이가 서로의 마음을 편지로 바꿔 전해주고, 마지막엔 두 사람을 위한 작은 미션이 도착해요.\n\n'
      + '지금부터 속마음을 정리하는 6개의 질문 단계를 하나씩 소개할게요.',
  },
  {
    variant: 'question',
    chip: '입력 1단계 · 상황',
    title: '갈등이 터진 순간부터 시작해요',
    body:
      '언제, 어디서, 어떤 말과 행동이 오갔는지 — 해석이나 평가 없이 사실 그대로 떠올려보는 단계예요.\n\n'
      + '기억나는 만큼 편하게 적으면, 매듭이가 부족한 부분을 다시 물어봐요.',
    example: {
      label: '이렇게 적으면 좋아요',
      text: '"어제 저녁 집에서, 내가 얘기하는데 계속 핸드폰만 보길래 \'듣고 있어?\'라고 했더니 짜증을 냈어."',
    },
  },
  {
    variant: 'think',
    chip: '입력 2단계 · 갈등 발생 순간',
    title: '마음이 먼저 상한 순간을 찾아요',
    body:
      '갈등이 겉으로 터지기 전, 마음이 가장 먼저 상하기 시작한 순간은 언제였나요?\n\n'
      + '비슷한 일이 반복돼 온 건지, 갈등이 터진 뒤 나와 상대가 각각 어떻게 반응했는지도 이 단계에서 함께 정리해요.',
  },
  {
    variant: 'comfort',
    chip: '입력 3단계 · 내 마음',
    title: '내 감정에 이름을 붙여요',
    body:
      '이번 갈등이 얼마나 컸는지, 내가 얼마나 속상했는지 1~10으로 표시하고, 그 순간 느낀 감정 단어들을 골라요.\n\n'
      + '감정 표현이 서툴러도 괜찮아요 — 세분화된 단어 보기 중에서 "이거다" 싶은 걸 고르기만 하면 돼요.',
    example: {
      label: '감정 단어 예시',
      text: '서운함 · 억울함 · 무시당한 느낌 · 외로움 · 지침',
    },
  },
  {
    variant: 'think',
    chip: '입력 4단계 · 상대 마음',
    title: '상대의 마음도 헤아려봐요',
    body:
      '상대가 일부러 그랬다고 생각하는지, 그 순간 상대는 어떤 기분이었을 것 같은지 짚어보는 단계예요.\n\n'
      + '상대 편을 들라는 게 아니에요 — 확실한 사실과 내 해석을 구분해보는 것만으로도 마음이 한결 정리돼요.',
  },
  {
    variant: 'question',
    chip: '입력 5단계 · 바라는 것',
    title: '진짜 바라는 걸 문장으로 만들어요',
    body:
      '처음 떠오른 바람에서 시작해, 그 뒤에 있는 진짜 욕구를 찾고, 상대가 실제로 해줄 수 있는 말과 행동 한마디까지 함께 다듬어요.\n\n'
      + '"좀 잘해줘" 같은 막연한 마음이 전할 수 있는 구체적인 문장으로 바뀌는 단계예요.',
    example: {
      label: '이렇게 바뀌어요',
      text: '"신경 좀 써줘" → "내가 얘기할 땐 핸드폰을 잠깐 내려놓고 \'응, 듣고 있어\'라고 말해줘"',
    },
  },
  {
    variant: 'comfort',
    chip: '입력 6단계 · 내가 반성하는 부분',
    title: '나의 아쉬웠던 점도 돌아봐요',
    body:
      '이번 갈등에서 스스로 아쉬웠던 부분이 있었는지 마지막으로 돌아보는 단계예요.\n\n'
      + '말투, 타이밍, 나도 마음을 닫아버렸던 것 — 작은 것이어도 좋아요. 내 입으로 꺼낸 반성은 편지에 진심으로 담겨요.',
  },
  {
    variant: 'letter',
    chip: null,
    title: '정리가 끝나면 편지가 도착해요',
    body:
      '두 사람 모두 입력을 마치면, 매듭이가 각자의 속마음을 상대에게 전할 편지로 바꿔줘요.\n\n'
      + '편지를 읽고 서로 준비가 되면 두 사람을 위한 미션과 대화 가이드가 열려요. 화해는 두 사람의 몫 — 매듭이는 마음이 잘 전해지도록 도울 뿐이에요.\n\n'
      + '이제 시작해볼까요?',
  },
];

export default function Tutorial() {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLast = page === PAGES.length - 1;
  const current = PAGES[page];

  // 홈에서 다시 열었을 땐 뒤로, 가입 직후(스택 첫 화면)엔 홈으로
  const finish = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(main)/home');
  };

  const onNext = () => {
    if (isLast) {
      finish();
      return;
    }
    setPage(page + 1);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const onBack = () => {
    if (page === 0) return;
    setPage(page - 1);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <View style={styles.container}>
      <Wash />
      <View style={styles.header}>
        {page > 0 ? (
          <Pressable onPress={onBack} hitSlop={8}>
            <Text style={styles.back}>←</Text>
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        {!isLast ? (
          <Pressable onPress={finish} hitSlop={8}>
            <Text style={styles.skip}>튜토리얼 스킵하기</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.progressWrap}>
        <View style={ui.progressTrack}>
          <View
            style={[ui.progressFill, { width: `${((page + 1) / PAGES.length) * 100}%` }]}
          />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.charWrap}>
          <Maedeubi size={88} variant={current.variant} breathe />
        </View>
        {current.chip ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{current.chip}</Text>
          </View>
        ) : null}
        <Text style={ui.statement}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>
        {current.example ? (
          <View style={styles.exampleCard}>
            <Text style={styles.exampleLabel}>{current.example.label}</Text>
            <Text style={styles.exampleText}>{current.example.text}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <Pressable style={styles.button} onPress={onNext}>
          <Text style={ui.primaryPillText}>{isLast ? '시작하기' : '다음'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 64 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  back: { fontSize: 22, color: colors.ink2 },
  backPlaceholder: { width: 22 },
  skip: { ...ui.quietCta, color: colors.ink3 },
  progressWrap: { paddingHorizontal: 24, marginBottom: 24 },
  scroll: { paddingHorizontal: 24, paddingBottom: 24 },
  charWrap: { alignItems: 'flex-start', marginBottom: 20 },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.purpleTint,
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  chipText: { fontSize: 12, color: colors.purpleText, fontFamily: fonts.bodyMedium },
  body: {
    ...ui.statementSub,
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink2,
    marginTop: 14,
  },
  exampleCard: {
    ...ui.card,
    marginTop: 22,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  exampleLabel: {
    fontSize: 12,
    color: colors.purpleText,
    fontFamily: fonts.bodyMedium,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink,
    fontFamily: fonts.body,
  },
  footer: { paddingHorizontal: 24, paddingBottom: 32, gap: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.line,
  },
  dotActive: { backgroundColor: colors.ink, width: 16 },
  button: { ...ui.primaryPill, alignItems: 'center' },
});
