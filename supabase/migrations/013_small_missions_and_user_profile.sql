-- 013: 작은 미션(오늘 바로 할 수 있는 것) + 회원 프로필(성격/캐릭터) + 소셜 로그인 대응
-- (1) conflict_outputs에 스몰 미션 컬럼 추가 — 기존 mission_a/b는 "천천히 이어갈" 빅 미션으로 유지
ALTER TABLE conflict_outputs
  ADD COLUMN small_mission_a JSONB,  -- [{ text: "..." }] 오늘 바로 실행 가능한 1~2개
  ADD COLUMN small_mission_b JSONB;

-- (2) profiles에 계정 단위 프로필 필드 추가 (가입 온보딩에서 수집)
ALTER TABLE profiles
  ADD COLUMN personality_tags TEXT[],          -- 내 성격 태그
  ADD COLUMN character_key    TEXT,            -- constants/characters.ts 프리셋 키
  ADD COLUMN onboarded_at     TIMESTAMPTZ;     -- 온보딩(프로필 생성) 완료 시각 — null이면 온보딩 화면으로

-- 기존 가입자는 이미 이름을 등록하고 사용 중이므로 온보딩을 강제하지 않되,
-- 캐릭터/성격은 비어 있으니 프로필 화면에서 채울 수 있다.
-- (테스트 단계이므로 backfill 없이 전원 온보딩 1회 통과시키는 편을 택함 — 주석만 남김)

-- (3) 소셜 로그인 가입자는 display_name 대신 full_name/name 메타데이터가 오므로 트리거 보강
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      '이름없음'
    )
  );
  RETURN NEW;
END;
$$;
