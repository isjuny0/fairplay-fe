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

test('팀 빌딩 미리보기의 최소 저장 상태에도 리포트 기본 정보를 복원한다', async () => {
  const manager = context('manager');
  storage.set('fairplay:mock:v7:preview:1', JSON.stringify({ teams: {}, rounds: [], scenario: 'building', spaceOverrides: { membershipLockedAt: null, teamBuildingStatus: 'OPEN' } }));
  const restored = getMockState(manager);
  assert.deepEqual(restored.reports, []);
  assert.equal(restored.reportWeights, null);
  assert.equal((await previewRequest('/api/spaces/1')).reportWeights, null);
  assert.equal(await previewRequest('/api/teams/1/report'), null);
});

test('미리보기 평가 시작은 본문 없는 POST로 호출한다', async () => {
  const manager = context('manager');
  resetMockState(manager, 'setup');
  const round = await plannedRequest(manager, '/api/spaces/1/evaluation-rounds', { method: 'POST', body: { type: 'MID', opensAt: koreanDateTime(Date.now() - 60000), closesAt: koreanDateTime(Date.now() + 86400000) } });
  const opened = await plannedRequest(manager, `/api/evaluation-rounds/${round.id}/open`, { method: 'POST' });
  assert.equal(opened.status, 'OPEN');
  assert.ok(opened.participantCount >= 2);
});

test('가이드 전용 작업은 단독 담당이며 자유 탐색 데이터와 분리된다', async () => {
  const session = new Map();
  globalThis.sessionStorage = { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: (key) => session.delete(key) };
  try {
    const { prepareGuide, completedGuideStep, guideScopeKey, guideTaskId, guideHome, guideStorageKey, readGuideSession } = await import('../src/mock/guide.js');
    const original = getMockState(context('leader'));
    original.teams[1].tasks[0].title = '자유 탐색에서 수정한 작업';
    saveMockState(context('leader'), original);
    const guide = prepareGuide();
    assert.equal(Object.hasOwn(JSON.parse(sessionStorage.getItem(guideStorageKey)), 'step'), false);
    assert.equal(readGuideSession().status, 'active');
    const state = getMockState(previewContext());
    const task = state.teams[1].tasks.find((task) => task.id === guideTaskId);
    assert.equal(previewContext().user.name, '이지원');
    assert.equal(completedGuideStep(guide, guideHome), false);
    assert.equal(completedGuideStep(guide, `${guideHome}/tasks`), true);
    assert.deepEqual(task.assignees, [{ userId: previewContext().user.id, allocationPercent: 100 }]);
    assert.equal(completedGuideStep({ ...guide, step: 4 }, ''), false);
    await assert.rejects(previewRequest(`/api/tasks/${guideTaskId}/contribution`, { method: 'PATCH', body: { expectedVersion: 0, contributionDescription: '짧음' } }));
    assert.equal(completedGuideStep({ ...guide, step: 4 }, ''), false);
    await previewRequest(`/api/tasks/${guideTaskId}/contribution`, { method: 'PATCH', body: { expectedVersion: 0, contributionDescription: '조사 결과의 핵심 발견을 정리했습니다.' } });
    assert.equal(completedGuideStep({ ...guide, step: 4 }, ''), true);
    assert.equal(completedGuideStep({ ...guide, step: 2 }, ''), false);
    const restarted = prepareGuide();
    assert.notEqual(restarted.scope, guide.scope);
    assert.equal(restarted.step, 0);
    const restartedTask = getMockState(previewContext()).teams[1].tasks.find((item) => item.id === guideTaskId);
    assert.equal(restartedTask.contributions[previewContext().user.id], null);
    assert.equal(restartedTask.status, 'IN_PROGRESS');
    sessionStorage.removeItem(guideScopeKey);
    assert.equal(getMockState(context('leader')).teams[1].tasks[0].title, '자유 탐색에서 수정한 작업');
    assert.equal(getMockState(context('leader')).teams[1].tasks.some((task) => task.id === guideTaskId), false);
  } finally { delete globalThis.sessionStorage; }
});

