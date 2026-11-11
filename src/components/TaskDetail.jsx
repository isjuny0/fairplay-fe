import { formatTaskEstimatedTime } from '../lib/taskTime.js';
import DetailBackButton from './DetailBackButton.jsx';
import { usePreviewGuide } from '../lib/previewGuideContext.js';
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
import { ErrorNotice, Field, Modal, ResourceState } from './ui.jsx';

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
  const guide = usePreviewGuide();
  const guideExample = guide?.guiding && guide.stepId === 'contribution' && task.id === guide.taskId
    ? guide.examples.contributionDescription : null;
  const [description, setDescription] = useState(contribution || guideExample || '');
  const manuallyEdited = useRef(false);
  useEffect(() => {
    if (guideExample && !contribution && !manuallyEdited.current)
      setDescription((current) => current || guideExample);
  }, [guideExample, contribution]);
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
            manuallyEdited.current = true;
            setDescription(event.target.value);
            setError(null);
          }}
        />
      </Field>
      {guideExample && !contribution && <p className="field-help">가이드 예시가 자동 입력되었습니다. 내용을 확인하거나 수정한 뒤 저장하세요.</p>}
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
            data-guide="save-contribution"
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
  readOnly = false,
}) {
  const guide = usePreviewGuide();
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
  const [reopening, setReopening] = useState(false);
  const [revisionAssigneeId, setRevisionAssigneeId] = useState('');
  const [showAllAssignees, setShowAllAssignees] = useState(false);
  const [activeTab, setActiveTab] = useState('task-description-section');
  const [sourceEdit, setSourceEdit] = useState(null);
  const [sectionToFocus, setSectionToFocus] = useState(null);
  useEffect(() => {
    setShowAllAssignees(false);
    setReopening(false);
    setActiveTab('task-description-section');
    setSourceEdit(null);
    setSectionToFocus(null);
  }, [taskId]);
  const { confirm, confirmDiscard, notify } = useInteractions();
  const mutate = async (
    action,
    successMessage = '작업 변경 사항을 저장했습니다.',
  ) => {
    if (readOnly || !canModifyTeamWork(team)) return;
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
  const canViewAi = Boolean(!readOnly && task && isAssignee(task, user.id));
  const memberIds = new Set(members.map((member) => member.userId));
  const departedAllocation = task?.status === 'DONE'
    ? task.assignees.filter((assignment) => !memberIds.has(assignment.userId))
      .reduce((total, assignment) => total + assignment.allocationPercent, 0)
    : 0;
  const canReopenWithHandoff = departedAllocation > 0 && isTeamEditor(team, user.id);
  const assigneeName = (userId) => memberIds.has(userId)
    ? memberName(members, userId)
    : '탈퇴한 팀원';
  const tabs = [
    ['task-description-section', '작업 내용'],
    ['task-deliverables-section', '결과물'],
    ...(canViewAi ? [['task-ai-review-section', 'AI 피드백']] : []),
    ['task-contributions-section', '수행 설명'],
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
  const visibleAssignees = !task ? [] : showAllAssignees || task.assignees.length <= 4
    ? task.assignees
    : [...task.assignees.filter((entry) => entry.userId === user.id),
      ...task.assignees.filter((entry) => entry.userId !== user.id)].slice(0, 4);
  const hasDeliverables = Boolean(resource.data?.deliverableSummary?.length);
  const completionReady =
    ['IN_PROGRESS', 'REVISING'].includes(task?.status) &&
    !missingContributions.length &&
    hasDeliverables;
  const workClosed = task?.completionBlockReason === 'WORK_PERIOD_CLOSED';
  const changeStatus = async (status) => {
    if (readOnly || busy || !canModifyTeamWork(team) || workClosed) return;
    if (
      status === 'DONE' &&
      (!completionReady || task.completionBlockReason !== null)
    )
      return;
    if (!(await confirmDiscard())) return;
    if (status === 'REVISING' && departedAllocation > 0) {
      setRevisionAssigneeId('');
      setError(null);
      setReopening(true);
      return;
    }
    if (
      status === 'DONE' &&
      !(await confirm({
        title: '작업 완료',
        message:
          '완료하면 작업 내용과 수행 설명·연결된 결과물은 잠깁니다. 이후 수정하려면 수정 중으로 전환해야 합니다. 완료할까요?',
        label: '완료 처리',
      }))
    )
      return;
    if (
      status === 'REVISING' &&
      !(await confirm({
        title: '완료 후 수정',
        message:
          '기존 내용과 결과물은 유지되며 수정 중에는 완료 집계에서 제외됩니다. 다시 완료하면 완료 시각이 새로 기록됩니다.',
        label: '수정 중으로 전환',
      }))
    )
      return;
    mutate(
      () => updateTask(task.id, { expectedVersion: task.version, status }),
      status === 'DONE' ? '작업을 완료했습니다.' : '작업 상태를 변경했습니다.',
    );
  };

  const submitRevisionHandoff = (event) => {
    event.preventDefault();
    if (!revisionAssigneeId || busy || !canModifyTeamWork(team) || workClosed) return;
    const assignees = task.assignees.filter((assignment) => memberIds.has(assignment.userId));
    const recipient = assignees.find((assignment) => assignment.userId === revisionAssigneeId);
    const allocation = recipient
      ? assignees.map((assignment) => assignment === recipient
        ? { ...assignment, allocationPercent: assignment.allocationPercent + departedAllocation }
        : assignment)
      : [...assignees, { userId: revisionAssigneeId, allocationPercent: departedAllocation }];
    mutate(async () => {
      await updateTask(task.id, { expectedVersion: task.version, status: 'REVISING', assignees: allocation });
      setReopening(false);
    }, '담당자를 재배정하고 수정 중으로 전환했습니다.');
  };

  const focusTaskSection = (id) => {
    setActiveTab(
      id === 'own-contribution-description' ? 'task-contributions-section' : id,
    );
    setSectionToFocus(id);
  };
  useEffect(() => {
    if (!guide?.guiding || Number(taskId) !== guide.taskId) return;
    const section = guide.section || 'task-description-section';
    setActiveTab(section);
    const focus = (event) => {
      if (tabs.some(([id]) => id === event.detail)) setActiveTab(event.detail);
    };
    window.addEventListener('fairplay:guide-focus', focus);
    return () => window.removeEventListener('fairplay:guide-focus', focus);
  }, [guide?.guiding, guide?.section, guide?.taskId, taskId]);
  const panelProps = (id) => ({
    role: 'tabpanel',
    'aria-labelledby': `${id}-tab`,
    hidden: visibleTab !== id,
  });

  const navigation = (
    <div className="task-detail-navigation">
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
  );

  return (
    <section className="stack task-detail-page">
      <DetailBackButton onClick={onBack}>목록으로</DetailBackButton>
      <ErrorNotice error={error} onRetry={reload} />
      <ResourceState resource={resource} label="작업 상세">
        {task && (
          <>
            <header className="task-detail-header">
              <div className="page-heading task-detail-title-row">
                <div>
                  <div className="task-title-context">
                    <span
                      className={`status-badge task-state-${task.status.toLowerCase()}`}
                    >
                      {statusLabels[task.status]}
                    </span>
                  </div>
                  <h1>{task.title}</h1>
                </div>
                <div className="task-detail-actions">
                  {!readOnly && isAssignee(task, user.id) && (
                    <button
                      className="secondary-button task-ai-shortcut"
                      onClick={() => focusTaskSection('task-ai-review-section')}
                    >
                      <Sparkles size={16} aria-hidden="true" />
                      AI 피드백 보기
                    </button>
                  )}
                  {!readOnly && canEditTask(task, team, user.id) && (
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
                    예상 시간
                  </dt>
                  <dd>{formatTaskEstimatedTime(task)}</dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays size={14} aria-hidden="true" />
                    계획 시작일
                  </dt>
                  <dd>{formatDate(task.startAt)}</dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays size={14} aria-hidden="true" />
                    마감일
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
              <div className="task-header-body">
                <div className="task-header-information">
                  <section
                    id="task-assignment-section"
                    tabIndex={-1}
                    className="task-assignment-panel task-section-anchor"
                    aria-label="담당자·담당 비율"
                  >
                    <h2>
                      <UsersRound size={18} aria-hidden="true" />
                      담당자·담당 비율
                    </h2>
                    <table className="task-assignment-table" aria-label="담당자별 수행 상태">
                      <thead><tr><th scope="col">담당자</th><th scope="col">담당 비율</th><th scope="col">수행 설명</th></tr></thead>
                      <tbody id="task-assignment-rows">
                        {visibleAssignees.map((assignment) => {
                          const missing = missingContributions.some((entry) => entry.userId === assignment.userId);
                          const ownAssignment = assignment.userId === user.id;
                          return <tr key={assignment.userId} className={ownAssignment ? 'is-own-assignment' : undefined}>
                            <th scope="row"><span className="task-assignee-identity">
                              <span className="task-assignee-avatar" aria-hidden="true">{assigneeName(assignment.userId).slice(0, 1)}</span>
                              <span>{assigneeName(assignment.userId)}</span>
                            </span></th>
                            <td className="task-assignment-percent">{assignment.allocationPercent}%</td>
                            <td>{missing ? ownAssignment && !readOnly && isMutable(task) && canModifyTeamWork(team) && !workClosed
                              ? <button className="text-button" aria-label="내 수행 설명 작성" onClick={() => focusTaskSection('own-contribution-description')}>작성하기</button>
                              : <span className="task-contribution-pending">미작성</span>
                              : <span className="task-contribution-complete">작성 완료</span>}</td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                    {task.assignees.length > 4 && <button className="text-button task-assignees-toggle"
                      aria-expanded={showAllAssignees} aria-controls="task-assignment-rows"
                      onClick={() => setShowAllAssignees((value) => !value)}>
                      {showAllAssignees ? '담당자 접기' : `전체 담당자 ${task.assignees.length}명 보기`}
                    </button>}
                  </section>
                </div>
                {!readOnly && (isAssignee(task, user.id) || canReopenWithHandoff) && (
                  <section className="task-next-action" id="task-next-action-panel" tabIndex={-1} aria-label="작업 상태 변경">
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
                              ? '결과물 추가됨'
                              : '결과물 없음'}
                          </ReadinessItem>
                          <ReadinessItem complete={missingContributions.length === 0}>
                            {missingContributions.length
                              ? `수행 설명 ${missingContributions.length}명 미작성`
                              : '수행 설명 작성 완료'}
                          </ReadinessItem>
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
                            data-guide="complete-task"
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
                      task.completionBlockReason !== 'INVALID_TASK_STATE' &&
                      task.completionBlockReason !== 'CONTRIBUTION_DESCRIPTION_REQUIRED' && (
                        <p className="field-help task-completion-reason">
                          {completionBlockLabels[task.completionBlockReason]}
                        </p>
                      )}
                  </section>
                )}
              </div>
            </header>
            {navigation}
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
                  {!readOnly && !canViewAi && (
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
                    sourceEdit={sourceEdit?.taskId === task.id ? sourceEdit : undefined}
                    onCloseSourceEdit={() => setSourceEdit(null)}
                  />
                </div>
                {!readOnly && isAssignee(task, user.id) ? (
                  <div
                    id="task-ai-review-section"
                    {...panelProps('task-ai-review-section')}
                    className="task-section-anchor task-ai-section"
                    tabIndex={0}
                  >
                    <AiReview
                      onEditSource={setSourceEdit}
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
                          <h3 className={contribution.userId === user.id ? 'self-identity' : undefined}>
                            {assigneeName(contribution.userId)}
                          </h3>
                          <span
                            className={`contribution-description-state ${contribution.contributionDescription?.trim() ? 'is-written' : ''}`}
                          >
                            {contribution.contributionDescription?.trim()
                              ? '작성 완료'
                              : '미작성'}
                          </span>
                        </div>
                        {!readOnly && contribution.userId === user.id ? (
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
              </div>
              {!readOnly && <div className="task-detail-comments">
                <TaskComments
                  key={`${team.id}-${task.id}-${user.id}`}
                  taskId={task.id}
                  team={team}
                  user={user}
                />
              </div>}
            </div>
            {!readOnly && isMutable(task) && isTeamEditor(team, user.id) && (
              <div className="task-detail-footer">
                <button
                  className="secondary-button danger"
                  disabled={busy || teamWorkBlocked(team)}
                  onClick={async () => {
                    if (
                      !(await confirm({
                        title: '작업 삭제',
                        message:
                          '이 작업에 등록된 결과를 완전히 삭제합니다. 삭제한 자료는 복구할 수 없습니다.',
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
      {reopening && task && (
        <Modal title="완료 작업 담당 재배정" busy={busy} onClose={() => setReopening(false)}>
          <form className="stack" onSubmit={submitRevisionHandoff}>
            <p>탈퇴한 팀원의 배분 {departedAllocation}%를 현재 팀원에게 옮기고 작업을 수정 중으로 전환합니다. 기존 수행 기록은 보존됩니다.</p>
            <Field label="새 담당자">
              <select required disabled={busy} value={revisionAssigneeId}
                onChange={(event) => setRevisionAssigneeId(event.target.value)}>
                <option value="">현재 팀원을 선택하세요</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>{member.name}</option>
                ))}
              </select>
            </Field>
            <ErrorNotice error={error} />
            <div className="modal-actions">
              <button type="button" className="secondary-button" disabled={busy} onClick={() => setReopening(false)}>취소</button>
              <button type="submit" className="primary-button" disabled={busy || !revisionAssigneeId}>재배정하고 수정 중으로 전환</button>
            </div>
          </form>
        </Modal>
      )}
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
