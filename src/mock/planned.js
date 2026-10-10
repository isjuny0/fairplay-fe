import { exampleDeliverables, exampleTasks, peerCriteria } from './fixtures.js';
import { validatePeerResponse, workSummary } from '../lib/evaluation.js';

export class MockError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const fail = (code, message, status) => {
  throw new MockError(code, message, status);
};
const now = () => new Date().toISOString();
const clone = (value) => structuredClone(value);
const memoryStates = new Map();
export const mockKey = (context) =>
  `fairplay:mock:v1:${context.preview ? 'preview' : context.user.id}:${context.space.id}`;
export function getMockState(context) {
  const key = mockKey(context);
  let state = memoryStates.get(key);
  try {
    state =
      JSON.parse(globalThis.localStorage?.getItem(key) || 'null') || state;
  } catch {
    /* 저장 공간이 없어도 현재 탭에서 동작한다. */
  }
  if (!state) {
    const timestamp = Date.now();
    state = {
      teams: {},
      responses: {},
      submitted: {},
      reports: [],
      ai: {},
      scenario: 'active',
      rounds: [
        {
          id: context.space.id * 10 + 1,
          spaceId: context.space.id,
          type: 'MID',
          status: 'CLOSED',
          version: 1,
          opensAt: new Date(timestamp - 15 * 86400000).toISOString(),
          closesAt: new Date(timestamp - 8 * 86400000).toISOString(),
          closedAt: new Date(timestamp - 8 * 86400000).toISOString(),
          workCutoffAt: null,
        },
        {
          id: context.space.id * 10 + 2,
          spaceId: context.space.id,
          type: 'FINAL',
          status: 'OPEN',
          version: 1,
          opensAt: new Date(timestamp - 86400000).toISOString(),
          closesAt: new Date(timestamp + 7 * 86400000).toISOString(),
          closedAt: null,
          workCutoffAt: null,
        },
      ],
    };
  }
  for (const entry of context.teamContexts ||
    (context.team ? [{ team: context.team, members: context.members }] : [])) {
    if (!state.teams[entry.team.id]) {
      const tasks = exampleTasks(entry.team, entry.members);
      state.teams[entry.team.id] = {
        team: clone(entry.team),
        members: clone(entry.members),
        tasks,
        deliverables: exampleDeliverables(entry.team, tasks, entry.members),
      };
    }
  }
  // 마감 회차의 예시 응답은 실제 저장/제출 상태와 함께 만든다.
  for (const round of state.rounds) {
    if (round.status === 'CLOSED' && !round.seeded)
      seedSubmittedRound(state, round);
    if (round.status === 'OPEN' && new Date(round.closesAt) <= new Date()) {
      round.status = 'CLOSED';
      round.seeded = true;
      round.closedAt = now();
      round.version++;
      if (round.type === 'FINAL') round.workCutoffAt ||= now();
    }
  }
  memoryStates.set(key, state);
  return state;
}
export function saveMockState(context, state) {
  memoryStates.set(mockKey(context), state);
  try {
    globalThis.localStorage?.setItem(mockKey(context), JSON.stringify(state));
  } catch {
    /* 탭 내 목업 상태는 유지한다. */
  }
}
export function resetMockState(context, scenario = 'active') {
  memoryStates.delete(mockKey(context));
  globalThis.localStorage?.removeItem(mockKey(context));
  const state = getMockState(context);
  state.scenario = scenario;
  if (scenario === 'setup' || scenario === 'building') state.rounds = [];
  if (scenario === 'building') {
    state.spaceOverrides = {
      membershipLockedAt: null,
      teamBuildingStatus: 'OPEN',
      teamBuildingOpensAt: new Date(Date.now() - 86400000).toISOString(),
      teamBuildingClosesAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    };
    state.applications = [
      {
        id: 700,
        teamId: 1,
        userId: '00000000-0000-4000-8000-000000000007',
        name: '한지민',
        requestedAt: now(),
        status: 'PENDING',
        canApprove: true,
      },
    ];
  }
  if (scenario === 'published' || scenario === 'review') {
    state.rounds.forEach((round) => {
      round.status = 'CLOSED';
      round.closedAt = now();
      if (round.type === 'FINAL') round.workCutoffAt = now();
      seedSubmittedRound(state, round);
    });
    for (const entry of Object.values(state.teams)) {
      for (const task of entry.tasks.filter((task) => task.status === 'DONE')) {
        state.ai[task.id] = exampleEvaluation(task, task.id, {
          successful: true,
        });
      }
      state.reports.push(
        makeReport(
          state,
          entry,
          scenario === 'published' ? 'PUBLISHED' : 'DRAFT',
        ),
      );
    }
  }
  saveMockState(context, state);
}
const responseKey = (roundId, userId) => `${roundId}:${userId}`;
function roundResponse(state, round, context) {
  const participantCount = Object.values(state.teams).reduce(
    (total, entry) => total + entry.members.length,
    0,
  );
  const submitted = state.submitted[responseKey(round.id, context.user.id)];
  const { seeded, ...publicRound } = round;
  return {
    ...publicRound,
    participantCount: round.status === 'DRAFT' ? 0 : participantCount,
    mySubmissionStatus:
      context.manager || round.status === 'DRAFT'
        ? 'NOT_PARTICIPATING'
        : submitted
          ? 'SUBMITTED'
          : 'NOT_SUBMITTED',
  };
}
function seedSubmittedRound(state, round) {
  for (const entry of Object.values(state.teams)) {
    for (const member of entry.members) {
      const key = responseKey(round.id, member.userId);
      const submittedAt = round.closedAt || now();
      state.responses[key] ||= Object.fromEntries(
        entry.members
          .filter((target) => target.userId !== member.userId)
          .map((target) => [
            target.userId,
            {
              roundId: round.id,
              targetId: target.userId,
              scores: {
                taskExecution: 4,
                responsibility: 4,
                collaboration: 2,
                communication: 4,
              },
              reason:
                '공동 작업 일정 조율에 참여가 부족해 다음 회차에는 함께 조율하기로 했습니다.',
              updatedAt: submittedAt,
              submittedAt,
            },
          ]),
      );
      state.submitted[key] ||= submittedAt;
    }
  }
  round.seeded = true;
}
function allSubmitted(state, round, entries = Object.values(state.teams)) {
  return entries
    .flatMap((entry) => entry.members)
    .every((member) => state.submitted[responseKey(round.id, member.userId)]);
}
function reportInput(state, entry) {
  const input = JSON.stringify({
    rounds: state.rounds.map((round) => [
      round.id,
      round.version,
      round.workCutoffAt,
    ]),
    tasks: entry.tasks.map((task) => [
      task.id,
      task.version,
      task.status,
      state.ai[task.id]?.status,
      state.ai[task.id]?.score,
    ]),
    responses: state.rounds.map((round) =>
      entry.members.map(
        (member) => state.responses[responseKey(round.id, member.userId)],
      ),
    ),
  });
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++)
    hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  return `mock-${(hash >>> 0).toString(16)}`;
}
function makeReport(state, entry, status = 'DRAFT') {
  const done = entry.tasks.filter((task) => task.status === 'DONE');
  const rawAi = entry.members.map((member) =>
    done.reduce(
      (sum, task) =>
        sum +
        (task.weight *
          state.ai[task.id].score *
          (task.assignees.find(
            (assignment) => assignment.userId === member.userId,
          )?.allocationPercent || 0)) /
          100,
      0,
    ),
  );
  const peerRaw = (type) => {
    const round = state.rounds.find((round) => round.type === type);
    return entry.members.map((member) =>
      entry.members
        .filter((evaluator) => evaluator.userId !== member.userId)
        .reduce(
          (sum, evaluator) =>
            sum +
            Object.values(
              state.responses[responseKey(round.id, evaluator.userId)]?.[
                member.userId
              ]?.scores || {},
            ).reduce((a, b) => a + b, 0),
          0,
        ),
    );
  };
  const normalize = (values) => {
    const total = values.reduce((a, b) => a + b, 0);
    if (!total)
      fail(
        'REPORT_UNCALCULABLE',
        '구성 요소의 합계가 0이라 비율을 계산할 수 없습니다.',
      );
    return values.map((value) => (value / total) * 100);
  };
  const ai = normalize(rawAi),
    mid = normalize(peerRaw('MID')),
    final = normalize(peerRaw('FINAL'));
  const rounded = entry.members.map(
    (_, i) =>
      Math.round((ai[i] * 0.7 + mid[i] * 0.1 + final[i] * 0.2) * 10) / 10,
  );
  const adjustment =
    Math.round((100 - rounded.reduce((a, b) => a + b, 0)) * 10) / 10;
  const firstById = entry.members.map((member) => member.userId).sort()[0];
  const members = entry.members.map((member, index) => ({
    userId: member.userId,
    name: member.name,
    contributionPercent:
      Math.round(
        (rounded[index] + (member.userId === firstById ? adjustment : 0)) * 10,
      ) / 10,
  }));
  return {
    id: entry.team.id * 10000 + 1,
    teamId: entry.team.id,
    status,
    version: 0,
    inputHash: reportInput(state, entry),
    cutoffAt: state.rounds.find((round) => round.type === 'FINAL').workCutoffAt,
    totalPercent: 100,
    createdAt: now(),
    publishedAt: status === 'PUBLISHED' ? now() : null,
    members,
    details: Object.fromEntries(
      members.map((member, i) => [
        member.userId,
        {
          aiRatioPercent: ai[i],
          midRatioPercent: mid[i],
          finalRatioPercent: final[i],
          aiContributionPercent: ai[i] * 0.7,
          midContributionPercent: mid[i] * 0.1,
          finalContributionPercent: final[i] * 0.2,
          roundingAdjustmentPercent:
            member.contributionPercent -
            (ai[i] * 0.7 + mid[i] * 0.1 + final[i] * 0.2),
          totalPercent: member.contributionPercent,
        },
      ]),
    ),
  };
}
const publicReport = ({ details, inputHash, members, ...report }) => report;
function feedback(state, teamId, context) {
  const mid = state.rounds.find((round) => round.type === 'MID');
  if (!mid) fail('ROUND_NOT_FOUND', '중간 평가 회차가 아직 없습니다.', 404);
  if (mid.status !== 'CLOSED')
    fail(
      'MID_FEEDBACK_NOT_READY',
      '중간 평가가 마감되고 우리 팀이 모두 제출하면 피드백을 볼 수 있습니다.',
    );
  const entry = state.teams[teamId];
  if (!allSubmitted(state, mid, [entry]))
    fail(
      'MID_FEEDBACK_NOT_READY',
      '우리 팀의 필수 평가 제출이 모두 필요합니다.',
    );
  return {
    roundId: mid.id,
    roundVersion: mid.version,
    teamId,
    asOf: now(),
    members: entry.members
      .filter((member) => context.manager || member.userId === context.user.id)
      .map((member) => ({
        userId: member.userId,
        name: member.name,
        receivedEvaluationCount: Math.max(0, entry.members.length - 1),
        averageScores: {
          taskExecution: 4,
          responsibility: 3.5,
          collaboration: 2,
          communication: 4.5,
        },
        improvementGuidance: [
          '협업: 역할을 함께 조율하고 어려움을 겪는 팀원에게 필요한 지원을 제공해 보세요.',
        ],
      })),
  };
}
function dashboard(state, context, teamFilter) {
  const entries = Object.values(state.teams).filter(
    (entry) => !teamFilter || entry.team.id === teamFilter,
  );
  const count = (tasks, status) =>
    tasks.filter((task) => task.status === status).length;
  const overdue = (tasks) =>
    tasks.filter(
      (task) => task.status !== 'DONE' && new Date(task.dueAt) < new Date(),
    ).length;
  const teams = entries.map(({ team, members, tasks, deliverables }) => ({
    teamId: team.id,
    teamName: team.name,
    leaderId: team.leaderId,
    leaderName:
      members.find((member) => member.userId === team.leaderId)?.name || '리더',
    approvedMemberCount: members.length,
    canProceedWithTasks: members.length >= 2,
    pendingApplications: 0,
    totalTaskCount: tasks.length,
    todoTaskCount: count(tasks, 'TODO'),
    inProgressTaskCount: count(tasks, 'IN_PROGRESS'),
    pendingApprovalCount: count(tasks, 'PENDING_APPROVAL'),
    doneTaskCount: count(tasks, 'DONE'),
    completionRate: tasks.length
      ? Math.round((count(tasks, 'DONE') / tasks.length) * 10000) / 100
      : null,
    overdueTaskCount: overdue(tasks),
    staleTaskCount: tasks.filter(
      (task) =>
        task.status === 'IN_PROGRESS' &&
        Date.now() - new Date(task.lastActivityAt).getTime() >= 48 * 3600000,
    ).length,
    aiNeedsReviewCount: tasks.filter(
      (task) =>
        task.status === 'DONE' &&
        (state.ai[task.id] || exampleEvaluation(task, task.id)).status ===
          'NEEDS_REVIEW',
    ).length,
    deliverableCount: deliverables.length,
    reportId:
      state.reports.find((report) => report.teamId === team.id)?.id || null,
    reportStatus:
      state.reports.find((report) => report.teamId === team.id)?.status || null,
    ...(teamFilter
      ? {
          members: members.map((member) => {
            const ownTasks = tasks.filter((task) =>
              task.assignees.some(
                (assignment) => assignment.userId === member.userId,
              ),
            );
            return {
              userId: member.userId,
              name: member.name,
              assignedTaskCount: ownTasks.length,
              todoTaskCount: count(ownTasks, 'TODO'),
              inProgressTaskCount: count(ownTasks, 'IN_PROGRESS'),
              pendingApprovalCount: count(ownTasks, 'PENDING_APPROVAL'),
              doneTaskCount: count(ownTasks, 'DONE'),
              overdueTaskCount: overdue(ownTasks),
              approvedWorkWeight: workSummary(team.id, member.userId, tasks)
                .myDoneWeight,
              missingContributionDescriptionCount: ownTasks.filter(
                (task) =>
                  task.assignees.length > 1 && !task.contributions?.[member.userId],
              ).length,
            };
          }),
        }
      : {}),
  }));
  const aggregate = (key) =>
    teams.reduce((total, team) => total + team[key], 0);
  return {
    spaceId: context.space.id,
    spaceName: context.space.name,
    teamId: teamFilter || null,
    asOf: now(),
    totalTeamCount: Object.keys(state.teams).length,
    unassignedCount: 0,
    pendingApplications: 0,
    overdueTaskCount: aggregate('overdueTaskCount'),
    staleTaskCount: aggregate('staleTaskCount'),
    pendingApprovalCount: aggregate('pendingApprovalCount'),
    aiNeedsReviewCount: aggregate('aiNeedsReviewCount'),
    teams,
    missingPeerSubmissions: state.rounds.map((round) => {
      const teamSubmissions = entries.map((entry) => {
        const requiredCount =
          round.status === 'DRAFT' ? 0 : entry.members.length;
        const submittedCount = entry.members.filter(
          (member) => state.submitted[responseKey(round.id, member.userId)],
        ).length;
        return {
          teamId: entry.team.id,
          requiredCount,
          submittedCount,
          missingCount: requiredCount - submittedCount,
        };
      });
      return {
        roundId: round.id,
        type: round.type,
        status: round.status,
        requiredCount: teamSubmissions.reduce(
          (sum, team) => sum + team.requiredCount,
          0,
        ),
        submittedCount: teamSubmissions.reduce(
          (sum, team) => sum + team.submittedCount,
          0,
        ),
        missingCount: teamSubmissions.reduce(
          (sum, team) => sum + team.missingCount,
          0,
        ),
        teams: teamSubmissions,
      };
    }),
  };
}

