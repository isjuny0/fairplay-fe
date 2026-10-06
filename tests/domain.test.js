import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditTask,
  deliverablePermissions,
  fromDateInput,
  reviewerCandidates,
  toDateInput,
} from '../src/lib/domain.js';
const members = [
  { userId: 'leader', isLeader: true },
  { userId: 'deputy', isDeputy: true },
  { userId: 'member' },
];
const team = {
  myMembershipStatus: 'APPROVED',
  leaderId: 'leader',
  deputyId: 'deputy',
  approvedMemberCount: 3,
};
const task = {
  status: 'IN_PROGRESS',
  assignees: [{ userId: 'member', allocationPercent: 100 }],
};
test('비담당 리더와 부리더 순으로 승인자 후보를 제공한다', () => {
  assert.deepEqual(
    reviewerCandidates([...members].reverse(), task.assignees).map(
      (member) => member.userId,
    ),
    ['leader', 'deputy'],
  );
});
test('전원 담당 예외는 리더와 부리더만 허용한다', () => {
  assert.deepEqual(
    reviewerCandidates(
      members,
      members.map((member) => ({ userId: member.userId })),
    ).map((member) => member.userId),
    ['leader', 'deputy'],
  );
});
test('일부 담당이면 담당 리더를 예외 후보에 넣지 않는다', () => {
  assert.deepEqual(
    reviewerCandidates(members, [{ userId: 'leader' }]).map(
      (member) => member.userId,
    ),
    ['deputy', 'member'],
  );
});
test('작업 수정은 현재 담당자와 팀 리더 역할로 판단한다', () => {
  assert.equal(canEditTask(task, team, 'member'), true);
  assert.equal(canEditTask(task, team, 'leader'), true);
  assert.equal(canEditTask(task, team, 'outsider'), false);
  assert.equal(
    canEditTask(task, { ...team, myMembershipStatus: 'PENDING' }, 'leader'),
    false,
  );
  for (const status of ['PENDING_APPROVAL', 'DONE'])
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
test('연결 자료는 담당자만 관리하고 승인 대기와 완료 후 잠근다', () => {
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
  assert.equal(toDateInput('2026-10-05T11:00:00Z'), '2026-10-05T20:00');
  assert.equal(fromDateInput('2026-10-05T20:00'), '2026-10-05T20:00:00+09:00');
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
