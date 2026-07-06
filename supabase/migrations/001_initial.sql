-- 맺음 (Maedum) — initial schema
-- AGENT.md §3 데이터 모델 + 커플 연결(초대 코드) + 프로필/푸시 토큰

-- ============================================================
-- profiles: auth.users 1:1, 표시 이름 + 푸시 토큰
-- ============================================================
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  push_token   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 회원가입 시 profiles row 자동 생성
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', '이름없음'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- couples + 초대 코드
-- ============================================================
CREATE TABLE couples (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   UUID REFERENCES auth.users NOT NULL,
  user_b_id   UUID REFERENCES auth.users NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_a_id, user_b_id)
);

CREATE TABLE couple_invites (
  code        TEXT PRIMARY KEY,               -- 6자리 초대 코드
  inviter_id  UUID REFERENCES auth.users NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days'
);

-- 초대 코드 수락 → couples row 생성 (SECURITY DEFINER: RLS 우회하되 검증 내장)
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

  -- 이미 커플이면 거부
  IF EXISTS (
    SELECT 1 FROM couples
    WHERE user_a_id IN (v_inviter, auth.uid())
       OR user_b_id IN (v_inviter, auth.uid())
  ) THEN
    RAISE EXCEPTION 'already_paired';
  END IF;

  INSERT INTO couples (user_a_id, user_b_id)
  VALUES (v_inviter, auth.uid())
  RETURNING id INTO v_couple_id;

  DELETE FROM couple_invites WHERE inviter_id = v_inviter;

  RETURN v_couple_id;
END;
$$;

-- ============================================================
-- conflicts: 상태 머신의 중심
-- ============================================================
CREATE TYPE conflict_status AS ENUM (
  'waiting_partner',   -- 한 명 시작, 상대 알림 대기
  'both_inputting',    -- 양쪽 입력 중
  'ai_processing',     -- AI 편지/분석 생성 중
  'letters_delivered', -- 편지 전달 완료
  'waiting_ready',     -- 한 명만 "대화 준비됨" 누름
  'mission_unlocked',  -- 양쪽 준비됨 → 미션 페이퍼 오픈
  'resolved'           -- 완료
);

CREATE TABLE conflicts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id    UUID REFERENCES couples NOT NULL,
  initiator_id UUID REFERENCES auth.users NOT NULL,
  status       conflict_status DEFAULT 'waiting_partner',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER conflicts_touch
  BEFORE UPDATE ON conflicts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- conflict_inputs: 각 사용자의 구조화 입력 + AI 대화 로그
-- ============================================================
CREATE TABLE conflict_inputs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_id         UUID REFERENCES conflicts NOT NULL,
  user_id             UUID REFERENCES auth.users NOT NULL,

  -- 구조화 필드 (AI 재질문으로 정제된 최종값)
  trigger_moment      TEXT,           -- 발화 시점 (팩트 중심)
  first_hurt_moment   TEXT,           -- 최초로 기분 상한 순간
  context_tags        TEXT[],         -- ['누적', '피로', '반복패턴', ...]
  context_detail      TEXT,           -- 맥락 상세 설명
  conflict_scale      SMALLINT,       -- 1~10
  emotion_scale       SMALLINT,       -- 1~10
  request_raw         TEXT,           -- 최초 바라는 것 (모호한 원본)
  request_refined     TEXT,           -- 정제된 구체적 요청 (실제 멘트 포함)
  partner_intention   TEXT,           -- 상대 의도 인식 ('악의없음'/'모름'/'무관')
  my_reflection       TEXT,           -- 내가 반성하는 부분

  -- AI 재질문 대화 로그 (전체 context 보존)
  chat_log            JSONB DEFAULT '[]',

  -- 입력 완료 여부
  is_complete         BOOLEAN DEFAULT FALSE,
  completed_at        TIMESTAMPTZ,

  UNIQUE(conflict_id, user_id)
);

-- ============================================================
-- conflict_outputs: AI가 생성한 편지, 분석, 미션
-- ============================================================
CREATE TABLE conflict_outputs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_id     UUID REFERENCES conflicts NOT NULL UNIQUE,

  -- 03단계: 편지 (각자 상대에게 전달되는 것)
  letter_a_to_b   TEXT,   -- user_a → user_b 편지
  letter_b_to_a   TEXT,   -- user_b → user_a 편지

  -- 03단계: 분석 (공개, 둘이 함께 보는 것)
  analysis_timing        TEXT,   -- 기분 상한 시점 차이 분석
  analysis_temperature   TEXT,   -- 온도 차이 이유 분석
  analysis_understanding TEXT,   -- 서로 이미 이해하는 부분

  -- 04단계: 미션 페이퍼
  mission_a       JSONB,  -- [{ text: "...", type: "habit"|"acknowledge"|"action" }]
  mission_b       JSONB,
  convo_guide     JSONB,  -- [{ step: 1, who: "a"|"b"|"both", text: "..." }]
  convo_note      TEXT,   -- 하단 주의사항

  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- conflict_ready_states: "대화 준비됐어요" 버튼 상태
