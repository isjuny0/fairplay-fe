import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  workSummary,
  validatePeerResponse,
  isLowScore,
} from '../src/lib/evaluation.js';
import {
  getMockState,
  saveMockState,
  resetMockState,
  plannedRequest,
} from '../src/mock/planned.js';
import { previewRequest, previewContext, setPreviewRole } from '../src/mock/preview.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key),
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const context = (role) => {
  setPreviewRole(role);
  return previewContext();
};
const scores = {
  taskExecution: 4,
  responsibility: 4,
  collaboration: 3,
  communication: 4,
};
beforeEach(() => {
  storage.clear();
  resetMockState(context('leader'));
});

test('작업 현황은 가중치와 본인 배분을 반영하며 분모가 없으면 null이다', () => {
  const leader = context('leader');
  const tasks = getMockState(leader).teams[1].tasks;
  const summary = workSummary(1, leader.user.id, tasks);
  assert.equal(summary.teamProgressRate, 50);
  assert.equal(summary.myAssignedShare, 70);
  assert.equal(summary.myCompletedContributionRate, 40);
  assert.equal(summary.myTaskCompletionRate, 57.14);
  assert.equal(
    workSummary(1, 'not-assigned', tasks).myTaskCompletionRate,
    null,
  );
  assert.equal(workSummary(1, leader.user.id, []).teamProgressRate, null);
});
test('저점 사유는 대상당 10~500자이며 미선택 값을 저점으로 해석하지 않는다', () => {
  assert.equal(isLowScore({ taskExecution: '' }), false);
  assert.equal(validatePeerResponse(scores, ''), null);
  assert.ok(validatePeerResponse({ ...scores, communication: 2 }, '짧은 사유'));
  assert.equal(
    validatePeerResponse(
      { ...scores, communication: 2 },
      '필요한 진행 공유를 두 번 누락했습니다.',
    ),
    null,
  );
  assert.ok(
    validatePeerResponse(
      { ...scores, communication: 2.5 },
      '충분히 긴 사유입니다.',
    ),
  );
});
test('평가 저장과 최종 제출을 구분하고 제출 응답은 잠긴다', async () => {
  const leader = context('leader');
  const targets = await plannedRequest(
    leader,
    '/api/evaluation-rounds/12/targets',
  );
  await assert.rejects(
    plannedRequest(leader, '/api/evaluation-rounds/12/submit', {
      method: 'POST',
    }),
    { code: 'PEER_RESPONSES_INCOMPLETE' },
  );
  for (const target of targets)
    await plannedRequest(
      leader,
      `/api/evaluation-rounds/12/responses/${target.targetId}`,
      { method: 'PUT', body: { scores } },
    );
  assert.equal(
    (await plannedRequest(leader, '/api/spaces/1/evaluation-rounds'))[1]
      .mySubmissionStatus,
    'NOT_SUBMITTED',
  );
  await plannedRequest(leader, '/api/evaluation-rounds/12/submit', {
    method: 'POST',
  });
  await assert.rejects(
    plannedRequest(
      leader,
      `/api/evaluation-rounds/12/responses/${targets[0].targetId}`,
      { method: 'PUT', body: { scores } },
    ),
    { code: 'PEER_ALREADY_SUBMITTED' },
  );

});
test('일반 사용자에게 관리자 집계·타 팀 리포트·관리자 권한만으로 본인 현황을 제공하지 않는다', async () => {
  await assert.rejects(
    plannedRequest(context('leader'), '/api/spaces/1/manager-dashboard'),
    { status: 403 },
  );
  await assert.rejects(
    plannedRequest(context('manager'), '/api/teams/1/my-work-summary'),
    { status: 403 },
  );
  const leader = context('leader');
  const feedback = await plannedRequest(leader, '/api/teams/1/mid-feedback');
  assert.equal(feedback.members.length, 1);
  assert.equal(feedback.members[0].userId, leader.user.id);
  resetMockState(leader, 'published');
  await assert.rejects(plannedRequest(leader, '/api/teams/2/report'), {
    status: 403,
  });
});
test('리포트는 팀당 한 번 생성하고 공개 후 본인 계산만 제공한다', async () => {
  const leader = context('leader');
  resetMockState(leader, 'review');
  assert.equal(await plannedRequest(leader, '/api/teams/1/report'), null);
  const manager = context('manager');
  const report = await plannedRequest(manager, '/api/teams/1/report', { method: 'POST' });
  assert.equal(report.id, 10001);
  assert.equal(report.status, 'UNPUBLISHED');
  assert.equal(report.myDetails, null);
  assert.deepEqual(await plannedRequest(manager, '/api/teams/1/report', { method: 'POST' }), report);
  await plannedRequest(manager, '/api/reports/10001/publish', { method: 'POST' });
  const result = await plannedRequest(leader, '/api/teams/1/report');
  assert.equal(result.totalPercent, 100);
  assert.equal(result.myDetails.totalPercent,
    result.members.find((member) => member.userId === leader.user.id).contributionPercent);
  assert.equal(result.details, undefined);
  assert.equal((await plannedRequest(manager, '/api/teams/1/report')).myDetails, null);
  assert.equal((await plannedRequest(manager, '/api/teams/1/report', { method: 'POST' })).status, 'PUBLISHED');
});
test('리포트 공개는 스페이스 전체의 필수 제출을 확인한다', async () => {
  const manager = context('manager');
  resetMockState(manager, 'review');
  const state = getMockState(manager);
  delete state.submitted[`12:${state.teams[2].members[0].userId}`];
  saveMockState(manager, state);
  await assert.rejects(
    plannedRequest(manager, '/api/reports/10001/publish', { method: 'POST' }),
    { code: 'REPORT_PUBLICATION_BLOCKED' },
  );
  state.submitted[`12:${state.teams[2].members[0].userId}`] =
    new Date().toISOString();
  saveMockState(manager, state);
  const published = await plannedRequest(manager, '/api/reports/10001/publish', {
    method: 'POST',
  });
  assert.equal(published.status, 'PUBLISHED');
});
test('AI 점수 결측은 리포트 생성 차단이며 기술 실패는 현재 담당자만 재시도한다', async () => {
  const manager = context('manager');
  resetMockState(manager, 'review');
  const state = getMockState(manager);
  state.reports = [];
  state.ai[105].score = null;
  saveMockState(manager, state);
  await assert.rejects(
    plannedRequest(manager, '/api/teams/1/report', { method: 'POST' }),
    { code: 'REPORT_INPUT_INCOMPLETE' },
  );
  resetMockState(context('leader'));
  const member = context('member');
  const retry = await plannedRequest(
    member,
    '/api/tasks/106/ai-evaluation/retry',
    { method: 'POST' },
  );
  assert.equal(retry.status, 'PENDING');
  assert.equal(retry.score, null);
  await assert.rejects(
    plannedRequest(manager, '/api/tasks/106/ai-evaluation/retry', {
      method: 'POST',
    }),
    { status: 403 },
  );
});
test('자료 실패 재작업은 고정 승인자만 허용하고 진단과 승인 이력을 보존한다', async () => {
  await assert.rejects(
    plannedRequest(context('leader'), '/api/tasks/105/rework', {
      method: 'POST',
      body: { expectedVersion: 1 },
    }),
    { status: 403 },
  );
  const reviewer = context('reviewer');
  const version = getMockState(reviewer).teams[1].tasks.find(
    (task) => task.id === 105,
  ).version;
  const result = await plannedRequest(reviewer, '/api/tasks/105/rework', {
    method: 'POST',
    body: { expectedVersion: version },
  });
  assert.equal(result.status, 'IN_PROGRESS');
  assert.equal(result.version, version + 1);
  assert.equal(
    (await plannedRequest(reviewer, '/api/tasks/105/ai-evaluation'))
      .failureCode,
    'DOCUMENT_UNREADABLE',
  );
  assert.equal(getMockState(reviewer).approvals[105][0].status, 'APPROVED');
});

