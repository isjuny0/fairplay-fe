import { useEffect, useRef, useState } from 'react';
import {
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
  memberRole,
  reviewerCandidates,
  statusLabels,
  teamWorkBlocked,
} from '../lib/domain.js';
import AiReview from './AiReview.jsx';
import ApprovalDecision from './ApprovalDecision.jsx';
import Deliverables from './Deliverables.jsx';
import TaskForm from './TaskForm.jsx';
import { ErrorNotice, Field, ResourceState } from './ui.jsx';

function OwnContribution({ task, contribution, busy, blocked, onSave }) {
  const [description, setDescription] = useState(contribution || '');
  const [error, setError] = useState(null);
  const descriptionInput = useRef(null);
  const hasChanges = description.trim() !== (contribution || '').trim();
  useEffect(() => {
    if (!isMutable(task)) setDescription(contribution || '');
  }, [task.status, contribution]);
  useUnsavedChanges(isMutable(task) && hasChanges);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || blocked || !isMutable(task) || !hasChanges) return;
        const trimmed = description.trim();
        if (trimmed && trimmed.length < 10) {
          setError(
            new Error('수행 설명은 10~1000자로 작성하거나 비워 주세요.'),
          );
          descriptionInput.current?.focus();
          return;
        }
        setError(null);
        onSave(trimmed || null);
      }}
    >
      <Field
        label="내 수행 설명"
        help="공동 담당자는 모두 작성해야 합니다. 비워서 저장하면 기존 설명을 제거합니다."
        error={error?.message}
      >
        <textarea
          ref={descriptionInput}
          id="own-contribution-description"
          disabled={busy || blocked || !isMutable(task)}
          maxLength={1000}
          rows={4}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setError(null);
          }}
        />
      </Field>
      {isMutable(task) && hasChanges && (
        <p className="field-help" role="status">
          저장하지 않은 수행 설명이 있습니다.
        </p>
      )}
      {isMutable(task) && (
        <div className="contribution-save-row">
          <span className="field-help">{description.length} / 1000자</span>
          <button
            className="secondary-button"
            disabled={busy || blocked || !hasChanges}
          >
            수행 설명 저장
          </button>
        </div>
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
  useEffect(() => {
    setError(null);
  }, [resource.data]);
  const [editing, setEditing] = useState(false);
  const [reviewerId, setReviewerId] = useState('');
  const { confirm, confirmDiscard, notify } = useInteractions();
  const mutate = async (
    action,
    successMessage = '작업 변경 사항을 저장했습니다.',
  ) => {
    if (!canModifyTeamWork(team)) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      notify(successMessage);
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
  const latestDecision = history[0];
  const missingContributions =
    task?.assignees.length > 1
      ? task.assignees.filter(
          (assignment) =>
            !resource.data.contributions
              .find((entry) => entry.userId === assignment.userId)
              ?.contributionDescription?.trim(),
        )
      : [];
  const hasDeliverables = Boolean(resource.data?.deliverableSummary?.length);
  const hasEligibleReviewer = candidates.some(
    (member) => member.userId === task?.completionReviewerId,
  );
  const completionReady =
    task?.status === 'IN_PROGRESS' &&
    !missingContributions.length &&
    hasDeliverables &&
    hasEligibleReviewer;

  const focusTaskSection = (id) => {
    const target = document.getElementById(id);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start' });
  };

  return (
    <section className="stack task-detail-page">
      <button className="secondary-button back-button" onClick={onBack}>
        ← 목록으로
      </button>
      <ErrorNotice error={error} onRetry={resource.reload} />
      <ResourceState resource={resource} label="작업 상세">
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
            <dl className="task-overview-facts" aria-label="작업 기본 정보">
              <div>
                <dt>예상 작업량</dt>
                <dd>{formatExpectedWorkload(task.weight)}</dd>
              </div>
              <div>
                <dt>시작일</dt>
                <dd>{formatDate(task.startAt)}</dd>
              </div>
              <div>
                <dt>마감</dt>
                <dd>{formatDate(task.dueAt)}</dd>
              </div>
              <div>
                <dt>완료 승인자</dt>
                <dd>{memberName(members, task.completionReviewerId)}</dd>
              </div>
            </dl>
            {isMutable(task) && latestDecision?.status === 'REJECTED' && (
              <section
                className="notice rejection-notice"
                aria-label="최근 반려 사유"
              >
                <h2>보완 필요</h2>
                <p className="preserve-lines">{latestDecision.reason}</p>
                <p className="field-help">
                  {memberName(members, latestDecision.reviewerId)} ·{' '}
                  {formatDate(latestDecision.decidedAt)} · 내용을 보완한 뒤 다시
                  완료를 요청해 주세요.
                </p>
              </section>
            )}
            <div className="task-detail-layout">
              <div className="stack">
                <section
                  id="task-description-section"
                  tabIndex={-1}
                  className="panel task-section-anchor"
                >
                  <h2>작업 설명</h2>
                  <p className="preserve-lines">{task.description}</p>
                </section>
                <section
                  id="task-contributions-section"
                  tabIndex={-1}
                  className="panel task-section-anchor"
                >
                  <h2>담당자 수행 설명</h2>
                  {resource.data.contributions.map((contribution) => (
                    <div
                      className="contribution-entry"
                      key={contribution.userId}
                    >
                      <div className="contribution-entry-heading">
                        <h3>
                          {memberName(members, contribution.userId)}
                          {contribution.userId === user.id && ' · 나'}
                        </h3>
                        <span
                          className={`contribution-description-state ${contribution.contributionDescription?.trim() ? 'is-written' : ''}`}
                        >
                          {contribution.contributionDescription?.trim()
                            ? '작성 완료'
                            : '미작성'}
                        </span>
                      </div>
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
                <div
                  id="task-deliverables-section"
                  className="task-section-anchor"
                  tabIndex={-1}
                >
                  <Deliverables
                    team={team}
                    user={user}
                    members={members}
                    tasks={[task]}
                    taskId={task.id}
                    onChanged={resource.reload}
                  />
                </div>
                {(isAssignee(task, user.id) ||
                  user.id ===
                    (task.status === 'PENDING_APPROVAL'
                      ? history.find(
                          (approval) => approval.status === 'PENDING',
                        )?.reviewerId
                      : task.completionReviewerId)) && (
                  <AiReview
                    context={{
                      task,
                      team,
                      space,
                      user,
                      members,
                      manager: false,
                    }}
                  />
                )}
              </div>
              <aside
                className="stack task-review-sidebar"
                aria-label="작업 진행 및 검토"
              >
                {isAssignee(task, user.id) && isMutable(task) && (
                  <section className="panel stack task-next-action">
                    <h2>작업 진행</h2>
                    <ul
                      className="completion-readiness"
                      aria-label="완료 요청 준비 상태"
                    >
                      <li>
                        {task.status === 'IN_PROGRESS' ? '✓' : '○'} 작업 진행 중
                      </li>
                      <li>
                        {hasDeliverables
                          ? '✓ 연결 산출물 등록 완료'
                          : '○ 연결 산출물 미등록'}
                        {!hasDeliverables && (
                          <button
                            className="text-button readiness-link"
                            onClick={() =>
                              focusTaskSection('task-deliverables-section')
                            }
                          >
                            산출물 확인
                          </button>
                        )}
                      </li>
                      {task.assignees.length > 1 &&
                        task.assignees.map((assignment) => (
                          <li key={assignment.userId}>
                            {missingContributions.some(
                              (entry) => entry.userId === assignment.userId,
                            )
                              ? '○'
                              : '✓'}{' '}
                            {memberName(members, assignment.userId)} 수행 설명{' '}
                            {missingContributions.some(
                              (entry) => entry.userId === assignment.userId,
                            )
                              ? '미작성'
                              : '작성 완료'}
                            {assignment.userId === user.id &&
                              canModifyTeamWork(team) &&
                              missingContributions.some(
                                (entry) => entry.userId === user.id,
                              ) && (
                                <button
                                  className="text-button readiness-link"
                                  onClick={() =>
                                    focusTaskSection(
                                      'own-contribution-description',
                                    )
                                  }
                                >
                                  내 수행 설명 작성
                                </button>
                              )}
                          </li>
                        ))}
                      <li>
                        {hasEligibleReviewer
                          ? '✓ 승인자 지정 완료'
                          : '○ 적격한 승인자 지정 필요'}
                        {!hasEligibleReviewer &&
                          canEditTask(task, team, user.id) && (
                            <button
                              className="text-button readiness-link"
                              onClick={() =>
                                focusTaskSection('task-reviewer-select')
                              }
                            >
                              승인자 선택
                            </button>
                          )}
                      </li>
                    </ul>
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
                          task.completionBlockReason !== null ||
                          !completionReady
                        }
                        onClick={async () => {
                          if (!(await confirmDiscard())) return;
                          mutate(
                            () => requestCompletion(task.id, task.version),
                            `${memberName(members, task.completionReviewerId)}님에게 완료 검토를 요청했습니다.`,
                          );
                        }}
                      >
                        완료 요청
                      </button>
                    </div>
                    {task.completionBlockReason !== null && (
                      <p className="field-help">
                        {completionBlockLabels[task.completionBlockReason]}
                      </p>
                    )}
                  </section>
                )}
                {currentApproval && (
                  <ApprovalDecision
                    key={currentApproval.id}
                    approval={currentApproval}
                    taskTitle={task.title}
                    user={user}
                    members={members}
                    onReviewSection={focusTaskSection}
                    blocked={teamWorkBlocked(team)}
                    onChanged={resource.reload}
                  />
                )}
                <section
                  id="task-assignment-section"
                  tabIndex={-1}
                  className="panel task-assignment-panel task-section-anchor"
                  aria-label="담당자와 배분"
                >
                  <h2>담당자와 배분</h2>
                  <p className="field-help">예상 작업량을 나누는 비율입니다.</p>
                  <ul className="clean-list">
                    {task.assignees.map((assignment) => (
                      <li className="row-item" key={assignment.userId}>
                        <span>
                          {memberName(members, assignment.userId)}
                          {assignment.userId === user.id && (
                            <small> · 나</small>
                          )}
                        </span>
                        <strong>{assignment.allocationPercent}%</strong>
                      </li>
                    ))}
                  </ul>
                </section>
                {canEditTask(task, team, user.id) && (
                  <section className="panel">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (
                          busy ||
                          reviewerId === task.completionReviewerId ||
                          !candidates.some(
                            (member) => member.userId === reviewerId,
                          )
                        )
                          return;
                        mutate(() =>
                          updateTask(task.id, {
                            completionReviewerId: reviewerId,
                            expectedVersion: task.version,
                          }),
                        );
                      }}
                    >
                      <Field label="승인자 변경">
                        <select
                          id="task-reviewer-select"
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
                              {index + 1}. {member.name} · {memberRole(member)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <button
                        className="secondary-button"
                        disabled={
                          busy ||
                          reviewerId === task.completionReviewerId ||
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
          team={team}
          members={members}
          user={user}
          busy={busy}
          blocked={!canModifyTeamWork(team)}
          serverError={error}
          onClose={() => {
            setEditing(false);
            if (error?.status === 409) resource.reload();
          }}
          onSave={(input, expectedVersion) =>
            mutate(() => updateTask(task.id, { ...input, expectedVersion }))
          }
        />
      )}
    </section>
  );
}
