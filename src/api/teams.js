const STORAGE_KEY = 'fairplay-teams';
const useMockApi = import.meta.env.VITE_TEAM_API_MODE !== 'api';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const wait = () => new Promise((resolve) => setTimeout(resolve, 250));

const sampleTeams = [
  { id: 'sample-a', name: 'A팀', memberCount: 4, maxMembers: 6, leaderId: 'member-kjy', deputyId: null, leaderName: '김준영', membershipStatus: 'NONE' },
  { id: 'sample-b', name: 'B팀', memberCount: 4, maxMembers: 6, leaderId: 'member-kyj', deputyId: null, leaderName: '김영진', membershipStatus: 'PENDING' },
  { id: 'sample-c', name: 'C팀', memberCount: 4, maxMembers: 6, leaderId: 'member-psw', deputyId: null, leaderName: '박선우', membershipStatus: 'NONE' },
];

function readMockTeams() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveMockTeams(teamsBySpace) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teamsBySpace));
}

function getMockTeams(spaceId) {
  const teamsBySpace = readMockTeams();
  if (!teamsBySpace[spaceId]) {
    teamsBySpace[spaceId] = sampleTeams.map((team) => ({ ...team, id: `${spaceId}-${team.id}`, spaceId }));
    saveMockTeams(teamsBySpace);
  }
  return teamsBySpace[spaceId].map((team) => ({
    ...team,
    spaceId: team.spaceId || spaceId,
    leaderId: team.leaderId || null,
    deputyId: team.deputyId || null,
    membershipStatus: team.membershipStatus === 'JOINED' ? 'APPROVED' : team.membershipStatus,
  }));
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || '팀 요청을 처리하지 못했습니다.');
  return result;
}

export async function listTeams(spaceId) {
  if (!useMockApi) return request(`/spaces/${spaceId}/teams`);
  await wait();
  return getMockTeams(spaceId);
}

export async function createTeam(spaceId, { name, maxMembers }) {
  if (!useMockApi) {
    return request(`/spaces/${spaceId}/teams`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ name }),
    });
  }

  await wait();
  const teamsBySpace = readMockTeams();
  const teams = getMockTeams(spaceId);
  const team = {
    id: crypto.randomUUID(),
    spaceId,
    name,
    memberCount: 1,
    maxMembers,
    leaderId: 'local-user',
    deputyId: null,
    leaderName: '사용자',
    membershipStatus: 'APPROVED',
    myRole: 'LEADER',
  };
  teamsBySpace[spaceId] = [...teams, team];
  saveMockTeams(teamsBySpace);
  return team;
}

export async function requestTeamJoin(spaceId, teamId) {
  if (!useMockApi) {
    return request(`/teams/${teamId}/applications`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
  }

  await wait();
  const teamsBySpace = readMockTeams();
  const teams = getMockTeams(spaceId);
  const team = teams.find((item) => item.id === teamId);
  if (!team) throw new Error('팀을 찾을 수 없습니다.');
  if (team.memberCount >= team.maxMembers) throw new Error('모집이 마감된 팀입니다.');

  teamsBySpace[spaceId] = teams.map((item) => item.id === teamId ? { ...item, membershipStatus: 'PENDING' } : item);
  saveMockTeams(teamsBySpace);
  return teamsBySpace[spaceId].find((item) => item.id === teamId);
}
