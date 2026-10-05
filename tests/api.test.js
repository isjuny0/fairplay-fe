import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, clearCsrfToken } from '../src/api/client.js';
import { updateTask } from '../src/api/tasks.js';
import { requestCompletion } from '../src/api/approvals.js';
import { reviewTeamApplication } from '../src/api/teams.js';
import {
  updateDeliverable,
  uploadDeliverable,
} from '../src/api/deliverables.js';
const originalFetch = globalThis.fetch;
let calls;
const jsonResponse = (result, status = 200) =>
  new Response(JSON.stringify(result), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
beforeEach(() => {
  clearCsrfToken();
  calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return url.endsWith('/csrf')
      ? jsonResponse({ headerName: 'X-CSRF-TOKEN', token: 'token' })
      : jsonResponse({ id: 1 });
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearCsrfToken();
  delete globalThis.window;
});
test('GET은 쿠키를 포함하고 불필요한 CSRF 조회를 하지 않는다', async () => {
  await apiRequest('/api/spaces');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].credentials, 'include');
});
test('작업 상태 수정과 완료 요청은 실제 경로 및 버전을 사용한다', async () => {
  await updateTask(7, { status: 'IN_PROGRESS', expectedVersion: 3 });
  await requestCompletion(7, 4);
  assert.equal(calls[1].url, '/api/tasks/7');
  assert.equal(calls[1].headers['X-CSRF-TOKEN'], 'token');
  assert.deepEqual(JSON.parse(calls[1].body), {
    status: 'IN_PROGRESS',
    expectedVersion: 3,
  });
  assert.equal(calls[2].url, '/api/tasks/7/completion-requests');
  assert.deepEqual(JSON.parse(calls[2].body), { expectedVersion: 4 });
});
test('가입 처리는 팀 경로가 아닌 application 경로를 사용한다', async () => {
  await reviewTeamApplication(5, 'APPROVED');
  assert.equal(calls[1].url, '/api/team-applications/5');
});
test('파일 업로드는 정확한 multipart 필드와 CSRF를 전송한다', async () => {
  await uploadDeliverable(
    1,
    { taskId: null, title: '자료', description: null, category: 'OTHER' },
    new Blob(['text']),
  );
  assert.deepEqual([...calls[1].body.keys()], ['title', 'category', 'file']);
  assert.equal(calls[1].headers['Content-Type'], undefined);
  assert.equal(calls[1].headers['X-CSRF-TOKEN'], 'token');
});
test('파일 교체는 JSON metadata와 file만 포함한다', async () => {
  await updateDeliverable(
    9,
    { expectedVersion: 2, title: '교체' },
    new Blob(['new']),
  );
  assert.deepEqual([...calls[1].body.keys()], ['metadata', 'file']);
  assert.equal(calls[1].body.get('metadata').type, 'application/json');
  assert.deepEqual(JSON.parse(await calls[1].body.get('metadata').text()), {
    expectedVersion: 2,
    title: '교체',
  });
});
test('보안 토큰 오류만 토큰을 갱신한 뒤 한 번 재시도한다', async () => {
  let mutations = 0;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith('/csrf'))
      return jsonResponse({ headerName: 'X-CSRF-TOKEN', token: 'refreshed' });
    return ++mutations === 1
      ? jsonResponse({ code: 'INVALID_CSRF_TOKEN' }, 403)
      : new Response(null, { status: 204 });
  };
  assert.equal(await apiRequest('/api/auth/logout', { method: 'POST' }), null);
  assert.equal(mutations, 2);
  assert.equal(calls.filter((call) => call.url.endsWith('/csrf')).length, 2);
});
test('일반 권한 오류와 버전 충돌은 변경 요청을 반복하지 않는다', async () => {
  for (const [status, code] of [
    [403, 'FORBIDDEN'],
    [409, 'VERSION_CONFLICT'],
  ]) {
    clearCsrfToken();
    let mutations = 0;
    globalThis.fetch = async (url) =>
      url.endsWith('/csrf')
        ? jsonResponse({ headerName: 'X-CSRF-TOKEN', token: 'token' })
        : (mutations++, jsonResponse({ code, message: '거절' }, status));
    await assert.rejects(
      apiRequest('/api/tasks/1', {
        method: 'PATCH',
        body: { expectedVersion: 0 },
      }),
      (error) => error.status === status && error.code === code,
    );
    assert.equal(mutations, 1);
  }
});
test('세션 만료를 앱에 전달한다', async () => {
  globalThis.window = new EventTarget();
  let expired = false;
  globalThis.window.addEventListener('fairplay:session-expired', () => {
    expired = true;
  });
  globalThis.fetch = async () => jsonResponse({ code: 'UNAUTHORIZED' }, 401);
  await assert.rejects(apiRequest('/api/me'));
  assert.equal(expired, true);
});
