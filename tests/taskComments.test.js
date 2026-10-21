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

test('모든 작업 상태와 FINAL 이후에도 비담당 팀원이 댓글을 쓰며 작업·AI 입력은 유지한다', async () => {
  setPreviewRole('teammate');
  const context = previewContext();
  const state = getMockState(context);
  state.rounds.find((round) => round.type === 'FINAL').closesAt =
    '2020-01-01T00:00:00Z';
  state.aiReviews = { 101: { id: 1, isCurrent: true, status: 'SUCCEEDED' } };
  saveMockState(context, state);
  const before = structuredClone(state.teams[1].tasks);
  for (const task of state.teams[1].tasks.slice(0, 4)) {
    const comment = await previewRequest(`/api/tasks/${task.id}/comments`, {
      method: 'POST',
      body: { content: '  피드백\n두 번째 줄  ' },
    });
    assert.equal(comment.content, '피드백\n두 번째 줄');
    assert.equal(comment.authorId, context.user.id);
    const edited = await previewRequest(`/api/task-comments/${comment.id}`, {
      method: 'PATCH',
      body: { content: '수정 의견' },
    });
    assert.equal(edited.createdAt, comment.createdAt);
    assert.equal(edited.content, '수정 의견');
    await previewRequest(`/api/task-comments/${comment.id}`, {
      method: 'DELETE',
    });
  }
  const after = getMockState(context);
  assert.deepEqual(after.teams[1].tasks, before);
  assert.deepEqual(after.aiReviews, state.aiReviews);
});

test('리더도 타인 댓글은 수정·삭제하지 못하며 미가입·관리자는 접근하지 못한다', async () => {
  setPreviewRole('member');
  const comment = await previewRequest('/api/tasks/101/comments', {
    method: 'POST',
    body: { content: '팀원 댓글' },
  });
  setPreviewRole('leader');
  for (const method of ['PATCH', 'DELETE']) {
    await assert.rejects(
      previewRequest(`/api/task-comments/${comment.id}`, {
        method,
        body: { content: '변경' },
      }),
      { status: 403, code: 'FORBIDDEN' },
    );
  }
  for (const role of ['manager', 'participant']) {
    setPreviewRole(role);
    await assert.rejects(previewRequest('/api/tasks/101/comments'), {
      status: 403,
    });
    await assert.rejects(
      previewRequest('/api/tasks/101/comments', {
        method: 'POST',
        body: { content: '접근' },
      }),
      { status: 403 },
    );
  }
  setPreviewRole('leader');
  await assert.rejects(previewRequest('/api/tasks/201/comments'), {
    status: 403,
  });
});

test('댓글 삭제 동결은 읽기를 유지하고 작성·수정·삭제를 차단한다', async () => {
  const comment = await previewRequest('/api/tasks/101/comments', {
    method: 'POST',
    body: { content: '의견' },
  });
  const context = previewContext();
  const state = getMockState(context);
  state.deletion = { teamId: 1, workFrozen: true };
  saveMockState(context, state);
  assert.equal((await previewRequest('/api/tasks/101/comments')).length, 1);
  for (const [path, method] of [
    ['/api/tasks/101/comments', 'POST'],
    [`/api/task-comments/${comment.id}`, 'PATCH'],
    [`/api/task-comments/${comment.id}`, 'DELETE'],
  ]) {
    await assert.rejects(
      previewRequest(path, { method, body: { content: '변경' } }),
      { status: 409, code: 'TEAM_DELETION_IN_PROGRESS' },
    );
  }
});

test('본문 경계·빈 입력·없는 대상 및 배열 페이지 정렬 계약을 검증한다', async () => {
  for (const content of [null, '', ' \n ', '가'.repeat(2001)]) {
    await assert.rejects(
      previewRequest('/api/tasks/101/comments', {
        method: 'POST',
        body: { content },
      }),
      { status: 400 },
    );
  }
  await previewRequest('/api/tasks/101/comments', {
    method: 'POST',
    body: { content: '가'.repeat(2000) },
  });
  for (let i = 0; i < 20; i++)
    await previewRequest('/api/tasks/101/comments', {
      method: 'POST',
      body: { content: String(i) },
    });
  const first = await previewRequest('/api/tasks/101/comments?page=0&size=20');
  const second = await previewRequest('/api/tasks/101/comments?page=1&size=20');
  assert.equal(first.length, 20);
  assert.equal(second.length, 1);
  assert.ok(first.at(-1).id < second[0].id);
  assert.deepEqual(
    await previewRequest('/api/tasks/101/comments?page=2&size=20'),
    [],
  );
  for (const query of ['page=-1', 'size=101', 'page=1.5', 'size=0'])
    await assert.rejects(previewRequest(`/api/tasks/101/comments?${query}`), {
      status: 400,
    });
  await assert.rejects(previewRequest('/api/tasks/99999/comments'), {
    code: 'TASK_NOT_FOUND',
    status: 404,
  });
  await assert.rejects(
    previewRequest('/api/task-comments/99999', { method: 'DELETE' }),
    { code: 'COMMENT_NOT_FOUND', status: 404 },
  );
});
