import { isMutable } from '../lib/domain.js';
import { searchPreviewDeliverables } from './deliverableSearch.js';
import { previewAiReview, invalidateReview } from './aiReviews.js';
import {
  previewUsers,
  previewMembers,
  previewSpace,
  previewTeams,
} from './fixtures.js';
import {
  getMockState,
  requireWorkBeforeFinalDeadline,
  saveMockState,
  plannedRequest,
  resetMockState,
  MockError,
} from './planned.js';

export { isPreviewPath } from '../lib/previewPath.js';
export function previewRole() {
  const storedRole = globalThis.localStorage?.getItem('fairplay:preview-role');
  return Object.hasOwn(previewUsers, storedRole) ? storedRole : 'leader';
}
export function getPreviewUser() {
  return previewUsers[previewRole()] || previewUsers.leader;
}
export function setPreviewRole(role) {
  globalThis.localStorage?.setItem('fairplay:preview-role', role);
}
export function previewContext() {
  const user = getPreviewUser();
  const secondMembers = [
    {
      userId: previewTeams[1].leaderId,
      name: '최유진',
      role: 'LEADER',
    },
    {
      userId: '00000000-0000-4000-8000-000000000006',
      name: '윤도현',
      role: 'MEMBER',
    },
  ];
  return {
    preview: true,
    user,
    manager: previewRole() === 'manager',
    space: {
      ...previewSpace,
      myRole: previewRole() === 'manager' ? 'MANAGER' : 'USER',
    },
    team: previewTeams[0],
    members: previewMembers,
    teamContexts: [
      { team: previewTeams[0], members: previewMembers },
      { team: previewTeams[1], members: secondMembers },
    ],
  };
}
export function resetPreview(scenario) {
  resetMockState(previewContext(), scenario);
}
const missing = (code, message) => {
  throw new MockError(code, message, 404);
};
const fileContents = new Map();

function teamDetail(entry, context, state) {
  const membership = entry.members.some(
    (member) => member.userId === context.user.id,
  )
    ? 'APPROVED'
    : state.applications?.find(
        (item) =>
          item.teamId === entry.team.id && item.userId === context.user.id,
      )?.status || null;
  return {
    id: entry.team.id,
    spaceId: entry.team.spaceId,
    name: entry.team.name,
    leaderId: entry.team.leaderId,
    createdAt: entry.team.createdAt,
    myMembershipStatus: membership,
    approvedMemberCount: entry.members.length,
    teamBuildingStatus: context.space.teamBuildingStatus,
    canApply:
      context.space.teamBuildingStatus === 'OPEN' &&
      (membership === null || membership === 'REJECTED') &&
      !Object.values(state.teams).some((team) =>
        team.members.some((member) => member.userId === context.user.id),
      ),
    canCreateTask: membership === 'APPROVED' && entry.members.length >= 2,
  };
}

function previewTaskResponse(state, context, entry, task) {
  let completionBlockReason = null;
  const finalRound = state.rounds.find((round) => round.type === 'FINAL');
  if (
    !task.assignees.some((assignment) => assignment.userId === context.user.id)
  )
    completionBlockReason = 'NOT_ASSIGNEE';
  else if (
    finalRound &&
    finalRound.status !== 'DRAFT' &&
    new Date(finalRound.closesAt) <= new Date()
  )
    completionBlockReason = 'WORK_PERIOD_CLOSED';
  else if (!['IN_PROGRESS', 'REVISING'].includes(task.status))
    completionBlockReason = 'INVALID_TASK_STATE';
  else if (entry.members.length < 2)
    completionBlockReason = 'INSUFFICIENT_TEAM_MEMBERS';
  else if (
    task.assignees.some(
      (assignment) => !task.contributions?.[assignment.userId]?.trim(),
    )
  )
    completionBlockReason = 'CONTRIBUTION_DESCRIPTION_REQUIRED';
  else if (!entry.deliverables.some((item) => item.taskId === task.id))
    completionBlockReason = 'DELIVERABLE_REQUIRED';
  return { ...task, completionBlockReason };
}