test('사용자 가이드의 AI피드백은 현재 결과가 준비되고 사용자가 확인해야 진행한다', async () => {
  const session = new Map();
  globalThis.sessionStorage = { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: (key) => session.delete(key) };
  try {
    const { prepareGuide, completedGuideStep, guideSteps, guideTaskId, guideExamples } = await import('../src/mock/guide.js');
    const guide = prepareGuide();
    const aiStep = { ...guide, step: guideSteps.findIndex((step) => step.id === 'ai-feedback') };
    await assert.rejects(previewRequest(`/api/tasks/${guideTaskId}/ai-review`, { method: 'POST' }), { code: 'AI_REVIEW_INPUT_REQUIRED' });
    await previewRequest('/api/teams/1/deliverables', { method: 'POST', body: { ...guideExamples.deliverable, taskId: guideTaskId } });
    await previewRequest(`/api/tasks/${guideTaskId}/ai-review`, { method: 'POST' });
    assert.equal(completedGuideStep(aiStep, '', { aiFeedbackConfirmed: true }), false);
    const state = getMockState(previewContext());
    state.reviews[guideTaskId].completesAt = Date.now() - 1;
    saveMockState(previewContext(), state);
    const review = await previewRequest(`/api/tasks/${guideTaskId}/ai-review`);
    assert.equal(review.status, 'COMPLETED');
    assert.equal(completedGuideStep(aiStep, ''), false);
    assert.equal(completedGuideStep(aiStep, '', { aiFeedbackConfirmed: true }), true);
    const stale = getMockState(previewContext());
    stale.reviews[guideTaskId].isCurrent = false;
    saveMockState(previewContext(), stale);
    assert.equal(completedGuideStep(aiStep, '', { aiFeedbackConfirmed: true }), false);
  } finally { delete globalThis.sessionStorage; }
});

test('동료 평가 가이드는 본인을 제외한 모든 응답 저장과 제출 확정 후에만 완료한다', async () => {
  const session = new Map();
  globalThis.sessionStorage = { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: (key) => session.delete(key) };
  try {
    const { prepareGuide, completedGuideStep, guidePeerRoundId, guideExamples, getGuideSteps, readGuideSession } = await import('../src/mock/guide.js');
    const guide = prepareGuide('peer-evaluation');
    assert.equal(readGuideSession().scenarioId, 'peer-evaluation');
    assert.equal(getGuideSteps(guide.scenarioId).length, 4);
    const targets = await previewRequest(`/api/evaluation-rounds/${guidePeerRoundId}/targets`);
    assert.equal(targets.length, 2);
    assert.ok(targets.every((target) => target.targetId !== previewContext().user.id));
    assert.equal(completedGuideStep(guide, ''), false);
    assert.equal(completedGuideStep(guide, '', { peerConfirmed: true }), true);
    await assert.rejects(previewRequest(`/api/evaluation-rounds/${guidePeerRoundId}/submit`, { method: 'POST' }), { code: 'PEER_RESPONSES_INCOMPLETE' });
    const responseStep = { ...guide, step: 1 };
    await assert.rejects(previewRequest(`/api/evaluation-rounds/${guidePeerRoundId}/responses/${targets[0].targetId}`, { method: 'PUT', body: { scores: { ...guideExamples.peerScores, taskExecution: 1 }, reason: '' } }), { code: 'INVALID_PEER_SCORES' });
    assert.equal(completedGuideStep(responseStep, ''), false);
    for (let index = 0; index < targets.length; index++) {
      await previewRequest(`/api/evaluation-rounds/${guidePeerRoundId}/responses/${targets[index].targetId}`, { method: 'PUT', body: { scores: guideExamples.peerScores, reason: guideExamples.peerReason } });
      assert.equal(completedGuideStep(responseStep, ''), index === targets.length - 1);
    }
    assert.equal(completedGuideStep({ ...guide, step: 2 }, ''), false);
    await previewRequest(`/api/evaluation-rounds/${guidePeerRoundId}/submit`, { method: 'POST' });
    assert.equal(completedGuideStep({ ...guide, step: 2 }, ''), true);
    assert.equal(completedGuideStep({ ...guide, step: 3 }, ''), false);
    assert.equal(completedGuideStep({ ...guide, step: 3 }, '', { peerConfirmed: true }), true);
    await assert.rejects(previewRequest(`/api/evaluation-rounds/${guidePeerRoundId}/responses/${targets[0].targetId}`, { method: 'PUT', body: { scores: guideExamples.peerScores } }), { code: 'PEER_ALREADY_SUBMITTED' });
    const fresh = prepareGuide('peer-evaluation');
    assert.notEqual(fresh.scope, guide.scope);
    assert.equal((await previewRequest(`/api/evaluation-rounds/${guidePeerRoundId}/responses/me`)).length, 0);
    assert.equal(completedGuideStep({ ...fresh, step: 2 }, ''), false);
  } finally { delete globalThis.sessionStorage; }
});

