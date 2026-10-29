import { apiTimeToEpoch, koreanDateTime } from '../lib/koreanTime.js';
import { exampleDeliverables, exampleTasks, peerCriteria } from './fixtures.js';
import { validatePeerResponse, workSummary } from '../lib/evaluation.js';
import { defaultReportWeights, sameReportWeights, validReportWeights } from '../lib/reportWeights.js';

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
const now = () => koreanDateTime();
const clone = (value) => structuredClone(value);
const memoryStates = new Map();
export function mockKey(context) {
  const baseKey = `fairplay:mock:v9:${context.preview ? 'preview' : context.user.id}:${context.space.id}`;
  if (!context.preview) return baseKey;
  try {
    const guideScope = globalThis.sessionStorage?.getItem('fairplay:preview-guide-scope');
    return guideScope ? `${baseKey}:guide:${guideScope}` : baseKey;
  } catch { return baseKey; }
}
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
          opensAt: koreanDateTime(timestamp - 15 * 86400000),
          closesAt: koreanDateTime(timestamp - 8 * 86400000),
        },
        {
          id: context.space.id * 10 + 2,
          spaceId: context.space.id,
          type: 'FINAL',
          status: 'OPEN',
          version: 1,
          opensAt: koreanDateTime(timestamp - 86400000),
          closesAt: koreanDateTime(timestamp + 7 * 86400000),
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
    if (round.status === 'OPEN' && new Date(apiTimeToEpoch(round.closesAt)) <= new Date()) {
      round.status = 'CLOSED';
      round.seeded = true;

      round.version++;
    }
  }
  for (const round of state.rounds) {
    if (round.status !== 'DRAFT' || apiTimeToEpoch(round.opensAt) > Date.now() || roundStartBlockReasons(state, round, context).length) continue;
    round.status = 'OPEN';
    round.openedAt = now();
    round.version++;
    if (round.type === 'MID') state.spaceOverrides = { ...state.spaceOverrides,
      membershipLockedAt: state.spaceOverrides?.membershipLockedAt || context.space.membershipLockedAt || now(),
      teamBuildingStatus: 'LOCKED', version: (state.spaceOverrides?.version ?? context.space.version) + 1 };
  }
  // Ensure a minimal preview state has report settings.
  state.reports ??= [];
  for (const report of state.reports) report.weights ??= { ...defaultReportWeights };
  state.reportWeights ??= state.reports[0]?.weights ?? null;
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
      teamBuildingOpensAt: koreanDateTime(Date.now() - 86400000),
      teamBuildingClosesAt: koreanDateTime(Date.now() + 7 * 86400000),
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
  if (['evaluated', 'review', 'published'].includes(scenario)) {
    state.rounds.forEach((round) => {
      if (new Date(apiTimeToEpoch(round.closesAt)) > new Date())
        round.closesAt = koreanDateTime(Date.now() - 1000);
      round.status = 'CLOSED';

      round.version++;

      seedSubmittedRound(state, round);
    });
    if (scenario !== 'evaluated') {
      for (const entry of Object.values(state.teams)) {
        state.reports.push(
          makeReport(
            state,
            entry,
            scenario === 'published' ? 'PUBLISHED' : 'UNPUBLISHED',
          ),
        );
      }
      state.reportWeights = { ...defaultReportWeights };
    }
  }
  saveMockState(context, state);
}
const responseKey = (roundId, userId) => `${roundId}:${userId}`;
function roundStartBlockReasons(state, round, context) {
  if (round.status !== 'DRAFT' || Date.now() < apiTimeToEpoch(round.opensAt)) return [];
  if (Date.now() >= apiTimeToEpoch(round.closesAt)) return ['SCHEDULE_EXPIRED'];
  if (round.type === 'FINAL') return state.rounds.some((item) => item.type === 'MID' && item.status === 'CLOSED') ? [] : ['MID_ROUND_NOT_CLOSED'];
  const space = { ...context.space, ...state.spaceOverrides };
  if (!space.teamBuildingClosesAt) return ['TEAM_BUILDING_NOT_CONFIGURED'];
  if (Date.now() < apiTimeToEpoch(space.teamBuildingClosesAt)) return ['TEAM_BUILDING_OPEN'];
  const teams = Object.values(state.teams);
  if (!teams.length) return ['ROUND_PARTICIPANTS_EMPTY'];
  return teams.some((entry) => entry.members.length < 2) ? ['TEAM_TOO_SMALL'] : [];
}
function roundResponse(state, round, context) {
  const participantCount = Object.values(state.teams).reduce(
    (total, entry) => total + entry.members.length,
    0,
  );
  const submitted = state.submitted[responseKey(round.id, context.user.id)];
  const { seeded, ...publicRound } = round;
  return {
    ...publicRound,
    openedAt: round.openedAt ?? null,
    startBlockReasons: roundStartBlockReasons(state, round, context),
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
    new Date(apiTimeToEpoch(final.closesAt)) <= new Date()
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
function makeReport(state, entry, status = 'UNPUBLISHED', weights = state.reportWeights ?? defaultReportWeights) {
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
  const totalWork = rawWork.reduce((sum, value) => sum + value, 0);
  if (!totalWork && weights.taskPercent > 0) fail('REPORT_UNCALCULABLE', '작업 점수를 계산할 완료 작업량이 없습니다.');
  const roundNumber = (value) => Math.round((value + Number.EPSILON) * 10000) / 10000;
  const received = (type, member) => {
    const round = state.rounds.find((item) => item.type === type);
    const responses = entry.members.filter((other) => other.userId !== member.userId).map((other) =>
      state.responses[responseKey(round.id, other.userId)]?.[member.userId]?.scores);
    if (!responses.length || responses.some((scores) => !scores || Object.keys(peerCriteria).some((key) => !Number.isFinite(scores[key]))))
      fail('REPORT_INPUT_INCOMPLETE', '동료 평가 점수가 누락되었습니다.');
    const criteria = Object.fromEntries(Object.keys(peerCriteria).map((key) => [key, roundNumber(responses.reduce((sum, scores) => sum + scores[key], 0) / responses.length)]));
    const average = responses.reduce((sum, scores) => sum + Object.keys(peerCriteria).reduce((part, key) => part + scores[key], 0), 0) / (responses.length * 4);
    return { criteria, average, score: average / 5 * 100 };
  };
  const scores = {};
  const details = Object.fromEntries(entry.members.map((member, index) => {
    const taskRatioPercent = totalWork ? rawWork[index] / totalWork * 100 : null;
    const taskScore = taskRatioPercent === null ? null : Math.min(100, taskRatioPercent * entry.members.length);
    const mid = received('MID', member), final = received('FINAL', member);
    const taskWeightedScore = (taskScore ?? 0) * weights.taskPercent / 100;
    const midWeightedScore = mid.score * weights.midPercent / 100, finalWeightedScore = final.score * weights.finalPercent / 100;
    scores[member.userId] = Math.round((taskWeightedScore + midWeightedScore + finalWeightedScore) * 10) / 10;
    return [member.userId, {
      taskRatioPercent: taskRatioPercent === null ? null : roundNumber(taskRatioPercent), taskScore: taskScore === null ? null : roundNumber(taskScore),
      midEvaluationAverage: roundNumber(mid.average), midEvaluationScore: roundNumber(mid.score),
      finalEvaluationAverage: roundNumber(final.average), finalEvaluationScore: roundNumber(final.score),
      taskWeightedScore: roundNumber(taskWeightedScore), midWeightedScore: roundNumber(midWeightedScore), finalWeightedScore: roundNumber(finalWeightedScore),
      midCriteriaAverages: mid.criteria, finalCriteriaAverages: final.criteria,
    }];
  }));
  return {
    id: entry.team.id * 10000 + 1, teamId: entry.team.id, status,
    evaluatedMemberCount: entry.members.length,
    cutoffAt: state.rounds.find((round) => round.type === 'FINAL').closesAt,
    weights: { ...weights },
    evidenceTasks: done.map((task) => ({ taskId: task.id, completedAt: task.completedAt, weightAtCutoff: task.weight, assignments: clone(task.assignees) })),
    createdAt: now(), publishedAt: status === 'PUBLISHED' ? now() : null,
    members: entry.members.map((member) => ({ userId: member.userId, name: member.name, totalScore: scores[member.userId] })),
    details,
  };
}
const publicReport = ({ details, evidenceTasks, ...report }, context) => ({
  ...report,
  members: report.members.filter((member) => context.manager || member.userId === context.user.id)
    .map((member) => ({ ...member, details: details[member.userId] })),
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
          '적극성: 팀 목표에 필요한 일이나 개선점을 찾아 제안하고, 문제 해결에 먼저 참여해 보세요.',
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
      (task) => task.status !== 'DONE' && new Date(apiTimeToEpoch(task.dueAt)) < new Date(),
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
        Date.now() - new Date(apiTimeToEpoch(task.lastActivityAt)).getTime() >= 48 * 3600000,
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

function spaceReportStatus(state, context) {
  const entries = Object.values(state.teams);
  const overview = dashboard(state, context);
  const teams = overview.teams.map((team) => {
    const report = state.reports.find((item) => item.teamId === team.teamId);
    return { teamId: team.teamId, teamName: team.teamName, approvedMemberCount: team.approvedMemberCount,
      reportId: report?.id ?? null, reportStatus: report?.status ?? null,
      createdAt: report?.createdAt ?? null, publishedAt: report?.publishedAt ?? null };
  });
  const rounds = ['MID', 'FINAL'].map((type) => {
    const round = state.rounds.find((item) => item.type === type);
    const submissions = overview.missingPeerSubmissions.find((item) => item.roundId === round?.id);
    const missingTeams = teams.filter((team) => {
      const submission = submissions?.teams.find((item) => item.teamId === team.teamId);
      return !submission || submission.requiredCount < 2 || submission.missingCount > 0;
    }).map((team) => ({ ...team, submission: submissions?.teams.find((item) => item.teamId === team.teamId) ?? null }));
    return { type, roundId: round?.id ?? null, status: round?.status ?? null,
      completedTeamCount: teams.length - missingTeams.length, missingTeams };
  });
  const weights = state.reportWeights ?? defaultReportWeights;
  const teamReports = teams.map((team) => {
    const generationBlockReasons = [];
    if (rounds.some((round) => round.status !== 'CLOSED')) generationBlockReasons.push('ROUNDS_NOT_CLOSED');
    else {
      if (team.approvedMemberCount < 2) generationBlockReasons.push('TEAM_TOO_SMALL');
      if (rounds.some((round) => round.missingTeams.some((missing) => missing.teamId === team.teamId))) generationBlockReasons.push('PEER_EVALUATIONS_INCOMPLETE');
    }
    const publicationBlockReasons = team.reportId == null ? ['REPORT_NOT_GENERATED'] : team.reportStatus === 'PUBLISHED' ? [] : [...generationBlockReasons];
    if (team.reportId != null) generationBlockReasons.length = 0;
    const { approvedMemberCount, ...report } = team;
    return { ...report, canGenerate: generationBlockReasons.length === 0, generationBlockReasons,
      canPublish: publicationBlockReasons.length === 0, publicationBlockReasons };
  });
  const generationBlockReasons = entries.length ? [...new Set(teamReports.flatMap((team) => team.generationBlockReasons))] : ['NO_TEAMS'];
  const publicationBlockReasons = entries.length ? [...new Set(teamReports.flatMap((team) => team.publicationBlockReasons))] : ['NO_TEAMS'];
  return { spaceId: context.space.id, weights, weightsConfirmed: state.reportWeights != null, totalTeamCount: teams.length,
    generatedTeamCount: teams.filter((team) => team.reportId != null).length,
    publishedTeamCount: teams.filter((team) => team.reportStatus === 'PUBLISHED').length,
    canGenerate: generationBlockReasons.length === 0, generationBlockReasons,
    canPublish: publicationBlockReasons.length === 0, publicationBlockReasons, teams: teamReports };
}

export async function plannedRequest(
  context,
  path,
  { method = 'GET', body } = {},
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
  if (segments[1] === 'spaces' && segments[3] === 'reports') {
    requireManager();
    if (id !== context.space.id) fail('FORBIDDEN', '다른 스페이스의 리포트는 관리할 수 없습니다.', 403);
    const status = spaceReportStatus(state, context);
    if (method === 'GET' && segments.length === 4) return clone(status);
    if (method === 'POST' && segments.length === 4) {
      const weights = body ?? state.reportWeights ?? defaultReportWeights;
      if (!validReportWeights(weights)) fail('INVALID_REQUEST', '각 반영 비율은 0~100 정수이며 합계가 100이어야 합니다.', 400);
      if (state.reportWeights && !sameReportWeights(state.reportWeights, weights)) fail('REPORT_WEIGHTS_LOCKED', '확정된 반영 비율은 변경할 수 없습니다.');
      if (status.totalTeamCount > 0 && status.generatedTeamCount === status.totalTeamCount) return clone(status);
      if (!status.canGenerate) fail('REPORT_INPUT_INCOMPLETE', status.generationBlockReasons.join(' '));
      // Calculate all pending reports before changing persisted preview state.
      const pending = Object.values(state.teams).filter((entry) => !state.reports.some((report) => report.teamId === entry.team.id));
      const reports = pending.map((entry) => makeReport(state, entry, 'UNPUBLISHED', weights));
      state.reportWeights = { ...weights };
      state.reports.push(...reports);
    } else if (method === 'POST' && segments.length === 5 && segments[4] === 'publish') {
      if (status.totalTeamCount > 0 && status.publishedTeamCount === status.totalTeamCount) return clone(status);
      if (!status.canPublish) fail('REPORT_PUBLICATION_BLOCKED', status.publicationBlockReasons.join(' '));
      const publishedAt = now();
      state.reports.filter((report) => status.teams.some((team) => team.reportId === report.id) && report.status === 'UNPUBLISHED')
        .forEach((report) => { report.status = 'PUBLISHED'; report.publishedAt = publishedAt; });
    } else fail('NOT_FOUND', '지원하지 않는 요청입니다.', 404);
    result = spaceReportStatus(state, context);
  } else if (segments[1] === 'spaces' && segments[3] === 'manager-dashboard') {
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
        if (round.status !== 'OPEN' || new Date(apiTimeToEpoch(round.closesAt)) <= new Date())
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
          if (round.status !== 'OPEN' || new Date(apiTimeToEpoch(round.closesAt)) <= new Date())
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
        body?.expectedVersion != null &&
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
    if (segments[3] === 'report' && segments[4] === 'evidence' && segments.length === 5 && method === 'GET') {
      const targetId = url.searchParams.get('userId') || context.user.id;
      if (entry.team.spaceId !== context.space.id || (!context.manager && targetId !== context.user.id))
        fail('FORBIDDEN', '본인의 기여 근거만 조회할 수 있습니다.', 403);
      const report = state.reports.find((item) => item.teamId === id && (context.manager || item.status === 'PUBLISHED'));
      if (!report) fail('REPORT_NOT_FOUND', '기여도 리포트를 찾을 수 없습니다.', 404);
      const member = report.members.find((item) => item.userId === targetId);
      if (!member) fail('REPORT_MEMBER_NOT_FOUND', '리포트에 포함된 팀원을 찾을 수 없습니다.', 404);
      if (!report.evidenceTasks) fail('REPORT_EVIDENCE_UNAVAILABLE', '작업 근거 정보가 누락되었습니다. 미리보기 설정에서 예시 데이터를 초기화해 주세요.', 409);
      const included = report.evidenceTasks.filter((task) => task.assignments.some((assignment) => assignment.userId === targetId));
      const detail = report.details[targetId];
      const evidenceTasks = included.map((task) => {
        const allocation = task.assignments.find((assignment) => assignment.userId === targetId).allocationPercent;
        const current = entry.tasks.find((item) => item.id === task.taskId);
        return { taskId: task.taskId, completedAt: task.completedAt, weightAtCutoff: task.weightAtCutoff,
          allocationAtCutoff: allocation, assignedUnits: task.weightAtCutoff * allocation / 100,
          current: current ? { availability: 'AVAILABLE', title: current.title,
            contributionDescription: current.assignees.some((assignment) => assignment.userId === targetId) ? current.contributions?.[targetId] || null : null, version: current.version, updatedAt: current.updatedAt,
            materials: entry.deliverables.filter((item) => item.taskId === task.taskId).map(({ id, title, type, version, updatedAt }) =>
              ({ id, title, type, version, updatedAt: updatedAt || current.updatedAt })) }
            : { availability: 'MISSING', title: null, contributionDescription: null, version: null, updatedAt: null, materials: [] } };
      });
      return clone({ reportId: report.id, teamId: id, userId: targetId, memberName: member.name, status: report.status,
        cutoffAt: report.cutoffAt, createdAt: report.createdAt, publishedAt: report.publishedAt, weights: report.weights, evaluatedMemberCount: report.evaluatedMemberCount, totalScore: member.totalScore, details: detail,
        workSummary: { memberUnits: evidenceTasks.reduce((sum, task) => sum + task.assignedUnits, 0),
          teamUnits: report.evidenceTasks.reduce((sum, task) => sum + task.weightAtCutoff, 0),
          taskRatioPercent: detail.taskRatioPercent, taskScore: detail.taskScore, taskWeightPercent: report.weights.taskPercent,
          taskWeightedScore: detail.taskWeightedScore }, tasks: evidenceTasks });
    }
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
        const weights = body == null ? state.reportWeights ?? defaultReportWeights : body;
        if (!validReportWeights(weights)) fail('INVALID_REQUEST', '각 반영 비율은 0~100 정수이며 합계가 100이어야 합니다.', 400);
        if (state.reportWeights && !sameReportWeights(state.reportWeights, weights))
          fail('REPORT_WEIGHTS_LOCKED', '첫 리포트 생성 시 확정한 스페이스 공통 반영 비율은 변경할 수 없습니다.');
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
        const calculated = makeReport(state, entry, 'UNPUBLISHED', weights);
        state.reportWeights = { ...weights };
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
    !Number.isFinite(apiTimeToEpoch(body.opensAt)) ||
    !Number.isFinite(apiTimeToEpoch(body.closesAt)) ||
    new Date(apiTimeToEpoch(body.opensAt)) >= new Date(apiTimeToEpoch(body.closesAt)) ||
    new Date(apiTimeToEpoch(body.closesAt)) <= new Date()
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
  if (!earliest || new Date(apiTimeToEpoch(body.opensAt)) < new Date(apiTimeToEpoch(earliest)))
    fail(
      'EVALUATION_SCHEDULE_CONFLICT',
      body.type === 'MID'
        ? '팀 빌딩 종료 이후로 설정해 주세요.'
        : '중간 평가 종료 이후로 설정해 주세요.',
    );
}
