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
