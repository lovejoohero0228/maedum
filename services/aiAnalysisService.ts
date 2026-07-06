// 03단계: 중재자 분석 로직 (AGENT.md §2, §4-3)
// 분석 생성은 서버(ai-letters)가 수행. 클라이언트는 JSON 문자열을 파싱해 표시한다.
import type {
  AnalysisTemperature,
  AnalysisTiming,
  AnalysisUnderstanding,
  ConflictOutputs,
} from '@/lib/types';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export interface ParsedAnalysis {
  timing: AnalysisTiming | null;
  temperature: AnalysisTemperature | null;
  understanding: AnalysisUnderstanding | null;
}

export function parseAnalysis(outputs: ConflictOutputs): ParsedAnalysis {
  return {
    timing: safeParse<AnalysisTiming>(outputs.analysis_timing),
    temperature: safeParse<AnalysisTemperature>(outputs.analysis_temperature),
    understanding: safeParse<AnalysisUnderstanding>(outputs.analysis_understanding),
  };
}
