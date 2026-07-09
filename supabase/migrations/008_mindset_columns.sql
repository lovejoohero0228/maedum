-- 04단계 미션 페이퍼에 "대화 전 마음가짐" 섹션 추가
-- 각자가 대화를 시작하기 전 마음에 새길 리프레이밍 문구
-- (예: "먼저 다가가는 것이 잘못이 커서가 아니에요")

ALTER TABLE conflict_outputs
  ADD COLUMN mindset_a TEXT,
  ADD COLUMN mindset_b TEXT;
