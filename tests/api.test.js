import {
  getTeamReport,
  generateTeamReport,
  publishReport,
} from '../src/api/reports.js';
import { getMemberContributions } from '../src/api/dashboard.js';
import { getManagerPeerResponses } from '../src/api/evaluations.js';
import { getAiReview, requestAiReview } from '../src/api/aiReviews.js';
import {
  assignTeamDeputy,
  getMyWorkSummary,
  getTeam,
  getTeamMembers,
} from '../src/api/teams.js';
import { invalidateSpaceList, listSpaces } from '../src/api/spaces.js';
import { reviewerCandidates } from '../src/lib/domain.js';
import { invalidateSharedReads } from '../src/api/sharedReads.js';
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
  invalidateSharedReads();
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
  invalidateSharedReads();
  globalThis.fetch = originalFetch;
  clearCsrfToken();
  delete globalThis.window;
});

test('동시 팀 조회는 공유하지만 완료 후에는 최신 가입·권한 상태를 확인한다', async () => {
  let membership = 'APPROVED';
  globalThis.fetch = async () =>
    jsonResponse({ myMembershipStatus: membership });
  const first = getTeam(7);
  const duplicate = getTeam(7);
  assert.equal(first, duplicate);
  assert.equal((await first).myMembershipStatus, 'APPROVED');
  membership = null;
  assert.equal((await getTeam(7)).myMembershipStatus, null);
});

test('새 팀원이 합류하면 최신 팀원으로 전원 담당 예외와 승인자 후보를 판단한다', async () => {
  const originalMembers = [
    { userId: 'leader', role: 'LEADER' },
    { userId: 'member', role: 'MEMBER' },
  ];
  let serverMembers = originalMembers;
  const assignees = originalMembers.map(({ userId }) => ({
    userId,
    allocationPercent: 50,
  }));
  globalThis.fetch = async (url) =>
    jsonResponse(
      url.endsWith('/members')
        ? serverMembers
        : { id: 7, approvedMemberCount: serverMembers.length },
    );
  assert.deepEqual(
    reviewerCandidates(await getTeamMembers(7), assignees).map(
      (member) => member.userId,
    ),
    ['leader'],
  );
  serverMembers = [
    ...originalMembers,
    { userId: 'new-member', role: 'MEMBER' },
  ];
  const detail = await getTeam(7);
  const currentMembers = await getTeamMembers(7);
  assert.equal(currentMembers.length, detail.approvedMemberCount);
  assert.deepEqual(
    reviewerCandidates(currentMembers, assignees).map(
      (member) => member.userId,
    ),
    ['new-member'],
  );
});

test('스페이스 목록은 짧게 재사용하고 유효 기간 후 최신 목록을 조회한다', async (context) => {
  let now = 1_000;
  context.mock.method(Date, 'now', () => now);
  let spaces = [{ id: 1, name: '기존 스페이스' }];
  globalThis.fetch = async () => jsonResponse(spaces);
  const initial = await listSpaces();
  spaces = [...spaces, { id: 2, name: '새 스페이스' }];
  assert.deepEqual(await listSpaces(), initial);
  now += 15_000;
  assert.deepEqual(await listSpaces(), spaces);
});

test('스페이스 목록 새로고침은 해당 캐시만 비우고 진행 중인 팀 조회를 공유한다', async () => {
  let releaseTeam;
  let spaces = [{ id: 1 }];
  globalThis.fetch = async (url) =>
    url === '/api/spaces'
      ? jsonResponse(spaces)
      : new Promise((resolve) => {
          releaseTeam = () => resolve(jsonResponse({ id: 7 }));
        });
  await listSpaces();
  const pendingTeam = getTeam(7);
  await Promise.resolve();
  spaces = [{ id: 1 }, { id: 2 }];
  invalidateSpaceList();
  assert.deepEqual(await listSpaces(), spaces);
  assert.equal(getTeam(7), pendingTeam);
  releaseTeam();
  await pendingTeam;
});

test('역할 변경 후에는 변경된 팀원 역할을 조회한다', async () => {
  let role = 'MEMBER';
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/csrf'))
      return jsonResponse({ headerName: 'X-CSRF-TOKEN', token: 'token' });
    if (options.method === 'PATCH') role = 'DEPUTY';
    return jsonResponse([{ userId: 'member', role }]);
  };
  assert.equal((await getTeamMembers(7))[0].role, 'MEMBER');
  await assignTeamDeputy(7, 'member');
  assert.equal((await getTeamMembers(7))[0].role, 'DEPUTY');
});

test('이전 세션의 늦은 응답은 새 세션의 스페이스 캐시를 덮어쓰지 않는다', async () => {
  let releasePrevious;
  let account = 'previous';
  globalThis.fetch = async (url) => {
    if (url === '/api/me') return jsonResponse({ id: account });
    if (account === 'previous')
      return new Promise((resolve) => {
        releasePrevious = () => resolve(jsonResponse([{ userId: 'previous' }]));
      });
    return jsonResponse([{ userId: account }]);
  };
  const previous = listSpaces();
  await Promise.resolve();
  account = 'current';
  await apiRequest('/api/me');
  assert.equal((await listSpaces())[0].userId, 'current');
  releasePrevious();
  await previous;
  assert.equal((await listSpaces())[0].userId, 'current');
});

test('세션 만료 후에는 캐시된 스페이스 목록을 다시 사용하지 않는다', async () => {
  let expired = false;
  globalThis.fetch = async () =>
    expired
      ? jsonResponse({ code: 'UNAUTHORIZED' }, 401)
      : jsonResponse([{ id: 1 }]);
  await listSpaces();
  expired = true;
  await assert.rejects(apiRequest('/api/teams/7'), { status: 401 });
  await assert.rejects(listSpaces(), { status: 401 });
});

test('삭제 요청이 없는 정상 404는 스페이스 목록을 무효화하지 않는다', async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return url.endsWith('/deletion-request')
      ? jsonResponse({ code: 'TEAM_DELETION_REQUEST_NOT_FOUND' }, 404)
      : jsonResponse([{ userId: 'member' }]);
  };
  await listSpaces();
  await assert.rejects(getTeamDeletionRequest(7), {
    status: 404,
    code: 'TEAM_DELETION_REQUEST_NOT_FOUND',
  });
  assert.deepEqual(await listSpaces(), [{ userId: 'member' }]);
  assert.equal(calls.filter((call) => call.url === '/api/spaces').length, 1);
});

test('실패한 조회는 저장하지 않고 재조회 오류를 그대로 전달한다', async () => {
  globalThis.fetch = async () =>
    jsonResponse(
      { code: 'FORBIDDEN', message: '팀원 조회 권한이 없습니다.' },
      403,
    );
  await assert.rejects(getTeamMembers(7), { status: 403 });
  globalThis.fetch = async () => jsonResponse([{ userId: 'member' }]);
  assert.deepEqual(await getTeamMembers(7), [{ userId: 'member' }]);
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
