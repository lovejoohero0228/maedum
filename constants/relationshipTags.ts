// 관계 프로필 설정 폼에서 쓰는 고정 입력 목록 (AI가 생성하는 reference_bank와는 별개)
import type { RelationshipType } from '@/lib/types';

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  '연인',
  '부부',
  '썸',
  '친구',
  '자매',
  '형제',
  '기타',
];

// 사귄 기간을 직접 개월 수로 입력하지 않아도 되도록 대표 구간을 개월 수로 매핑
export const RELATIONSHIP_DURATION_PRESETS: { label: string; months: number }[] = [
  { label: '3개월 미만', months: 2 },
  { label: '6개월 정도', months: 6 },
  { label: '1년 정도', months: 12 },
  { label: '2년 정도', months: 24 },
  { label: '3년 이상', months: 36 },
];

export const PERSONALITY_TAGS: string[] = [
  '감정표현이 서툼',
  '예민한 편',
  '무던한 편',
  '완벽주의',
  '회피형',
  '즉흥적',
  '계획적',
  '자존심이 강함',
  '애정표현이 많음',
  '무뚝뚝함',
  '걱정이 많음',
  '솔직한 편',
  '참는 편',
  '화를 잘 냄',
  '논리적',
  '감정적',
  '눈치가 빠름',
  '고집이 셈',
];

export const CONFLICT_TOPICS: string[] = [
  '연락 빈도·속도',
  '약속·시간 관리',
  '집안일 분담',
  '돈·소비 습관',
  '스킨십·애정표현',
  '친구·인간관계',
  'SNS·핸드폰 사용',
  '우선순위·소홀함',
  '가족·시댁처가',
  '미래 계획',
  '질투·불안',
  '감정 표현 방식 차이',
];
