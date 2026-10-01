const STORAGE_KEY = 'fairplay-task-board-v1';
const useMockApi = import.meta.env.VITE_TASK_API_MODE !== 'api';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const wait = (delay = 250) => new Promise((resolve) => setTimeout(resolve, delay));
const now = () => new Date().toISOString();

function readMockData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveMockData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function makeInitialEvidence(task, criteria) {
  const count = Number(task.evidenceCount || 0);
  const evidence = [];
  if (count >= 1) evidence.push({
    id: `${task.id}-evidence-text`, type: 'TEXT', title: '구현 내용 정리',
    body: '담당 기능의 주요 흐름과 예외 상태를 정리했습니다.', criterionId: criteria[0].id,
    authorName: task.assignees?.[0]?.name || '팀원', createdAt: new Date(Date.now() - 7200000).toISOString(), scanStatus: 'CLEAN',
  });
  if (count >= 2) evidence.push({
    id: `${task.id}-evidence-url`, type: 'URL', title: '작업 결과 링크',
    url: 'https://github.com/isjuny0/fairplay-fe', criterionId: criteria[1].id,
    authorName: task.assignees?.[0]?.name || '팀원', createdAt: new Date(Date.now() - 3600000).toISOString(), scanStatus: 'CLEAN',
  });
  if (count >= 3) evidence.push({
    id: `${task.id}-evidence-file`, type: 'FILE', title: '검토 자료', fileName: 'task-result.pdf', fileSize: 842000,
    criterionId: criteria[1].id, authorName: task.assignees?.[0]?.name || '팀원', createdAt: new Date(Date.now() - 1800000).toISOString(), scanStatus: 'CLEAN',
  });
  return evidence;
}

function initialHistory(task) {
  return [
    { id: `${task.id}-history-created`, type: 'CREATED', label: '작업 생성', detail: '가중치와 담당 배분이 등록되었습니다.', actorName: '박선우', createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
    ...(task.status === 'TODO' ? [] : [{ id: `${task.id}-history-started`, type: 'STARTED', label: '작업 시작', detail: '담당자가 작업을 시작했습니다.', actorName: task.assignees?.[0]?.name || '팀원', createdAt: new Date(Date.now() - 86400000 * 2).toISOString() }]),
  ];
}

function hydrateTask(task) {
  if (task.detailInitialized) return task;
  const criteria = [
    { id: `${task.id}-criterion-1`, description: '요구사항에 맞는 핵심 기능을 구현한다.', weightPercent: 60, completed: Number(task.evidenceCount || 0) >= 1 },
    { id: `${task.id}-criterion-2`, description: '오류·빈 상태와 모바일 화면을 확인한다.', weightPercent: 40, completed: Number(task.evidenceCount || 0) >= 2 },
  ];
  return {
    ...task,
    detailInitialized: true,
    description: `${task.title} 작업의 범위와 결과를 팀원이 함께 확인할 수 있도록 정리합니다.`,
    milestoneName: 'MVP 핵심 기능 구현',
    progressNote: task.status === 'TODO' ? '' : '기본 기능 구현을 마치고 근거 자료를 정리하고 있습니다.',
    reviewer: { userId: 'local-user', name: task.reviewerName || '박선우' },
    assignees: (task.assignees || []).map((assignee, index) => ({ ...assignee, confirmedAt: assignee.userId === 'local-user' && task.status === 'IN_PROGRESS' ? null : new Date(Date.now() - 86400000 * (index + 1)).toISOString() })),
    criteria,
    evidences: makeInitialEvidence(task, criteria),
    history: initialHistory(task),
    rejectionReason: task.approvalStatus === 'REJECTED' ? '완료 기준과 연결된 근거를 보완해 주세요.' : '',
  };
}

function normalizeTask(task) {
  const approvalStatus = String(task.approvalStatus || 'NOT_REQUESTED').toUpperCase();
  const rawStatus = String(task.status || 'TODO').toUpperCase();
  return {
    ...task,
    id: task.id || task.taskId,
    status: approvalStatus === 'PENDING' ? 'PENDING_APPROVAL' : rawStatus,
    approvalStatus,
    assignees: task.assignees || task.assignments || task.contributions || [],
    criteria: task.criteria || task.acceptanceCriteria || [],
    evidences: task.evidences || task.evidence || [],
    history: task.history || task.approvalHistory || [],
  };
}

function getMockTask(teamId, taskId) {
  const data = readMockData();
  const tasks = data[teamId] || [];
  const index = tasks.findIndex((task) => String(task.id) === String(taskId));
  if (index < 0) throw new Error('작업을 찾을 수 없습니다.');
  const task = hydrateTask(tasks[index]);
  tasks[index] = task;
  data[teamId] = tasks;
  saveMockData(data);
  return { data, tasks, index, task };
}

function updateMockTask(teamId, taskId, updater) {
  const { data, tasks, index, task } = getMockTask(teamId, taskId);
  const updated = updater({ ...task });
  tasks[index] = updated;
  data[teamId] = tasks;
  saveMockData(data);
  return normalizeTask(updated);
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', ...options });
  const result = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || '작업 상세 요청을 처리하지 못했습니다.');
  return result;
}

