-- 02단계 입력에 세분화된 감정 표현 + 상대방 마음 헤아리기 필드 추가 (복수 선택)

ALTER TABLE conflict_inputs
  ADD COLUMN emotion_words TEXT[],              -- 세분화된 감정 단어 (복수 선택)
  ADD COLUMN partner_perspective_words TEXT[];  -- "상대방 마음 헤아리기" 복수 선택
