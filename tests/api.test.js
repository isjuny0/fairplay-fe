import {
  getTeamReport,
  generateTeamReport,
  publishReport,
} from '../src/api/reports.js';
import { getMemberContributions } from '../src/api/dashboard.js';
import { getManagerPeerResponses } from '../src/api/evaluations.js';
import { getAiReview, requestAiReview } from '../src/api/aiReviews.js';
import { getMyWorkSummary } from '../src/api/teams.js';
import {
  listEvaluationRounds,
  openEvaluationRound,
  getMyPeerResponses,
  savePeerResponse,
  submitPeerEvaluation,
  getMidFeedback,
} from '../src/api/evaluations.js';
import { getManagerDashboard } from '../src/api/dashboard.js';
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, clearCsrfToken } from '../src/api/client.js';
import { updateTask } from '../src/api/tasks.js';
import { requestCompletion } from '../src/api/approvals.js';
import {
  createTeamDeletionRequest,
  deleteTeam,
  getTeamDeletionRequest,
  leaveTeam,
  reviewTeamApplication,
  updateTeamDeletionConsent,
} from '../src/api/teams.js';
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
test('팀 삭제 현황은 단수 경로이고 생성과 동의는 CSRF를 포함한다', async () => {
  await getTeamDeletionRequest(7);
  await createTeamDeletionRequest(7);
  await updateTeamDeletionConsent(12, false);
  assert.equal(calls[0].url, '/api/teams/7/deletion-request');
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[2].url, '/api/teams/7/deletion-requests');
  assert.equal(calls[2].method, 'POST');
  assert.equal(calls[2].body, undefined);
  assert.equal(calls[3].url, '/api/team-deletion-requests/12/consent');
  assert.equal(calls[3].method, 'PUT');
  assert.deepEqual(JSON.parse(calls[3].body), { agree: false });
  assert.equal(calls[3].headers['X-CSRF-TOKEN'], 'token');
});
test('팀 삭제와 탈퇴는 본문 없이 쿼리를 전송하고 204를 처리한다', async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return url.endsWith('/csrf')
      ? jsonResponse({ headerName: 'X-CSRF-TOKEN', token: 'token' })
      : new Response(null, { status: 204 });
  };
  assert.equal(await deleteTeam(7, 12, 0), null);
  assert.equal(await leaveTeam(7), null);
  assert.equal(await leaveTeam(7, 'next-leader'), null);
  assert.equal(
    calls[1].url,
    '/api/teams/7?deletionRequestId=12&expectedVersion=0',
  );
  assert.equal(calls[2].url, '/api/teams/7/members/me');
  assert.equal(
    calls[3].url,
    '/api/teams/7/members/me?nextLeaderId=next-leader',
  );
  for (const call of calls.slice(1)) {
    assert.equal(call.method, 'DELETE');
    assert.equal(call.body, undefined);
    assert.equal(call.headers['X-CSRF-TOKEN'], 'token');
  }
});
test('파일 업로드는 정확한 multipart 필드와 CSRF를 전송한다', async () => {
  await uploadDeliverable(
    1,
    { taskId: null, title: '자료', description: null, category: 'OTHER' },
    new Blob(['text']),
  );
  assert.deepEqual([...calls[1].body.keys()], ['metadata', 'file']);
  assert.equal(calls[1].body.get('metadata').type, 'application/json');
  assert.deepEqual(JSON.parse(await calls[1].body.get('metadata').text()), {
    taskId: null,
    title: '자료',
    description: null,
    category: 'OTHER',
  });
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

test('새 조회 API는 실제 경로에 쿠키를 보내며 목업 데이터를 반환하지 않는다', async () => {
  await getMyWorkSummary(7);
  await listEvaluationRounds(3);
  await getMyPeerResponses(12);
  await getMidFeedback(7);
  await getManagerDashboard(3, 7);
  await getAiReview(10);
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      '/api/teams/7/my-work-summary',
      '/api/spaces/3/evaluation-rounds',
      '/api/evaluation-rounds/12/responses/me',
      '/api/teams/7/mid-feedback',
      '/api/spaces/3/manager-dashboard?teamId=7',
      '/api/tasks/10/ai-review',
    ],
  );
  assert.ok(
    calls.every(
      (call) => call.method === 'GET' && call.credentials === 'include',
    ),
  );
});
test('검토 요청·회차 개방·최종 제출은 본문 없이 CSRF를 전송한다', async () => {
  await requestAiReview(10);
  await openEvaluationRound(12);
  await submitPeerEvaluation(12);
  assert.deepEqual(
    calls.slice(1).map((call) => call.url),
    [
      '/api/tasks/10/ai-review',
      '/api/evaluation-rounds/12/open',
      '/api/evaluation-rounds/12/submit',
    ],
  );
  assert.ok(
    calls
      .slice(1)
      .every(
        (call) =>
          call.body === undefined && call.headers['X-CSRF-TOKEN'] === 'token',
      ),
  );
});
test('동료 평가 저장은 고정 대상의 네 점수와 선택 사유를 PUT으로 전송한다', async () => {
  const input = {
    scores: {
      taskExecution: 4,
      responsibility: 4,
      collaboration: 3,
      communication: 5,
    },
    reason: null,
  };
  await savePeerResponse(12, '00000000-0000-4000-8000-000000000001', input);
  assert.equal(calls[1].method, 'PUT');
  assert.equal(
    calls[1].url,
    '/api/evaluation-rounds/12/responses/00000000-0000-4000-8000-000000000001',
  );
  assert.deepEqual(JSON.parse(calls[1].body), input);
});
test('AI 검토 비활성화는 실제 오류로 반환하고 자동으로 재요청하지 않는다', async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return url.endsWith('/csrf')
      ? jsonResponse({ headerName: 'X-CSRF-TOKEN', token: 'token' })
      : jsonResponse(
          {
            code: 'AI_REVIEW_UNAVAILABLE',
            message: 'AI 검토를 사용할 수 없습니다.',
          },
          503,
        );
  };
  await assert.rejects(requestAiReview(10), {
    status: 503,
    code: 'AI_REVIEW_UNAVAILABLE',
  });
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1);
});

test('추가된 리포트·관리자 조회는 현재 경로에 쿠키를 전송한다', async () => {
  await getTeamReport(7);
  await getMemberContributions(7, '00000000-0000-4000-8000-000000000001');
  await getManagerPeerResponses(12, 7);
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      '/api/teams/7/report',
      '/api/teams/7/members/00000000-0000-4000-8000-000000000001/contributions',
      '/api/evaluation-rounds/12/teams/7/responses',
    ],
  );
  assert.ok(
    calls.every(
      (call) => call.credentials === 'include' && call.method === 'GET',
    ),
  );
});
test('리포트 생성·공개에는 본문이나 쿼리 없이 CSRF만 전송한다', async () => {
  await generateTeamReport(7);
  await publishReport(8);
  assert.deepEqual(
    calls.slice(1).map((call) => call.url),
    ['/api/teams/7/report', '/api/reports/8/publish'],
  );
  assert.ok(
    calls
      .slice(1)
      .every(
        (call) =>
          call.method === 'POST' &&
          call.body === undefined &&
          call.headers['Content-Type'] === undefined &&
          call.headers['X-CSRF-TOKEN'] === 'token',
      ),
  );
});
