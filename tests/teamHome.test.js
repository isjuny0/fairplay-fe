import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  previewContext,
  previewRequest,
  setPreviewRole,
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
const body = {
  title: '팀 공유 일정',
  kind: 'meeting',
  notes: '',
  allDay: true,
  startAt: '2026-10-21T00:00:00',
  endAt: '2026-10-22T00:00:00',
  schedule: { mode: 'single' },
};
test('다른 팀원도 공유 일정을 변경하지만 개인 위젯과 메모는 분리한다', async () => {
  const event = await previewRequest('/api/teams/1/calendar-events', {
    method: 'POST',
    body,
  });
  await previewRequest('/api/teams/1/home-preferences/me', {
    method: 'PATCH',
    body: { memo: '비공개 메모', widgets: ['memo'] },
  });
  setPreviewRole('member');
  assert.equal(
    (
      await previewRequest(
        '/api/teams/1/calendar-events?from=2026-10-21&to=2026-10-21',
      )
    )[0].id,
    event.id,
  );
  assert.equal(
    (await previewRequest('/api/teams/1/home-preferences/me')).memo,
    '',
  );
  const updated = await previewRequest(`/api/calendar-events/${event.id}`, {
    method: 'PATCH',
    body: { ...body, title: '공유 수정', expectedVersion: 0 },
  });
  assert.equal(updated.version, 1);
  await assert.rejects(
    previewRequest(`/api/calendar-events/${event.id}?expectedVersion=0`, {
      method: 'DELETE',
    }),
    { code: 'CALENDAR_EVENT_VERSION_CONFLICT' },
  );
  setPreviewRole('leader');
  assert.equal(
    (await previewRequest('/api/teams/1/home-preferences/me')).memo,
    '비공개 메모',
  );
  await previewRequest(`/api/calendar-events/${event.id}?expectedVersion=1`, {
    method: 'DELETE',
  });
});
test('공유 일정은 삭제 동의 중 조회만 가능하고 개인 메모는 저장할 수 있다', async () => {
  const event = await previewRequest('/api/teams/1/calendar-events', {
    method: 'POST',
    body,
  });
  const context = previewContext(),
    state = getMockState(context);
  state.deletion = { teamId: 1, workFrozen: true };
  saveMockState(context, state);
  assert.equal(
    (
      await previewRequest(
        '/api/teams/1/calendar-events?from=2026-10-21&to=2026-10-21',
      )
    ).length,
    1,
  );
  await assert.rejects(
    previewRequest(`/api/calendar-events/${event.id}?expectedVersion=0`, {
      method: 'DELETE',
    }),
    { code: 'TEAM_DELETION_IN_PROGRESS' },
  );
  assert.equal(
    (
      await previewRequest('/api/teams/1/home-preferences/me', {
        method: 'PATCH',
        body: { memo: '내 메모' },
      })
    ).memo,
    '내 메모',
  );
  setPreviewRole('manager');
  await assert.rejects(previewRequest('/api/teams/1/home-preferences/me'), {
    status: 403,
  });
});


test('브리핑은 펼침·재조회만으로 확인되지 않고 확인한 뒤에만 사라진다', async () => {
  const first = await previewRequest('/api/teams/1/briefing');
  assert.equal(first.hasUpdates, true);
  assert.equal(first.highlights.length, Math.min(2, first.items.length));
  assert.equal(first.totalEventCount, first.items.length);
  assert.equal(first.additionalCount, first.items.length - first.highlights.length);
  const second = await previewRequest('/api/teams/1/briefing');
  assert.deepEqual(second.items, first.items);
  const material = first.items.find(({ targetType }) => targetType === 'DELIVERABLE');
  assert.equal((await previewRequest(`/api/deliverables/${material.targetId}`)).id, material.targetId);
  const result = await previewRequest('/api/teams/1/briefing/acknowledge', {
    method: 'POST', body: { ackToken: first.ackToken },
  });
  assert.equal(result, null);
  const empty = await previewRequest('/api/teams/1/briefing');
  assert.equal(empty.hasUpdates, false);
  assert.deepEqual(empty.items, []);
  assert.equal(empty.ackToken, null);
});

test('브리핑 확인은 다른 사용자와 관리자의 접근을 거부한다', async () => {
  const briefing = await previewRequest('/api/teams/1/briefing');
  setPreviewRole('member');
  await assert.rejects(previewRequest('/api/teams/1/briefing/acknowledge', {
    method: 'POST', body: { ackToken: briefing.ackToken },
  }), { code: 'FORBIDDEN' });
  setPreviewRole('manager');
  await assert.rejects(previewRequest('/api/teams/1/briefing'), { code: 'FORBIDDEN' });
  setPreviewRole('leader');
  assert.equal((await previewRequest('/api/teams/1/briefing')).hasUpdates, true);
});

test('이전 브리핑 확인을 반복해도 조회 이후의 새 변경은 남아 있다', async () => {
  const briefing = await previewRequest('/api/teams/1/briefing');
  const context = previewContext(), state = getMockState(context);
  state.teamBriefingEvents[1].push({
    ...briefing.items[0], id: 'task-new-change', position: briefing.totalEventCount + 1,
    title: '조회 이후의 새 변경',
  });
  saveMockState(context, state);
  for (let repeat = 0; repeat < 2; repeat++) await previewRequest('/api/teams/1/briefing/acknowledge', {
    method: 'POST', body: { ackToken: briefing.ackToken },
  });
  const next = await previewRequest('/api/teams/1/briefing');
  assert.equal(next.items.length, 1);
  assert.equal(next.items[0].title, '조회 이후의 새 변경');
});


test('브리핑 개별 확인은 선택한 항목만 제외하고 이후 새 변경과 다른 사용자 상태를 보존한다', async () => {
  const first = await previewRequest('/api/teams/1/briefing');
  const item = first.items[0];
  const ack = () => previewRequest('/api/teams/1/briefing/acknowledge', {
    method: 'POST', body: { ackToken: first.ackToken, itemId: item.id },
  });
  await ack();
  await ack();
  const remaining = await previewRequest('/api/teams/1/briefing');
  assert.deepEqual(remaining.items, first.items.filter(({ id }) => id !== item.id));
  assert.equal(remaining.totalEventCount, first.totalEventCount - 1);
  assert.equal(remaining.highlights.length, Math.min(2, remaining.items.length));
  const context = previewContext(), state = getMockState(context);
  state.teamBriefingEvents[1].push({ ...item, position: first.totalEventCount + 1, title: '같은 대상의 새 변경' });
  saveMockState(context, state);
  await ack();
  assert.ok((await previewRequest('/api/teams/1/briefing')).items.some(({ title }) => title === '같은 대상의 새 변경'));
  setPreviewRole('member');
  assert.ok((await previewRequest('/api/teams/1/briefing')).items.some(({ id }) => id === item.id));
});

test('브리핑 조회에 없는 항목은 개별 확인할 수 없다', async () => {
  const briefing = await previewRequest('/api/teams/1/briefing');
  await assert.rejects(previewRequest('/api/teams/1/briefing/acknowledge', {
    method: 'POST', body: { ackToken: briefing.ackToken, itemId: 'task-not-in-window' },
  }), { code: 'INVALID_REQUEST' });
  assert.equal((await previewRequest('/api/teams/1/briefing')).totalEventCount, briefing.totalEventCount);
});
