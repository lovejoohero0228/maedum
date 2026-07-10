-- 014: 맺음별 3문장 요약 + "둘이 함께" 미션
-- (1) conflicts.summary — ai-letters가 title과 함께 생성하는 중립적 3문장 이내 요약.
--     홈의 장기 미션 보드 "자세히 보기"에서 이 미션이 어떤 맺음에서 나왔는지 보여줄 때 사용.
ALTER TABLE conflicts
  ADD COLUMN summary TEXT;

-- (2) conflict_outputs.mission_both — 두 사람이 함께 노력할 것 (ai-mission 생성, [{ text }])
ALTER TABLE conflict_outputs
  ADD COLUMN mission_both JSONB;
