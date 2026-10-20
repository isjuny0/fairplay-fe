import { useEffect, useRef, useState } from 'react';
import {
  deleteTask,
  getTask,
  updateContribution,
  updateTask,
} from '../api/tasks.js';
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
  statusLabels,
  teamWorkBlocked,
} from '../lib/domain.js';
import AiReview from './AiReview.jsx';
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
        help="모든 담당자가 작성해야 완료할 수 있습니다. 비워서 저장하면 기존 설명을 제거합니다."
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
    const detail = await getTask(taskId);
    if (detail.task.teamId !== team.id)
      throw new Error(
        '이 팀에 속한 작업이 아닙니다. 작업 목록에서 다시 선택해 주세요.',
      );
    return detail;
  }, [taskId, team.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    setError(null);
  }, [resource.data]);
  const [editing, setEditing] = useState(false);
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
  const reload = resource.reload;
  const task = resource.data?.task;
  const missingContributions =
    task?.assignees.filter(
      (assignment) =>
        !resource.data.contributions
          .find((entry) => entry.userId === assignment.userId)
          ?.contributionDescription?.trim(),
    ) || [];
  const hasDeliverables = Boolean(resource.data?.deliverableSummary?.length);
  const completionReady =
    ['IN_PROGRESS', 'REVISING'].includes(task?.status) &&
    !missingContributions.length &&
    hasDeliverables;
  const workClosed = task?.completionBlockReason === 'WORK_PERIOD_CLOSED';
  const changeStatus = async (status) => {
    if (busy || !canModifyTeamWork(team) || workClosed) return;
    if (
      status === 'DONE' &&
      (!completionReady || task.completionBlockReason !== null)
    )
      return;
    if (!(await confirmDiscard())) return;
    if (
      status === 'DONE' &&
      !(await confirm({
        title: '작업 완료',
        message:
          '완료하면 작업 내용과 수행 설명·연결 산출물은 잠깁니다. 이후 수정하려면 수정 중으로 전환해야 합니다. 완료할까요?',
        label: '완료 처리',
      }))
    )
      return;
    if (
      status === 'REVISING' &&
      !(await confirm({
        title: '완료 후 수정',
        message:
          '기존 내용과 산출물은 유지되며 수정 중에는 완료 집계에서 제외됩니다. 다시 완료하면 완료 시각이 새로 기록됩니다.',
        label: '수정 중으로 전환',
      }))
    )
      return;
    mutate(
      () => updateTask(task.id, { expectedVersion: task.version, status }),
      status === 'DONE' ? '작업을 완료했습니다.' : '작업 상태를 변경했습니다.',
    );
  };

  const focusTaskSection = (id) => {
    const target = document.getElementById(id);
    if (target?.tagName === 'DETAILS') target.open = true;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start' });
  };

  return (
    <section className="stack task-detail-page">
      <div className="task-detail-navigation">
        <button className="secondary-button back-button" onClick={onBack}>
          ← 목록으로
        </button>
        {task && (
          <nav className="task-section-navigation" aria-label="작업 상세 항목">
            {[
              ['task-description-section', '작업 설명'],
              ['task-contributions-section', '수행 설명'],
              ['task-deliverables-section', '산출물'],
              ['task-assignment-section', '담당·배분'],
            ].map(([id, label]) => (
              <button
                key={id}
                className="text-button"
                aria-label={`${label} 영역으로 이동`}
                onClick={() => focusTaskSection(id)}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
      </div>
      <ErrorNotice error={error} onRetry={reload} />
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
                <dt>완료일</dt>
                <dd>
                  {task.completedAt ? formatDate(task.completedAt) : '미완료'}
                </dd>
              </div>
            </dl>
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
                          blocked={!canModifyTeamWork(team) || workClosed}
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
                    onChanged={reload}
                  />
                </div>
                {isAssignee(task, user.id) && (
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
                className="stack task-progress-sidebar"
                aria-label="작업 진행 및 담당"
              >
                {isAssignee(task, user.id) && (
                  <section className="panel stack task-next-action">
                    <h2>
                      {task.status === 'DONE' ? '완료된 작업' : '작업 진행'}
                    </h2>
                    {task.status === 'DONE' ? (
                      <>
                        <p className="field-help">
                          수정하려면 먼저 수정 중으로 전환하세요. 수정 중에는
                          완료 집계에서 제외됩니다.
                        </p>
                        <button
                          className="secondary-button"
                          disabled={
                            busy || !canModifyTeamWork(team) || workClosed
                          }
                          onClick={() => changeStatus('REVISING')}
                        >
                          수정 중으로 전환
                        </button>
                      </>
                    ) : (
                      <>
                        <ul
                          className="completion-readiness"
                          aria-label="완료 준비 상태"
                        >
                          <li>
                            {['IN_PROGRESS', 'REVISING'].includes(task.status)
                              ? '✓'
                              : '○'}{' '}
                            {task.status === 'REVISING'
                              ? '완료 후 수정 중'
                              : '작업 진행 중'}
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
                          {task.assignees.map((assignment) => {
                            const missing = missingContributions.some(
                              (entry) => entry.userId === assignment.userId,
                            );
                            return (
                              <li key={assignment.userId}>
                                {missing ? '○' : '✓'}{' '}
                                {memberName(members, assignment.userId)} 수행
                                설명 {missing ? '미작성' : '작성 완료'}
                                {missing &&
                                  assignment.userId === user.id &&
                                  canModifyTeamWork(team) && (
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
                            );
                          })}
                        </ul>
                        <div className="heading-actions">
                          {['TODO', 'IN_PROGRESS'].includes(task.status) && (
                            <button
                              className="secondary-button"
                              disabled={
                                busy || !canModifyTeamWork(team) || workClosed
                              }
                              onClick={() =>
                                changeStatus(
                                  task.status === 'TODO'
                                    ? 'IN_PROGRESS'
                                    : 'TODO',
                                )
                              }
                            >
                              {task.status === 'TODO'
                                ? '작업 시작'
                                : '할 일로 되돌리기'}
                            </button>
                          )}
                          <button
                            className="primary-button"
                            disabled={
                              busy ||
                              !canModifyTeamWork(team) ||
                              task.completionBlockReason !== null ||
                              !completionReady
                            }
                            onClick={() => changeStatus('DONE')}
                          >
                            {task.status === 'REVISING'
                              ? '다시 완료'
                              : '완료 처리'}
                          </button>
                        </div>
                      </>
                    )}
                    {task.completionBlockReason !== null &&
                      task.completionBlockReason !== 'INVALID_TASK_STATE' && (
                        <p className="field-help">
                          {completionBlockLabels[task.completionBlockReason]}
                        </p>
                      )}
                  </section>
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
              </aside>
            </div>
            {isMutable(task) && isTeamEditor(team, user.id) && (
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
          blocked={!canModifyTeamWork(team) || workClosed}
          serverError={error}
          onClose={() => {
            setEditing(false);
            if (error?.status === 409) reload();
          }}
          onSave={(input, expectedVersion) =>
            mutate(() => updateTask(task.id, { ...input, expectedVersion }))
          }
        />
      )}
    </section>
  );
}
