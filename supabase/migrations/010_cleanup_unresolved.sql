-- 일회성 데이터 정리 (2026-07-09): 테스트 중 진행중 상태로 남은 갈등 데이터 리셋.
-- resolved(지난 기록)와 couples/profiles/relationship_profiles는 그대로 보존한다.
-- 새 DB에서는 지울 것이 없으므로 무해하다.

DELETE FROM conflict_ready_states WHERE conflict_id IN (
  SELECT id FROM conflicts WHERE status <> 'resolved'
);
DELETE FROM conflict_outputs WHERE conflict_id IN (
  SELECT id FROM conflicts WHERE status <> 'resolved'
);
DELETE FROM conflict_inputs WHERE conflict_id IN (
  SELECT id FROM conflicts WHERE status <> 'resolved'
);
DELETE FROM conflicts WHERE status <> 'resolved';
