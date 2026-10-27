import { MockError } from './planned.js';
import { previewSpace } from './fixtures.js';
import { koreanDateTime } from '../lib/koreanTime.js';

const initialNotifications = (context, state) => {
  const now = Date.now();
  const evaluationRound = state.rounds.find((round) => round.type === 'FINAL')
    || state.rounds.find((round) => round.type === 'MID');
  const roundLabel = evaluationRound?.type === 'FINAL' ? '최종 평가' : '중간 평가';
  return [
    { id: 205, type: 'TASK_ASSIGNED', title: '새 작업에 배정되었습니다', message: '설문 결과 분석', spaceId: 1, teamId: 1, target: { type: 'TASK', id: 102, taskId: null }, accessible: true, createdAt: koreanDateTime(now - 3600000), readAt: null },
    { id: 204, type: 'TASK_COMMENT_CREATED', title: '작업에 댓글이 등록되었습니다', message: '서비스 흐름 설계', spaceId: 1, teamId: 1, target: { type: 'TASK_COMMENT', id: 9002, taskId: 103 }, accessible: true, createdAt: koreanDateTime(now - 7200000), readAt: null },
    ...(evaluationRound ? [{
      id: 203,
      type: 'EVALUATION_ROUND_OPENED',
      title: `${roundLabel}가 시작되었습니다`,
      message: `${context.team?.name || '삼위일체'} · ${roundLabel}`,
      spaceId: context.space.id,
      teamId: context.team?.id || 1,
      target: { type: 'EVALUATION_ROUND', id: evaluationRound.id, taskId: null },
      accessible: true,
      createdAt: koreanDateTime(now - 86400000),
      readAt: null,
    }] : []),
    { id: 202, type: null, title: '더 이상 접근할 수 없는 항목입니다', message: null, spaceId: null, teamId: null, target: null, accessible: false, createdAt: koreanDateTime(now - 172800000), readAt: koreanDateTime(now - 160000000) },
  ];
};
const notificationStore = new Map();
const storeFor = (context, state) => {
  const key = context.user.id;
  if (!notificationStore.has(key)) notificationStore.set(key, initialNotifications(context, state));
  return notificationStore.get(key);
};

export function previewPersonalWork(context, state, parts, url, method) {
  if (parts[2] === 'notifications') {
    const notifications = storeFor(context, state);
    if (parts[3] === 'unread-count' && method === 'GET')
      return { unreadCount: notifications.filter((item) => item.accessible && !item.readAt).length };
    if (parts[3] === 'read-all' && method === 'POST') {
      notifications.forEach((item) => {
        if (item.accessible && !item.readAt) item.readAt = koreanDateTime();
      });
      return null;
    }
    if (parts.length === 5 && parts[4] === 'read' && method === 'PATCH') {
      const item = notifications.find((entry) => String(entry.id) === decodeURIComponent(parts[3]));
      if (!item) throw new MockError('NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없습니다.', 404);
      item.readAt ||= koreanDateTime();
      return null;
    }
    if (parts.length === 3 && method === 'GET') {
      const filter = url.searchParams.get('filter') || 'ALL';
      const accessibleOnly = url.searchParams.get('accessibleOnly') === 'true';
      const size = Math.max(1, Math.min(100, Number(url.searchParams.get('size') || 20)));
      const cursor = url.searchParams.get('cursor');
      const offset = cursor ? Number(cursor) : 0;
      let items = notifications.filter((item) => filter !== 'UNREAD' || (item.accessible && !item.readAt));
      if (accessibleOnly) items = items.filter((item) => item.accessible);
      items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      const page = items.slice(offset, offset + size);
      return { items: structuredClone(page), nextCursor: offset + size < items.length ? String(offset + size) : null };
    }
  }
  if (parts[2] === 'tasks' && parts.length === 3 && method === 'GET') {
    if (context.manager || !context.members.some((member) => member.userId === context.user.id)) return [];
    const page = Math.max(0, Number(url.searchParams.get('page') || 0));
    const size = Math.max(1, Math.min(100, Number(url.searchParams.get('size') || 20)));
    const assigned = (context.teamContexts || []).flatMap(({ team, members }) => {
      const entry = state.teams[team.id];
      if (!entry || !members.some((member) => member.userId === context.user.id)) return [];
      return entry.tasks.filter((task) => ['TODO', 'IN_PROGRESS', 'REVISING'].includes(task.status) && task.assignees?.some((assignee) => assignee.userId === context.user.id)).map((task) => ({
        taskId: task.id, spaceId: team.spaceId, spaceName: previewSpace.name, teamId: team.id, teamName: team.name,
        title: task.title, status: task.status, startAt: task.startAt, dueAt: task.dueAt,
        isOverdue: new Date(task.dueAt) < new Date(), myAllocationPercent: task.assignees.find((assignee) => assignee.userId === context.user.id).allocationPercent,
        workRestrictionReasons: [],
      }));
    }).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.taskId - b.taskId);
    return structuredClone(assigned.slice(page * size, (page + 1) * size));
  }
  return undefined;
}
