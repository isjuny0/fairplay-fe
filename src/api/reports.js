const useMockApi = import.meta.env.VITE_REPORT_API_MODE !== 'api';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const wait = () => new Promise((resolve) => setTimeout(resolve, 250));

const policy = {
  version: 'MVP-2026.09',
  label: 'AI 작업 70% + 중간 평가 10% + 최종 평가 20%',
  weights: { ai: 70, mid: 10, final: 20 },
};

let mockReports = [
  {
    id: 'report-team-a', teamId: 'team-a', teamName: 'A팀', status: 'DRAFT', totalPercent: 100,
    policy, generatedAt: '2026-09-28T10:00:00+09:00', publishedAt: null,
    completeness: { ai: { completed: 12, total: 12 }, mid: { completed: 4, total: 4 }, final: { completed: 4, total: 4 } },
    blockingReasons: [], excludedComponents: [],
    members: [
      { id: 'a-1', name: '박선우', contributionPercent: 32.5, ai: 22.8, mid: 3.2, final: 6.5, evidence: ['승인된 작업 5건', 'AI 작업 로그 12건 반영'] },
      { id: 'a-2', name: '김준영', contributionPercent: 27.5, ai: 19.2, mid: 2.8, final: 5.5, evidence: ['승인된 작업 4건', 'AI 작업 로그 10건 반영'] },
      { id: 'a-3', name: '김영진', contributionPercent: 22, ai: 15.4, mid: 2.2, final: 4.4, evidence: ['승인된 작업 3건', 'AI 작업 로그 8건 반영'] },
      { id: 'a-4', name: '염승혜', contributionPercent: 18, ai: 12.6, mid: 1.8, final: 3.6, evidence: ['승인된 작업 2건', 'AI 작업 로그 6건 반영'] },
    ],
  },
  {
    id: 'report-team-b', teamId: 'team-b', teamName: 'B팀', status: 'PUBLISHED', totalPercent: 100,
    policy, generatedAt: '2026-09-27T14:20:00+09:00', publishedAt: '2026-09-28T15:30:00+09:00',
    completeness: { ai: { completed: 11, total: 11 }, mid: { completed: 4, total: 4 }, final: { completed: 4, total: 4 } },
    blockingReasons: [], excludedComponents: [], viewerMemberId: 'b-1',
    members: [
      { id: 'b-1', name: '서범주', contributionPercent: 30, ai: 21, mid: 3, final: 6, evidence: ['승인된 작업 5건', 'AI 작업 로그 11건 반영'] },
      { id: 'b-2', name: '노신비', contributionPercent: 26, ai: 18.2, mid: 2.6, final: 5.2, evidence: ['승인된 작업 4건', 'AI 작업 로그 9건 반영'] },
      { id: 'b-3', name: '정승민', contributionPercent: 24, ai: 16.8, mid: 2.4, final: 4.8, evidence: ['승인된 작업 3건', 'AI 작업 로그 8건 반영'] },
      { id: 'b-4', name: '안수경', contributionPercent: 20, ai: 14, mid: 2, final: 4, evidence: ['승인된 작업 3건', 'AI 작업 로그 7건 반영'] },
    ],
  },
  {
    id: 'report-team-c', teamId: 'team-c', teamName: 'C팀', status: 'INSUFFICIENT_DATA', totalPercent: null,
    policy, generatedAt: '2026-09-28T11:10:00+09:00', publishedAt: null,
    completeness: { ai: { completed: 9, total: 9 }, mid: { completed: 4, total: 4 }, final: { completed: 3, total: 4 } },
    blockingReasons: ['최종 동료 평가 미제출 1명'],
    excludedComponents: ['최종 평가 결과는 입력 완료 전까지 계산에서 제외됩니다.'],
    members: [
      { id: 'c-1', name: '정규도', contributionPercent: null, ai: 19.9, mid: 2.8, final: null, evidence: [] },
      { id: 'c-2', name: '박기재', contributionPercent: null, ai: 18.3, mid: 2.6, final: null, evidence: [] },
      { id: 'c-3', name: '정채원', contributionPercent: null, ai: 16.8, mid: 2.4, final: null, evidence: [] },
      { id: 'c-4', name: '강지원', contributionPercent: null, ai: 15, mid: 2.2, final: null, evidence: [] },
    ],
  },
];

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(result?.message || '리포트를 불러오지 못했습니다.');
    error.status = response.status;
    throw error;
  }
  return result?.data || result;
}

export async function getReportDraft(spaceId) {
  if (!useMockApi) return request(`/spaces/${spaceId}/reports/draft`, { method: 'POST' });
  await wait();
  return { spaceId, reports: structuredClone(mockReports) };
}

export async function publishReport(reportId) {
  if (!useMockApi) return request(`/reports/${reportId}/publish`, { method: 'POST' });
  await wait();
  const report = mockReports.find((item) => item.id === reportId);
  if (!report) throw new Error('공개할 리포트를 찾을 수 없습니다.');
  const complete = Object.values(report.completeness).every((item) => item.completed === item.total);
  if (report.status !== 'DRAFT' || !complete || report.totalPercent !== 100 || report.blockingReasons.length > 0) {
    throw new Error('공개 조건을 충족하지 않은 리포트입니다.');
  }
  mockReports = mockReports.map((item) => item.id === reportId
    ? { ...item, status: 'PUBLISHED', publishedAt: new Date().toISOString() }
    : item);
  return structuredClone(mockReports.find((item) => item.id === reportId));
}

export async function getPublishedTeamReport({ reportId, teamId }) {
  if (!useMockApi) return reportId ? request(`/reports/${reportId}`) : null;
  await wait();
  const report = mockReports.find((item) => item.teamId === teamId && item.status === 'PUBLISHED');
  return report ? structuredClone(report) : null;
}
