import {
  previewUsers,
  previewMembers,
  previewSpace,
  previewTeams,
} from './fixtures.js';
import {
  getMockState,
  saveMockState,
  plannedRequest,
  resetMockState,
  MockError,
  exampleEvaluation,
} from './planned.js';

export const isPreviewPath = (path) =>
  path === '/preview' || path.startsWith('/preview/');
export function previewRole() {
  return globalThis.localStorage?.getItem('fairplay:preview-role') || 'leader';
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
      isLeader: true,
      isDeputy: false,
    },
    {
      userId: '00000000-0000-4000-8000-000000000006',
      name: '윤도현',
      isLeader: false,
      isDeputy: false,
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
        role: space.myRole,
      }));
    if (parts.length === 2 && method === 'POST') {
      state.extraSpace = {
        ...body,
        id: 3,
        spaceId: 3,
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
          .map((entry) => entry.team);
      const team = {
        ...previewTeams[0],
        id: Math.max(...Object.keys(state.teams).map(Number)) + 1,
        spaceId: id,
        name: body.name,
        leaderId: context.user.id,
        approvedMemberCount: 1,
      };
      state.teams[team.id] = {
        team,
        members: [
          { userId: context.user.id, name: context.user.name, isLeader: true },
        ],
        tasks: [],
        deliverables: [],
      };
      result = team;
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
          code: 'PLAY2026',
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
      } else
        return {
          ...entry.team,
          myMembershipStatus: entry.members.some(
            (member) => member.userId === context.user.id,
          )
            ? 'APPROVED'
            : state.applications?.find(
                (item) => item.teamId === id && item.userId === context.user.id,
              )?.status || null,
          deletionPending:
            state.deletion?.teamId === id &&
            ['PENDING', 'READY'].includes(state.deletion.status),
          canCreateTask: entry.members.length >= 2 && !context.manager,
          canApply:
            context.space.teamBuildingStatus === 'OPEN' &&
            !entry.members.some(
              (member) => member.userId === context.user.id,
            ) &&
            !state.applications?.some(
              (item) =>
                item.teamId === id &&
                item.userId === context.user.id &&
                item.status === 'PENDING',
            ),
          teamBuildingStatus: context.space.teamBuildingStatus,
        };
    } else if (parts[3] === 'members' && parts[4] !== 'me')
      return entry.members;
    else if (parts[3] === 'members' && parts[4] === 'me') {
      const nextLeaderId = url.searchParams.get('nextLeaderId');
      if (entry.team.leaderId === context.user.id && nextLeaderId) {
        entry.team.leaderId = nextLeaderId;
        entry.members.forEach((member) => {
          member.isLeader = member.userId === nextLeaderId;
        });
      }
      entry.members = entry.members.filter(
        (member) => member.userId !== context.user.id,
      );
      entry.team.approvedMemberCount = entry.members.length;
      result = null;
    } else if (parts[3] === 'deputy') {
      entry.team.deputyId = body.userId;
      entry.members.forEach((member) => {
        member.isDeputy = member.userId === body.userId;
      });
      result = entry.team;
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
        canApprove: true,
        requestedAt: new Date().toISOString(),
      };
      state.applications.push(application);
      result = application;
    } else if (parts[3] === 'tasks') {
      if (method === 'GET') return entry.tasks;
      const task = {
        ...body,
        id: Math.max(0, ...entry.tasks.map((task) => task.id)) + 1,
        teamId: id,
        version: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        status: 'TODO',
        canRequestCompletion: false,
        completionBlockReason: 'INVALID_TASK_STATE',
      };
      entry.tasks.push(task);
      result = task;
    } else if (parts[3] === 'deliverables') {
      if (method === 'GET') {
        const taskId = Number(url.searchParams.get('taskId'));
        return entry.deliverables
          .filter((item) => !taskId || item.taskId === taskId)
          .slice(
            Number(url.searchParams.get('page') || 0) * 20,
            (Number(url.searchParams.get('page') || 0) + 1) * 20,
          );
      }
      let fields = body;
      if (body instanceof FormData) {
        const file = body.get('file');
        fields = Object.fromEntries(body.entries());
        delete fields.file;
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
      result = item;
    } else if (parts[3] === 'approvals') {
      const status = url.searchParams.get('status') || 'PENDING';
      return entry.tasks
        .flatMap((task) => approvalHistory(state, task))
        .filter(
          (approval) =>
            approval.reviewerId === context.user.id &&
            approval.status === status,
        );
    } else if (parts[3] === 'deletion-request')
      return (
        state.deletion ||
        missing('TEAM_DELETION_REQUEST_NOT_FOUND', '삭제 요청이 없습니다.')
      );
    else if (parts[3] === 'deletion-requests') {
      state.deletion = {
        id: 50,
        teamId: id,
        status: 'PENDING',
        version: 0,
        requestedBy: context.user.id,
        requestedAt: new Date().toISOString(),
        requiredCount: entry.members.length,
        agreedCount: 0,
        myConsented: false,
        canDelete: false,
        taskCount: entry.tasks.length,
        deliverableCount: entry.deliverables.length,
        workFrozen: true,
        members: entry.members.map((member) => ({
          ...member,
          consented: false,
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
    if (body.status === 'APPROVED') {
      const entry = state.teams[application.teamId];
      entry.members.push({
        userId: application.userId,
        name: application.name,
        isLeader: false,
        isDeputy: false,
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
    if (parts[3] === 'ai-evaluation' || parts[3] === 'rework')
      return plannedRequest(
        { ...context, team: entry.team, members: entry.members, task },
        path,
        { method, body },
      );
    if (parts.length === 3 && method === 'GET')
      return {
        task,
        contributions: task.assignees.map((assignment) => ({
          userId: assignment.userId,
          allocationPercent: assignment.allocationPercent,
          contributionDescription:
            task.contributions?.[assignment.userId] ?? null,
          contributionUpdatedAt: task.updatedAt,
        })),
        approvalStatus: task.status === 'DONE' ? 'APPROVED' : null,
      };
    if (parts[3] === 'approvals') return approvalHistory(state, task);
    if (parts[3] === 'completion-requests') {
      if (
        !entry.deliverables.some(
          (item) => item.taskId === id && ['TEXT', 'FILE'].includes(item.type),
        )
      )
        throw new MockError(
          'COMPLETION_INPUT_INCOMPLETE',
          '완료 요청 전에 연결된 TEXT 또는 지원 파일 산출물 1개 이상이 필요합니다.',
        );
      task.status = 'PENDING_APPROVAL';
      state.approvals ||= {};
      const previous = approvalHistory(state, task).filter(
        (approval) => approval.status !== 'PENDING',
      );
      state.approvals[id] = [
        {
          id: id * 1000 + previous.length + 1,
          taskId: id,
          status: 'PENDING',
          reviewerId: task.completionReviewerId,
          requesterId: context.user.id,
          requestedAt: new Date().toISOString(),
          decidedAt: null,
          reason: null,
        },
        ...previous,
      ];
      result = state.approvals[id][0];
    } else if (parts[3] === 'contribution') {
      task.contributions ||= {};
      task.contributions[context.user.id] = body.contributionDescription;
      result = task;
    } else if (parts[3] === 'completion-reviewer') {
      task.completionReviewerId = body.reviewerId;
      result = task;
    } else if (method === 'DELETE') {
      entry.tasks = entry.tasks.filter((item) => item.id !== id);
      result = null;
    } else {
      if (body.expectedVersion !== task.version)
        throw new MockError(
          'VERSION_CONFLICT',
          '다른 사용자가 먼저 작업을 수정했습니다.',
          409,
        );
      Object.assign(task, body);
      task.canRequestCompletion = task.status === 'IN_PROGRESS';
      task.completionBlockReason = task.canRequestCompletion
        ? null
        : 'INVALID_TASK_STATE';
      result = task;
    }
    task.version++;
    task.updatedAt = new Date().toISOString();
  } else if (parts[1] === 'approvals') {
    const task = Object.values(state.teams)
      .flatMap((entry) => entry.tasks)
      .find((task) =>
        approvalHistory(state, task).some((approval) => approval.id === id),
      );
    if (!task) missing('APPROVAL_NOT_FOUND', '승인 요청이 없습니다.');
    const history = approvalHistory(state, task);
    const approval = history.find((approval) => approval.id === id);
    approval.status = parts[3] === 'approve' ? 'APPROVED' : 'REJECTED';
    approval.reason = body.reason || null;
    approval.decidedAt = new Date().toISOString();
    task.status = approval.status === 'APPROVED' ? 'DONE' : 'IN_PROGRESS';
    if (approval.status === 'APPROVED')
      state.ai[task.id] = exampleEvaluation(task, approval.id, {
        successful: true,
      });
    task.version++;
    state.approvals ||= {};
    state.approvals[task.id] = history;
    result = approval;
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
      member.consented = body.agree;
      member.decision = body.agree ? 'AGREED' : 'REJECTED';
      member.consentedAt = new Date().toISOString();
    }
    if (!body.agree) {
      deletion.status = 'CANCELLED';
      deletion.workFrozen = false;
    }
    deletion.agreedCount = deletion.members.filter(
      (member) => member.consented,
    ).length;
    deletion.myConsented = body.agree;
    if (deletion.agreedCount === deletion.requiredCount)
      deletion.status = 'READY';
    deletion.canDelete = deletion.agreedCount === deletion.requiredCount;
    deletion.version++;
    result = deletion;
  } else return plannedRequest(context, path, { method, body });
  saveMockState(context, state);
  return structuredClone(result);
}
function approvalHistory(state, task) {
  if (state.approvals?.[task.id]) return state.approvals[task.id];
  return ['PENDING_APPROVAL', 'DONE'].includes(task.status)
    ? [
        {
          id: task.id,
          taskId: task.id,
          status: task.status === 'DONE' ? 'APPROVED' : 'PENDING',
          reviewerId: task.completionReviewerId,
          requesterId: task.assignees[0].userId,
          requestedAt: task.updatedAt,
          decidedAt: task.status === 'DONE' ? task.updatedAt : null,
          reason: null,
        },
      ]
    : [];
}