test('기여도 가이드는 공개된 본인 근거만 사용하고 누락·미공개·잘못된 비중을 완료로 취급하지 않는다', async () => {
  const session = new Map();
  globalThis.sessionStorage = { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: (key) => session.delete(key) };
  try {
    const { prepareGuide, contributionGuideReady, readGuideSession, getGuideSteps } = await import('../src/mock/guide.js');
    const guide = prepareGuide('contribution-report');
    const userId = previewContext().user.id;
    assert.equal(getGuideSteps(guide.scenarioId).length, 3);
    assert.equal(readGuideSession().scenarioId, 'contribution-report');
    const report = await previewRequest('/api/teams/1/report');
    assert.equal(report.status, 'PUBLISHED');
    assert.equal(contributionGuideReady(report, userId), true);
    assert.ok(report.members.every((member) => !Object.hasOwn(member, 'details')));
    assert.equal(contributionGuideReady(null, userId), false);
    for (const change of [{ status: 'UNPUBLISHED' }, { teamId: 2 }, { myDetails: null }, { weights: { taskPercent: 70, midPercent: 20, finalPercent: 20 } }, { myDetails: { ...report.myDetails, taskRatioPercent: null } }]) {
      assert.equal(contributionGuideReady({ ...report, ...change }, userId), false);
    }
    assert.equal(contributionGuideReady(report, 'unknown-user'), false);
    const fresh = prepareGuide('contribution-report');
    assert.notEqual(fresh.scope, guide.scope);
    assert.equal(fresh.step, 0);
    assert.equal((await previewRequest('/api/teams/1/report')).status, 'PUBLISHED');
  } finally { delete globalThis.sessionStorage; }
});

