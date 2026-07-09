-- 커플 단위 롤링 히스토리 요약
-- 맺음이 resolved될 때마다 ai-history가 "기존 요약 + 이번 맺음 → 갱신 요약"으로 다시 쓴다.
-- 맺음이 아무리 쌓여도 다음 중재에 들어가는 컨텍스트는 항상 이 요약 하나(500자 상한)다.

ALTER TABLE couples
  ADD COLUMN history_summary TEXT,
  ADD COLUMN history_updated_at TIMESTAMPTZ;

-- 요약에 이미 통합된 맺음 표시 (중복 통합 방지 + 기존 resolved 기록 소급 통합용)
ALTER TABLE conflicts
  ADD COLUMN history_merged_at TIMESTAMPTZ;
