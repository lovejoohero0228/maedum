-- 버그 수정: unpair_couple()이 relationship_profiles를 지우지 않아,
-- 관계 프로필을 설정한 커플(=사실상 모든 활성 커플)은 "연결 해제"가
-- relationship_profiles_couple_id_fkey FK 위반으로 실패했다.
-- (004에서 relationship_profiles.couple_id가 ON DELETE CASCADE 없이 couples를 참조)
-- couples를 삭제하기 전에 relationship_profiles를 함께 삭제하도록 보강한다.
CREATE OR REPLACE FUNCTION unpair_couple(p_couple_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_couple_member(p_couple_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  DELETE FROM conflict_ready_states WHERE conflict_id IN (
    SELECT id FROM conflicts WHERE couple_id = p_couple_id
  );
  DELETE FROM conflict_outputs WHERE conflict_id IN (
    SELECT id FROM conflicts WHERE couple_id = p_couple_id
  );
  DELETE FROM conflict_inputs WHERE conflict_id IN (
    SELECT id FROM conflicts WHERE couple_id = p_couple_id
  );
  DELETE FROM conflicts WHERE couple_id = p_couple_id;
  DELETE FROM relationship_profiles WHERE couple_id = p_couple_id;
  DELETE FROM couples WHERE id = p_couple_id;
END;
$$;