test('관리자 팀 진행 가이드는 조회 데이터와 열린 산출물의 연결·버전이 일치해야 완료할 수 있다', async () => {
  const session = new Map();
  globalThis.sessionStorage = { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: (key) => session.delete(key) };
  try {
    const { prepareGuide, managerGuideReady, managerGuideMemberId, managerGuideTaskId, managerGuideDeliverableId, getGuideSteps, readGuideSession } = await import('../src/mock/guide.js');
    const guide = prepareGuide('team-management');
    assert.equal(previewContext().manager, true);
    assert.equal(readGuideSession().scenarioId, 'team-management');
    assert.equal(getGuideSteps(guide.scenarioId).length, 4);
    const dashboard = await previewRequest('/api/spaces/1/manager-dashboard?teamId=1');
    const selected = { kind: 'team', team: dashboard.teams[0] };
    assert.equal(managerGuideReady('manager-select-team', selected), true);
    assert.equal(managerGuideReady('manager-select-team', null), false);
    const tasks = await previewRequest(`/api/teams/1/members/${managerGuideMemberId}/contributions`);
    const task = tasks.find((item) => item.taskId === managerGuideTaskId);
    const member = { kind: 'member', teamId: 1, userId: managerGuideMemberId, task };
    assert.equal(managerGuideReady('manager-overview', member), true);
    assert.equal(managerGuideReady('manager-member', { ...member, userId: 'wrong' }), false);
    const documents = await previewRequest(`/api/teams/1/deliverables?taskId=${managerGuideTaskId}&page=0&size=100`);
    const document = documents.find((item) => item.id === managerGuideDeliverableId);
    const source = { ready: true, teamId: document.teamId, taskId: document.taskId, deliverableId: document.id, version: document.version };
    assert.equal(managerGuideReady('manager-material', member, source), true);
    for (const change of [{ ready: false }, { version: source.version + 1 }, { taskId: 999 }, { teamId: 2 }]) {
      assert.equal(managerGuideReady('manager-material', member, { ...source, ...change }), false);
    }
    await assert.rejects(previewRequest(`/api/tasks/${managerGuideTaskId}`, { method: 'PATCH', body: { expectedVersion: 1, title: '관리자 수정' } }), { status: 403 });
    const fresh = prepareGuide('team-management');
    assert.equal(fresh.step, 0);
    assert.notEqual(fresh.scope, guide.scope);
  } finally { delete globalThis.sessionStorage; }
});

test('관리자 평가 시작 가이드는 일정 저장과 개방 성공을 구분하고 실제 제출 현황 확인 후에만 완료한다', async () => {
  const session = new Map();
  globalThis.sessionStorage = { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: (key) => session.delete(key) };
  try {
    const { prepareGuide, evaluationGuideReady, evaluationGuideSchedule, getGuideSteps, readGuideSession, guideScopeKey } = await import('../src/mock/guide.js');
    setPreviewRole('leader');
    resetMockState(previewContext(), 'published');
    const guide = prepareGuide('evaluation-management');
    assert.equal(previewContext().manager, true);
    assert.equal(readGuideSession().scenarioId, 'evaluation-management');
    assert.equal(getGuideSteps(guide.scenarioId).length, 4);
    const observed = async (viewedRoundId) => ({
      space: await previewRequest('/api/spaces/1'),
      rounds: await previewRequest('/api/spaces/1/evaluation-rounds'),
      dashboard: await previewRequest('/api/spaces/1/manager-dashboard'), viewedRoundId,
    });
    const initial = await observed();
    assert.equal(initial.space.membershipLockedAt, null);
    assert.equal(evaluationGuideReady('evaluation-overview', initial), true);
    assert.equal(evaluationGuideReady('evaluation-overview', null), false);
    assert.equal(evaluationGuideReady('evaluation-schedule', initial), false);
    const schedule = evaluationGuideSchedule();
    await assert.rejects(previewRequest('/api/spaces/1/evaluation-rounds', { method: 'POST', body: { ...schedule, closesAt: schedule.opensAt } }), { code: 'INVALID_ROUND_WINDOW' });
    assert.equal(evaluationGuideReady('evaluation-schedule', await observed()), false);
    const round = await previewRequest('/api/spaces/1/evaluation-rounds', { method: 'POST', body: schedule });
    const scheduled = await observed();
    assert.equal(round.status, 'DRAFT');
    assert.equal(evaluationGuideReady('evaluation-schedule', scheduled), true);
    assert.equal(evaluationGuideReady('evaluation-open', scheduled), false);
    const state = getMockState(previewContext());
    const teamBuildingClosesAt = state.spaceOverrides.teamBuildingClosesAt;
    state.spaceOverrides.teamBuildingClosesAt = koreanDateTime(Date.now() + 86400000);
    saveMockState(previewContext(), state);
    await assert.rejects(previewRequest(`/api/evaluation-rounds/${round.id}/open`, { method: 'POST' }), { code: 'TEAM_BUILDING_OPEN' });
    assert.equal(evaluationGuideReady('evaluation-open', await observed()), false);
    const restored = getMockState(previewContext());
    restored.spaceOverrides.teamBuildingClosesAt = teamBuildingClosesAt;
    saveMockState(previewContext(), restored);
    await previewRequest(`/api/evaluation-rounds/${round.id}/open`, { method: 'POST' });
    const opened = await observed();
    assert.equal(opened.space.teamBuildingStatus, 'LOCKED');
    assert.ok(opened.space.membershipLockedAt);
    assert.equal(opened.rounds[0].participantCount, 5);
    assert.equal(evaluationGuideReady('evaluation-open', opened), true);
    assert.equal(evaluationGuideReady('evaluation-result', opened), false);
    const viewed = await observed(round.id);
    assert.equal(evaluationGuideReady('evaluation-result', viewed), true);
    for (const change of [
      { viewedRoundId: 999 }, { space: { ...viewed.space, membershipLockedAt: null } },
      { rounds: [{ ...viewed.rounds[0], participantCount: 0 }] },
      { dashboard: { ...viewed.dashboard, missingPeerSubmissions: [] } },
      { dashboard: { ...viewed.dashboard, spaceId: 2 } },
    ]) assert.equal(evaluationGuideReady('evaluation-result', { ...viewed, ...change }), false);
    const fresh = prepareGuide('evaluation-management');
    assert.notEqual(fresh.scope, guide.scope);
    assert.equal(fresh.step, 0);
    assert.deepEqual(await previewRequest('/api/spaces/1/evaluation-rounds'), []);
    assert.equal((await previewRequest('/api/spaces/1')).membershipLockedAt, null);
    sessionStorage.removeItem(guideScopeKey);
    assert.equal(getMockState(previewContext()).reports.every((report) => report.status === 'PUBLISHED'), true);
  } finally { delete globalThis.sessionStorage; }
});

