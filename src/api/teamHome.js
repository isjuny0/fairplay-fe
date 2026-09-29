const useMockApi = import.meta.env.VITE_TEAM_HOME_API_MODE !== 'api';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const wait = () => new Promise((resolve) => setTimeout(resolve, 250));

const membersByTeam = {
  'A팀': [
    { userId: 'member-psw', name: '박선우' },
    { userId: 'member-kjy', name: '김준영' },
    { userId: 'member-kyj', name: '김영진' },
    { userId: 'member-ysh', name: '염승혜' },
  ],
  'B팀': [
    { userId: 'member-sbj', name: '서범주' },
    { userId: 'member-nsb', name: '노신비' },
    { userId: 'member-jsm', name: '정승민' },
    { userId: 'member-ask', name: '안수경' },
  ],
  'C팀': [
    { userId: 'member-jgd', name: '정규도' },
    { userId: 'member-pgj', name: '박기재' },
    { userId: 'member-jcw', name: '정채원' },
    { userId: 'member-kjw', name: '강지원' },
  ],
};

const addDays = (days, hour = 18) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

function asList(result) {
  if (Array.isArray(result)) return result;
  return result?.content || result?.items || result?.data || [];
}

function normalizeTask(task) {
  return {
    ...task,
    assignees: task.assignees || task.assignments || [],
  };
}

async function request(path) {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include' });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || '팀 홈 정보를 불러오지 못했습니다.');
  return result;
}

function resolveRole(team, userId) {
  if (team.myRole) return team.myRole;
  if (String(team.leaderId) === String(userId)) return 'LEADER';
  if (team.deputyId && String(team.deputyId) === String(userId)) return 'DEPUTY';
  return 'MEMBER';
}

function makeMockTasks(team, members) {
  const [first, second, third] = members;
  return [
    {
      id: `${team.id}-task-1`, teamId: team.id, title: '요구사항 정리', description: '핵심 사용자 흐름을 정리합니다.',
      weight: 3, dueAt: addDays(1), status: 'IN_PROGRESS', version: 1,
      assignees: [{ ...(first || { userId: 'local-user', name: '사용자' }), allocationPercent: 100 }],
    },
    {
      id: `${team.id}-task-2`, teamId: team.id, title: '중간 발표 자료', description: '중간 발표용 결과와 근거를 모읍니다.',
      weight: 5, dueAt: addDays(4), status: 'TODO', version: 1,
      assignees: [{ ...(second || first || { userId: 'local-user', name: '사용자' }), allocationPercent: 100 }],
    },
    {
      id: `${team.id}-task-3`, teamId: team.id, title: '화면 흐름 검토', description: '완료된 화면 흐름을 팀에서 검토합니다.',
      weight: 2, dueAt: addDays(-1), status: 'PENDING_APPROVAL', version: 2,
      assignees: [{ ...(third || first || { userId: 'local-user', name: '사용자' }), allocationPercent: 100 }],
    },
  ];
}

function chooseNextAction(tasks, role, userId) {
  const pendingApproval = tasks.find((task) => task.status === 'PENDING_APPROVAL');
  if (['LEADER', 'DEPUTY'].includes(role) && pendingApproval) {
    return {
      type: 'APPROVAL', targetId: pendingApproval.id, title: pendingApproval.title,
      description: '완료 요청을 확인하고 승인 여부를 결정해 주세요.', dueAt: pendingApproval.dueAt,
      priority: 'HIGH', actionLabel: '승인 대기 확인', targetMenu: '승인 대기',
    };
  }

  const openTasks = tasks
    .filter((task) => !['DONE', 'PENDING_APPROVAL'].includes(task.status))
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const assignedTask = openTasks.find((task) => task.assignees?.some((assignee) => String(assignee.userId) === String(userId)));
  const task = assignedTask || openTasks[0];
  if (!task) return null;

  return {
    type: 'TASK', targetId: task.id, title: task.title,
    description: task.description || '마감 전에 작업 상태를 확인해 주세요.', dueAt: task.dueAt,
    priority: new Date(task.dueAt).getTime() - Date.now() < 3 * 86400000 ? 'HIGH' : 'NORMAL',
    actionLabel: '다음 작업 수행', targetMenu: '작업',
  };
}

function makeMockHome(team, userId) {
  const fallbackMember = { userId: userId || 'local-user', name: '사용자' };
  const members = membersByTeam[team.name] || [fallbackMember];
  const role = resolveRole(team, userId);
  const tasks = makeMockTasks(team, members);
  return {
    team: { ...team, myRole: role, members },
    nextAction: chooseNextAction(tasks, role, userId),
    recentTasks: tasks,
    evaluationRounds: [
      { id: `${team.spaceId}-mid`, spaceId: team.spaceId, type: 'MID', opensAt: addDays(5, 9), closesAt: addDays(8, 23), status: 'DRAFT' },
      { id: `${team.spaceId}-final`, spaceId: team.spaceId, type: 'FINAL', opensAt: addDays(26, 9), closesAt: addDays(30, 23), status: 'DRAFT' },
    ],
    evaluationAvailable: true,
    evaluationSource: 'mock-planned',
  };
}

export async function getTeamHome({ spaceId, team, userId }) {
  if (!team?.id) return null;
  if (useMockApi) {
    await wait();
    return makeMockHome({ ...team, spaceId: team.spaceId || spaceId }, userId);
  }

  const tasksResult = await request(`/teams/${team.id}/tasks`);
  const evaluationResult = await request(`/spaces/${spaceId}/evaluation-rounds`)
    .then((result) => ({ rounds: asList(result), available: true }))
    .catch(() => ({ rounds: [], available: false }));
  const recentTasks = asList(tasksResult).map(normalizeTask);
  const role = resolveRole(team, userId);

  return {
    team: { ...team, spaceId: team.spaceId || spaceId, myRole: role },
    nextAction: chooseNextAction(recentTasks, role, userId),
    recentTasks,
    evaluationRounds: evaluationResult.rounds,
    evaluationAvailable: evaluationResult.available,
    evaluationSource: evaluationResult.available ? 'api' : 'unavailable',
  };
}
