import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { cancelTeamJoin, getTeam, requestTeamJoin } from '../src/api/teams.js';
import { clearCsrfToken } from '../src/api/client.js';
import { invalidateSharedReads } from '../src/api/sharedReads.js';
import { previewContext, resetPreview, setPreviewRole } from '../src/mock/preview.js';
import { getMockState, saveMockState } from '../src/mock/planned.js';

const originalStorage = globalThis.localStorage;
const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  globalThis.window = { location: { pathname: '/preview/spaces/1' } };
  invalidateSharedReads();
  clearCsrfToken();
  setPreviewRole('participant');
  resetPreview('building');
});

afterEach(() => {
  globalThis.localStorage = originalStorage;
  globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
  invalidateSharedReads();
  clearCsrfToken();
});

test('신청 대기 중에는 다른 팀에 신청할 수 없고 취소 후 다시 신청할 수 있다', async () => {
  assert.equal((await getTeam(1)).myMembershipStatus, 'PENDING');
  assert.equal((await getTeam(2)).canApply, false);
  await assert.rejects(requestTeamJoin(2), { code: 'APPLICATION_CONFLICT' });
  await cancelTeamJoin(1);
  assert.equal((await getTeam(1)).myMembershipStatus, null);
  assert.equal((await getTeam(1)).canApply, true);
  assert.equal((await getTeam(2)).canApply, true);
  await requestTeamJoin(2);
  assert.equal((await getTeam(2)).myMembershipStatus, 'PENDING');
  assert.equal((await getTeam(1)).canApply, false);
  await cancelTeamJoin(2);
  assert.equal((await getTeam(1)).canApply, true);
  assert.equal((await getTeam(2)).canApply, true);
});

test('다른 사용자의 신청과 승인된 팀 소속은 취소하지 않는다', async () => {
  setPreviewRole('leader');
  await assert.rejects(cancelTeamJoin(1), { code: 'APPLICATION_NOT_PENDING' });
  assert.equal((await getTeam(1)).myMembershipStatus, 'APPROVED');
  setPreviewRole('participant');
  assert.equal((await getTeam(1)).myMembershipStatus, 'PENDING');
});

test('반려된 신청을 같은 신청으로 갱신하고 취소 후 상태를 복원한다', async () => {
  const context = previewContext();
  const state = getMockState(context);
  state.applications[0].status = 'REJECTED';
  saveMockState(context, state);
  const result = await requestTeamJoin(1);
  assert.equal(result.id, 700);
  assert.equal(result.status, 'PENDING');
  assert.equal((await getTeam(1)).myMembershipStatus, 'PENDING');
  await cancelTeamJoin(1);
  assert.equal((await getTeam(1)).myMembershipStatus, null);
  assert.equal((await getTeam(2)).canApply, true);
});

test('기간 종료 후 취소는 가능하지만 새 가입 신청은 계속 제한한다', async () => {
  const context = previewContext();
  const state = getMockState(context);
  state.spaceOverrides.teamBuildingStatus = 'CLOSED';
  saveMockState(context, state);
  await cancelTeamJoin(1);
  assert.equal((await getTeam(1)).myMembershipStatus, null);
  assert.equal((await getTeam(2)).canApply, false);
});

test('실제 취소 요청은 세션과 CSRF를 포함하고 본문 없이 DELETE하며 204를 처리한다', async () => {
  globalThis.window.location.pathname = '/spaces/1';
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, ...options });
    return url.endsWith('/csrf')
      ? new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'test-token' }), { status: 200 })
      : new Response(null, { status: 204 });
  };
  assert.equal(await cancelTeamJoin(2), null);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].url, '/api/teams/2/applications/me');
  assert.equal(requests[1].method, 'DELETE');
  assert.equal(requests[1].credentials, 'include');
  assert.equal(requests[1].headers['X-CSRF-TOKEN'], 'test-token');
  assert.equal(requests[1].body, undefined);
});

test('API가 아직 없거나 충돌하면 취소 요청을 성공으로 처리하거나 자동 재전송하지 않는다', async () => {
  globalThis.window.location.pathname = '/spaces/1';
  for (const status of [404, 409, 501]) {
    clearCsrfToken();
    let deletes = 0;
    globalThis.fetch = async (url) => {
      if (url.endsWith('/csrf'))
        return new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'test-token' }));
      deletes++;
      return new Response(JSON.stringify({ code: 'CANCEL_FAILED', message: '취소할 수 없습니다.' }), { status });
    };
    await assert.rejects(cancelTeamJoin(1), { status, code: 'CANCEL_FAILED' });
    assert.equal(deletes, 1);
  }
});
