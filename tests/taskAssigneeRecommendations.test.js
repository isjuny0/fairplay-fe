import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMockState,
  resetMockState,
  saveMockState,
} from '../src/mock/planned.js';
import {
  previewContext,
  previewRequest,
  setPreviewRole,
} from '../src/mock/preview.js';

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
const recommend = (count) =>
  previewRequest(`/api/teams/1/task-assignee-recommendations?count=${count}`);

test('완료·미완료 전체의 현재 가중치·배분으로 선택하고 100%로 균등 배분하며 원자료는 변경하지 않는다', async () => {
  const context = previewContext(),
    state = getMockState(context),
    entry = state.teams[1];
  const [a, b, c] = entry.members;
  entry.tasks = [
    {
      id: 1,
      weight: 8,
      status: 'DONE',
      assignees: [{ userId: a.userId, allocationPercent: 100 }],
    },
    {
      id: 2,
      weight: 5,
      status: 'IN_PROGRESS',
      assignees: [
        { userId: b.userId, allocationPercent: 60 },
        { userId: c.userId, allocationPercent: 40 },
      ],
    },
    {
      id: 3,
      weight: 1,
      status: 'REVISING',
      assignees: [{ userId: c.userId, allocationPercent: 100 }],
    },
    {
      id: 4,
      weight: 1,
      status: 'TODO',
      assignees: [{ userId: b.userId, allocationPercent: 100 }],
    },
  ];
  // B=4, C=3이므로 완료 작업까지 포함한 순서는 C, B, A다.
  saveMockState(context, state);
  const before = getMockState(context);
  assert.deepEqual(await recommend(2), [
    { userId: c.userId, allocationPercent: 50 },
    { userId: b.userId, allocationPercent: 50 },
  ]);
  assert.deepEqual(await recommend(3), [
    { userId: c.userId, allocationPercent: 34 },
    { userId: b.userId, allocationPercent: 33 },
    { userId: a.userId, allocationPercent: 33 },
  ]);
  assert.deepEqual(getMockState(context), before);
});

test('다른 팀의 작업을 제외하고 동점은 이름·사용자 ID 오름차순이며 무담당 팀원도 선택한다', async () => {
  const context = previewContext(),
    state = getMockState(context),
    entry = state.teams[1];
  entry.tasks = [];
  entry.members.forEach((member) => (member.name = '같은 이름'));
  state.teams[2].tasks = [
    {
      weight: 8,
      assignees: [{ userId: entry.members[0].userId, allocationPercent: 100 }],
    },
  ];
  saveMockState(context, state);
  assert.deepEqual(
    (await recommend(3)).map((item) => item.userId),
    entry.members.map((member) => member.userId).sort(),
  );
});

test('잘못된 인원·미가입·한 명 팀·마감·삭제 동결은 추천을 제공하지 않는다', async () => {
  for (const count of ['', '0', '-1', '1.5', '4', '101', 'invalid'])
    await assert.rejects(recommend(count), {
      status: 400,
      code: 'INVALID_REQUEST',
    });
  for (const role of ['manager', 'participant']) {
    setPreviewRole(role);
    await assert.rejects(recommend(1), { status: 403, code: 'FORBIDDEN' });
  }
  setPreviewRole('leader');
  const context = previewContext(),
    state = getMockState(context);
  state.deletion = { teamId: 1, workFrozen: true };
  saveMockState(context, state);
  await assert.rejects(recommend(1), {
    status: 409,
    code: 'TEAM_DELETION_IN_PROGRESS',
  });
  state.deletion = null;
  state.rounds.find((round) => round.type === 'FINAL').closesAt =
    '2020-01-01T00:00:00';
  saveMockState(context, state);
  await assert.rejects(recommend(1), { status: 409, code: 'TASK_WORK_CLOSED' });
  state.rounds = [];
  state.teams[1].members = [state.teams[1].members[0]];
  saveMockState(context, state);
  await assert.rejects(recommend(1), {
    status: 409,
    code: 'INSUFFICIENT_TEAM_MEMBERS',
  });
});
