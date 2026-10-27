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

test('자료 검색 가이드는 독립 데이터로 시작하고 선택한 시나리오만 저장한다', async () => {
  const session = new Map();
  globalThis.sessionStorage = { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: (key) => session.delete(key) };
  try {
    const { prepareGuide, getGuideSteps, readGuideSession, guideTaskId, guideScopeKey } = await import('../src/mock/guide.js');
    const guide = prepareGuide('materials-search');
    assert.equal(getGuideSteps(guide.scenarioId).length, 4);
    assert.equal(readGuideSession().scenarioId, 'materials-search');
    assert.equal(Object.hasOwn(readGuideSession(), 'step'), false);
    assert.equal(getMockState(previewContext()).teams[1].tasks.some((task) => task.id === guideTaskId), false);
    const status = await previewRequest(`${base}/index-status`);
    assert.ok(status.readyCount > 0);
    const originalScope = sessionStorage.getItem(guideScopeKey);
    const fresh = prepareGuide(readGuideSession().scenarioId);
    assert.equal(fresh.step, 0);
    assert.notEqual(fresh.scope, originalScope);
    assert.throws(() => prepareGuide('mid-feedback'));
  } finally { delete globalThis.sessionStorage; }
});

test('자료 가이드는 답변 없음·다른 팀·버전이나 인용 범위가 다른 원문을 완료로 취급하지 않는다', async () => {
  const { materialsGuideReady, guideExamples } = await import('../src/mock/guide.js');
  const status = await previewRequest(`${base}/index-status`);
  assert.equal(materialsGuideReady('materials-overview', { status }), true);
  assert.equal(materialsGuideReady('materials-overview', { status: { ...status, readyCount: 0 } }), false);
  const answer = await previewRequest(`${base}/questions`, { method: 'POST', body: { question: guideExamples.question } });
  assert.equal(materialsGuideReady('materials-answer', { answer: { ...answer, answerable: false } }), false);
  assert.equal(materialsGuideReady('materials-question', { answer }), true);
  const reference = answer.references[0];
  const content = await previewRequest(`${base}/sources/${reference.deliverableId}?expectedVersion=${reference.deliverableVersion}`);
  const source = { ...reference, teamId: content.teamId, ready: true };
  assert.equal(materialsGuideReady('materials-source', { answer, source }), true);
  for (const change of [{ ready: false }, { teamId: 2 }, { deliverableVersion: reference.deliverableVersion + 1 }, { endLine: reference.endLine + 1 }]) {
    assert.equal(materialsGuideReady('materials-source', { answer, source: { ...source, ...change } }), false);
  }
});

test('자료 검색 가이드의 원문 설명은 열기 전·로딩·준비 완료·실패·다른 자료를 구분한다', async () => {
  const { materialsGuideSteps, materialsSourceGuideStep, materialsGuideReady } = await import('../src/mock/guide.js');
  const step = materialsGuideSteps.find((entry) => entry.id === 'materials-source');
  const answer = { teamId: 1, answerable: true, references: [{ deliverableId: 1, deliverableVersion: 2, startLine: 1, endLine: 3 }] };
  const source = { ...answer.references[0], teamId: 1, ready: true, loading: false, error: false };
  assert.equal(materialsSourceGuideStep(step, { answer }), step);
  assert.equal(materialsSourceGuideStep(step, { answer, source: null }), step);
  const opened = materialsSourceGuideStep(step, { answer, source });
  assert.equal(opened.title, '강조된 원문과 인용 내용을 비교하세요');
  assert.match(opened.description, /강조된 부분과 답변의 인용문·줄 번호/);
  assert.doesNotMatch(opened.description, /‘원문 확인’을 눌러/);
  assert.equal(materialsGuideReady(step.id, { answer, source }), true);
  const loading = materialsSourceGuideStep(step, { answer, source: { ...source, ready: false, loading: true } });
  assert.equal(loading.title, '근거 원문을 불러오고 있습니다');
  assert.equal(loading.calloutTarget, '.rag-source-message');
  const failed = materialsSourceGuideStep(step, { answer, source: { ...source, ready: false, error: true } });
  assert.equal(failed.title, '원문 조회 상태를 확인하세요');
  assert.equal(failed.actionTarget, null);
  assert.equal(materialsGuideReady(step.id, { answer, source: { ...source, ready: false } }), false);
  for (const change of [{ deliverableId: 99 }, { deliverableVersion: 3 }, { teamId: 2 }, { startLine: undefined, endLine: undefined }]) {
    assert.equal(materialsSourceGuideStep(step, { answer, source: { ...source, ...change } }).title, '답변의 근거 자료를 열어 주세요');
  }
  assert.equal(materialsSourceGuideStep(materialsGuideSteps[0], { answer, source }), materialsGuideSteps[0]);
});