export async function getTaskDetail(teamId, taskId) {
  if (!useMockApi) return normalizeTask(await request(`/teams/${teamId}/tasks/${taskId}`));
  await wait();
  return normalizeTask(getMockTask(teamId, taskId).task);
}

export async function updateTaskProgress(teamId, taskId, progressNote) {
  if (!useMockApi) return normalizeTask(await request(`/tasks/${taskId}/progress`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progressNote }) }));
  await wait();
  return updateMockTask(teamId, taskId, (task) => ({
    ...task, progressNote,
    history: [{ id: crypto.randomUUID(), type: 'PROGRESS', label: '진행 내용 갱신', detail: progressNote, actorName: '박선우', createdAt: now() }, ...task.history],
  }));
}

export async function confirmTaskAssignment(teamId, taskId, userId) {
  if (!useMockApi) return normalizeTask(await request(`/tasks/${taskId}/assignments/me/confirm`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } }));
  await wait();
  return updateMockTask(teamId, taskId, (task) => {
    const assignee = task.assignees.find((item) => String(item.userId || item.id) === String(userId));
    if (!assignee) throw new Error('본인 담당 배분만 확인할 수 있습니다.');
    return {
      ...task,
      assignees: task.assignees.map((item) => String(item.userId || item.id) === String(userId) ? { ...item, confirmedAt: now() } : item),
      history: [{ id: crypto.randomUUID(), type: 'ASSIGNMENT_CONFIRMED', label: '담당 배분 확인', detail: `${assignee.name}님이 ${assignee.allocationPercent}% 배분을 확인했습니다.`, actorName: assignee.name, createdAt: now() }, ...task.history],
    };
  });
}

export async function addTaskEvidence(teamId, taskId, input) {
  if (!useMockApi) {
    if (input.type === 'FILE') {
      const formData = new FormData();
      formData.append('file', input.file);
      formData.append('criterionId', input.criterionId);
      formData.append('title', input.title || input.file.name);
      return normalizeTask(await request(`/tasks/${taskId}/evidences`, { method: 'POST', body: formData }));
    }
    return normalizeTask(await request(`/tasks/${taskId}/evidences`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(input) }));
  }
  await wait();
  return updateMockTask(teamId, taskId, (task) => {
    const evidence = {
      id: crypto.randomUUID(), type: input.type, title: input.title || input.file?.name || '수행 근거',
      body: input.type === 'TEXT' ? input.value : undefined,
      url: input.type === 'URL' ? input.value : undefined,
      fileName: input.type === 'FILE' ? input.file.name : undefined,
      fileSize: input.type === 'FILE' ? input.file.size : undefined,
      criterionId: input.criterionId, authorName: '박선우', createdAt: now(), scanStatus: input.type === 'FILE' ? 'SCANNING' : 'CLEAN',
    };
    return {
      ...task, evidenceCount: task.evidences.length + 1,
      evidences: [evidence, ...task.evidences],
      criteria: task.criteria.map((criterion) => criterion.id === input.criterionId ? { ...criterion, completed: true } : criterion),
      history: [{ id: crypto.randomUUID(), type: 'EVIDENCE_ADDED', label: '수행 근거 추가', detail: evidence.title, actorName: '박선우', createdAt: now() }, ...task.history],
    };
  });
}

export async function completeMockEvidenceScan(teamId, taskId, evidenceId) {
  if (!useMockApi) return getTaskDetail(teamId, taskId);
  await wait(700);
  return updateMockTask(teamId, taskId, (task) => ({ ...task, evidences: task.evidences.map((evidence) => evidence.id === evidenceId ? { ...evidence, scanStatus: 'CLEAN' } : evidence) }));
}

export async function requestTaskCompletion(teamId, taskId) {
  if (!useMockApi) return normalizeTask(await request(`/tasks/${taskId}/completion-requests`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } }));
  await wait(350);
  return updateMockTask(teamId, taskId, (task) => {
    if (task.status !== 'IN_PROGRESS') throw new Error('진행 중인 작업만 완료 요청할 수 있습니다.');
    if (task.assignees.some((assignee) => !assignee.confirmedAt)) throw new Error('모든 담당자가 배분을 확인해야 합니다.');
    if (!task.criteria.length || task.criteria.some((criterion) => !criterion.completed)) throw new Error('모든 완료 기준에 근거를 연결해 주세요.');
    if (!task.evidences.length || task.evidences.some((evidence) => evidence.scanStatus !== 'CLEAN')) throw new Error('사용 가능한 수행 근거가 필요합니다.');
    return {
      ...task, status: 'PENDING_APPROVAL', approvalStatus: 'PENDING', rejectionReason: '',
      history: [{ id: crypto.randomUUID(), type: 'COMPLETION_REQUESTED', label: '완료 요청', detail: `${task.reviewer?.name || task.reviewerName || '검토자'}에게 검토를 요청했습니다.`, actorName: task.assignees[0]?.name || '팀원', createdAt: now() }, ...task.history],
    };
  });
}
