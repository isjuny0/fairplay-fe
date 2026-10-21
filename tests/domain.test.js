import { apiTimeToEpoch } from '../src/lib/koreanTime.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditTask,
  teamBuildingCountdown,
  deliverablePermissions,
  fromDateInput,
  formatBoardWorkload,
  formatExpectedWorkload,
  toDateInput,
} from '../src/lib/domain.js';
test('팀 빌딩 D-day는 한국 날짜를 기준으로 세고 마감 시각부터 마감으로 표시한다', () => {
  for (const [now, end, expected] of [
    ['2026-09-01T12:00:00', '2026-09-15T23:59:00', 'D-14'],
    ['2026-09-01T23:30:00', '2026-09-02T00:30:00', 'D-1'],
    ['2026-09-15T10:00:00', '2026-09-15T23:59:00', 'D-day'],
    ['2026-09-15T23:59:00', '2026-09-15T23:59:00', '마감'],
    ['2026-09-16T00:00:00', '2026-09-15T23:59:00', '마감'],
    ['2026-09-01T23:59:00', '2026-09-02T00:01:00', 'D-1'],
  ]) assert.equal(teamBuildingCountdown(end, apiTimeToEpoch(now)), expected);
});
test('미설정·잘못된 날짜에는 D-day를 표시하지 않는다', () => {
  assert.equal(teamBuildingCountdown(null), null);
  assert.equal(teamBuildingCountdown('invalid'), null);
  assert.equal(teamBuildingCountdown('2026-09-15T23:59:00', NaN), null);
});
test('카드 작업량은 이상·미만 조건을 생략하지 않고 표시한다', () => {
  assert.equal(formatBoardWorkload(1), '1시간 미만');
  assert.equal(formatBoardWorkload(2), '1시간 이상 ~ 3시간 미만');
  assert.equal(formatBoardWorkload(3), '3시간 이상 ~ 6시간 미만');
  assert.equal(formatBoardWorkload(5), '6시간 이상 ~ 12시간 미만');
  assert.equal(formatBoardWorkload(8), '12시간 이상');
  assert.equal(formatExpectedWorkload(2), '1시간 이상 ~ 3시간 미만의 작업');
});
const team = {
  myMembershipStatus: 'APPROVED',
  leaderId: 'leader',
  approvedMemberCount: 3,
};
const task = {
  status: 'IN_PROGRESS',
  assignees: [{ userId: 'member', allocationPercent: 100 }],
};
test('작업 수정은 현재 담당자와 팀 리더 역할로 판단한다', () => {
  assert.equal(canEditTask(task, team, 'member'), true);
  assert.equal(canEditTask(task, team, 'leader'), true);
  assert.equal(canEditTask(task, team, 'outsider'), false);
  assert.equal(
    canEditTask(task, { ...team, myMembershipStatus: 'PENDING' }, 'leader'),
    false,
  );
  for (const status of ['DONE'])
    assert.equal(canEditTask({ ...task, status }, team, 'leader'), false);
});
test('공용 자료는 작성자가 관리하며 리더는 제목과 분류만 수정한다', () => {
  const deliverable = { authorId: 'member', taskId: null };
  assert.deepEqual(deliverablePermissions(deliverable, null, team, 'leader'), {
    metadata: true,
    content: false,
    remove: false,
  });
  assert.deepEqual(deliverablePermissions(deliverable, null, team, 'member'), {
    metadata: true,
    content: true,
    remove: true,
  });
});
test('연결 자료는 담당자만 관리하고 완료 후에는 잠근다', () => {
  const deliverable = { authorId: 'leader', taskId: 1 };
  assert.equal(
    deliverablePermissions(deliverable, task, team, 'leader').content,
    false,
  );
  assert.equal(
    deliverablePermissions(deliverable, task, team, 'member').content,
    true,
  );
  assert.equal(
    deliverablePermissions(
      deliverable,
      { ...task, status: 'DONE' },
      team,
      'member',
    ).content,
    false,
  );
});
test('관리자 읽기 권한이 자료 수정 권한으로 확장되지 않는다', () => {
  assert.deepEqual(
    deliverablePermissions(
      { authorId: 'leader' },
      task,
      { ...team, myMembershipStatus: null },
      'leader',
    ),
    { metadata: false, content: false, remove: false },
  );
});
test('날짜 입력은 브라우저 시간대와 무관하게 한국 시간으로 변환한다', () => {
  assert.equal(toDateInput('2026-10-05T20:00:00'), '2026-10-05T20:00');
  assert.equal(fromDateInput('2026-10-05T20:00'), '2026-10-05T20:00:00');
});
test('삭제 동의 중이거나 현황 확인에 실패하면 작업과 산출물 변경을 제한한다', () => {
  for (const blockedTeam of [
    { ...team, workFrozen: true },
    { ...team, workStateUnknown: true },
  ]) {
    assert.equal(canEditTask(task, blockedTeam, 'member'), false);
    for (const taskId of [null, 1])
      assert.deepEqual(
        deliverablePermissions(
          { authorId: 'member', taskId },
          task,
          blockedTeam,
          'member',
        ),
        {
          metadata: false,
          content: false,
          remove: false,
        },
      );
  }
});
test('1인 팀은 작업 변경과 연결 자료 수정을 막되 자료 정리와 공용 자료 관리는 허용한다', () => {
  const soloTeam = { ...team, approvedMemberCount: 1 };
  assert.equal(canEditTask(task, soloTeam, 'member'), false);
  assert.deepEqual(
    deliverablePermissions(
      { authorId: 'member', taskId: 1 },
      task,
      soloTeam,
      'member',
    ),
    {
      metadata: false,
      content: false,
      remove: true,
    },
  );
  assert.deepEqual(
    deliverablePermissions(
      { authorId: 'member', taskId: null },
      null,
      soloTeam,
      'member',
    ),
    {
      metadata: true,
      content: true,
      remove: true,
    },
  );
});

test('수정 중인 작업과 연결 자료는 현재 담당자가 변경할 수 있다', () => {
  const revising = {...task, status: 'REVISING'};
  assert.equal(canEditTask(revising, team, 'member'), true);
  assert.equal(canEditTask(revising, team, 'leader'), true);
  assert.deepEqual(deliverablePermissions({taskId:1}, revising, team, 'member'), {metadata:true,content:true,remove:true});
  assert.equal(canEditTask(revising, team, 'other'), false);
});