-- ============================================================
CREATE TABLE conflict_ready_states (
  conflict_id UUID REFERENCES conflicts NOT NULL,
  user_id     UUID REFERENCES auth.users NOT NULL,
  ready_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (conflict_id, user_id)
);

-- ============================================================
-- 헬퍼: 내가 속한 커플인지
-- ============================================================
CREATE OR REPLACE FUNCTION is_couple_member(p_couple_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM couples
    WHERE id = p_couple_id
      AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION is_conflict_member(p_conflict_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conflicts c
    JOIN couples cp ON cp.id = c.couple_id
    WHERE c.id = p_conflict_id
      AND (cp.user_a_id = auth.uid() OR cp.user_b_id = auth.uid())
  );
$$;

-- ============================================================
-- RLS 정책
-- ============================================================
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE couples               ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_invites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflicts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_inputs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_outputs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_ready_states ENABLE ROW LEVEL SECURITY;

-- profiles: 본인 + 커플 상대만 읽기, 본인만 수정
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM couples
    WHERE (user_a_id = auth.uid() AND user_b_id = profiles.id)
       OR (user_b_id = auth.uid() AND user_a_id = profiles.id)
  )
);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (id = auth.uid());

-- couples: 멤버만 읽기 (생성은 accept_couple_invite 함수로만)
CREATE POLICY couples_select ON couples FOR SELECT USING (
  user_a_id = auth.uid() OR user_b_id = auth.uid()
);

-- couple_invites: 본인 것만 생성/조회/삭제 (수락은 함수로)
CREATE POLICY invites_insert ON couple_invites FOR INSERT WITH CHECK (inviter_id = auth.uid());
CREATE POLICY invites_select ON couple_invites FOR SELECT USING (inviter_id = auth.uid());
CREATE POLICY invites_delete ON couple_invites FOR DELETE USING (inviter_id = auth.uid());

-- conflicts: 커플 멤버만 읽기/생성/수정
CREATE POLICY conflicts_select ON conflicts FOR SELECT USING (is_couple_member(couple_id));
CREATE POLICY conflicts_insert ON conflicts FOR INSERT WITH CHECK (
  is_couple_member(couple_id) AND initiator_id = auth.uid()
);
CREATE POLICY conflicts_update ON conflicts FOR UPDATE USING (is_couple_member(couple_id));

-- conflict_inputs:
--   쓰기: 자신의 것만.
--   읽기: 자신의 것 + (outputs 생성 이후에는 상대 것도 공개 — AGENT.md §3 RLS)
CREATE POLICY inputs_insert ON conflict_inputs FOR INSERT WITH CHECK (
  user_id = auth.uid() AND is_conflict_member(conflict_id)
);
CREATE POLICY inputs_update ON conflict_inputs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY inputs_select ON conflict_inputs FOR SELECT USING (
  user_id = auth.uid()
  OR (
    is_conflict_member(conflict_id)
    AND EXISTS (SELECT 1 FROM conflict_outputs o WHERE o.conflict_id = conflict_inputs.conflict_id)
  )
);

-- conflict_outputs: 커플 양쪽 모두 읽기 가능. 쓰기는 Edge Function(service_role)만.
CREATE POLICY outputs_select ON conflict_outputs FOR SELECT USING (
  is_conflict_member(conflict_id)
);

-- conflict_ready_states: 멤버 읽기, 본인 것만 생성
CREATE POLICY ready_select ON conflict_ready_states FOR SELECT USING (
  is_conflict_member(conflict_id)
);
CREATE POLICY ready_insert ON conflict_ready_states FOR INSERT WITH CHECK (
  user_id = auth.uid() AND is_conflict_member(conflict_id)
);

-- ============================================================
-- Realtime 발행 (postgres_changes 구독 대상)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE conflicts;
ALTER PUBLICATION supabase_realtime ADD TABLE conflict_inputs;
ALTER PUBLICATION supabase_realtime ADD TABLE conflict_ready_states;
