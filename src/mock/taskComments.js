import { MockError } from './planned.js';

export function previewTaskComments(context, state, parts, url, method, body) {
  const byTask = parts[1] === 'tasks';
  const id = Number(parts[2]);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new MockError(
      'INVALID_REQUEST',
      '올바른 댓글 또는 작업 ID가 필요합니다.',
      400,
    );
  const existing = (state.taskComments || []).find(
    (comment) => comment.id === id,
  );
  const taskId = byTask ? id : existing?.taskId;
  if (!byTask && !existing)
    throw new MockError('COMMENT_NOT_FOUND', '댓글이 없습니다.', 404);
  const entry = Object.values(state.teams).find((entry) =>
    entry.tasks.some((task) => task.id === taskId),
  );
  if (!entry) throw new MockError('TASK_NOT_FOUND', '작업이 없습니다.', 404);
  if (!entry.members.some((member) => member.userId === context.user.id))
    throw new MockError(
      'FORBIDDEN',
      '현재 팀원만 댓글을 이용할 수 있습니다.',
      403,
    );
  const comments = state.taskComments || [];
  const response = (comment) => ({
    ...comment,
    authorName:
      entry.members.find((member) => member.userId === comment.authorId)
        ?.name || comment.authorName,
  });
  if (byTask && method === 'GET') {
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);
    if (
      !Number.isSafeInteger(page) ||
      page < 0 ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      size > 100
    )
      throw new MockError(
        'INVALID_REQUEST',
        '댓글 페이지 범위를 확인해 주세요.',
        400,
      );
    return comments
      .filter((comment) => comment.taskId === taskId)
      .sort(
        (a, b) =>
          Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id,
      )
      .slice(page * size, (page + 1) * size)
      .map(response);
  }
  if (
    (!byTask && !['PATCH', 'DELETE'].includes(method)) ||
    (byTask && method !== 'POST')
  )
    throw new MockError('NOT_FOUND', '지원하지 않는 API입니다.', 404);
  if (!byTask && existing.authorId !== context.user.id)
    throw new MockError(
      'FORBIDDEN',
      '본인이 작성한 댓글만 변경할 수 있습니다.',
      403,
    );
  if (
    entry.team.workFrozen ||
    (state.deletion?.teamId === entry.team.id && state.deletion.workFrozen)
  )
    throw new MockError(
      'TEAM_DELETION_IN_PROGRESS',
      '팀 삭제 동의 중에는 댓글을 변경할 수 없습니다.',
    );
  if (method === 'DELETE') {
    state.taskComments = comments.filter((comment) => comment.id !== id);
    return null;
  }
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content || content.length > 2000)
    throw new MockError(
      'INVALID_REQUEST',
      '댓글은 1~2,000자로 작성해 주세요.',
      400,
    );
  const timestamp = new Date().toISOString();
  if (method === 'PATCH') {
    Object.assign(existing, { content, updatedAt: timestamp });
    return response(existing);
  }
  const comment = {
    id: Math.max(
      state.nextTaskCommentId || 1,
      ...comments.map((comment) => comment.id + 1),
    ),
    taskId,
    authorId: context.user.id,
    authorName: context.user.name,
    content,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.nextTaskCommentId = comment.id + 1;
  state.taskComments = [...comments, comment];
  return response(comment);
}
