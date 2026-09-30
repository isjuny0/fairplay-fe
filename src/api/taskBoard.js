const STORAGE_KEY = 'fairplay-task-board-v1';
const useMockApi = import.meta.env.VITE_TASK_API_MODE !== 'api';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const wait = () => new Promise((resolve) => setTimeout(resolve, 250));

const mockMembers = [
  { userId: 'local-user', name: '박선우', role: 'LEADER' },
  { userId: 'member-kjy', name: '김준영', role: 'DEPUTY' },
  { userId: 'member-kyj', name: '김영진', role: 'MEMBER' },
  { userId: 'member-ysh', name: '염승혜', role: 'MEMBER' },
];

const addDays = (days) => {
  const date = new Date();
  date.setHours(18, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

function makeInitialTasks(teamId) {
  return [
    {
      id: `${teamId}-task-1`, teamId, title: '사용자 요구사항 정리', status: 'TODO', approvalStatus: 'NOT_REQUESTED',
      weight: 3, dueAt: addDays(3), reviewerName: '박선우', evidenceCount: 0,
      assignees: [{ userId: 'member-kjy', name: '김준영', allocationPercent: 100 }],
    },
    {
      id: `${teamId}-task-2`, teamId, title: '핵심 화면 구현', status: 'IN_PROGRESS', approvalStatus: 'NOT_REQUESTED',
      weight: 5, dueAt: addDays(1), reviewerName: '박선우', evidenceCount: 2,
      assignees: [{ userId: 'local-user', name: '박선우', allocationPercent: 60 }, { userId: 'member-kyj', name: '김영진', allocationPercent: 40 }],
    },
    {
      id: `${teamId}-task-3`, teamId, title: '중간 발표 자료 검토', status: 'PENDING_APPROVAL', approvalStatus: 'PENDING',
      weight: 2, dueAt: addDays(0), reviewerName: '김준영', evidenceCount: 3,
      assignees: [{ userId: 'member-ysh', name: '염승혜', allocationPercent: 100 }],
    },
    {
      id: `${teamId}-task-4`, teamId, title: '서비스 흐름 정의', status: 'DONE', approvalStatus: 'APPROVED',
      weight: 3, dueAt: addDays(-4), reviewerName: '박선우', evidenceCount: 2, aiScore: 86,
      assignees: [{ userId: 'member-kyj', name: '김영진', allocationPercent: 100 }],
    },
  ];
}

function readMockData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveMockData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getMockTasks(teamId) {
  const data = readMockData();
  if (!data[teamId]) {
    data[teamId] = makeInitialTasks(teamId);
    saveMockData(data);
  }
  return { data, tasks: data[teamId] };
}

function asList(result) {
  if (Array.isArray(result)) return result;
  return result?.content || result?.items || result?.data || [];
}

function normalizeTask(task) {
  const approvalStatus = String(task.approvalStatus || 'NOT_REQUESTED').toUpperCase();
  const rawStatus = String(task.status || 'TODO').toUpperCase();
  const status = approvalStatus === 'PENDING' ? 'PENDING_APPROVAL' : rawStatus;
  return {
    ...task,
    id: task.id || task.taskId,
    status,
    approvalStatus,
    assignees: task.assignees || task.assignments || task.contributions || [],
    evidenceCount: task.evidenceCount ?? task.evidences?.length ?? 0,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || '작업 요청을 처리하지 못했습니다.');
  return result;
}

export async function getTaskBoard(teamId) {
  if (!teamId) return null;
  if (!useMockApi) {
    const [tasksResult, membersResult] = await Promise.all([
      request(`/teams/${teamId}/tasks`),
      request(`/teams/${teamId}/members`),
    ]);
    return { tasks: asList(tasksResult).map(normalizeTask), members: asList(membersResult) };
  }
  await wait();
  return { tasks: getMockTasks(teamId).tasks.map((task) => ({ ...task })), members: mockMembers.map((member) => ({ ...member })) };
}

export async function createTask(teamId, input) {
  if (!useMockApi) {
    return normalizeTask(await request(`/teams/${teamId}/tasks`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(input),
    }));
  }
  await wait();
  const { data, tasks } = getMockTasks(teamId);
  const assignee = mockMembers.find((member) => member.userId === input.assigneeId) || mockMembers[0];
  const task = {
    id: crypto.randomUUID(), teamId, title: input.title, status: 'TODO', approvalStatus: 'NOT_REQUESTED',
    weight: Number(input.weight), dueAt: new Date(`${input.dueAt}T18:00:00`).toISOString(),
    reviewerName: mockMembers.find((member) => member.role === 'LEADER')?.name || '팀리더', evidenceCount: 0,
    assignees: [{ userId: assignee.userId, name: assignee.name, allocationPercent: 100 }],
  };
  data[teamId] = [...tasks, task];
  saveMockData(data);
  return { ...task };
}

export async function updateTaskStatus(teamId, taskId, nextStatus) {
  if (!useMockApi) {
    return normalizeTask(await request(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ status: nextStatus }),
    }));
  }
  await wait();
  const { data, tasks } = getMockTasks(teamId);
  const task = tasks.find((item) => item.id === taskId);
  if (!task) throw new Error('작업을 찾을 수 없습니다.');
  const allowedNextStatus = { TODO: 'IN_PROGRESS', IN_PROGRESS: 'PENDING_APPROVAL' }[task.status];
  if (allowedNextStatus !== nextStatus) throw new Error('현재 상태에서 허용되지 않는 변경입니다.');
  const approvalStatus = nextStatus === 'PENDING_APPROVAL' ? 'PENDING' : task.approvalStatus;
  data[teamId] = tasks.map((item) => item.id === taskId ? { ...item, status: nextStatus, approvalStatus } : item);
  saveMockData(data);
  return { ...data[teamId].find((item) => item.id === taskId) };
}
