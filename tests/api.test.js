import {
  getTeamReport,
  generateTeamReport,
  publishReport,
} from '../src/api/reports.js';
import { getMemberContributions } from '../src/api/dashboard.js';
import { listSpaceParticipants, removeSpaceParticipant } from '../src/api/spaceParticipants.js';
import { getManagerPeerResponses } from '../src/api/evaluations.js';
import { getAiReview, requestAiReview } from '../src/api/aiReviews.js';
import { getMyWorkSummary, getTeam, getTeamMembers } from '../src/api/teams.js';
import { invalidateSpaceList, listSpaces } from '../src/api/spaces.js';
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
import { listSpaceAnnouncements, getSpaceAnnouncement, createSpaceAnnouncement, updateSpaceAnnouncement, deleteSpaceAnnouncement } from '../src/api/spaceAnnouncements.js';
import { updateTask, recommendTaskAssignees } from '../src/api/tasks.js';
import {
  listTaskComments,
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
} from '../src/api/taskComments.js';
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

test('담당자 추천은 인원 쿼리와 세션으로 조회하며 본문·CSRF 요청 없이 선택 목록을 받는다', async () => {
  const selected = [{ userId: '00000000-0000-4000-8000-000000000001', allocationPercent: 100 }];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return jsonResponse(selected);
  };
  assert.deepEqual(await recommendTaskAssignees(7, 1), selected);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/api/teams/7/task-assignee-recommendations?count=1'));
  assert.equal(calls[0].credentials, 'include');
  assert.equal(calls[0].body, undefined);
});

test('참여자 조회는 캐시·쿼리 없이 배열을 받고 삭제는 세션·CSRF 및 본문 없는 204 계약을 사용한다', async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith('/csrf')) return jsonResponse({ headerName: 'X-CSRF-TOKEN', token: 'token' });
    return options.method === 'DELETE' ? new Response(null, { status: 204 }) : jsonResponse([]);
  };
  const path = '/api/spaces/1/manager-dashboard/members';
  assert.deepEqual(await listSpaceParticipants(1), []);
  assert.deepEqual(await listSpaceParticipants(1), []);
  assert.equal(await removeSpaceParticipant(1, '00000000-0000-4000-8000-000000000003'), null);
  assert.deepEqual(calls.map((call) => [call.url, call.method]), [[path, 'GET'], [path, 'GET'], ['/api/auth/csrf', undefined], [`${path}/00000000-0000-4000-8000-000000000003`, 'DELETE']]);
  assert.equal(calls[3].body, undefined);
  assert.equal(calls[3].headers['X-CSRF-TOKEN'], 'token');
  for (const call of calls) assert.equal(call.credentials, 'include');
  globalThis.fetch = async () => jsonResponse({ members: [] });
  await assert.rejects(listSpaceParticipants(1), /응답 형식/);
});

test('공지 5개 API는 배열 페이지·전체 수정·쿼리 버전 삭제와 세션 및 CSRF 계약을 사용한다', async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith('/csrf')) return jsonResponse({ headerName: 'X-CSRF-TOKEN', token: 'token' });
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    return jsonResponse(options.method === 'GET' && url.includes('?page=') ? [] : { id: 7, version: 2 });
  };
  const input = { title: '제목', content: '본문', pinned: true };
  assert.deepEqual(await listSpaceAnnouncements(1, 2, 20), []);
  assert.equal((await getSpaceAnnouncement(1, 7)).id, 7);
  await createSpaceAnnouncement(1, input);
  await updateSpaceAnnouncement(1, 7, { ...input, expectedVersion: 2 });
  assert.equal(await deleteSpaceAnnouncement(1, 7, 3), null);
  assert.deepEqual(calls.map((call) => [call.url, call.method || 'GET']), [
    ['/api/spaces/1/announcements?page=2&size=20', 'GET'],
    ['/api/spaces/1/announcements/7', 'GET'],
    ['/api/auth/csrf', 'GET'],
    ['/api/spaces/1/announcements', 'POST'],
    ['/api/spaces/1/announcements/7', 'PATCH'],
    ['/api/spaces/1/announcements/7?expectedVersion=3', 'DELETE'],
  ]);
  assert.deepEqual(JSON.parse(calls[3].body), input);
  assert.deepEqual(JSON.parse(calls[4].body), { ...input, expectedVersion: 2 });
  assert.equal(calls[5].body, undefined);
  for (const call of calls) assert.equal(call.credentials, 'include');
  for (const call of calls.slice(3)) assert.equal(call.headers['X-CSRF-TOKEN'], 'token');
  assert.equal(calls[0].headers['X-CSRF-TOKEN'], undefined);
});