test('관리자 리포트 가이드는 전체 생성·계산 근거 검토·선택 팀 공개를 구분하며 재시작 시 초기화한다', async () => {
  const session = new Map();
  globalThis.sessionStorage = { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: (key) => session.delete(key) };
  try {
    const { prepareGuide, reportManagementGuideReady, managerGuideMemberId, getGuideSteps, readGuideSession, guideScopeKey } = await import('../src/mock/guide.js');
    setPreviewRole('leader');
    resetMockState(previewContext(), 'published');
    const guide = prepareGuide('report-management');
    assert.equal(previewContext().manager, true);
    assert.equal(readGuideSession().scenarioId, 'report-management');
    assert.equal(getGuideSteps(guide.scenarioId).length, 5);
    const weights = { taskPercent: 60, midPercent: 20, finalPercent: 20 };
    const batch = async () => ({
      space: await previewRequest('/api/spaces/1'), rounds: await previewRequest('/api/spaces/1/evaluation-rounds'),
      dashboard: await previewRequest('/api/spaces/1/manager-dashboard'), weights, canGenerate: true,
    });
    const initial = await batch();
    assert.equal(initial.rounds.every((round) => round.status === 'CLOSED'), true);
    assert.equal(initial.dashboard.teams.every((team) => team.reportId == null), true);
    assert.equal(initial.space.reportWeights, null);
    assert.equal(reportManagementGuideReady('management-report-weights', initial), true);
    assert.equal(reportManagementGuideReady('management-report-weights', { ...initial, weights: { ...weights, taskPercent: 70 } }), false);
    assert.equal(reportManagementGuideReady('management-report-weights', { ...initial, rounds: [{ ...initial.rounds[0], status: 'OPEN' }] }), false);
    assert.equal(reportManagementGuideReady('management-report-generate', initial), false);
    await assert.rejects(previewRequest('/api/teams/1/report', { method: 'POST', body: { ...weights, taskPercent: 70 } }), { code: 'INVALID_REQUEST' });
    assert.equal(reportManagementGuideReady('management-report-generate', await batch()), false);
    const first = await previewRequest('/api/teams/1/report', { method: 'POST', body: weights });
    assert.equal(first.status, 'UNPUBLISHED');
    assert.equal(reportManagementGuideReady('management-report-generate', await batch()), false);
    await previewRequest('/api/teams/2/report', { method: 'POST', body: weights });
    const generated = await batch();
    assert.deepEqual(generated.space.reportWeights, weights);
    assert.equal(reportManagementGuideReady('management-report-generate', generated), true);
    const result = { teamId: 1, report: await previewRequest('/api/teams/1/report') };
    const review = { reportId: first.id, memberId: managerGuideMemberId, open: true };
    assert.equal(reportManagementGuideReady('management-report-review', generated, result), false);
    assert.equal(reportManagementGuideReady('management-report-review', generated, result, review), true);
    for (const change of [{ open: false }, { memberId: 'unknown' }, { reportId: 0 }]) {
      assert.equal(reportManagementGuideReady('management-report-review', generated, result, { ...review, ...change }), false);
    }
    assert.equal(reportManagementGuideReady('management-report-review', generated, { ...result, teamId: 2 }, review), false);
    assert.equal(reportManagementGuideReady('management-report-publish', generated, result), false);
    assert.equal(reportManagementGuideReady('management-report-result', generated, null), false);
    const state = getMockState(previewContext());
    const savedSubmission = state.submitted[`12:${managerGuideMemberId}`];
    delete state.submitted[`12:${managerGuideMemberId}`];
    saveMockState(previewContext(), state);
    await assert.rejects(previewRequest(`/api/reports/${first.id}/publish`, { method: 'POST' }), { code: 'REPORT_PUBLICATION_BLOCKED' });
    assert.equal(reportManagementGuideReady('management-report-publish', await batch(), { teamId: 1, report: await previewRequest('/api/teams/1/report') }), false);
    const restored = getMockState(previewContext());
    restored.submitted[`12:${managerGuideMemberId}`] = savedSubmission;
    saveMockState(previewContext(), restored);
    const published = await previewRequest(`/api/reports/${first.id}/publish`, { method: 'POST' });
    assert.equal(reportManagementGuideReady('management-report-publish', await batch(), { teamId: 1, report: published }), true);
    assert.equal(reportManagementGuideReady('management-report-result', await batch(), { teamId: 1, report: published }), true);
    assert.equal((await previewRequest('/api/teams/2/report')).status, 'UNPUBLISHED');
    setPreviewRole('member');
    const memberReport = await previewRequest('/api/teams/1/report');
    assert.equal(memberReport.status, 'PUBLISHED');
    assert.ok(memberReport.myDetails);
    assert.equal(memberReport.members.every((member) => !member.details), true);
    const fresh = prepareGuide('report-management');
    assert.equal(previewContext().manager, true);
    assert.notEqual(fresh.scope, guide.scope);
    assert.equal(fresh.step, 0);
    assert.equal((await previewRequest('/api/spaces/1/manager-dashboard')).teams.every((team) => team.reportId == null), true);
    assert.equal((await previewRequest('/api/spaces/1')).reportWeights, null);
    sessionStorage.removeItem(guideScopeKey);
    assert.equal(getMockState(previewContext()).reports.every((report) => report.status === 'PUBLISHED'), true);
  } finally { delete globalThis.sessionStorage; }
});

