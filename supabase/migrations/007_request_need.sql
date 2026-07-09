-- 02단계 입력에 "요청 뒤의 욕구/이해관계" 필드 추가
-- (NVC 욕구 단계 / Getting to Yes의 Interest — request_raw(입장)와 request_refined(요청) 사이의 "왜")

ALTER TABLE conflict_inputs
  ADD COLUMN request_need TEXT;  -- 요청 뒤에 있는 진짜 욕구 (예: "약속이 존중받는 안정감")
