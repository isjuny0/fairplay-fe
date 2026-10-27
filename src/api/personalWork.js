import { apiRequest } from './client.js';

export async function listMyNotifications({
  filter = 'ALL',
  accessibleOnly = false,
  size = 20,
  cursor,
} = {}) {
  const query = new URLSearchParams({ filter, accessibleOnly, size });
  if (cursor) query.set('cursor', cursor);
  const page = await apiRequest(`/api/me/notifications?${query}`);
  if (!page || !Array.isArray(page.items) ||
    !(page.nextCursor === null || typeof page.nextCursor === 'string'))
    throw new Error('알림 목록 응답 형식을 확인해 주세요.');
  return page;
}

export async function getMyNotificationUnreadCount() {
  const result = await apiRequest('/api/me/notifications/unread-count');
  if (!Number.isInteger(result?.unreadCount) || result.unreadCount < 0)
    throw new Error('읽지 않은 알림 응답 형식을 확인해 주세요.');
  return result.unreadCount;
}

export const markNotificationRead = (id) =>
  apiRequest(`/api/me/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });

export const markAllNotificationsRead = () =>
  apiRequest('/api/me/notifications/read-all', { method: 'POST' });

export async function listMyTasks(page = 0, size = 20) {
  const items = await apiRequest(
    `/api/me/tasks?${new URLSearchParams({ page, size })}`,
  );
  if (!Array.isArray(items))
    throw new Error('내 할 일 목록 응답 형식을 확인해 주세요.');
  return items;
}

export async function listMyTodos(page = 0, size = 20) {
  const items = await apiRequest(
    `/api/me/todos?${new URLSearchParams({ page, size })}`,
  );
  if (!Array.isArray(items) || items.some((item) =>
    !['TASK', 'PEER_EVALUATION'].includes(item?.type) ||
    !Number.isInteger(item.id) || !Number.isInteger(item.spaceId) ||
    !Number.isInteger(item.teamId) || typeof item.title !== 'string' ||
    typeof item.dueAt !== 'string' || typeof item.isOverdue !== 'boolean' ||
    (item.type === 'TASK' ? !item.task || item.evaluation !== null : !item.evaluation || item.task !== null)
  ))
    throw new Error('내 할 일 목록 응답 형식을 확인해 주세요.');
  return items;
}
