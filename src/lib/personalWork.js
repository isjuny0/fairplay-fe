import { teamMenuPath } from './routes.js';

export const notificationTypeLabels = {
  TASK_ASSIGNED: '작업 배정', TASK_UPDATED: '작업 변경', TASK_UNASSIGNED: '작업 배정 해제',
  TASK_COMMENT_CREATED: '새 댓글', EVALUATION_ROUND_OPENED: '평가 시작',
  EVALUATION_DEADLINE_APPROACHING: '평가 마감 안내', CONTRIBUTION_REPORT_PUBLISHED: '리포트 공개',
  TEAM_APPLICATION_APPROVED: '팀 가입 승인', TEAM_APPLICATION_REJECTED: '팀 가입 결과',
};

export const restrictionLabels = {
  TEAM_DELETION_IN_PROGRESS: '팀 삭제 절차가 진행 중입니다.',
  TASK_WORK_CLOSED: '최종 평가 마감 후 작업이 제한됩니다.',
  INSUFFICIENT_TEAM_MEMBERS: '승인된 팀원이 부족해 작업이 제한됩니다.',
};

export function notificationPath(notification) {
  if (!notification?.accessible || !notification.target || !notification.spaceId) return null;
  const { target, spaceId, teamId } = notification;
  const safeId = (value) => value != null && /^\d+$/.test(String(value)) ? String(value) : null;
  const space = safeId(spaceId);
  const team = safeId(teamId);
  const id = safeId(target.id);
  if (!space || !id) return null;
  if (target.type === 'TASK' && team)
    return `${teamMenuPath(space, team, '작업')}/${id}`;
  if (target.type === 'TASK_COMMENT' && team && safeId(target.taskId))
    return `${teamMenuPath(space, team, '작업')}/${safeId(target.taskId)}`;
  if (target.type === 'EVALUATION_ROUND' && team)
    return `${teamMenuPath(space, team, '동료 평가')}?roundId=${id}`;
  if (target.type === 'CONTRIBUTION_REPORT' && team)
    return teamMenuPath(space, team, '기여도 리포트');
  if (target.type === 'TEAM_APPLICATION') return `/spaces/${space}`;
  return null;
}

export function announceNotificationChange() {
  globalThis.window?.dispatchEvent(new Event('fairplay:notifications-changed'));
}