export async function plannedRequest(
  context,
  path,
  { method = 'GET', body = {} } = {},
) {
  const state = getMockState(context);
  const url = new URL(path, 'https://mock.local');
  const segments = url.pathname.split('/').filter(Boolean);
  const id = Number(segments[2]);
  let result;
  const requireManager = () => {
    if (!context.manager)
      fail('FORBIDDEN', '스페이스 관리자만 사용할 수 있습니다.', 403);
  };
  if (segments[1] === 'spaces' && segments[3] === 'manager-dashboard') {
    requireManager();
    result = dashboard(state, context, Number(url.searchParams.get('teamId')));
  } else if (segments[1] === 'spaces' && segments[3] === 'evaluation-rounds') {
    if (method === 'GET')
      result = state.rounds.map((round) =>
        roundResponse(state, round, context),
      );
    else {
      requireManager();
      if (state.rounds.some((round) => round.type === body.type))
        fail('ROUND_CONFLICT', '이 종류의 평가 회차가 이미 있습니다.');
      validateSchedule(state, context, body);
      const round = {
        id: id * 10 + (body.type === 'MID' ? 1 : 2),
        spaceId: id,
        type: body.type,
        status: 'DRAFT',
        version: 0,
        opensAt: body.opensAt,
        closesAt: body.closesAt,
        closedAt: null,
        workCutoffAt: null,
      };
      state.rounds.push(round);
      result = roundResponse(state, round, context);
    }
  } else if (segments[1] === 'evaluation-rounds') {
    const round = state.rounds.find((entry) => entry.id === id);
    if (!round) fail('ROUND_NOT_FOUND', '평가 회차가 없습니다.', 404);
    const entry = state.teams[context.team?.id];
    const key = responseKey(id, context.user.id);
    const saved = state.responses[key] || {};
    if (['targets', 'responses', 'submit'].includes(segments[3])) {
      if (
        context.manager ||
        !entry?.members.some((member) => member.userId === context.user.id) ||
        round.status === 'DRAFT'
      )
        fail('FORBIDDEN', '이 회차의 평가 참여자가 아닙니다.', 403);
      const targets = entry.members.filter(
        (member) => member.userId !== context.user.id,
      );
      if (segments[3] === 'targets')
        result = targets.map((member) => ({
          targetId: member.userId,
          name: member.name,
          teamId: context.team.id,
          hasSavedResponse: Boolean(saved[member.userId]),
          submittedAt: state.submitted[key] || null,
        }));
      else if (segments[3] === 'responses' && method === 'GET')
        result = Object.values(saved);
      else if (segments[3] === 'responses') {
        if (round.status !== 'OPEN' || new Date(round.closesAt) <= new Date())
          fail('ROUND_CLOSED', '평가 작성 기간이 아닙니다.');
        if (state.submitted[key])
          fail(
            'PEER_ALREADY_SUBMITTED',
            '최종 제출한 평가는 수정할 수 없습니다.',
          );
        if (!targets.some((target) => target.userId === segments[4]))
          fail(
            'INVALID_PEER_TARGET',
            '같은 팀의 다른 평가 대상자만 평가할 수 있습니다.',
            403,
          );
        const error = validatePeerResponse(body.scores, body.reason || '');
        if (error) fail('INVALID_PEER_SCORES', error, 400);
        result = {
          roundId: id,
          targetId: segments[4],
          scores: body.scores,
          reason: body.reason?.trim() || null,
          updatedAt: now(),
          submittedAt: null,
        };
        state.responses[key] = { ...saved, [segments[4]]: result };
      } else {
        if (state.submitted[key])
          result = { roundId: id, submittedAt: state.submitted[key] };
        else {
          if (round.status !== 'OPEN' || new Date(round.closesAt) <= new Date())
            fail('ROUND_CLOSED', '평가 작성 기간이 아닙니다.');
          if (!targets.every((target) => saved[target.userId]))
            fail(
              'PEER_RESPONSES_INCOMPLETE',
              '모든 평가 대상의 응답을 먼저 저장해 주세요.',
            );
          state.submitted[key] = now();
          Object.values(saved).forEach((response) => {
            response.submittedAt = state.submitted[key];
          });
          result = { roundId: id, submittedAt: state.submitted[key] };
        }
      }
    } else {
      requireManager();
      if (
        body.expectedVersion != null &&
        body.expectedVersion !== round.version
      )
        fail(
          'VERSION_CONFLICT',
          '회차가 변경되었습니다. 최신 정보를 확인해 주세요.',
        );
      if (method === 'PATCH') {
        if (round.status !== 'DRAFT')
          fail(
            'INVALID_ROUND_STATE',
            '일정 대기 상태에서만 일정을 수정할 수 있습니다.',
          );
        validateSchedule(state, context, { ...body, type: round.type });
        Object.assign(round, {
          opensAt: body.opensAt,
          closesAt: body.closesAt,
        });
      } else if (segments[3] === 'open') {
        if (round.status !== 'DRAFT')
          fail('INVALID_ROUND_STATE', '일정 대기 회차만 시작할 수 있습니다.');
        if (
          new Date(round.opensAt) > new Date() ||
          new Date(round.closesAt) <= new Date()
        )
          fail(
            'ROUND_OUTSIDE_WINDOW',
            '시작 시각부터 마감 시각 전까지만 시작할 수 있습니다.',
          );
        if (new Date(context.space.teamBuildingClosesAt) > new Date())
          fail(
            'TEAM_BUILDING_OPEN',
            '팀 빌딩 기간 종료 후 시작할 수 있습니다.',
          );
        if (!Object.keys(state.teams).length)
          fail('ROUND_PARTICIPANTS_EMPTY', '평가할 팀이 없습니다.');
        if (Object.values(state.teams).some((team) => team.members.length < 2))
          fail(
            'TEAM_TOO_SMALL',
            '모든 팀에 승인된 팀원 2명 이상이 필요합니다.',
          );
        if (
          round.type === 'FINAL' &&
          state.rounds.find((entry) => entry.type === 'MID')?.status !==
            'CLOSED'
        )
          fail(
            'MID_ROUND_NOT_CLOSED',
            '중간 평가 마감 후 최종 평가를 시작할 수 있습니다.',
          );
        round.status = 'OPEN';
      } else if (segments[3] === 'close') {
        if (round.status !== 'OPEN')
          fail('INVALID_ROUND_STATE', '작성 중인 회차만 마감할 수 있습니다.');
        if (
          new Date(round.closesAt) > new Date() &&
          !Object.values(state.teams)
            .flatMap((team) => team.members)
            .every((member) => state.submitted[responseKey(id, member.userId)])
        )
          fail(
            'ROUND_SUBMISSIONS_INCOMPLETE',
            '기한 전에는 모든 참여자가 제출해야 마감할 수 있습니다.',
          );
        round.status = 'CLOSED';
        round.seeded = true;
        round.closedAt = now();
        if (round.type === 'FINAL') round.workCutoffAt ||= now();
      } else if (segments[3] === 'reopen') {
        if (round.status !== 'CLOSED')
          fail('INVALID_ROUND_STATE', '마감된 회차만 재개방할 수 있습니다.');
        if (state.reports.some((report) => report.status === 'PUBLISHED'))
          fail(
            'ROUND_ALREADY_PUBLISHED',
            '공개된 리포트가 있어 재개방할 수 없습니다.',
          );
        if (new Date(body.closesAt) <= new Date())
          fail(
            'INVALID_ROUND_WINDOW',
            '새 마감은 현재보다 미래여야 합니다.',
            400,
          );
        round.status = 'OPEN';
        round.closedAt = null;
        round.closesAt = body.closesAt;
      }
      round.version++;
      result = roundResponse(state, round, context);
    }
  } else if (segments[1] === 'teams') {
    const entry = state.teams[id];
    if (!entry) fail('TEAM_NOT_FOUND', '팀이 없습니다.', 404);
    if (
      !context.manager &&
      !entry.members.some((member) => member.userId === context.user.id)
    )
      fail(
        'FORBIDDEN',
        '현재 해당 팀의 승인된 팀원만 조회할 수 있습니다.',
        403,
      );
    if (segments[3] === 'my-work-summary') {
      if (
        context.manager &&
        !entry.members.some((member) => member.userId === context.user.id)
      )
        fail(
          'FORBIDDEN',
          '관리자 권한만으로 본인 현황을 조회할 수 없습니다.',
          403,
        );
      result = workSummary(id, context.user.id, entry.tasks);
    }
    if (segments[3] === 'mid-feedback') result = feedback(state, id, context);
    if (segments[3] === 'members') {
      requireManager();
      const member = entry.members.find(
        (member) => member.userId === segments[4],
      );
      if (!member) fail('TEAM_MEMBER_NOT_FOUND', '해당 팀원이 없습니다.', 404);
      result = entry.tasks
        .filter((task) =>
          task.assignees.some(
            (assignment) => assignment.userId === member.userId,
          ),
        )
        .map((task) => ({
          taskId: task.id,
          title: task.title,
          status: task.status,
          weight: task.weight,
          dueAt: task.dueAt,
          allocationPercent: task.assignees.find(
            (assignment) => assignment.userId === member.userId,
          ).allocationPercent,
          contributionDescription: task.contributions?.[member.userId] ?? null,
          contributionUpdatedAt: task.updatedAt,
          taskVersion: task.version,
          deliverableSummary: entry.deliverables.filter(
            (deliverable) => deliverable.taskId === task.id,
          ),
        }));
    }
    if (
      (segments[3] === 'report' && method === 'GET') ||
      (segments[3] === 'reports' && segments[4] === 'draft' && method === 'POST')
    ) {
      if (method === 'GET') {
        const report = state.reports.find(
          (report) =>
            report.teamId === id &&
            (context.manager || report.status === 'PUBLISHED'),
        );
        result = report ? publicReport(report) : null;
      } else {
        requireManager();
        const existing = state.reports.find((report) => report.teamId === id);
        if (existing?.status === 'PUBLISHED')
          fail(
            'REPORT_ALREADY_PUBLISHED',
            '공개된 리포트는 재계산할 수 없습니다.',
          );
        if (entry.members.length < 2)
          fail('TEAM_TOO_SMALL', '승인 팀원 2명 이상이 필요합니다.');
        if (
          !['MID', 'FINAL'].every((type) =>
            state.rounds.some(
              (round) => round.type === type && round.status === 'CLOSED',
            ),
          )
        )
          fail(
            'REPORT_INPUT_INCOMPLETE',
            '중간·최종 평가 마감과 우리 팀 필수 제출이 필요합니다.',
          );
        if (
          !state.rounds.every((round) => allSubmitted(state, round, [entry])) ||
          !state.rounds.find((round) => round.type === 'FINAL')?.workCutoffAt ||
          entry.tasks.some(
            (task) => state.ai[task.id]?.rework && task.status !== 'DONE',
          ) ||
          entry.tasks
            .filter((task) => task.status === 'DONE')
            .some(
              (task) =>
                state.ai[task.id]?.status !== 'COMPLETED' ||
                state.ai[task.id]?.score == null,
            )
        )
          fail(
            'REPORT_INPUT_INCOMPLETE',
            '필수 동료 평가 제출과 유효 AI 평가가 필요합니다. 자료 보완 또는 평가 대기 작업을 먼저 확인해 주세요.',
          );
        const calculated = makeReport(state, entry);
        if (existing) {
          Object.assign(existing, calculated, {
            id: existing.id,
            createdAt: existing.createdAt,
            version: existing.version + 1,
          });
          result = publicReport(existing);
        } else {
          state.reports.push(calculated);
          result = publicReport(calculated);
        }
      }
    }
  } else if (segments[1] === 'reports') {
    const report = state.reports.find((entry) => entry.id === id);
    if (!report) fail('REPORT_NOT_FOUND', '리포트가 없습니다.', 404);
    if (
      !context.manager &&
      (!state.teams[report.teamId]?.members.some(
        (member) => member.userId === context.user.id,
      ) ||
        context.team?.id !== report.teamId)
    )
      fail('FORBIDDEN', '다른 팀의 리포트는 볼 수 없습니다.', 403);
    if (method === 'POST') {
      requireManager();
      if (!Number.isInteger(body?.expectedVersion) || body.expectedVersion < 0)
        fail('INVALID_REQUEST', '조회한 리포트 버전이 필요합니다.', 400);
      if (report.status === 'PUBLISHED') return publicReport(report);
      if (body.expectedVersion !== report.version)
        fail('VERSION_CONFLICT', '초안이 갱신되었습니다. 다시 검토해 주세요.');
      if (
        state.rounds.length !== 2 ||
        state.rounds.some(
          (round) => round.status !== 'CLOSED' || !allSubmitted(state, round),
        )
      )
        fail(
          'REPORT_PUBLICATION_BLOCKED',
          '스페이스의 모든 필수 평가 제출이 완료되어야 공개할 수 있습니다.',
        );
      if (
        report.status !== 'PUBLISHED' &&
        report.inputHash !== reportInput(state, state.teams[report.teamId])
      )
        fail(
          'REPORT_INPUT_STALE',
          '리포트 생성 이후 입력이 변경되었습니다. 최신 초안을 다시 생성해 주세요.',
        );
      report.status = 'PUBLISHED';
      report.publishedAt = now();
      report.version++;
      result = publicReport(report);
    } else {
      if (!context.manager && report.status !== 'PUBLISHED')
        fail('REPORT_NOT_PUBLISHED', '아직 공개되지 않은 리포트입니다.', 403);
      result = {
        ...publicReport(report),
        members: report.members,
        myDetails: report.details[context.user.id] || null,
      };
    }
  } else if (segments[1] === 'tasks') {
    const task =
      context.task ||
      Object.values(state.teams)
        .flatMap((entry) => entry.tasks)
        .find((task) => task.id === id);
    if (!task) fail('TASK_NOT_FOUND', '작업이 없습니다.', 404);
    const currentApproval = context.approval || {
      id,
      reviewerId: task.completionReviewerId,
      status: 'APPROVED',
    };
    const assigned = task.assignees.some(
      (assignment) => assignment.userId === context.user.id,
    );
    const reviewer = currentApproval.reviewerId === context.user.id;
    if (!assigned && !reviewer && !context.manager)
      fail(
        'FORBIDDEN',
        '담당자·고정 승인자·관리자만 AI 결과를 볼 수 있습니다.',
        403,
      );
    if (!state.ai[id])
      state.ai[id] = exampleEvaluation(task, currentApproval.id);
    if (
      state.ai[id].retryCompletesAt &&
      Date.now() >= state.ai[id].retryCompletesAt
    )
      state.ai[id] = exampleEvaluation(task, currentApproval.id, {
        successful: true,
      });
    const evaluation = state.ai[id];
    if (segments[3] === 'rework') {
      if (!reviewer || context.manager)
        fail(
          'FORBIDDEN',
          '직전 완료 승인의 고정 승인자만 자료 보완을 허용할 수 있습니다.',
          403,
        );
      if (body.expectedVersion !== task.version)
        fail('VERSION_CONFLICT', '작업이 변경되었습니다.');
      if (
        state.teams[task.teamId]?.members.length < 2 ||
        (state.deletion?.teamId === task.teamId &&
          ['PENDING', 'READY'].includes(state.deletion.status))
      )
        fail(
          'TEAM_WORK_BLOCKED',
          '팀원 2명 이상이며 삭제 동의가 진행 중이 아니어야 합니다.',
        );
      if (
        task.status !== 'DONE' ||
        evaluation.status !== 'NEEDS_REVIEW' ||
        ![
          'EVALUATION_INPUT_INSUFFICIENT',
          'INPUT_FORMAT_UNSUPPORTED',
          'DOCUMENT_UNREADABLE',
          'INPUT_LIMIT_EXCEEDED',
        ].includes(evaluation.failureCode)
      )
        fail(
          'TASK_REWORK_NOT_ALLOWED',
          '자료 실패 상태의 완료 작업만 보완할 수 있습니다.',
        );
      if (
        state.reports.some(
          (report) =>
            report.teamId === task.teamId && report.status === 'PUBLISHED',
        )
      )
        fail(
          'TASK_REWORK_BLOCKED_BY_REPORT',
          '공개된 리포트의 작업은 변경할 수 없습니다.',
        );
      const mockTask = state.teams[task.teamId]?.tasks.find(
        (entry) => entry.id === id,
      );
      if (context.preview) {
        state.approvals ||= {};
        state.approvals[id] ||= [
          {
            ...currentApproval,
            taskId: id,
            requesterId: task.assignees[0].userId,
            requestedAt: task.updatedAt,
            decidedAt: task.updatedAt,
            reason: null,
          },
        ];
      }
      const nextVersion = task.version + 1;
      if (mockTask) {
        mockTask.status = 'IN_PROGRESS';
        mockTask.canRequestCompletion = true;
        mockTask.completionBlockReason = null;
        mockTask.version++;
      }
      evaluation.rework = true;
      result = { ...task, status: 'IN_PROGRESS', version: nextVersion };
    } else if (method === 'POST') {
      if (!assigned || context.manager)
        fail('FORBIDDEN', '현재 작업 담당자만 재시도할 수 있습니다.', 403);
      if (
        task.status !== 'DONE' ||
        evaluation.status !== 'NEEDS_REVIEW' ||
        !['UPSTREAM_UNAVAILABLE', 'OUTPUT_VALIDATION_FAILED'].includes(
          evaluation.failureCode,
        )
      )
        fail(
          'AI_EVALUATION_NOT_RETRYABLE',
          '종료된 기술 실패에서만 재시도할 수 있습니다.',
        );
      Object.assign(evaluation, {
        status: 'PENDING',
        score: null,
        criteria: [],
        reason: null,
        unverified: [],
        failureCode: null,
        retryCompletesAt: Date.now() + 2000,
      });
      const { rework, retryCompletesAt, ...publicEvaluation } = evaluation;
      result = publicEvaluation;
    } else {
      if (task.status !== 'DONE' && !state.ai[id]?.rework)
        fail('AI_EVALUATION_NOT_FOUND', '승인 후 AI 평가가 예약됩니다.', 404);
      const { rework, retryCompletesAt, ...publicEvaluation } = evaluation;
      result = publicEvaluation;
    }
  }
  if (result === undefined)
    fail('MOCK_NOT_SUPPORTED', '이 목업 동작은 아직 준비되지 않았습니다.', 400);
  saveMockState(context, state);
  return clone(result);
}
function validateSchedule(state, context, body) {
  if (
    !['MID', 'FINAL'].includes(body.type) ||
    !body.opensAt ||
    !body.closesAt ||
    !Number.isFinite(Date.parse(body.opensAt)) ||
    !Number.isFinite(Date.parse(body.closesAt)) ||
    new Date(body.opensAt) >= new Date(body.closesAt) ||
    new Date(body.closesAt) <= new Date()
  )
    fail(
      'INVALID_ROUND_WINDOW',
      '시작보다 종료가 늦고 종료가 미래인 일정을 입력해 주세요.',
      400,
    );
  const earliest =
    body.type === 'MID'
      ? context.space.teamBuildingClosesAt
      : state.rounds.find((round) => round.type === 'MID')?.closesAt;
  if (!earliest || new Date(body.opensAt) < new Date(earliest))
    fail(
      'EVALUATION_SCHEDULE_CONFLICT',
      body.type === 'MID'
        ? '팀 빌딩 종료 이후로 설정해 주세요.'
        : '중간 평가 종료 이후로 설정해 주세요.',
    );
}
export function exampleEvaluation(
  task,
  approvalId,
  { successful = false } = {},
) {
  const dataFailure = !successful && task.id % 100 === 5;
  const technicalFailure = !successful && task.id % 100 === 6;
  return {
    id: task.id,
    taskId: task.id,
    approvalId,
    status: dataFailure || technicalFailure ? 'NEEDS_REVIEW' : 'COMPLETED',
    score: dataFailure || technicalFailure ? null : 85,
    criteria:
      dataFailure || technicalFailure
        ? []
        : [
            'REQUIREMENT_FULFILLMENT',
            'ACCURACY_CONSISTENCY',
            'EVIDENCE_SUPPORT',
            'CLARITY_USABILITY',
          ].map((code, index) => ({
            code,
            level: [4, 3, 3, 3][index],
            maxPoints: [40, 30, 20, 10][index],
            points: [40, 22.5, 15, 7.5][index],
            reason: [
              '합의한 주요 결과가 제출 자료에 포함되어 있습니다.',
              '결과와 설명이 대체로 일관됩니다.',
              '조사 근거와 한계가 제시되어 있습니다.',
              '다음 작업에 활용할 수 있도록 정리되어 있습니다.',
            ][index],
            evidence:
              index === 2
                ? [
                    {
                      deliverableId: task.teamId * 1000 + 2,
                      sourceType: 'TEXT',
                      kind: 'TEXT_QUOTE',
                      quote: '관찰과 해석을 구분해 기록합니다.',
                      observation: null,
                      location: {
                        page: null,
                        section: '기록 방식',
                        slide: null,
                        sheetName: null,
                        cellRange: null,
                      },
                    },
                  ]
                : [],
          })),
    reason: dataFailure
      ? '자료에서 핵심 내용을 확인하지 못했습니다. 지정 승인자에게 자료 보완을 요청하세요.'
      : technicalFailure
        ? '평가 서비스 연결에 실패했습니다. 자료를 바꾸지 않고 다시 시도할 수 있습니다.'
        : '요구한 결과를 충족하며 일부 근거의 범위를 더 명확히 하면 좋겠습니다.',
    unverified: [
      '실제 인터뷰 수행 여부는 제출된 자료만으로 확인할 수 없습니다.',
    ],
    failureCode: dataFailure
      ? 'DOCUMENT_UNREADABLE'
      : technicalFailure
        ? 'UPSTREAM_UNAVAILABLE'
        : null,
    model: 'mock-model',
    promptVersion: 'v1',
    rubricVersion: 'v1',
    createdAt: now(),
    updatedAt: now(),
  };
}
