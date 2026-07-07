-- 초대 코드 재생성 버그 수정: createInviteCode()는 upsert(onConflict: 'inviter_id')를
-- 사용하는데, couple_invites에는 UPDATE RLS 정책이 없어 이미 초대를 만든 적 있는
-- 사용자가 다시 "코드 생성"을 누르면(예: 만료 후 재시도, 화면 재진입) ON CONFLICT DO
-- UPDATE 경로가 RLS에 막혀 에러가 났다 ("new row violates row-level security policy").

CREATE POLICY invites_update ON couple_invites FOR UPDATE
  USING (inviter_id = auth.uid())
  WITH CHECK (inviter_id = auth.uid());
