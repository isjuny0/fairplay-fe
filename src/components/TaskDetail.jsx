import { useEffect, useState } from 'react';
import {
  assignCompletionReviewer,
  deleteTask,
  getTask,
  updateContribution,
  updateTask,
} from '../api/tasks.js';
import { getApprovalHistory, requestCompletion } from '../api/approvals.js';
import useResource from '../hooks/useResource.js';
import {
  useInteractions,
  useUnsavedChanges,
} from '../hooks/useInteractions.js';
import {
  canEditTask,
  canModifyTeamWork,
  completionBlockLabels,
  formatDate,
  formatExpectedWorkload,
  isAssignee,
  isMutable,
  isTeamEditor,
  memberName,
  reviewerCandidates,
  statusLabels,
  teamWorkBlocked,
} from '../lib/domain.js';
import AiEvaluation from './AiEvaluation.jsx';
import ApprovalDecision from './ApprovalDecision.jsx';
import Deliverables from './Deliverables.jsx';
import TaskForm from './TaskForm.jsx';
import { ErrorNotice, Field, ResourceState } from './ui.jsx';

function OwnContribution({ task, contribution, busy, blocked, onSave }) {
  const [description, setDescription] = useState(contribution || '');
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!isMutable(task)) setDescription(contribution || '');
  }, [task.status, contribution]);
  useUnsavedChanges(isMutable(task) && description !== (contribution || ''));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (blocked) return;
        const trimmed = description.trim();
        if (trimmed && trimmed.length < 10) {
          setError(
            new Error('수행 설명은 10~1000자로 작성하거나 비워 주세요.'),
          );
          return;
        }
        setError(null);
        onSave(trimmed || null);
      }}
    >
      <Field
        label="내 수행 설명"
        help="공동 담당자는 모두 작성해야 합니다. 비워서 저장하면 기존 설명을 제거합니다."
      >
        <textarea
          disabled={busy || blocked || !isMutable(task)}
          maxLength={1000}
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <ErrorNotice error={error} />
      {isMutable(task) && description !== (contribution || '') && (
        <p className="field-help" role="status">
          저장하지 않은 수행 설명이 있습니다.
        </p>
      )}
      {isMutable(task) && (
        <button className="secondary-button" disabled={busy || blocked}>
          수행 설명 저장
        </button>
      )}
    </form>
  );
}

