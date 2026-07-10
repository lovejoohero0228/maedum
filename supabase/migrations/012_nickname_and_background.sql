-- 관계 프로필 확장: 상대를 부르는 별칭(편지 호칭에 사용) + 홈 배경 선택
-- partner_nickname: 내가 상대를 부르는 호칭 — 편지 서두에서 사용 (예: "자기야", "여보", 별명)
-- home_background: 홈 상단 워시 배경 — 'preset:<key>' 또는 'url:<storage 공개 URL>'
ALTER TABLE relationship_profiles
  ADD COLUMN partner_nickname TEXT,
  ADD COLUMN home_background TEXT;

-- 홈 배경 커스텀 이미지 업로드 버킷 (공개 읽기, 본인 폴더에만 쓰기)
INSERT INTO storage.buckets (id, name, public)
VALUES ('backgrounds', 'backgrounds', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY backgrounds_read ON storage.objects
  FOR SELECT USING (bucket_id = 'backgrounds');
CREATE POLICY backgrounds_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'backgrounds'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY backgrounds_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'backgrounds'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY backgrounds_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'backgrounds'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
