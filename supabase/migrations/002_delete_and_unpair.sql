-- 진행 중인 맺음 삭제(재시작) + 파트너 연결 해제 기능

-- 진행 중인 conflict 삭제 (본인이 속한 커플의 conflict만 가능)
CREATE OR REPLACE FUNCTION delete_conflict(p_conflict_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_conflict_member(p_conflict_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  DELETE FROM conflict_ready_states WHERE conflict_id = p_conflict_id;
  DELETE FROM conflict_outputs WHERE conflict_id = p_conflict_id;
  DELETE FROM conflict_inputs WHERE conflict_id = p_conflict_id;
  DELETE FROM conflicts WHERE id = p_conflict_id;
END;
$$;

-- 파트너 연결 해제 — 그 커플의 모든 맺음 기록(편지/미션 포함)도 함께 삭제
CREATE OR REPLACE FUNCTION unpair_couple()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_couple_id UUID;
BEGIN
  SELECT id INTO v_couple_id FROM couples
  WHERE user_a_id = auth.uid() OR user_b_id = auth.uid();

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'not_paired';
  END IF;

  DELETE FROM conflict_ready_states WHERE conflict_id IN (
    SELECT id FROM conflicts WHERE couple_id = v_couple_id
  );
  DELETE FROM conflict_outputs WHERE conflict_id IN (
    SELECT id FROM conflicts WHERE couple_id = v_couple_id
  );
  DELETE FROM conflict_inputs WHERE conflict_id IN (
    SELECT id FROM conflicts WHERE couple_id = v_couple_id
  );
  DELETE FROM conflicts WHERE couple_id = v_couple_id;
  DELETE FROM couples WHERE id = v_couple_id;
END;
$$;