test('댓글 4개 API는 페이지 배열·본문 필드·세션과 CSRF·204 삭제 계약을 사용한다', async () => {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith('/csrf'))
      return jsonResponse({ headerName: 'X-CSRF-TOKEN', token: 'token' });
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    return jsonResponse(
      options.method === 'GET' ? [] : { id: 7, content: '본문' },
    );
  };
  assert.deepEqual(await listTaskComments(101, 1, 20), []);
  await createTaskComment(101, '본문');
  await updateTaskComment(7, '변경');
  assert.equal(await deleteTaskComment(7), null);
  assert.deepEqual(
    calls.map((call) => [call.url, call.method || 'GET']),
    [
      ['/api/tasks/101/comments?page=1&size=20', 'GET'],
      ['/api/auth/csrf', 'GET'],
      ['/api/tasks/101/comments', 'POST'],
      ['/api/task-comments/7', 'PATCH'],
      ['/api/task-comments/7', 'DELETE'],
    ],
  );
  assert.deepEqual(JSON.parse(calls[2].body), { content: '본문' });
  assert.deepEqual(JSON.parse(calls[3].body), { content: '변경' });
  for (const call of calls.slice(2)) {
    assert.equal(call.credentials, 'include');
    assert.equal(call.headers['X-CSRF-TOKEN'], 'token');
  }
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
test('직접 완료와 재수정은 PATCH 상태와 버전만 전송한다', async () => {
  await updateTask(7, { status: 'IN_PROGRESS', expectedVersion: 3 });
  await updateTask(7, { status: 'DONE', expectedVersion: 4 });
  await updateTask(7, { status: 'REVISING', expectedVersion: 5 });
  assert.equal(calls[1].url, '/api/tasks/7');
  assert.equal(calls[1].headers['X-CSRF-TOKEN'], 'token');
  assert.deepEqual(JSON.parse(calls[1].body), {
    status: 'IN_PROGRESS',
    expectedVersion: 3,
  });
  assert.equal(calls[2].url, '/api/tasks/7');
  assert.equal(calls[2].method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[2].body), {
    status: 'DONE',
    expectedVersion: 4,
  });
  assert.deepEqual(JSON.parse(calls[3].body), {
    status: 'REVISING',
    expectedVersion: 5,
  });
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

test('팀 홈 API는 표시 구간·개인 부분 수정과 일정 version·CSRF·204 삭제 계약을 사용한다', async () => {
  const {
    listCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    getHomePreferences,
    updateHomePreferences,
  } = await import('../src/api/teamHome.js');
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith('/csrf'))
      return jsonResponse({ headerName: 'X-CSRF-TOKEN', token: 'token' });
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    return jsonResponse(
      options.method === 'GET' && url.includes('calendar-events')
        ? []
        : { teamId: 1 },
    );
  };
  await listCalendarEvents(1, '2026-09-27', '2026-10-31');
  await getHomePreferences(1);
  await updateHomePreferences(1, { widgets: [] });
  await updateHomePreferences(1, { memo: '' });
  const body = {
    title: '회의',
    kind: 'meeting',
    notes: '',
    allDay: true,
    startAt: '2026-10-21T00:00:00',
    endAt: '2026-10-22T00:00:00',
    schedule: { mode: 'single' },
  };
  await createCalendarEvent(1, body);
  await updateCalendarEvent(7, { ...body, expectedVersion: 3 });
  assert.equal(await deleteCalendarEvent(7, 4), null);
  const actual = calls.filter((call) => !call.url.endsWith('/csrf'));
  assert.deepEqual(
    actual.map((call) => [call.method, call.url]),
    [
      ['GET', '/api/teams/1/calendar-events?from=2026-09-27&to=2026-10-31'],
      ['GET', '/api/teams/1/home-preferences/me'],
      ['PATCH', '/api/teams/1/home-preferences/me'],
      ['PATCH', '/api/teams/1/home-preferences/me'],
      ['POST', '/api/teams/1/calendar-events'],
      ['PATCH', '/api/calendar-events/7'],
      ['DELETE', '/api/calendar-events/7?expectedVersion=4'],
    ],
  );
  assert.deepEqual(JSON.parse(actual[2].body), { widgets: [] });
  assert.deepEqual(JSON.parse(actual[3].body), { memo: '' });
  assert.equal(JSON.parse(actual[5].body).expectedVersion, 3);
  assert.ok(actual.every((call) => call.credentials === 'include'));
  assert.ok(
    actual
      .filter((call) => call.method !== 'GET')
      .every((call) => call.headers['X-CSRF-TOKEN'] === 'token'),
  );
});

test('팀 자료 질문·준비 현황은 현재 API 계약과 세션·CSRF를 사용한다', async () => {
  const { askTeamMaterials, getRagIndexStatus } = await import('../src/api/rag.js');
  await getRagIndexStatus(3, 2, 20);
  await askTeamMaterials(3, '게시글 처리 정책은?');
  const actual = calls.filter((call) => !call.url.endsWith('/csrf'));
  assert.equal(actual[0].url, '/api/teams/3/rag/index-status?page=2&size=20');
  assert.equal(actual[0].method, 'GET');
  assert.equal(actual[1].url, '/api/teams/3/rag/questions');
  assert.equal(actual[1].method, 'POST');
  assert.deepEqual(JSON.parse(actual[1].body), { question: '게시글 처리 정책은?' });
  assert.equal(actual[1].headers['X-CSRF-TOKEN'], 'token');
  assert.ok(actual.every((call) => call.credentials === 'include'));
});
test('원문 조회는 현재 자료 버전을 쿼리에 보내고 세션을 포함한 GET을 사용한다', async () => {
  const { getRagSource } = await import('../src/api/rag.js');
  const source = {
    teamId: 3, deliverableId: 2, deliverableVersion: 0,
    title: '회원 정책', type: 'TEXT', content: '# 정책\n게시글 유지',
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return jsonResponse(source);
  };
  assert.deepEqual(await getRagSource(3, 2, 0), source);
  assert.equal(calls[0].url, '/api/teams/3/rag/sources/2?expectedVersion=0');
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].credentials, 'include');
  assert.equal(calls[0].body, undefined);
});
test('원문 변경·권한·읽기 실패는 목업이나 이전 버전으로 대체하지 않는다', async () => {
  const { getRagSource } = await import('../src/api/rag.js');
  for (const [status, code] of [
    [401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'], [404, 'DELIVERABLE_NOT_FOUND'],
    [409, 'RAG_SOURCE_CHANGED'], [413, 'RAG_SOURCE_TOO_LARGE'],
    [415, 'RAG_SOURCE_UNSUPPORTED'], [422, 'RAG_SOURCE_UNREADABLE'],
  ]) {
    globalThis.fetch = async () => jsonResponse({ code, message: code }, status);
    await assert.rejects(getRagSource(3, 2, 0), { status, code });
  }
});
