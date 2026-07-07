-- 관계 프로필: 커플 페어링 후 최초 1회 필수 입력, 이후 언제든 수정 가능
-- 유저별로 완전히 분리 관리 (파트너는 서로의 프로필을 볼 수 없음 — conflict_inputs와 동일한 비공개 원칙)

CREATE TABLE relationship_profiles (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id                    UUID REFERENCES couples NOT NULL,
  user_id                      UUID REFERENCES auth.users NOT NULL,

  relationship_type            TEXT NOT NULL,        -- '연인'/'부부'/'썸'/'친구'/'자매'/'형제'/'기타'
  relationship_duration_months SMALLINT,              -- 연인/부부/썸일 때만 사용

  my_personality_tags          TEXT[] DEFAULT '{}',
  partner_personality_tags     TEXT[] DEFAULT '{}',   -- 내가 보는 상대의 성격
  frequent_conflict_topics     TEXT[] DEFAULT '{}',

  -- AI가 관계 프로필을 기반으로 1회 생성하는 개인화 레퍼런스 뱅크 (02단계 선택지 생성에 사용)
  reference_bank               JSONB,
  reference_bank_generated_at  TIMESTAMPTZ,

  is_complete                  BOOLEAN DEFAULT FALSE,
  created_at                   TIMESTAMPTZ DEFAULT now(),
  updated_at                   TIMESTAMPTZ DEFAULT now(),

  UNIQUE(couple_id, user_id)
);

CREATE TRIGGER relationship_profiles_touch
  BEFORE UPDATE ON relationship_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE relationship_profiles ENABLE ROW LEVEL SECURITY;

-- 본인만 읽기/쓰기 (파트너 비공개)
CREATE POLICY relationship_profiles_select ON relationship_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY relationship_profiles_insert ON relationship_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_couple_member(couple_id));
CREATE POLICY relationship_profiles_update ON relationship_profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