test('완료 후 다음 가이드는 같은 역할의 이용 가능한 흐름만 안내하고 마지막에는 종료한다', async () => {
  const { guideScenarios, nextGuideScenario } = await import('../src/mock/guide.js');
  const expected = {
    'task-completion': 'materials-search',
    'materials-search': 'peer-evaluation',
    'peer-evaluation': 'contribution-report',
    'contribution-report': null,
    'team-management': 'evaluation-management',
    'evaluation-management': 'report-management',
    'report-management': null,
    'mid-feedback': null,
    unknown: null,
  };
  for (const [id, nextId] of Object.entries(expected)) {
    const next = nextGuideScenario(id);
    assert.equal(next?.id ?? null, nextId);
    if (next) {
      assert.equal(next.available, true);
      assert.equal(next.audience, guideScenarios.find((scenario) => scenario.id === id).audience);
    }
  }
});

test('관리자 산출물 안내는 일치하는 원문을 연 뒤에만 비교 안내로 전환한다', async () => {
  const { managerGuideStep, managerGuideSteps, managerGuideTaskId, managerGuideMemberId, managerGuideDeliverableId } = await import('../src/mock/guide.js');
  const step = managerGuideSteps.find((entry) => entry.id === 'manager-material');
  const member = { kind: 'member', teamId: 1, userId: managerGuideMemberId,
    task: { taskId: managerGuideTaskId, contributionDescription: '수행 설명',
      deliverableSummary: [{ id: managerGuideDeliverableId, type: 'TEXT', version: 2 }] } };
  const source = { teamId: 1, taskId: managerGuideTaskId, deliverableId: managerGuideDeliverableId,
    expanded: true, ready: true, loading: false, error: false, version: 2 };
  assert.equal(managerGuideStep(step, { member }).title, step.title);
  assert.match(managerGuideStep(step, { member, source }).title, /원문과 수행 설명/);
  assert.equal(managerGuideStep(step, { member, source: { ...source, ready: false, expanded: false } }).title, step.title);
  for (const change of [{ version: 1 }, { teamId: 2 }, { taskId: 102 }, { deliverableId: 999 }]) {
    assert.doesNotMatch(managerGuideStep(step, { member, source: { ...source, ...change } }).title, /원문과 수행 설명/);
  }
  const loading = managerGuideStep(step, { member, source: { ...source, ready: false, loading: true } });
  assert.match(loading.title, /불러오고/);
  assert.equal(loading.actionTarget, null);
  const failed = managerGuideStep(step, { member, source: { ...source, ready: false, error: true } });
  assert.match(failed.description, /불러오지 못했습니다/);
  assert.equal(failed.actionTarget, null);
});

