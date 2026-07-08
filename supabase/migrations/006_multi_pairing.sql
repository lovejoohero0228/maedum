-- 한 사람이 여러 상대와 동시에 연결(페어링)될 수 있도록 허용
-- (기존엔 accept_couple_invite()가 "이미 커플이면 거부"해서 1:1로 강제하고 있었음)

-- 초대 코드 수락 — 이제 이미 다른 사람과 연결돼 있어도 새로 페어링 가능.
-- 단, 같은 두 사람이 중복으로 커플 row를 또 만드는 것만 막는다
-- (UNIQUE(user_a_id, user_b_id)는 방향이 고정돼 있어 (A,B)/(B,A) 역방향 중복은 못 잡아서 별도 체크 필요).
CREATE OR REPLACE FUNCTION accept_couple_invite(invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inviter UUID;
  v_couple_id UUID;
BEGIN
  SELECT inviter_id INTO v_inviter
  FROM couple_invites
  WHERE code = invite_code AND expires_at > now();

  IF v_inviter IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_code';
  END IF;

  IF v_inviter = auth.uid() THEN
    RAISE EXCEPTION 'cannot_pair_with_self';
  END IF;

  -- 이미 이 두 사람끼리 연결돼 있으면 거부 (양방향 체크)
  IF EXISTS (
    SELECT 1 FROM couples
    WHERE (user_a_id = v_inviter AND user_b_id = auth.uid())
       OR (user_a_id = auth.uid() AND user_b_id = v_inviter)
  ) THEN
    RAISE EXCEPTION 'already_paired_with_this_person';
  END IF;

  INSERT INTO couples (user_a_id, user_b_id)
  VALUES (v_inviter, auth.uid())
  RETURNING id INTO v_couple_id;

  DELETE FROM couple_invites WHERE inviter_id = v_inviter;

  RETURN v_couple_id;
END;
$$;

-- 파트너 연결 해제 — 이제 여러 커플 중 하나를 지정해서 해제해야 하므로
-- p_couple_id 인자를 받고, delete_conflict()와 동일한 패턴으로 멤버십을 확인한다.
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
  DELETE FROM couples WHERE id = p_couple_id;
END;
$$;
