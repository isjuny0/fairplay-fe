import { useRef, useState } from 'react';
import {
  createTaskComment,
  deleteTaskComment,
  listTaskComments,
  updateTaskComment,
} from '../api/taskComments.js';
import useResource from '../hooks/useResource.js';
import {
  useInteractions,
  useUnsavedChanges,
} from '../hooks/useInteractions.js';
import {
  formatDate,
  isApprovedMember,
  teamWorkBlocked,
} from '../lib/domain.js';
import { ErrorNotice, Field, ResourceState } from './ui.jsx';

const PAGE_SIZE = 20;

function CommentForm({
  initialContent = '',
  editing = false,
  busy,
  blocked,
  onSave,
  onCancel,
}) {
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState(null);
  const input = useRef(null);
  const changed = content.trim() !== initialContent.trim();
  useUnsavedChanges(changed);
  return (
    <form
      className="task-comment-form"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || blocked) return;
        const trimmed = content.trim();
        if (!trimmed || trimmed.length > 2000) {
          setError(
            '댓글은 공백을 제외한 내용이 있도록 1~2,000자로 작성해 주세요.',
          );
          input.current?.focus();
          return;
        }
        if (editing && !changed) return;
        if (await onSave(trimmed)) {
          if (!editing) setContent('');
          setError(null);
        }
      }}
    >
      <Field label={editing ? '댓글 수정 내용' : '댓글 내용'} error={error}>
        <textarea
          ref={input}
          rows={3}
          maxLength={2000}
          placeholder="팀원에게 의견을 남겨보세요."
          value={content}
          disabled={busy || blocked}
          onChange={(event) => {
            setContent(event.target.value);
            setError(null);
          }}
        />
      </Field>
      <div className="task-comment-form-actions">
        <span className="field-help">{content.length} / 2,000자</span>
        <div>
          {editing && (
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={onCancel}
            >
              취소
            </button>
          )}
          <button
            className="primary-button"
            disabled={
              busy || blocked || !content.trim() || (editing && !changed)
            }
          >
            {editing ? '수정 저장' : '댓글 등록'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function TaskComments({ taskId, team, user }) {
  const [page, setPage] = useState(0);
  const resource = useResource(
    () => listTaskComments(taskId, page, PAGE_SIZE),
    [taskId, team.id, user.id, page],
  );
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const { confirm, notify } = useInteractions();
  const approved = isApprovedMember(team);
  const blocked = !approved || teamWorkBlocked(team);
  const unavailable = resource.loading || Boolean(resource.error);
  const comments = resource.data || [];

  const mutate = async (action, message, afterSave) => {
    if (mutationLock.current || blocked || unavailable) return false;
    mutationLock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      afterSave?.();
      notify(message);
      resource.reload();
      return true;
    } catch (requestError) {
      setError(requestError);
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  };

  return (
    <section
      id="task-comments-section"
      tabIndex={-1}
      className="panel task-comments-panel task-section-anchor"
      aria-label="작업 댓글"
    >
      <div className="task-comments-heading">
        <h2>댓글</h2>
        <button
          type="button"
          className="text-button"
          disabled={busy || resource.loading || editingId !== null}
          onClick={() => {
            setError(null);
            resource.reload();
          }}
        >
          새로고침
        </button>
      </div>
      <ErrorNotice error={error} />
      {approved && (
        <CommentForm
          busy={busy}
          blocked={blocked || unavailable || editingId !== null}
          onSave={(content) =>
            mutate(
              () => createTaskComment(taskId, content),
              '댓글을 등록했습니다.',
            )
          }
        />
      )}
      {team.workFrozen && (
        <p className="field-help" role="status">
          팀 삭제 동의 중에는 댓글을 조회만 할 수 있습니다.
        </p>
      )}
      {team.workStateUnknown && (
        <p className="field-help" role="status">
          팀 상태를 확인하는 중입니다.
        </p>
      )}
      <ResourceState resource={resource} label="댓글">
        {!comments.length ? (
          <p className="task-comments-empty">
            {page ? '이 페이지에는 댓글이 없습니다.' : '아직 댓글이 없습니다.'}
          </p>
        ) : (
          <ul className="clean-list task-comment-list" aria-label="댓글 목록">
            {comments.map((comment) => (
              <li key={comment.id} className="task-comment-entry">
                <div className="task-comment-author">
                  <strong>
                    {comment.authorName}
                    {comment.authorId === user.id && ' · 나'}
                  </strong>
                  {approved &&
                    comment.authorId === user.id &&
                    editingId !== comment.id && (
                      <div className="task-comment-actions">
                        <button
                          type="button"
                          className="text-button"
                          disabled={
                            busy || blocked || unavailable || editingId !== null
                          }
                          onClick={() => {
                            setError(null);
                            setEditingId(comment.id);
                          }}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="text-button danger"
                          disabled={
                            busy || blocked || unavailable || editingId !== null
                          }
                          onClick={async () => {
                            if (
                              !(await confirm({
                                title: '댓글 삭제',
                                message:
                                  '댓글을 삭제할까요? 삭제한 댓글은 복구할 수 없습니다.',
                                label: '댓글 삭제',
                                danger: true,
                              }))
                            )
                              return;
                            mutate(
                              () => deleteTaskComment(comment.id),
                              '댓글을 삭제했습니다.',
                              () => {
                                if (comments.length === 1 && page > 0)
                                  setPage(page - 1);
                              },
                            );
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    )}
                </div>
                <p className="task-comment-time">
                  <time dateTime={comment.createdAt}>
                    {formatDate(comment.createdAt)}
                  </time>
                  {Date.parse(comment.updatedAt) >
                    Date.parse(comment.createdAt) && (
                    <span title={`수정 ${formatDate(comment.updatedAt)}`}>
                      {' '}
                      · 수정됨
                    </span>
                  )}
                </p>
                {editingId === comment.id ? (
                  <CommentForm
                    initialContent={comment.content}
                    editing
                    busy={busy}
                    blocked={blocked || unavailable}
                    onCancel={() => {
                      setEditingId(null);
                      setError(null);
                    }}
                    onSave={(content) =>
                      mutate(
                        () => updateTaskComment(comment.id, content),
                        '댓글을 수정했습니다.',
                        () => setEditingId(null),
                      )
                    }
                  />
                ) : (
                  <p className="preserve-lines task-comment-content">
                    {comment.content}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </ResourceState>
      {(page > 0 || comments.length === PAGE_SIZE) && (
        <nav className="task-comment-pagination" aria-label="댓글 페이지">
          <button
            type="button"
            className="secondary-button"
            disabled={
              page === 0 || busy || resource.loading || editingId !== null
            }
            onClick={() => {
              setError(null);
              setPage(page - 1);
            }}
          >
            이전
          </button>
          <span>{page + 1} 페이지</span>
          <button
            type="button"
            className="secondary-button"
            disabled={
              comments.length < PAGE_SIZE ||
              busy ||
              unavailable ||
              editingId !== null
            }
            onClick={() => {
              setError(null);
              setPage(page + 1);
            }}
          >
            다음
          </button>
        </nav>
      )}
    </section>
  );
}
