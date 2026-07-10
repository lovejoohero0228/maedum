// 홈 상단 워시 배경 프리셋 + home_background 값 파서
// relationship_profiles.home_background: 'preset:<key>' | 'url:<공개 URL>' | null
export interface HomeBackgroundPreset {
  key: string;
  label: string;
  gradient: readonly [string, string];
}

export const HOME_BACKGROUND_PRESETS: readonly HomeBackgroundPreset[] = [
  { key: 'dawn',    label: '새벽',   gradient: ['#F8E3C4', '#F6F1E8'] },
  { key: 'blossom', label: '꽃잎',   gradient: ['#F6D9D6', '#F6F1E8'] },
  { key: 'ember',   label: '노을',   gradient: ['#F2B490', '#F6F1E8'] },
  { key: 'meadow',  label: '들녘',   gradient: ['#DDE5C8', '#F6F1E8'] },
  { key: 'sea',     label: '바다',   gradient: ['#CFE0E4', '#F6F1E8'] },
  { key: 'dusk',    label: '해질녘', gradient: ['#D9CFE2', '#F6F1E8'] },
] as const;

export const presetValue = (key: string) => `preset:${key}`;
export const urlValue = (url: string) => `url:${url}`;

// home_background 값 → Wash가 그릴 수 있는 형태로 변환
export function parseHomeBackground(value: string | null | undefined): {
  colors?: readonly [string, string];
  imageUrl?: string;
} {
  if (!value) return {};
  if (value.startsWith('preset:')) {
    const preset = HOME_BACKGROUND_PRESETS.find((p) => p.key === value.slice(7));
    return preset ? { colors: preset.gradient } : {};
  }
  if (value.startsWith('url:')) return { imageUrl: value.slice(4) };
  return {};
}
