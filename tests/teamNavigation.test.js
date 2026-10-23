import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableTeamMenus,
  teamNavigationGroups,
} from '../src/lib/teamNavigation.js';

test('팀 메뉴는 세 그룹으로 묶되 승인 검토 없이 아홉 개 이동 경로를 제공한다', () => {
  assert.deepEqual(
    teamNavigationGroups.map((group) => group.label),
    ['팀 작업', '평가·리포트', '팀 관리'],
  );
  assert.deepEqual(availableTeamMenus({ myMembershipStatus: 'APPROVED' }), [
    '팀 홈',
    '작업',
    '산출물',
    '팀 자료 검색',
    '동료 평가',
    '중간 피드백',
    '기여도 리포트',
    '팀원 관리',
    '팀 설정',
  ]);
});

test('승인된 팀원이 아니면 조회용 메뉴만 유지한다', () => {
  for (const status of [null, 'PENDING', 'REJECTED']) {
    assert.deepEqual(availableTeamMenus({ myMembershipStatus: status }), [
      '팀원 관리',
      '산출물',
    ]);
  }
});
