const useMockApi = import.meta.env.VITE_DASHBOARD_API_MODE !== 'api';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const wait = () => new Promise((resolve) => setTimeout(resolve, 250));

const mockDashboard = {
  summary: {
    teamCount: 3,
    averageProgress: 68,
    unassignedCount: 2,
    missingEvaluationCount: 4,
  },
  teams: [
    { id: 'team-a', name: 'A팀', memberCount: 4, progressPercent: 82, pendingApprovals: 1, missingEvaluations: 0, status: 'ON_TRACK' },
    { id: 'team-b', name: 'B팀', memberCount: 5, progressPercent: 67, pendingApprovals: 2, missingEvaluations: 1, status: 'ATTENTION' },
    { id: 'team-c', name: 'C팀', memberCount: 3, progressPercent: 54, pendingApprovals: 0, missingEvaluations: 3, status: 'ATTENTION' },
  ],
  unassignedMembers: [
    { id: 'user-1', name: '김하늘' },
    { id: 'user-2', name: '이도윤' },
  ],
  missingEvaluations: [
    { id: 'evaluation-1', teamName: 'B팀', roundName: '중간 동료 평가', members: ['최유진'] },
    { id: 'evaluation-2', teamName: 'C팀', roundName: '중간 동료 평가', members: ['정민수', '한서아', '윤지호'] },
  ],
};

async function request(path) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(result?.message || '교수 대시보드를 불러오지 못했습니다.');
    error.status = response.status;
    throw error;
  }
  return result?.data || result;
}

export async function getInstructorDashboard(spaceId) {
  if (!useMockApi) return request(`/spaces/${spaceId}/instructor-dashboard`);
  await wait();
  return structuredClone(mockDashboard);
}
