import { koreanDateTime } from '../src/lib/koreanTime.js';
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { peerCriteria } from '../src/lib/peerCriteria.js';
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
import {
  previewRequest,
  previewContext,
  previewRole,
  setPreviewRole,
} from '../src/mock/preview.js';

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

test('적극성 표시 이름은 기존 collaboration API 키를 유지한다', () => {
  assert.deepEqual(peerCriteria, {
    taskExecution: '작업 수행',
    responsibility: '책임감',
    collaboration: '적극성',
    communication: '의사소통',
  });
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
  const report = await plannedRequest(manager, '/api/teams/1/report', {
    method: 'POST',
  });
  assert.equal(report.id, 10001);
  assert.equal(report.status, 'UNPUBLISHED');
  assert.equal(report.myDetails, null);
  assert.deepEqual(
    await plannedRequest(manager, '/api/teams/1/report', { method: 'POST' }),
    report,
  );
  await plannedRequest(manager, '/api/reports/10001/publish', {
    method: 'POST',
  });
  const result = await plannedRequest(leader, '/api/teams/1/report');
  assert.equal(result.totalPercent, 100);
  assert.equal(
    result.myDetails.totalPercent,
    result.members.find((member) => member.userId === leader.user.id)
      .contributionPercent,
  );
  assert.equal(result.details, undefined);
  assert.equal(
    (await plannedRequest(manager, '/api/teams/1/report')).myDetails,
    null,
  );
  assert.equal(
    (await plannedRequest(manager, '/api/teams/1/report', { method: 'POST' }))
      .status,
    'PUBLISHED',
  );
});
test('리포트 생성과 공개는 해당 팀 제출만 확인하고 AI 점수를 요구하지 않는다', async () => {
  const manager = context('manager');
  resetMockState(manager, 'review');
  const state = getMockState(manager);
  state.reports = [];
  delete state.submitted[`12:${state.teams[2].members[0].userId}`];
  saveMockState(manager, state);
  const report = await plannedRequest(manager, '/api/teams/1/report', {
    method: 'POST',
  });
  assert.equal(report.members.length, 3);
  assert.equal(report.members[0].details.taskRatioPercent, 80);
  assert.equal(report.members[0].details.taskContributionPercent, 56);
  assert.equal(report.members[0].details.aiRatioPercent, undefined);
  const current = getMockState(manager);
  delete current.submitted[`12:${current.teams[1].members[0].userId}`];
  saveMockState(manager, current);
  await assert.rejects(
    plannedRequest(manager, '/api/reports/10001/publish', { method: 'POST' }),
    { code: 'REPORT_PUBLICATION_BLOCKED' },
  );
  current.submitted[`12:${current.teams[1].members[0].userId}`] =
    koreanDateTime();
  saveMockState(manager, current);
  assert.equal(
    (
      await plannedRequest(manager, '/api/reports/10001/publish', {
        method: 'POST',
      })
    ).status,
    'PUBLISHED',
  );
});

test('관리자 평가 원문은 마감된 회차의 최종 제출분만 제공한다', async () => {
  const manager = context('manager');
  await assert.rejects(
    previewRequest('/api/evaluation-rounds/12/teams/1/responses'),
    { code: 'ROUND_NOT_CLOSED' },
  );
  const state = getMockState(manager);
  const evaluator = state.teams[1].members[0].userId;
  delete state.submitted[`11:${evaluator}`];
  saveMockState(manager, state);
  const result = await previewRequest(
    '/api/evaluation-rounds/11/teams/1/responses',
  );
  assert.equal(result.missingCount, 1);
  assert.ok(result.responses.length > 0);
  assert.ok(
    result.responses.every((response) => response.evaluatorId !== evaluator),
  );
  context('leader');
  await assert.rejects(
    previewRequest('/api/evaluation-rounds/11/teams/1/responses'),
    { status: 403 },
  );
});
test('AI 검토는 현재 담당자만 조회·실행할 수 있다', async () => {
  const leader = context('leader');
  resetMockState(leader);
  await assert.rejects(previewRequest('/api/tasks/102/ai-review'), {
    code: 'AI_REVIEW_NOT_FOUND',
  });
  const review = await previewRequest('/api/tasks/102/ai-review', {
    method: 'POST',
  });
  assert.equal(review.status, 'PENDING');
  assert.equal(review.isCurrent, true);
  assert.equal(
    (await previewRequest('/api/tasks/102/ai-review', { method: 'POST' })).id,
    review.id,
  );
  context('teammate');
  await assert.rejects(previewRequest('/api/tasks/102/ai-review'), {
    status: 403,
  });
  await assert.rejects(
    previewRequest('/api/tasks/102/ai-review', { method: 'POST' }),
    { status: 403 },
  );
});
test('검토 입력 변경은 현재 표시를 무효화하며 완료 작업에서 새 검토를 만들지 않는다', async () => {
  context('leader');
  await previewRequest('/api/tasks/102/ai-review', { method: 'POST' });
  const state = getMockState(context('leader'));
  const task = state.teams[1].tasks.find((task) => task.id === 102);
  await previewRequest('/api/tasks/102', {
    method: 'PATCH',
    body: { title: '새 입력', expectedVersion: task.version },
  });
  assert.equal(
    (await previewRequest('/api/tasks/102/ai-review')).isCurrent,
    false,
  );
  await assert.rejects(
    previewRequest('/api/tasks/101/ai-review', { method: 'POST' }),
    { code: 'TASK_LOCKED' },
  );
});