export async function previewRequest(
  path,
  { method = 'GET', body = {}, responseType } = {},
) {
  const context = previewContext();
  const state = getMockState(context);
  Object.assign(context.space, state.spaceOverrides || {});
  const url = new URL(path, 'https://preview.local');
  const parts = url.pathname.split('/').filter(Boolean);
  const id = Number(parts[2]);
  if (
    method !== 'GET' &&
    (['tasks', 'deliverables'].includes(parts[1]) ||
      (parts[1] === 'teams' && ['tasks', 'deliverables'].includes(parts[3])))
  ) {
    requireWorkBeforeFinalDeadline(state);
  }
  if (
    (parts[1] === 'spaces' &&
      ['evaluation-rounds', 'manager-dashboard'].includes(parts[3])) ||
    parts[1] === 'evaluation-rounds' ||
    (parts[1] === 'teams' &&
      (['my-work-summary', 'mid-feedback'].includes(parts[3]) ||
        (parts[3] === 'members' && parts[5] === 'contributions')))
  ) {
    const entry =
      parts[1] === 'teams'
        ? state.teams[id]
        : Object.values(state.teams).find((entry) =>
            entry.members.some((member) => member.userId === context.user.id),
          );
    return plannedRequest(
      {
        ...context,
        ...(entry ? { team: entry.team, members: entry.members } : {}),
      },
      path,
      { method, body },
    );
  }
  let result;
  if (path === '/api/me') return context.user;
  if (path === '/api/auth/csrf')
    return { headerName: 'X-CSRF-TOKEN', token: 'preview-only' };
  if (path === '/api/auth/logout') return null;
  if (parts[1] === 'spaces') {
    if (parts.length === 2 && method === 'GET')
      return [
        context.space,
        ...(state.extraSpace ? [state.extraSpace] : []),
      ].map((space) => ({
        ...space,
        myRole: space.myRole,
      }));
    if (parts.length === 2 && method === 'POST') {
      state.extraSpace = {
        ...body,
        id: 3,
        myRole: 'MANAGER',
        teamBuildingStatus: 'NOT_CONFIGURED',
        version: 0,
      };
      result = state.extraSpace;
    } else if (parts[2] === 'join') result = context.space;
    else if (parts.length === 3)
      return id === 1
        ? context.space
        : state.extraSpace ||
            missing('SPACE_NOT_FOUND', '스페이스가 없습니다.');
    else if (parts[3] === 'teams') {
      if (method === 'GET')
        return Object.values(state.teams)
          .filter((entry) => entry.team.spaceId === id)
          .map((entry) => teamDetail(entry, context, state));
      const team = {
        ...previewTeams[0],
        id: Math.max(...Object.keys(state.teams).map(Number)) + 1,
        spaceId: id,
        name: body.name,
        createdAt: new Date().toISOString(),
        leaderId: context.user.id,
        approvedMemberCount: 1,
      };
      state.teams[team.id] = {
        team,
        members: [
          { userId: context.user.id, name: context.user.name, role: 'LEADER' },
        ],
        tasks: [],
        deliverables: [],
      };
      result = teamDetail(state.teams[team.id], context, state);
    } else if (parts[3] === 'join-code') {
      if (method === 'GET')
        return (
          state.joinCode ||
          missing('JOIN_CODE_NOT_FOUND', '유효한 참여 코드가 없습니다.')
        );
      if (parts[4] === 'revoke') {
        state.joinCode = null;
        result = null;
      } else {
        state.joinCode = {
          spaceId: id,
          code: crypto
            .randomUUID()
            .replaceAll('-', '')
            .slice(0, 8)
            .toUpperCase(),
          createdAt: new Date().toISOString(),
          expiresAt: new Date(
            Date.now() + (body.expirationMinutes || 1440) * 60000,
          ).toISOString(),
        };
        result = state.joinCode;
      }
    } else if (parts[3] === 'team-building-period') {
      state.spaceOverrides = { ...body, version: context.space.version + 1 };
      result = { ...context.space, ...state.spaceOverrides };
    } else return plannedRequest(context, path, { method, body });
  } else if (parts[1] === 'teams') {
    const entry =
      state.teams[id] || missing('TEAM_NOT_FOUND', '팀이 없습니다.');
    if (parts.length === 3) {
      if (method === 'DELETE') {
        delete state.teams[id];
        result = null;
      } else return teamDetail(entry, context, state);
    } else if (parts[3] === 'members' && parts[4] !== 'me')
      return entry.members;
    else if (parts[3] === 'members' && parts[4] === 'me') {
      const nextLeaderId = url.searchParams.get('nextLeaderId');
      if (entry.team.leaderId === context.user.id && nextLeaderId) {
        entry.team.leaderId = nextLeaderId;
        entry.members.forEach((member) => {
          member.role = member.userId === nextLeaderId ? 'LEADER' : 'MEMBER';
        });
      }
      entry.members = entry.members.filter(
        (member) => member.userId !== context.user.id,
      );
      entry.team.approvedMemberCount = entry.members.length;
      result = null;
    } else if (parts[3] === 'applications') {
      state.applications ||= [];
      if (method === 'GET')
        return state.applications.filter(
          (item) => item.teamId === id && item.status === 'PENDING',
        );
      const application = {
        id: 800 + state.applications.length,
        teamId: id,
        userId: context.user.id,
        name: context.user.name,
        status: 'PENDING',
        canApprove: false,
        decidedAt: null,
        requestedAt: new Date().toISOString(),
      };
      state.applications.push(application);
      result = application;
    } else if (parts[3] === 'tasks') {
      if (method === 'GET')
        return entry.tasks.map((task) =>
          previewTaskResponse(state, context, entry, task),
        );
      if (
        !body.startAt ||
        !Number.isFinite(Date.parse(body.startAt)) ||
        new Date(body.startAt) > new Date(body.dueAt)
      )
        throw new MockError(
          'INVALID_REQUEST',
          '시작일과 마감을 확인해 주세요.',
          400,
        );
      const task = {
        ...body,
        id: Math.max(0, ...entry.tasks.map((task) => task.id)) + 1,
        teamId: id,
        version: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        status: 'TODO',
        completedAt: null,
        completionBlockReason: 'INVALID_TASK_STATE',
      };
      entry.tasks.push(task);
      result = task;
    } else if (parts[3] === 'deliverables') {
      if (method === 'GET') {
        return searchPreviewDeliverables(entry.deliverables, url.searchParams);
      }
      let fields = { ...body, type: 'TEXT' };
      if (body instanceof FormData) {
        const file = body.get('file');
        fields = JSON.parse(await body.get('metadata').text());
        fields = {
          ...fields,
          type: 'FILE',
          taskId: fields.taskId ? Number(fields.taskId) : null,
          file: {
            originalFilename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          },
        };
      }
      const item = {
        ...fields,
        id: id * 1000 + entry.deliverables.length + 10,
        teamId: id,
        authorId: context.user.id,
        version: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (body instanceof FormData) fileContents.set(item.id, body.get('file'));
      entry.deliverables.push(item);
      invalidateReview(state, item.taskId);
      result = item;
    } else if (parts[3] === 'deletion-request') {
      const deletion =
        state.deletion ||
        missing('TEAM_DELETION_REQUEST_NOT_FOUND', '삭제 요청이 없습니다.');
      return {
        ...deletion,
        canDelete:
          deletion.status === 'READY' &&
          entry.team.leaderId === context.user.id &&
          !context.space.membershipLockedAt,
      };
    } else if (parts[3] === 'deletion-requests') {
      state.deletion = {
        id: 50,
        teamId: id,
        status: 'PENDING',
        version: 0,
        requestedBy: context.user.id,
        requestedAt: new Date().toISOString(),
        canDelete: false,
        taskCount: entry.tasks.length,
        deliverableCount: entry.deliverables.length,
        workFrozen: true,
        members: entry.members.map((member) => ({
          ...member,
          consentedAt: null,
          decision: 'UNANSWERED',
        })),
      };
      result = state.deletion;
    } else
      return plannedRequest(
        { ...context, team: entry.team, members: entry.members },
        path,
        { method, body },
      );
  } else if (parts[1] === 'team-applications') {
    const application =
      state.applications?.find((item) => item.id === id) ||
      missing('TEAM_APPLICATION_NOT_FOUND', '가입 신청이 없습니다.');
    application.status = body.status;
    application.decidedAt = new Date().toISOString();
    application.canApprove = false;
    if (body.status === 'APPROVED') {
      const entry = state.teams[application.teamId];
      entry.members.push({
        userId: application.userId,
        name: application.name,
        role: 'MEMBER',
      });
      entry.team.approvedMemberCount = entry.members.length;
    }
    result = application;
  } else if (parts[1] === 'tasks') {
    const entry = Object.values(state.teams).find((entry) =>
      entry.tasks.some((task) => task.id === id),
    );
    const task =
      entry?.tasks.find((task) => task.id === id) ||
      missing('TASK_NOT_FOUND', '작업이 없습니다.');
    if (parts.length > 3 && !['ai-review', 'contribution'].includes(parts[3]))
      throw new MockError('NOT_FOUND', '지원하지 않는 API입니다.', 404);
    if (parts[3] === 'ai-review') {
      const review = previewAiReview(state, context, entry, task, method);
      saveMockState(context, state);
      return structuredClone(review);
    }
    if (parts.length === 3 && method === 'GET')
      return {
        task: previewTaskResponse(state, context, entry, task),
        deliverableSummary: entry.deliverables
          .filter((item) => item.taskId === id)
          .map(({ id, title, category, type, version }) => ({
            id,
            title,
            category,
            type,
            version,
          })),
        contributions: task.assignees.map((assignment) => ({
          userId: assignment.userId,
          allocationPercent: assignment.allocationPercent,
          contributionDescription:
            task.contributions?.[assignment.userId] ?? null,
          contributionUpdatedAt: task.updatedAt,
        })),
      };
    const assigned = task.assignees.some(
      (assignment) => assignment.userId === context.user.id,
    );
    const isMember = entry.members.some(
      (member) => member.userId === context.user.id,
    );
    const leader = entry.team.leaderId === context.user.id;
    if (!isMember)
      throw new MockError(
        'FORBIDDEN',
        '팀원만 작업을 변경할 수 있습니다.',
        403,
      );
    if (parts[3] === 'contribution' || body.status != null) {
      if (!assigned)
        throw new MockError(
          'FORBIDDEN',
          '현재 담당자만 처리할 수 있습니다.',
          403,
        );
    } else if (!assigned && !leader)
      throw new MockError(
        'FORBIDDEN',
        '담당자 또는 리더만 수정할 수 있습니다.',
        403,
      );
    if (
      body.expectedVersion !== undefined &&
      body.expectedVersion !== task.version
    )
      throw new MockError(
        'VERSION_CONFLICT',
        '최신 작업을 다시 확인해 주세요.',
      );
    if (state.deletion?.workFrozen)
      throw new MockError(
        'TEAM_DELETION_IN_PROGRESS',
        '팀 삭제 동의 중입니다.',
      );
    if (method !== 'DELETE' && entry.members.length < 2)
      throw new MockError(
        'INSUFFICIENT_TEAM_MEMBERS',
        '팀원이 2명 이상이어야 합니다.',
      );
    if (parts[3] === 'contribution') {
      if (!isMutable(task))
        throw new MockError(
          'TASK_LOCKED',
          '수정 중으로 전환한 뒤 변경해 주세요.',
        );
      const description = body.contributionDescription?.trim() || null;
      if (description && (description.length < 10 || description.length > 1000))
        throw new MockError(
          'INVALID_REQUEST',
          '수행 설명은 10~1000자로 작성해 주세요.',
          400,
        );
      task.contributions ||= {};
      task.contributions[context.user.id] = description;
    } else if (method === 'DELETE') {
      if (!leader)
        throw new MockError('FORBIDDEN', '리더만 삭제할 수 있습니다.', 403);
      if (!isMutable(task))
        throw new MockError(
          'TASK_LOCKED',
          '완료된 작업은 수정 중으로 전환해 주세요.',
        );
      entry.tasks = entry.tasks.filter((item) => item.id !== id);
      entry.deliverables = entry.deliverables.filter(
        (item) => item.taskId !== id,
      );
      saveMockState(context, state);
      return null;
    } else {
      const { expectedVersion, ...changes } = body;
      const changesDetails = Object.keys(changes).some(
        (key) => key !== 'status',
      );
      const transitions = {
        TODO: ['TODO', 'IN_PROGRESS'],
        IN_PROGRESS: ['IN_PROGRESS', 'TODO', 'DONE'],
        REVISING: ['REVISING', 'DONE'],
        DONE: ['REVISING'],
      };
      if (
        body.status != null &&
        (!transitions[task.status].includes(body.status) ||
          ((body.status === 'DONE' || task.status === 'DONE') &&
            changesDetails))
      )
        throw new MockError(
          'INVALID_REQUEST',
          '허용되지 않은 작업 상태 변경입니다.',
          400,
        );
      if (body.status == null && !isMutable(task))
        throw new MockError(
          'TASK_LOCKED',
          '수정 중으로 전환한 뒤 변경해 주세요.',
        );
      if (body.status === 'DONE') {
        const reason = previewTaskResponse(
          state,
          context,
          entry,
          task,
        ).completionBlockReason;
        if (reason)
          throw new MockError(
            reason,
            reason === 'CONTRIBUTION_DESCRIPTION_REQUIRED'
              ? '담당자 전원의 수행 설명이 필요합니다.'
              : '작업에 연결된 산출물이 필요합니다.',
          );
      }
      const startAt = body.startAt ?? task.startAt;
      const dueAt = body.dueAt ?? task.dueAt;
      if (
        (Object.hasOwn(body, 'startAt') &&
          (!body.startAt || !Number.isFinite(Date.parse(body.startAt)))) ||
        new Date(startAt) > new Date(dueAt)
      )
        throw new MockError(
          'INVALID_REQUEST',
          '시작일과 마감을 확인해 주세요.',
          400,
        );
      if (
        (body.title != null && body.title !== task.title) ||
        (body.description != null && body.description !== task.description)
      )
        invalidateReview(state, task.id);
      Object.assign(task, changes);
      task.completedAt =
        task.status === 'DONE' ? new Date().toISOString() : null;
    }
    task.version++;
    task.updatedAt = new Date().toISOString();
    result = previewTaskResponse(state, context, entry, task);
  } else if (parts[1] === 'deliverables') {
    const entry = Object.values(state.teams).find((entry) =>
      entry.deliverables.some((item) => item.id === id),
    );
    const item =
      entry?.deliverables.find((item) => item.id === id) ||
      missing('DELIVERABLE_NOT_FOUND', '산출물이 없습니다.');
    if (responseType === 'blob')
      return (
        fileContents.get(id) ||
        new Blob(['미리보기 산출물입니다.'], { type: 'text/plain' })
      );
    if (method === 'DELETE') {
      invalidateReview(state, item.taskId);
      entry.deliverables = entry.deliverables.filter(
        (deliverable) => deliverable.id !== id,
      );
      result = null;
    } else {
      const metadata =
        body instanceof FormData
          ? JSON.parse(await body.get('metadata').text())
          : body;
      if (metadata.expectedVersion !== item.version)
        throw new MockError(
          'VERSION_CONFLICT',
          '다른 사용자가 먼저 산출물을 수정했습니다.',
          409,
        );
      if (
        body instanceof FormData ||
        (metadata.text != null && metadata.text !== item.text)
      )
        invalidateReview(state, item.taskId);
      if (body instanceof FormData) {
        Object.assign(item, metadata);
        const file = body.get('file');
        item.file = {
          originalFilename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        };
        fileContents.set(id, file);
      } else Object.assign(item, metadata);
      item.version++;
      item.updatedAt = new Date().toISOString();
      result = item;
    }
  } else if (parts[1] === 'team-deletion-requests') {
    const deletion = state.deletion;
    if (!deletion)
      missing('TEAM_DELETION_REQUEST_NOT_FOUND', '삭제 요청이 없습니다.');
    const member = deletion.members.find(
      (member) => member.userId === context.user.id,
    );
    if (member) {
      member.decision = body.agree ? 'AGREED' : 'REJECTED';
      member.consentedAt = body.agree ? new Date().toISOString() : null;
    }
    if (!body.agree) {
      deletion.status = 'CANCELLED';
      deletion.workFrozen = false;
    }
    const agreedCount = deletion.members.filter(
      (member) => member.decision === 'AGREED',
    ).length;
    if (agreedCount === deletion.members.length) deletion.status = 'READY';
    deletion.canDelete =
      deletion.status === 'READY' &&
      state.teams[deletion.teamId].team.leaderId === context.user.id &&
      !context.space.membershipLockedAt;
    deletion.version++;
    result = deletion;
  } else return plannedRequest(context, path, { method, body });
  saveMockState(context, state);
  return structuredClone(result);
}
