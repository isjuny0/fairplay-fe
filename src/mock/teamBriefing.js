import { MockError } from './planned.js';
import { apiTimeToEpoch, koreanDateTime } from '../lib/koreanTime.js';

function initialChanges(entry) {
  const recentTasks = entry.tasks.filter((task) => apiTimeToEpoch(task.updatedAt) >= Date.now() - 7 * 86400000).sort((a, b) => {
    const priority = { REVISING: 0, DONE: 1, IN_PROGRESS: 2, TODO: 3 };
    return priority[a.status] - priority[b.status];
  }).slice(0, 3);
  const items = recentTasks.map((task) => {
    const type = task.status === 'DONE' ? 'TASK_COMPLETED'
      : task.status === 'REVISING' ? 'TASK_REVISING' : 'TASK_CREATED';
    const changeDescription = type === 'TASK_COMPLETED' ? '작업이 완료됐어요.' : type === 'TASK_REVISING' ? '작업이 수정 중으로 변경됐어요.' : '작업이 새로 추가됐어요.';
    const hoursRemaining = Math.ceil((apiTimeToEpoch(task.dueAt) - Date.now()) / 3600000);
    return {
      id: `task-${task.id}`, type,
      priority: task.status === 'REVISING' ? 'ATTENTION' : 'NORMAL',
      title: task.title, changeDescription,
      description: task.status !== 'DONE' && hoursRemaining > 0 && hoursRemaining <= 24 ? `마감까지 ${hoursRemaining}시간` : null,
      targetType: 'TASK', targetId: task.id, status: task.status, dueAt: task.dueAt,
      occurredAt: task.updatedAt || koreanDateTime(),
    };
  });
  for (const material of entry.deliverables.slice(0, 2)) {
    items.push({
      id: `deliverable-${material.id}`, type: 'DELIVERABLE_UPDATED', priority: 'NORMAL',
      title: material.title, changeDescription: '자료가 수정됐어요.',
      description: null,
      targetType: 'DELIVERABLE', targetId: material.id, status: null, dueAt: null,
      occurredAt: material.updatedAt || koreanDateTime(),
    });
  }
  return items.map((item, index) => ({ ...item, position: index + 1 }));
}

export function previewTeamBriefing(context, state, parts, method, body) {
  const teamId = Number(parts[2]);
  const entry = state.teams[teamId];
  if (!entry) throw new MockError('TEAM_NOT_FOUND', '팀을 찾을 수 없습니다.', 404);
  if (!entry.members.some(({ userId }) => userId === context.user.id))
    throw new MockError('FORBIDDEN', '현재 팀원만 이용할 수 있습니다.', 403);
  state.teamBriefingEvents ||= {};
  state.teamBriefingCheckpoints ||= {};
  state.teamBriefingWindows ||= {};
  state.teamBriefingItemReads ||= {};
  const key = `${teamId}:${context.user.id}`;
  const checkpoint = state.teamBriefingCheckpoints[key];
  const asOf = koreanDateTime();
  if (method === 'POST' && parts[4] === 'acknowledge') {
    const window = state.teamBriefingWindows[body?.ackToken];
    if (!window || apiTimeToEpoch(window.expiresAt) <= Date.now())
      throw new MockError('TEAM_BRIEFING_EXPIRED', '브리핑을 다시 불러와 주세요.', 410);
    if (window.userId !== context.user.id)
      throw new MockError('FORBIDDEN', '이 브리핑을 확인할 수 없습니다.', 403);
    if (window.teamId !== teamId)
      throw new MockError('TEAM_BRIEFING_SCOPE_MISMATCH', '다른 팀의 브리핑입니다.', 409);
    if (body.itemId !== undefined && body.itemId !== null) {
      if (!window.itemIds?.includes(body.itemId))
        throw new MockError('INVALID_REQUEST', '조회한 브리핑에 없는 항목입니다.', 400);
      const reads = state.teamBriefingItemReads[key] ||= {};
      reads[body.itemId] = Math.max(reads[body.itemId] || 0, window.throughPosition);
      return null;
    }
    state.teamBriefingCheckpoints[key] = {
      position: Math.max(checkpoint?.position || 0, window.throughPosition),
      lastReadAt: checkpoint?.lastReadAt > window.asOf ? checkpoint.lastReadAt : window.asOf,
    };
    return null;
  }
  if (method !== 'GET' || parts.length !== 4)
    throw new MockError('NOT_FOUND', '지원하지 않는 API입니다.', 404);
  const events = state.teamBriefingEvents[teamId] ||= initialChanges(entry);
  const items = events.filter((item) => item.position > Math.max(checkpoint?.position || 0, state.teamBriefingItemReads[key]?.[item.id] || 0)
    && (checkpoint || apiTimeToEpoch(item.occurredAt) >= Date.now() - 7 * 86400000));
  const highlights = items.slice(0, 2);
  const ackToken = items.length ? crypto.randomUUID() : null;
  if (ackToken) state.teamBriefingWindows[ackToken] = {
    userId: context.user.id, teamId, asOf, itemIds: items.map(({ id }) => id),
    throughPosition: Math.max(0, ...events.map(({ position }) => position)),
    expiresAt: koreanDateTime(Date.now() + 15 * 60 * 1000),
  };
  return {
    teamId, asOf, hasUpdates: items.length > 0, lastReadAt: checkpoint?.lastReadAt || null,
    headline: items.length ? `새로운 변경이 ${items.length}건 있어요.` : '새로운 변경 사항이 없어요.',
    totalEventCount: items.length, highlights, items, additionalCount: items.length - highlights.length, ackToken,
  };
}
