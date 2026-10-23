import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  previewContext,
  previewRequest,
  setPreviewRole,
  setRagPreviewScenario,
} from '../src/mock/preview.js';
import {
  getMockState,
  resetMockState,
  saveMockState,
} from '../src/mock/planned.js';
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key),
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
beforeEach(() => {
  storage.clear();
  setPreviewRole('leader');
  resetMockState(previewContext());
});
const base = '/api/teams/1/rag';
test('질문 결과의 근거는 현재 팀 자료·버전·실제 본문과 일치한다', async () => {
  const status = await previewRequest(`${base}/index-status?page=0&size=2`);
  assert.equal(status.items.length, 2);
  assert.equal(status.totalElements, 4);
  assert.equal(status.readyCount, 3);
  const answer = await previewRequest(`${base}/questions`, {
    method: 'POST',
    body: { question: '프로젝트 범위는?' },
  });
  assert.equal(answer.answerable, true);
  for (const ref of answer.references) {
    const source = await previewRequest(
      `${base}/sources/${ref.deliverableId}?expectedVersion=${ref.deliverableVersion}`,
    );
    assert.equal(source.teamId, answer.teamId);
    assert.equal(source.deliverableVersion, ref.deliverableVersion);
    assert.ok(source.content.includes(ref.quote));
    assert.equal(ref.startLine, 1);
  }
});
test('미가입자·관리자는 자료 질문·준비 현황·원문에 접근할 수 없다', async () => {
  for (const role of ['manager', 'participant']) {
    setPreviewRole(role);
    for (const [suffix, method, body] of [
      ['/questions', 'POST', { question: '범위?' }],
      ['/index-status', 'GET'],
      ['/sources/1001?expectedVersion=1', 'GET'],
    ])
      await assert.rejects(previewRequest(base + suffix, { method, body }), {
        status: 403,
      });
  }
});
test('자료 변경·삭제 후 이전 원문을 표시하지 않는다', async () => {
  const context = previewContext(),
    state = getMockState(context);
  state.teams[1].deliverables[0].version++;
  saveMockState(context, state);
  await assert.rejects(
    previewRequest(`${base}/sources/1001?expectedVersion=1`),
    { code: 'RAG_SOURCE_CHANGED' },
  );
  state.teams[1].deliverables = state.teams[1].deliverables.filter(
    (item) => item.id !== 1001,
  );
  saveMockState(context, state);
  await assert.rejects(
    previewRequest(`${base}/sources/1001?expectedVersion=2`),
    { status: 404 },
  );
});
test('준비 중·근거 없음·기능 중지는 성공 답변으로 대체하지 않는다', async () => {
  for (const [scenario, reason] of [
    ['preparing', 'NO_READY_SOURCES'],
    ['no-evidence', 'NO_RELEVANT_SOURCES'],
  ]) {
    setRagPreviewScenario(scenario);
    const answer = await previewRequest(`${base}/questions`, {
      method: 'POST',
      body: { question: '정책은?' },
    });
    assert.equal(answer.answerable, false);
    assert.equal(answer.reason, reason);
    assert.deepEqual(answer.references, []);
  }
  setRagPreviewScenario('disabled');
  assert.equal((await previewRequest(`${base}/index-status`)).enabled, false);
  await assert.rejects(
    previewRequest(`${base}/questions`, {
      method: 'POST',
      body: { question: '정책은?' },
    }),
    { code: 'RAG_UNAVAILABLE', status: 503 },
  );
});
test('실패 자료의 준비 현황은 조회만 제공하고 사용자 재처리 요청은 받지 않는다', async () => {
  setRagPreviewScenario('failed');
  const before = await previewRequest(`${base}/index-status`);
  const failed = before.items.find((item) => item.status === 'FAILED');
  assert.ok(failed);
  assert.equal(failed.failureCode, 'UPSTREAM_UNAVAILABLE');
  await assert.rejects(
    previewRequest(`${base}/sources/${failed.deliverableId}/reindex`, {
      method: 'POST',
      body: { expectedVersion: failed.deliverableVersion },
    }),
    { code: 'NOT_FOUND', status: 404 },
  );
  assert.deepEqual(await previewRequest(`${base}/index-status`), before);
});
