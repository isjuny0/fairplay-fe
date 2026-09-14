const STORAGE_KEY = 'fairplay-spaces';
const useMockApi = import.meta.env.VITE_SPACE_API_MODE !== 'api';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const wait = () => new Promise((resolve) => setTimeout(resolve, 250));

function readMockSpaces() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveMockSpaces(spaces) { localStorage.setItem(STORAGE_KEY, JSON.stringify(spaces)); }

async function request(path, options) {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) throw new Error('요청을 처리하지 못했습니다.');
  return response.json();
}

export async function listSpaces() {
  if (!useMockApi) return request('/spaces');
  await wait(); return readMockSpaces();
}

export async function createSpace(name) {
  if (!useMockApi) return request('/spaces', { method: 'POST', body: JSON.stringify({ name }) });
  await wait();
  const spaces = readMockSpaces();
  const space = { id: crypto.randomUUID(), name, role: 'MANAGER' };
  saveMockSpaces([...spaces, space]); return space;
}

export async function joinSpace(code) {
  if (!useMockApi) return request('/spaces/join', { method: 'POST', body: JSON.stringify({ code }) });
  await wait();
  if (code.toUpperCase() !== 'FAIRPLAY') throw new Error('올바르지 않은 참여 코드입니다. (테스트 코드: FAIRPLAY)');
  const spaces = readMockSpaces();
  const space = { id: crypto.randomUUID(), name: 'Fairplay 테스트 스페이스', role: 'USER' };
  saveMockSpaces([...spaces, space]); return space;
}