test('관리자 기본 조회는 팀 요약만 제공하고 팀 선택 조회에서 구성원 현황을 제공한다', async () => {
  const manager = context('manager');
  const all = await plannedRequest(manager, '/api/spaces/1/manager-dashboard');
  assert.equal(all.teams.length, 2);
  assert.ok(all.teams.every((team) => !('members' in team)));
  const selected = await plannedRequest(manager, '/api/spaces/1/manager-dashboard?teamId=1');
  assert.equal(selected.teams.length, 1);
  assert.equal(selected.teams[0].teamId, 1);
  assert.equal(selected.teams[0].members.length, 3);
  assert.equal(selected.totalTeamCount, all.totalTeamCount);
});

test('관리자 생성·공개 요청은 같은 결과를 반환하고 계산 결과를 유지한다', async () => {
  const manager = context('manager');
  resetMockState(manager, 'review');
  const state = getMockState(manager);
  state.reports = [];
  saveMockState(manager, state);
  const report = await plannedRequest(manager, '/api/teams/1/report', { method: 'POST' });
  assert.deepEqual(Object.keys(report).sort(), [
    'id', 'teamId', 'status', 'cutoffAt', 'totalPercent', 'createdAt',
    'publishedAt', 'members', 'myDetails',
  ].sort());
  const result = await plannedRequest(manager, '/api/teams/1/report', { method: 'POST' });
  assert.deepEqual(result, report);
  const published = await plannedRequest(manager, `/api/reports/${report.id}/publish`, { method: 'POST' });
  assert.equal(published.status, 'PUBLISHED');
  assert.deepEqual(published.members, report.members);
  assert.equal(published.createdAt, report.createdAt);
  assert.deepEqual(await plannedRequest(manager, `/api/reports/${report.id}/publish`, { method: 'POST' }), published);
  assert.deepEqual(await plannedRequest(manager, '/api/teams/1/report', { method: 'POST' }), published);
});

