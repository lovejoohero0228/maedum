-- 지난 기록 목록용 갈등 주제 제목 (ai-letters가 분석 생성 시 함께 만든다)

ALTER TABLE conflicts
  ADD COLUMN title TEXT;  -- 예: "약속 시간 오해"