export default function TaskDetail({
  taskId,
  team,
  space,
  user,
  members,
  onBack,
}) {
  const resource = useResource(async () => {
    const [detail, history] = await Promise.all([
      getTask(taskId),
      getApprovalHistory(taskId),
    ]);
    if (detail.task.teamId !== team.id)
      throw new Error(
        '이 팀에 속한 작업이 아닙니다. 작업 목록에서 다시 선택해 주세요.',
      );
    return { ...detail, history };
  }, [taskId, team.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [reviewerId, setReviewerId] = useState('');
  const { confirm, confirmDiscard, notify } = useInteractions();
  const mutate = async (action) => {
    if (!canModifyTeamWork(team)) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      notify('작업 변경 사항을 저장했습니다.');
      setEditing(false);
      resource.reload();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  const task = resource.data?.task;
  const history = resource.data?.history || [];
  const currentApproval = history.find(
    (approval) => approval.status === 'PENDING',
  );
  const candidates = task ? reviewerCandidates(members, task.assignees) : [];
  return (
    <section className="stack">
      <button className="secondary-button back-button" onClick={onBack}>
        ← 목록으로
      </button>
      <ErrorNotice error={error} onRetry={resource.reload} />
      <ResourceState resource={resource}>
        {task && (
          <>
            <div className="page-heading">
              <div>
                <span
                  className={`status-badge task-state-${task.status.toLowerCase()}`}
                >
                  {statusLabels[task.status]}
                </span>
                <h1>{task.title}</h1>
                <p>
                  예상 작업량: {formatExpectedWorkload(task.weight)} · 마감{' '}
                  {formatDate(task.dueAt)}
                </p>
              </div>
              {canEditTask(task, team, user.id) && (
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setEditing(true);
                  }}
                >
                  작업 수정
                </button>
              )}
            </div>
            <div className="task-detail-layout">
              <div className="stack">
                <section className="panel">
                  <h2>작업 설명</h2>
                  <p className="preserve-lines">{task.description}</p>
                  <p>
                    승인자 · {memberName(members, task.completionReviewerId)}
                  </p>
                  <ul className="clean-list">
                    {task.assignees.map((assignment) => (
                      <li className="row-item" key={assignment.userId}>
                        {memberName(members, assignment.userId)}
                        <strong>{assignment.allocationPercent}%</strong>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="panel">
                  <h2>담당자 수행 설명</h2>
                  {resource.data.contributions.map((contribution) => (
                    <div
                      className="contribution-entry"
                      key={contribution.userId}
                    >
                      <h3>
                        {memberName(members, contribution.userId)}
                        {contribution.userId === user.id && ' · 나'}
                      </h3>
                      {contribution.userId === user.id ? (
                        <OwnContribution
                          key={`${task.id}-${contribution.contributionDescription || ''}`}
                          task={task}
                          contribution={contribution.contributionDescription}
                          busy={busy}
                          blocked={!canModifyTeamWork(team)}
                          onSave={(contributionDescription) =>
                            mutate(() =>
                              updateContribution(task.id, {
                                expectedVersion: task.version,
                                contributionDescription,
                              }),
                            )
                          }
                        />
                      ) : (
                        <p className="preserve-lines">
                          {contribution.contributionDescription ||
                            '아직 작성하지 않았습니다.'}
                        </p>
                      )}
                    </div>
                  ))}
                </section>
                <Deliverables
                  team={team}
                  user={user}
                  members={members}
                  tasks={[task]}
                  taskId={task.id}
                  onChanged={resource.reload}
                />
              </div>
              <aside
                className="stack task-review-sidebar"
                aria-label="작업 진행 및 검토"
              >
                {isAssignee(task, user.id) && isMutable(task) && (
                  <section className="panel stack task-next-action">
                    <h2>작업 진행</h2>
                    <div className="heading-actions">
                      <button
                        className="secondary-button"
                        disabled={busy || !canModifyTeamWork(team)}
                        onClick={async () => {
                          if (!(await confirmDiscard())) return;
                          mutate(() =>
                            updateTask(task.id, {
                              expectedVersion: task.version,
                              status:
                                task.status === 'TODO' ? 'IN_PROGRESS' : 'TODO',
                            }),
                          );
                        }}
                      >
                        {task.status === 'TODO'
                          ? '작업 시작'
                          : '할 일로 되돌리기'}
                      </button>
                      <button
                        className="primary-button"
                        disabled={
                          busy ||
                          !canModifyTeamWork(team) ||
                          !task.canRequestCompletion
                        }
                        onClick={async () => {
                          if (!(await confirmDiscard())) return;
                          mutate(() =>
                            requestCompletion(task.id, task.version),
                          );
                        }}
                      >
                        완료 요청
                      </button>
                    </div>
                    {!task.canRequestCompletion && (
                      <p className="field-help">
                        {completionBlockLabels[task.completionBlockReason]}
                      </p>
                    )}
                  </section>
                )}
                {canEditTask(task, team, user.id) && (
                  <section className="panel">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        mutate(() =>
                          assignCompletionReviewer(task.id, {
                            reviewerId,
                            expectedVersion: task.version,
                          }),
                        );
                      }}
                    >
                      <Field label="승인자 변경">
                        <select
                          required
                          value={reviewerId}
                          disabled={busy}
                          onChange={(event) =>
                            setReviewerId(event.target.value)
                          }
                        >
                          <option value="">승인자를 선택하세요</option>
                          {candidates.map((member, index) => (
                            <option key={member.userId} value={member.userId}>
                              {index + 1}. {member.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <button
                        className="secondary-button"
                        disabled={
                          busy ||
                          !candidates.some(
                            (member) => member.userId === reviewerId,
                          )
                        }
                      >
                        승인자 저장
                      </button>
                    </form>
                  </section>
                )}
                {currentApproval && (
                  <ApprovalDecision
                    key={currentApproval.id}
                    approval={currentApproval}
                    user={user}
                    blocked={teamWorkBlocked(team)}
                    onChanged={resource.reload}
                  />
                )}
                {(isAssignee(task, user.id) ||
                  history.some(
                    (approval) =>
                      approval.status === 'APPROVED' &&
                      approval.reviewerId === user.id,
                  )) &&
                  ['DONE', 'IN_PROGRESS', 'PENDING_APPROVAL'].includes(
                    task.status,
                  ) && (
                    <AiEvaluation
                      context={{
                        task,
                        team,
                        space,
                        user,
                        members,
                        manager: false,
                        approval: history.find(
                          (approval) => approval.status === 'APPROVED',
                        ),
                      }}
                      onChanged={resource.reload}
                    />
                  )}
                <details className="panel">
                  <summary>완료 요청 이력 · {history.length}건</summary>
                  <p className="field-help">
                    과거 작업 내용·파일 사본은 보관하지 않습니다. 현재 산출물과
                    요청 처리 이력을 확인하세요.
                  </p>
                  {history.length ? (
                    <ul className="clean-list">
                      {history.map((approval) => (
                        <li className="approval-history" key={approval.id}>
                          <strong>
                            {
                              {
                                PENDING: '승인 대기',
                                APPROVED: '승인',
                                REJECTED: '반려',
                              }[approval.status]
                            }
                          </strong>
                          <span>
                            요청 {memberName(members, approval.requesterId)} ·
                            승인자 {memberName(members, approval.reviewerId)}
                          </span>
                          <small>
                            요청 {formatDate(approval.requestedAt)}
                            {approval.decidedAt &&
                              ` · 처리 ${formatDate(approval.decidedAt)}`}
                          </small>
                          {approval.reason && (
                            <p className="preserve-lines">
                              반려 사유: {approval.reason}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>완료 요청 이력이 없습니다.</p>
                  )}
                </details>
              </aside>
            </div>
            {isMutable(task) &&
              isTeamEditor(team, user.id) &&
              history.length === 0 && (
                <button
                  className="secondary-button danger"
                  disabled={busy || teamWorkBlocked(team)}
                  onClick={async () => {
                    if (
                      !(await confirm({
                        title: '작업 삭제',
                        message:
                          '작업과 연결된 산출물을 완전히 삭제합니다. 삭제한 자료는 복구할 수 없습니다.',
                        label: '작업 삭제',
                        danger: true,
                      }))
                    )
                      return;
                    setBusy(true);
                    setError(null);
                    try {
                      await deleteTask(task.id, task.version);
                      notify('작업을 삭제했습니다.');
                      onBack();
                    } catch (requestError) {
                      setError(requestError);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  작업 삭제
                </button>
              )}
          </>
        )}
      </ResourceState>
      {editing && task && (
        <TaskForm
          task={task}
          members={members}
          user={user}
          busy={busy}
          blocked={!canModifyTeamWork(team)}
          serverError={error}
          onClose={() => {
            setEditing(false);
            if (error?.status === 409) resource.reload();
          }}
          onSave={(input) =>
            mutate(() =>
              updateTask(task.id, { ...input, expectedVersion: task.version }),
            )
          }
        />
      )}
    </section>
  );
}
