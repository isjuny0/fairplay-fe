import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  FileText,
  Sparkles,
  UsersRound,
} from 'lucide-react';
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
import TaskComments from './TaskComments.jsx';
import Icon from './Icon.jsx';
import { ErrorNotice, Field, ResourceState } from './ui.jsx';

function ReadinessItem({ complete, children }) {
  return (
    <li className={`readiness-item${complete ? ' is-complete' : ''}`}>
      <span
        className="readiness-checkbox"
        role="img"
        aria-label={complete ? '충족' : '미충족'}
      >
        {complete && <Icon name="checkmark" />}
      </span>
      <div className="readiness-item-content">{children}</div>
    </li>
  );
}

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
  const [activeTab, setActiveTab] = useState('task-description-section');
  const [sectionToFocus, setSectionToFocus] = useState(null);
  useEffect(() => {
    setActiveTab('task-description-section');
    setSectionToFocus(null);
  }, [taskId]);
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
  const canViewAi = Boolean(task && isAssignee(task, user.id));
  const tabs = [
    ['task-description-section', '작업 설명'],
    ['task-deliverables-section', '산출물'],
    ['task-contributions-section', '수행 설명'],
    ...(canViewAi ? [['task-ai-review-section', 'AI 피드백']] : []),
    ['task-comments-tabpanel', '댓글'],
  ];
  const visibleTab =
    activeTab === 'task-ai-review-section' && !canViewAi
      ? 'task-description-section'
      : activeTab;
  useEffect(() => {
    if (!sectionToFocus) return;
    const target = document.getElementById(sectionToFocus);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start' });
    setSectionToFocus(null);
  }, [sectionToFocus, visibleTab]);
  const missingContributions =
    task?.assignees.filter(
      (assignment) =>
        !resource.data.contributions
          .find((entry) => entry.userId === assignment.userId)
          ?.contributionDescription?.trim(),
    ) || [];
  const hasDeliverables = Boolean(resource.data?.deliverableSummary?.length);
  const preparedItems =
    Number(['IN_PROGRESS', 'REVISING'].includes(task?.status)) +
    Number(hasDeliverables) +
    (task?.assignees.length || 0) -
    missingContributions.length;
  const preparationItems = 2 + (task?.assignees.length || 0);
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
    setActiveTab(
      id === 'own-contribution-description' ? 'task-contributions-section' : id,
    );
    setSectionToFocus(id);
  };
  const panelProps = (id) => ({
    role: 'tabpanel',
    'aria-labelledby': `${id}-tab`,
    hidden: visibleTab !== id,
  });

  return (
    <section className="stack task-detail-page">
      <div className="task-detail-navigation">
        <button className="secondary-button back-button" onClick={onBack}>
          ← 목록으로
        </button>
        {task && (
          <div
            className="task-section-navigation"
            role="tablist"
            aria-label="작업 상세 항목"
          >
            {tabs.map(([id, label], index) => (
              <button
                key={id}
                id={`${id}-tab`}
                type="button"
                role="tab"
                aria-selected={visibleTab === id}
                aria-controls={id}
                tabIndex={visibleTab === id ? 0 : -1}
                className="text-button"
                data-ai={id === 'task-ai-review-section' || undefined}
                onClick={() => setActiveTab(id)}
                onKeyDown={(event) => {
                  let nextIndex;
                  if (event.key === 'ArrowRight')
                    nextIndex = (index + 1) % tabs.length;
                  if (event.key === 'ArrowLeft')
                    nextIndex = (index - 1 + tabs.length) % tabs.length;
                  if (event.key === 'Home') nextIndex = 0;
                  if (event.key === 'End') nextIndex = tabs.length - 1;
                  if (nextIndex === undefined) return;
                  event.preventDefault();
                  const nextId = tabs[nextIndex][0];
                  setActiveTab(nextId);
                  document.getElementById(`${nextId}-tab`)?.focus();
                }}
              >
                {id === 'task-ai-review-section' && (
                  <Sparkles size={14} aria-hidden="true" />
                )}
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <ErrorNotice error={error} onRetry={reload} />
      <ResourceState resource={resource} label="작업 상세">
        {task && (
          <>
            <header className="task-detail-header">
              <div className="page-heading task-detail-title-row">
                <div>
                  <div className="task-title-context">
                    <span className="task-detail-number">작업 #{task.id}</span>
                    <span
                      className={`status-badge task-state-${task.status.toLowerCase()}`}
                    >
                      {statusLabels[task.status]}
                    </span>
                  </div>
                  <h1>{task.title}</h1>
                </div>
                <div className="task-detail-actions">
                  {isAssignee(task, user.id) && (
                    <button
                      className="secondary-button task-ai-shortcut"
                      onClick={() => focusTaskSection('task-ai-review-section')}
                    >
                      <Sparkles size={16} aria-hidden="true" />
                      AI 피드백 보기
                    </button>
                  )}
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
              </div>
              <dl className="task-overview-facts" aria-label="작업 기본 정보">
                <div>
                  <dt>
                    <Clock3 size={14} aria-hidden="true" />
                    예상 작업량
                  </dt>
                  <dd>{formatExpectedWorkload(task.weight)}</dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays size={14} aria-hidden="true" />
                    시작일
                  </dt>
                  <dd>{formatDate(task.startAt)}</dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays size={14} aria-hidden="true" />
                    마감
                  </dt>
                  <dd>{formatDate(task.dueAt)}</dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays size={14} aria-hidden="true" />
                    완료일
                  </dt>
                  <dd>
                    {task.completedAt ? formatDate(task.completedAt) : '미완료'}
                  </dd>
                </div>
              </dl>
            </header>
            <div className="task-detail-layout">
              <div className="stack task-detail-main">
                <section
                  id="task-description-section"
                  {...panelProps('task-description-section')}
                  tabIndex={0}
                  className="panel task-section-anchor task-description-card"
                >
                  <h2>
                    <FileText size={18} aria-hidden="true" />
                    작업 설명
                  </h2>
                  <p className="preserve-lines">{task.description}</p>
                  {!canViewAi && (
                    <p className="task-ai-access-note">
                      <Sparkles size={16} aria-hidden="true" />
                      AI 피드백은 이 작업의 담당자에게만 제공됩니다.
                    </p>
                  )}
                </section>
                <div
                  id="task-deliverables-section"
                  {...panelProps('task-deliverables-section')}
                  className="task-section-anchor"
                  tabIndex={0}
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
                {isAssignee(task, user.id) ? (
                  <div
                    id="task-ai-review-section"
                    {...panelProps('task-ai-review-section')}
                    className="task-section-anchor task-ai-section"
                    tabIndex={0}
                  >
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
                  </div>
                ) : null}
                <section
                  id="task-contributions-section"
                  {...panelProps('task-contributions-section')}
                  tabIndex={0}
                  className="panel task-section-anchor"
                >
                  <h2>
                    <UsersRound size={18} aria-hidden="true" />
                    담당자 수행 설명
                  </h2>
                  {[...resource.data.contributions]
                    .sort(
                      (a, b) =>
                        Number(b.userId === user.id) -
                        Number(a.userId === user.id),
                    )
                    .map((contribution) => (
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
                  id="task-comments-tabpanel"
                  {...panelProps('task-comments-tabpanel')}
                  className="task-section-anchor task-comments-tabpanel"
                  tabIndex={0}
                >
                  <TaskComments
                    key={`${team.id}-${task.id}-${user.id}`}
                    taskId={task.id}
                    team={team}
                    user={user}
                  />
                </div>
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
                        <div
                          className="task-preparation-summary"
                          aria-label="완료 준비 항목"
                        >
                          <span>준비 항목</span>
                          <strong>
                            {preparedItems}
                            <span> / {preparationItems}</span>
                          </strong>
                          <div
                            className="task-preparation-track"
                            aria-hidden="true"
                          >
                            <span
                              style={{
                                width: `${(preparedItems / preparationItems) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                        <ul
                          className="completion-readiness"
                          aria-label="완료 준비 상태"
                        >
                          <ReadinessItem
                            complete={['IN_PROGRESS', 'REVISING'].includes(
                              task.status,
                            )}
                          >
                            {task.status === 'REVISING'
                              ? '완료 후 수정 중'
                              : '작업 진행 중'}
                          </ReadinessItem>
                          <ReadinessItem complete={hasDeliverables}>
                            {hasDeliverables
                              ? '연결 산출물 등록 완료'
                              : '연결 산출물 미등록'}
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
                          </ReadinessItem>
                          {task.assignees.map((assignment) => {
                            const missing = missingContributions.some(
                              (entry) => entry.userId === assignment.userId,
                            );
                            return (
                              <ReadinessItem
                                key={assignment.userId}
                                complete={!missing}
                              >
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
                              </ReadinessItem>
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
                  <h2>
                    <UsersRound size={18} aria-hidden="true" />
                    담당자와 배분
                  </h2>
                  <p className="field-help">예상 작업량을 나누는 비율입니다.</p>
                  <ul className="clean-list">
                    {task.assignees.map((assignment) => (
                      <li className="row-item" key={assignment.userId}>
                        <span className="task-assignee-identity">
                          <span
                            className="task-assignee-avatar"
                            aria-hidden="true"
                          >
                            {memberName(members, assignment.userId).slice(0, 1)}
                          </span>
                          <span>
                            {memberName(members, assignment.userId)}
                            {assignment.userId === user.id && (
                              <small> · 나</small>
                            )}
                          </span>
                        </span>
                        <strong>{assignment.allocationPercent}%</strong>
                        <div
                          className="task-allocation-track"
                          aria-hidden="true"
                        >
                          <span
                            style={{
                              width: `${Math.max(0, Math.min(100, assignment.allocationPercent))}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </aside>
            </div>
            {isMutable(task) && isTeamEditor(team, user.id) && (
              <div className="task-detail-footer">
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
              </div>
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