test('OPEN 마감 시각만 수정할 수 있고 기한 도달 시 마감 기준을 고정한다', async () => {
  const manager = context('manager');
  const state = getMockState(manager);
  const final = state.rounds.find((round) => round.type === 'FINAL');
  const closesAt = new Date(Date.now() + 86400000).toISOString();
  const changed = await plannedRequest(manager, '/api/evaluation-rounds/12', {
    method: 'PATCH', body: { closesAt, expectedVersion: final.version },
  });
  assert.equal(changed.closesAt, closesAt);
  await assert.rejects(plannedRequest(manager, '/api/evaluation-rounds/12', {
    method: 'PATCH', body: { opensAt: final.opensAt, closesAt, expectedVersion: changed.version },
  }), { code: 'INVALID_REQUEST' });
  final.closesAt = new Date(Date.now() - 1000).toISOString();
  saveMockState(manager, state);
  const closed = (await plannedRequest(manager, '/api/spaces/1/evaluation-rounds'))[1];
  assert.equal(closed.status, 'CLOSED');
  assert.equal(closed.closesAt, final.closesAt);
  await assert.rejects(plannedRequest(manager, '/api/evaluation-rounds/12', {
    method: 'PATCH', body: { closesAt, expectedVersion: closed.version },
  }), { code: 'INVALID_ROUND_STATE' });
});

test('FINAL 기한 이후 업무 변경을 차단하고 담당자의 기술 실패 재시도는 허용한다', async () => {
  const member = context('member');
  const state = getMockState(member);
  state.rounds[1].closesAt = new Date(Date.now() - 1000).toISOString();
  saveMockState(member, state);
  await assert.rejects(previewRequest('/api/tasks/101', {
    method: 'PATCH', body: { title: '제목 수정', expectedVersion: 1 },
  }), { code: 'TASK_WORK_CLOSED' });
  const result = await previewRequest('/api/tasks/106/ai-evaluation/retry', { method: 'POST' });
  assert.equal(result.status, 'PENDING');
});