test('관리자 기본 조회는 팀 요약만 제공하고 팀 선택 조회에서 구성원 현황을 제공한다', async () => {
  const manager = context('manager');
  const all = await plannedRequest(manager, '/api/spaces/1/manager-dashboard');
  assert.equal(all.teams.length, 2);
  assert.ok(all.teams.every((team) => !('members' in team)));
  const selected = await plannedRequest(
    manager,
    '/api/spaces/1/manager-dashboard?teamId=1',
  );
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
  const report = await plannedRequest(manager, '/api/teams/1/report', {
    method: 'POST',
  });
  assert.deepEqual(
    Object.keys(report).sort(),
    [
      'id',
      'teamId',
      'status',
      'cutoffAt',
      'totalPercent',
      'createdAt',
      'publishedAt',
      'members',
      'myDetails',
      'weights',
    ].sort(),
  );
  const result = await plannedRequest(manager, '/api/teams/1/report', {
    method: 'POST',
  });
  assert.deepEqual(result, report);
  const published = await plannedRequest(
    manager,
    `/api/reports/${report.id}/publish`,
    { method: 'POST' },
  );
  assert.equal(published.status, 'PUBLISHED');
  assert.deepEqual(published.members, report.members);
  assert.equal(published.createdAt, report.createdAt);
  assert.deepEqual(
    await plannedRequest(manager, `/api/reports/${report.id}/publish`, {
      method: 'POST',
    }),
    published,
  );
  assert.deepEqual(
    await plannedRequest(manager, '/api/teams/1/report', { method: 'POST' }),
    published,
  );
});

test('OPEN 마감 시각만 수정할 수 있고 기한 도달 시 마감 기준을 고정한다', async () => {
  const manager = context('manager');
  const state = getMockState(manager);
  const final = state.rounds.find((round) => round.type === 'FINAL');
  const closesAt = koreanDateTime(Date.now() + 86400000);
  const changed = await plannedRequest(manager, '/api/evaluation-rounds/12', {
    method: 'PATCH',
    body: { closesAt, expectedVersion: final.version },
  });
  assert.equal(changed.closesAt, closesAt);
  await assert.rejects(
    plannedRequest(manager, '/api/evaluation-rounds/12', {
      method: 'PATCH',
      body: {
        opensAt: final.opensAt,
        closesAt,
        expectedVersion: changed.version,
      },
    }),
    { code: 'INVALID_REQUEST' },
  );
  final.closesAt = koreanDateTime(Date.now() - 1000);
  saveMockState(manager, state);
  const closed = (
    await plannedRequest(manager, '/api/spaces/1/evaluation-rounds')
  )[1];
  assert.equal(closed.status, 'CLOSED');
  assert.equal(closed.closesAt, final.closesAt);
  await assert.rejects(
    plannedRequest(manager, '/api/evaluation-rounds/12', {
      method: 'PATCH',
      body: { closesAt, expectedVersion: closed.version },
    }),
    { code: 'INVALID_ROUND_STATE' },
  );
});

test('FINAL 기한 이후 작업 변경은 차단하며 과거 검토 조회는 유지한다', async () => {
  const member = context('member');
  const state = getMockState(member);
  state.rounds[1].closesAt = koreanDateTime(Date.now() - 1000);
  saveMockState(member, state);
  await assert.rejects(
    previewRequest('/api/tasks/101', {
      method: 'PATCH',
      body: { title: '제목 수정', expectedVersion: 1 },
    }),
    { code: 'TASK_WORK_CLOSED' },
  );
  await assert.rejects(previewRequest('/api/tasks/106/ai-review'), {
    code: 'AI_REVIEW_NOT_FOUND',
  });
  await assert.rejects(
    previewRequest('/api/tasks/106/ai-review', { method: 'POST' }),
    { code: 'TASK_WORK_CLOSED' },
  );
});

