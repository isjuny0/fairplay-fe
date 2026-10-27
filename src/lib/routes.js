export const teamMenuPaths = {
  '팀 홈': '',
  '작업': 'tasks',
  산출물: 'deliverables',
  '팀 회의록': 'meeting-minutes',
  '팀 자료 검색': 'materials-search',
  '동료 평가': 'peer-evaluations',
  '중간 피드백': 'mid-feedback',
  '기여도 리포트': 'reports',
  '팀원 관리': 'members',
  '팀 설정': 'settings',
};

export function parseRouteId(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export const spacePath = (spaceId) => `/spaces/${spaceId}`;
export const myNotificationsPath = () => '/notifications';
export const myTasksPath = () => '/my/tasks';
export const announcementsPath = (spaceId) => `${spacePath(spaceId)}/announcements`;
export const announcementPath = (spaceId, id) => `${announcementsPath(spaceId)}/${id}`;
export const teamPath = (spaceId, teamId) =>
  `${spacePath(spaceId)}/teams/${teamId}`;
export function teamMenuPath(spaceId, teamId, menu) {
  const path = teamPath(spaceId, teamId);
  const segment = teamMenuPaths[menu];
  return segment ? `${path}/${segment}` : path;
}

export function loginReturnPath(value) {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
    ? value
    : '/main';
}
