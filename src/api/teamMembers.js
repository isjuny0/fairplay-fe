const STORAGE_KEY = 'fairplay-team-members';
const useMockApi = import.meta.env.VITE_TEAM_MEMBER_API_MODE !== 'api';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const wait = () => new Promise((resolve) => setTimeout(resolve, 250));

const sampleMembers = [
  { userId: 'local-user', name: '박선우', role: 'LEADER', joinedAt: '2026-09-01T09:00:00Z' },
  { userId: 'member-kjy', name: '김준영', role: 'DEPUTY', joinedAt: '2026-09-01T09:10:00Z' },
  { userId: 'member-kyj', name: '김영진', role: 'MEMBER', joinedAt: '2026-09-01T09:20:00Z' },
  { userId: 'member-ysh', name: '염승혜', role: 'MEMBER', joinedAt: '2026-09-01T09:30:00Z' },
];

const sampleApplications = [
  { id: 'application-jsm', userId: 'member-jsm', name: '정승민', status: 'PENDING', requestedAt: '2026-09-28T08:30:00Z' },
  { id: 'application-nsb', userId: 'member-nsb', name: '노신비', status: 'PENDING', requestedAt: '2026-09-28T10:20:00Z' },
];

function readMockData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveMockData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getMockTeam(teamId) {
  const data = readMockData();
  if (!data[teamId]) {
    data[teamId] = {
      members: sampleMembers.map((member) => ({ ...member })),
      applications: sampleApplications.map((application) => ({ ...application })),
    };
    saveMockData(data);
  }
  return { data, team: data[teamId] };
}

function asList(result) {
  if (Array.isArray(result)) return result;
  return result?.content || result?.items || result?.data || [];
}

function normalizeRole(role) {
  const normalizedRole = String(role || 'MEMBER').toUpperCase();
  if (['LEADER', 'TEAM_LEADER'].includes(normalizedRole)) return 'LEADER';
  if (['DEPUTY', 'DEPUTY_LEADER', 'SUB_LEADER'].includes(normalizedRole)) return 'DEPUTY';
  return 'MEMBER';
}

function normalizeMember(member) {
  return {
    ...member,
    userId: member.userId || member.user?.id || member.id,
    name: member.name || member.user?.name || member.userName || '이름 없음',
    role: normalizeRole(member.role || member.teamRole),
    joinedAt: member.joinedAt || member.createdAt,
  };
}

function normalizeApplication(application) {
  return {
    ...application,
    id: application.id || application.applicationId,
    userId: application.userId || application.user?.id,
    name: application.name || application.user?.name || application.userName || '이름 없음',
    status: String(application.status || 'PENDING').toUpperCase(),
    requestedAt: application.requestedAt || application.createdAt,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || '팀원 정보를 처리하지 못했습니다.');
  return result;
}

export async function getTeamMembers({ teamId, viewerRole = 'MEMBER' }) {
  if (!teamId) return null;
  if (!useMockApi) {
    const [membersResult, applicationsResult] = await Promise.all([
      request(`/teams/${teamId}/members`),
      request(`/teams/${teamId}/applications`),
    ]);
    return {
      teamId,
      viewerRole,
      members: asList(membersResult).map(normalizeMember),
      applications: asList(applicationsResult).map(normalizeApplication).filter((application) => application.status === 'PENDING'),
    };
  }

  await wait();
  const { team } = getMockTeam(teamId);
  return {
    teamId,
    viewerRole,
    members: team.members.map((member) => ({ ...member })),
    applications: team.applications.filter((application) => application.status === 'PENDING').map((application) => ({ ...application })),
  };
}

export async function reviewTeamApplication({ teamId, applicationId, decision }) {
  if (!useMockApi) {
    return request(`/teams/${teamId}/applications/${applicationId}`, {
      method: 'PATCH',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ status: decision }),
    });
  }

  await wait();
  const { data, team } = getMockTeam(teamId);
  const application = team.applications.find((item) => item.id === applicationId);
  if (!application) throw new Error('가입 신청을 찾을 수 없습니다.');
  if (decision === 'APPROVED' && !team.members.some((member) => member.userId === application.userId)) {
    team.members.push({ userId: application.userId, name: application.name, role: 'MEMBER', joinedAt: new Date().toISOString() });
  }
  application.status = decision;
  saveMockData(data);
  return application;
}

export async function assignTeamDeputy({ teamId, userId }) {
  if (!useMockApi) {
    return request(`/teams/${teamId}/deputy`, {
      method: 'PATCH',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ userId }),
    });
  }

  await wait();
  const { data, team } = getMockTeam(teamId);
  const target = team.members.find((member) => member.userId === userId);
  if (!target || target.role === 'LEADER') throw new Error('부리더로 지정할 팀원을 찾을 수 없습니다.');
  team.members = team.members.map((member) => ({
    ...member,
    role: member.userId === userId ? 'DEPUTY' : member.role === 'DEPUTY' ? 'MEMBER' : member.role,
  }));
  saveMockData(data);
  return team.members.find((member) => member.userId === userId);
}