test('미리보기 공동 담당 설명 누락은 직접 완료를 막고 전원 작성 후 완료한다', async () => {
  const leader = context('leader');
  let detail = await previewRequest('/api/tasks/102');
  assert.equal(
    detail.task.completionBlockReason,
    'CONTRIBUTION_DESCRIPTION_REQUIRED',
  );
  assert.ok(detail.deliverableSummary.length > 0);
  await assert.rejects(
    previewRequest('/api/tasks/102', {
      method: 'PATCH',
      body: { status: 'DONE', expectedVersion: detail.task.version },
    }),
    { code: 'CONTRIBUTION_DESCRIPTION_REQUIRED' },
  );
  assert.equal(
    (await previewRequest('/api/tasks/102')).task.status,
    'IN_PROGRESS',
  );
  context('member');
  await previewRequest('/api/tasks/102/contribution', {
    method: 'PATCH',
    body: {
      expectedVersion: detail.task.version,
      contributionDescription:
        '설문 응답을 분류하고 결과 자료의 근거를 정리했습니다.',
    },
  });
  context('leader');
  detail = await previewRequest('/api/tasks/102');
  assert.equal(detail.task.completionBlockReason, null);
  const completed = await previewRequest('/api/tasks/102', {
    method: 'PATCH',
    body: { status: 'DONE', expectedVersion: detail.task.version },
  });
  assert.equal(completed.status, 'DONE');
  assert.ok(completed.completedAt);
  assert.equal((await previewRequest('/api/tasks/102')).task.status, 'DONE');
});

test('미리보기 연결 산출물이 없으면 직접 완료를 거절하고 상태를 유지한다', async () => {
  const leader = context('leader');
  const state = getMockState(leader);
  state.teams[1].tasks.find((task) => task.id === 102).contributions[
    state.teams[1].members[1].userId
  ] = '개인 수행 설명을 충분히 작성했습니다.';
  state.teams[1].deliverables = state.teams[1].deliverables.filter(
    (item) => item.taskId !== 102,
  );
  saveMockState(leader, state);
  const detail = await previewRequest('/api/tasks/102');
  assert.equal(detail.task.completionBlockReason, 'DELIVERABLE_REQUIRED');
  await assert.rejects(
    previewRequest('/api/tasks/102', {
      method: 'PATCH',
      body: { status: 'DONE', expectedVersion: detail.task.version },
    }),
    { code: 'DELIVERABLE_REQUIRED' },
  );
  assert.equal(
    (await previewRequest('/api/tasks/102')).task.status,
    'IN_PROGRESS',
  );
});

test('본인 수행 지연은 할 일·진행 중·수정 중을 포함하고 완료는 제외한다', () => {
  const tasks = ['TODO', 'IN_PROGRESS', 'REVISING', 'DONE'].map(
    (status, index) => ({
      id: index + 1,
      status,
      weight: 1,
      dueAt: '2030-01-01T09:00:00',
      assignees: [{ userId: 'me', allocationPercent: 100 }],
    }),
  );
  tasks.push({
    ...tasks[0],
    id: 5,
    assignees: [{ userId: 'other', allocationPercent: 100 }],
  });
  tasks.push({ ...tasks[0], id: 6, dueAt: '2030-01-03T09:00:00' });
  const summary = workSummary(1, 'me', tasks, new Date('2030-01-02T00:00:00Z'));
  assert.equal(summary.myOverdueTaskCount, 3);
});

test('단독 담당자도 수행 설명이 필요하고 완료·재수정은 담당자만 수행한다', async () => {
  const leader = context('leader');
  const state = getMockState(leader);
  const task = state.teams[1].tasks.find((task) => task.id === 103);
  task.status = 'IN_PROGRESS';
  task.contributions[leader.user.id] = null;
  state.teams[1].deliverables.push({
    id: 999,
    taskId: 103,
    type: 'TEXT',
    text: '검증 산출물',
  });
  saveMockState(leader, state);
  await assert.rejects(
    previewRequest('/api/tasks/103', {
      method: 'PATCH',
      body: { status: 'DONE', expectedVersion: task.version },
    }),
    { code: 'CONTRIBUTION_DESCRIPTION_REQUIRED' },
  );
  await previewRequest('/api/tasks/103/contribution', {
    method: 'PATCH',
    body: {
      contributionDescription: '작업 구현과 검증 결과를 작성했습니다.',
      expectedVersion: task.version,
    },
  });
  let done = await previewRequest('/api/tasks/103', {
    method: 'PATCH',
    body: {
      status: 'DONE',
      expectedVersion: (await previewRequest('/api/tasks/103')).task.version,
    },
  });
  assert.ok(done.completedAt);
  await assert.rejects(
    previewRequest('/api/tasks/103', {
      method: 'PATCH',
      body: { title: '완료 후 변경', expectedVersion: done.version },
    }),
    { code: 'TASK_LOCKED' },
  );
  context('teammate');
  await assert.rejects(
    previewRequest('/api/tasks/103', {
      method: 'PATCH',
      body: { status: 'REVISING', expectedVersion: done.version },
    }),
    { status: 403 },
  );
  context('leader');
  let revising = await previewRequest('/api/tasks/103', {
    method: 'PATCH',
    body: { status: 'REVISING', expectedVersion: done.version },
  });
  assert.equal(revising.completedAt, null);
  await assert.rejects(
    previewRequest('/api/tasks/103', {
      method: 'PATCH',
      body: { status: 'IN_PROGRESS', expectedVersion: revising.version },
    }),
    { status: 400 },
  );
  done = await previewRequest('/api/tasks/103', {
    method: 'PATCH',
    body: { status: 'DONE', expectedVersion: revising.version },
  });
  assert.ok(done.completedAt);
});