test('다른 작업이나 팀을 선택하면 해당 결과를 확인하도록 안내하지 않는다', async () => {
  const { managerGuideStep, managerGuideSteps, reportManagementGuideSteps } = await import('../src/mock/guide.js');
  for (const step of managerGuideSteps.filter((entry) => ['manager-member', 'manager-material'].includes(entry.id))) {
    const resolved = managerGuideStep(step, { member: { kind: 'member', task: { taskId: 102 } } });
    assert.match(resolved.title, /사용자 인터뷰 계획.*선택/);
    assert.equal(resolved.target, null);
    assert.doesNotMatch(resolved.actionTarget, /confirm-manager/);
  }
  for (const step of reportManagementGuideSteps.slice(2)) {
    const resolved = managerGuideStep(step, { reportResult: { teamId: 2 }, reportReviewReady: true });
    assert.match(resolved.title, /삼위일체로 선택/);
    assert.equal(resolved.target, null);
    assert.match(resolved.actionTarget, /choose-report-guide-team/);
  }
});

test('리포트 계산 근거를 확인하기 전과 후의 안내를 구분한다', async () => {
  const { managerGuideStep, reportManagementGuideSteps } = await import('../src/mock/guide.js');
  const step = reportManagementGuideSteps.find((entry) => entry.id === 'management-report-review');
  assert.match(managerGuideStep(step).dialogDescription, /펼쳐/);
  const ready = managerGuideStep(step, { reportResult: { teamId: 1 }, reportReviewReady: true });
  assert.doesNotMatch(ready.dialogDescription, /펼쳐/);
  assert.match(ready.dialogDescription, /반올림 보정/);
  assert.equal(ready.dialogActionTarget, '[data-guide="confirm-management-report-review"]');
});
