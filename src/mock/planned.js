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
  `fairplay:mock:v6:${context.preview ? 'preview' : context.user.id}:${context.space.id}`;
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
        },
        {
          id: context.space.id * 10 + 2,
          spaceId: context.space.id,
          type: 'FINAL',
          status: 'OPEN',
          version: 1,
          opensAt: new Date(timestamp - 86400000).toISOString(),
          closesAt: new Date(timestamp + 7 * 86400000).toISOString(),
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

      round.version++;
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
      if (new Date(round.closesAt) > new Date())
        round.closesAt = new Date(Date.now() - 1000).toISOString();
      round.status = 'CLOSED';

      round.version++;

      seedSubmittedRound(state, round);
    });
    for (const entry of Object.values(state.teams)) {
      state.reports.push(
        makeReport(
          state,
          entry,
          scenario === 'published' ? 'PUBLISHED' : 'UNPUBLISHED',
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
      const submittedAt = round.closesAt;
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

export function requireWorkBeforeFinalDeadline(state) {
  const final = state.rounds.find((round) => round.type === 'FINAL');
  if (
    final &&
    final.status !== 'DRAFT' &&
    new Date(final.closesAt) <= new Date()
  )
    fail(
      'TASK_WORK_CLOSED',
      '최종 평가 마감 이후에는 작업과 산출물을 변경할 수 없습니다.',
    );
}

function allSubmitted(state, round, entries = Object.values(state.teams)) {
  return entries
    .flatMap((entry) => entry.members)
    .every((member) => state.submitted[responseKey(round.id, member.userId)]);
}
function makeReport(state, entry, status = 'UNPUBLISHED') {
  const done = entry.tasks.filter((task) => task.status === 'DONE');
  const rawWork = entry.members.map((member) =>
    done.reduce(
      (sum, task) =>
        sum +
        (task.weight *
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
  const work = normalize(rawWork),
    mid = normalize(peerRaw('MID')),
    final = normalize(peerRaw('FINAL'));
  const rounded = entry.members.map(
    (_, i) =>
      Math.round((work[i] * 0.7 + mid[i] * 0.1 + final[i] * 0.2) * 10) / 10,
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
    cutoffAt: state.rounds.find((round) => round.type === 'FINAL').closesAt,
    totalPercent: 100,
    createdAt: now(),
    publishedAt: status === 'PUBLISHED' ? now() : null,
    members,
    details: Object.fromEntries(
      members.map((member, i) => [
        member.userId,
        {
          taskRatioPercent: work[i],
          midRatioPercent: mid[i],
          finalRatioPercent: final[i],
          taskContributionPercent: work[i] * 0.7,
          midContributionPercent: mid[i] * 0.1,
          finalContributionPercent: final[i] * 0.2,
          roundingAdjustmentPercent:
            member.contributionPercent -
            (work[i] * 0.7 + mid[i] * 0.1 + final[i] * 0.2),
          totalPercent: member.contributionPercent,
        },
      ]),
    ),
  };
}
const publicReport = ({ details, ...report }, context) => ({
  ...report,
  members: report.members.map((member) => ({
    ...member,
    ...(context.manager ? { details: details[member.userId] } : {}),
  })),
  myDetails: details[context.user.id] || null,
});
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
    hasMinimumMembers: members.length >= 2,
    pendingApplications: 0,
    totalTaskCount: tasks.length,
    todoTaskCount: count(tasks, 'TODO'),
    inProgressTaskCount: count(tasks, 'IN_PROGRESS'),
    revisingTaskCount: count(tasks, 'REVISING'),
    doneTaskCount: count(tasks, 'DONE'),
    completionRate: workSummary(team.id, members[0]?.userId, tasks)
      .teamProgressRate,
    overdueTaskCount: overdue(tasks),
    staleTaskCount: tasks.filter(
      (task) =>
        ['IN_PROGRESS', 'REVISING'].includes(task.status) &&
        Date.now() - new Date(task.lastActivityAt).getTime() >= 48 * 3600000,
    ).length,
    deliverableCount: deliverables.length,
    reportId:
      state.reports.find((report) => report.teamId === team.id)?.id ?? null,
    reportStatus:
      state.reports.find((report) => report.teamId === team.id)?.status ?? null,
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
              revisingTaskCount: count(ownTasks, 'REVISING'),
              doneTaskCount: count(ownTasks, 'DONE'),
              overdueTaskCount: overdue(ownTasks),
              completedWorkWeight: workSummary(team.id, member.userId, tasks)
                .myDoneWeight,
              missingContributionDescriptionCount: ownTasks.filter(
                (task) =>
                  task.status !== 'DONE' && !task.contributions?.[member.userId],
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
    if (
      segments[3] === 'teams' &&
      segments[5] === 'responses' &&
      method === 'GET'
    ) {
      requireManager();
      const teamId = Number(segments[4]);
      const selectedTeam = state.teams[teamId];
      if (!selectedTeam) fail('TEAM_NOT_FOUND', '팀이 없습니다.', 404);
      if (round.status !== 'CLOSED')
        fail('ROUND_NOT_CLOSED', '회차 마감 후 조회할 수 있습니다.');
      const submittedMembers = selectedTeam.members.filter(
        (member) => state.submitted[responseKey(id, member.userId)],
      );
      result = {
        roundId: id,
        type: round.type,
        teamId,
        requiredCount: selectedTeam.members.length,
        submittedCount: submittedMembers.length,
        missingCount: selectedTeam.members.length - submittedMembers.length,
        responses: submittedMembers.flatMap((evaluator) =>
          Object.values(
            state.responses[responseKey(id, evaluator.userId)] || {},
          ).map((response) => ({
            evaluatorId: evaluator.userId,
            evaluatorName: evaluator.name,
            targetId: response.targetId,
            targetName: selectedTeam.members.find(
              (member) => member.userId === response.targetId,
            )?.name,
            scores: response.scores,
            reason: response.reason,
            submittedAt: state.submitted[responseKey(id, evaluator.userId)],
          })),
        ),
      };
    } else if (['targets', 'responses', 'submit'].includes(segments[3])) {
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
        if (!['DRAFT', 'OPEN'].includes(round.status))
          fail(
            'INVALID_ROUND_STATE',
            '마감된 회차의 일정은 수정할 수 없습니다.',
          );
        if (round.status === 'OPEN' && Object.hasOwn(body, 'opensAt'))
          fail(
            'INVALID_REQUEST',
            '작성 중에는 마감 시각만 수정할 수 있습니다.',
            400,
          );
        const schedule = { opensAt: round.opensAt, ...body, type: round.type };
        validateSchedule(state, context, schedule);
        Object.assign(round, {
          opensAt: schedule.opensAt,
          closesAt: schedule.closesAt,
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
      } else {
        fail('NOT_FOUND', '지원하지 않는 요청입니다.', 404);
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
          startAt: task.startAt,
          dueAt: task.dueAt,
          allocationPercent: task.assignees.find(
            (assignment) => assignment.userId === member.userId,
          ).allocationPercent,
          contributionDescription: task.contributions?.[member.userId] ?? null,
          contributionUpdatedAt: task.updatedAt,
          taskVersion: task.version,
          deliverableSummary: entry.deliverables
            .filter((deliverable) => deliverable.taskId === task.id)
            .map(({ id, title, category, type, version }) => ({
              id,
              title,
              category,
              type,
              version,
            })),
        }));
    }
    if (
      segments[3] === 'report' &&
      segments.length === 4 &&
      ['GET', 'POST'].includes(method)
    ) {
      if (method === 'GET') {
        const report = state.reports.find(
          (report) =>
            report.teamId === id &&
            (context.manager || report.status === 'PUBLISHED'),
        );
        result = report ? publicReport(report, context) : null;
      } else {
        requireManager();
        const existing = state.reports.find((report) => report.teamId === id);
        if (existing) return clone(publicReport(existing, context));
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
        if (!state.rounds.every((round) => allSubmitted(state, round, [entry])))
          fail(
            'REPORT_INPUT_INCOMPLETE',
            '우리 팀의 필수 평가 제출이 필요합니다.',
          );
        const calculated = makeReport(state, entry);
        state.reports.push(calculated);
        result = publicReport(calculated, context);
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
    if (method !== 'POST' || segments[3] !== 'publish' || segments.length !== 4)
      fail('NOT_FOUND', '지원하지 않는 요청입니다.', 404);
    requireManager();
    if (report.status === 'PUBLISHED')
      return clone(publicReport(report, context));
    if (
      state.rounds.length !== 2 ||
      state.rounds.some(
        (round) =>
          round.status !== 'CLOSED' ||
          !allSubmitted(state, round, [state.teams[report.teamId]]),
      )
    )
      fail(
        'REPORT_PUBLICATION_BLOCKED',
        '해당 팀의 모든 필수 평가 제출이 완료되어야 공개할 수 있습니다.',
      );
    report.status = 'PUBLISHED';
    report.publishedAt = now();
    result = publicReport(report, context);
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