test('AI 검토 진행 중에도 직접 완료하고 현재 담당자는 기존 결과만 조회할 수 있다', async () => {
  const leader=context('leader');
  const state=getMockState(leader);
  const task=state.teams[1].tasks.find(task=>task.id===102);
  for(const assignment of task.assignees) task.contributions[assignment.userId]='담당한 구현과 검증 결과를 작성했습니다.';
  saveMockState(leader,state);
  const review=await previewRequest('/api/tasks/102/ai-review',{method:'POST'});
  const completed=await previewRequest('/api/tasks/102',{method:'PATCH',body:{status:'DONE',expectedVersion:task.version}});
  assert.equal(completed.status,'DONE');
  assert.equal((await previewRequest('/api/tasks/102/ai-review')).id,review.id);
  await assert.rejects(previewRequest('/api/tasks/102/ai-review',{method:'POST'}),{code:'TASK_LOCKED'});
});

test('이전 미리보기 역할 값이 남아 있어도 현재 역할 선택지를 표시한다', () => {
  setPreviewRole('obsolete-role');
  assert.equal(previewRole(), 'leader');
  assert.equal(previewContext().user.name, '김하늘');
});

test('미리보기는 최초 성공 비율을 스페이스에 고정하고 다른 팀과 공개 결과에도 유지한다', async () => {
  const manager = context('manager');
  resetMockState(manager, 'review');
  const state = getMockState(manager);
  state.reports = [];
  state.reportWeights = null;
  saveMockState(manager, state);
  const weights = { taskPercent: 50, midPercent: 20, finalPercent: 30 };
  const report = await previewRequest('/api/teams/1/report', { method: 'POST', body: weights });
  assert.deepEqual(report.weights, weights);
  assert.deepEqual((await previewRequest('/api/spaces/1')).reportWeights, weights);
  await assert.rejects(previewRequest('/api/teams/2/report', { method: 'POST', body: { taskPercent: 70, midPercent: 10, finalPercent: 20 } }), { code: 'REPORT_WEIGHTS_LOCKED' });
  const second = await previewRequest('/api/teams/2/report', { method: 'POST' });
  assert.deepEqual(second.weights, weights);
  const published = await previewRequest(`/api/reports/${report.id}/publish`, { method: 'POST' });
  assert.deepEqual(published.weights, weights);
  assert.deepEqual(published.members, report.members);
  context('member');
  assert.deepEqual((await previewRequest('/api/teams/1/report')).weights, weights);
});

test('미리보기는 잘못된 비율이나 생성 실패로 비율을 고정하지 않고 작업 비중 0도 허용한다', async () => {
  const manager = context('manager');
  resetMockState(manager, 'review');
  const state = getMockState(manager);
  state.reports = [];
  state.reportWeights = null;
  state.teams[1].tasks = [];
  saveMockState(manager, state);
  for (const body of [{}, { taskPercent: 50.5, midPercent: 20, finalPercent: 29.5 }, { taskPercent: 0, midPercent: 0, finalPercent: 99 }])
    await assert.rejects(previewRequest('/api/teams/1/report', { method: 'POST', body }), { code: 'INVALID_REQUEST' });
  await assert.rejects(previewRequest('/api/teams/1/report', { method: 'POST' }), { code: 'REPORT_UNCALCULABLE' });
  assert.equal((await previewRequest('/api/spaces/1')).reportWeights, null);
  const weights = { taskPercent: 0, midPercent: 0, finalPercent: 100 };
  const report = await previewRequest('/api/teams/1/report', { method: 'POST', body: weights });
  assert.deepEqual(report.weights, weights);
  for (const member of report.members) assert.equal(member.details.taskContributionPercent, 0);
});
