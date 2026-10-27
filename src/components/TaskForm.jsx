import { useRef, useState } from 'react';
import DateTimeInput from './DateTimeInput.jsx';
import TaskWorkloadHelp from './TaskWorkloadHelp.jsx';
import { currentDateTime } from '../lib/dateTime.js';
import useMobileLayout from '../hooks/useMobileLayout.js';
import useSaveRecovery from '../hooks/useSaveRecovery.js';
import { getTask, recommendTaskAssignees } from '../api/tasks.js';
import './task-assignee-recommendation.css';
import { getTeamWorkContext } from '../api/teams.js';
import { useInteractions } from '../hooks/useInteractions.js';
import SaveRecovery from './SaveRecovery.jsx';
import {
  fromDateInput,
  expectedWorkloadOptions,
  memberRole,
  toDateInput,
  formatDate,
  formatExpectedWorkload,
  memberName,
  canEditTask,
  statusLabels,
} from '../lib/domain.js';
import { ErrorNotice, Field, FormActions, Modal } from './ui.jsx';
import {
  collectFieldErrors,
  focusFirstFieldError,
} from '../lib/formValidation.js';

function TaskField(props) {
  return <Field {...props} requiredIndicator="*" />;
}

function distributeEqually(assignees) {
  return assignees.map((assignment, index) => ({
    ...assignment,
    allocationPercent:
      Math.floor(100 / assignees.length) +
      (index < 100 % assignees.length ? 1 : 0),
  }));
}

function withDefaultTime(value, fallback) {
  const [date, time] = value.split('T');
  return date ? `${date}T${time || fallback.split('T')[1]}` : '';
}

export default function TaskForm({
  task,
  team,
  members,
  user,
  busy,
  blocked = false,
  serverError,
  onSave,
  onClose,
}) {
  const { confirm } = useInteractions();
  const recovery = useSaveRecovery(serverError);
  const editingMembers = recovery.latest?.members || members;
  const [defaultDateTime] = useState(currentDateTime);
  const [initialForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    weight: task?.weight || 3,
    startAt: task ? toDateInput(task.startAt) : defaultDateTime,
    dueAt: toDateInput(task?.dueAt) || defaultDateTime,
    assignees: task?.assignees.map((assignment) => ({ ...assignment })) || [],
  });
  const [form, setForm] = useState(initialForm);
  const [recommendationCount, setRecommendationCount] = useState('1');
  const [recommending, setRecommending] = useState(false);
  const recommendationInFlight = useRef(false);
  const [recommendationError, setRecommendationError] = useState(null);
  const [recommendationNotice, setRecommendationNotice] = useState('');
  const startAt = withDefaultTime(
    form.startAt,
    initialForm.startAt || defaultDateTime,
  );
  const dueAt = withDefaultTime(
    form.dueAt,
    initialForm.dueAt || defaultDateTime,
  );
  const mobile = useMobileLayout();
  const [step, setStep] = useState(0);
  const formElement = useRef(null);
  const goToStep = (nextStep) => {
    setStep(nextStep);
    requestAnimationFrame(() => {
      const heading = formElement.current?.querySelector(
        `[data-step-title="${nextStep}"]`,
      );
      heading?.focus();
      heading?.scrollIntoView({ block: 'start' });
    });
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const update = (name, value) => {
    if (name === 'assignees') setRecommendationNotice('');
    setFieldErrors((current) => ({
      ...Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => name !== 'assignees' || !key.startsWith('allocation-'),
        ),
      ),
      [name]: undefined,
    }));
    setForm((current) => ({ ...current, [name]: value }));
  };
  const selectRecommendedAssignees = async () => {
    if (recommendationInFlight.current || busy || blocked) return;
    const count = Number(recommendationCount);
    setRecommendationError(null);
    setRecommendationNotice('');
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > Math.min(editingMembers.length, 100)
    ) {
      setRecommendationError(
        new Error(
          `인원을 1~${Math.min(editingMembers.length, 100)}명 사이의 정수로 입력해 주세요.`,
        ),
      );
      return;
    }
    recommendationInFlight.current = true;
    setRecommending(true);
    try {
      if (
        form.assignees.length &&
        !(await confirm({
          title: '담당자 자동 선택',
          message: '현재 담당자와 배분을 자동 선택 결과로 바꿀까요?',
          label: '자동 선택',
        }))
      )
        return;
      const selected = await recommendTaskAssignees(team.id, count);
      if (
        selected.some(
          (assignment) =>
            !editingMembers.some(
              (member) => member.userId === assignment.userId,
            ),
        )
      ) {
        throw new Error(
          '팀원 정보가 변경됐습니다. 창을 다시 열어 확인해 주세요.',
        );
      }
      update('assignees', selected);
      setRecommendationNotice(
        `${selected.length}명을 선택했습니다. 담당자와 배분을 조정할 수 있습니다.`,
      );
    } catch (failure) {
      setRecommendationError(failure);
    } finally {
      recommendationInFlight.current = false;
      setRecommending(false);
    }
  };
  const total = form.assignees.reduce(
    (sum, assignment) => sum + Number(assignment.allocationPercent),
    0,
  );
  const toggle = (member, checked) =>
    update(
      'assignees',
      distributeEqually(
        checked
          ? [...form.assignees, { userId: member.userId }]
          : form.assignees.filter(
              (assignment) => assignment.userId !== member.userId,
            ),
      ),
    );
  const canReapply =
    !recovery.latest ||
    (canEditTask(recovery.latest.task, recovery.latest.team, user.id) &&
      form.assignees.every((assignment) =>
        editingMembers.some((member) => member.userId === assignment.userId),
      ));
  const conflict = serverError?.code === 'VERSION_CONFLICT';
  const submit = async (event) => {
    event.preventDefault();
    if (busy || recovery.loading || blocked || recommendationInFlight.current)
      return;
    setError(null);
    if (editingMembers.length < 2) {
      setError(new Error('승인된 팀원이 2명 이상 필요합니다.'));
      return;
    }
    const allErrors = collectFieldErrors(event.currentTarget, {
      ...(startAt && dueAt && startAt > dueAt
        ? { dueAt: '마감은 시작일과 같거나 이후여야 합니다.' }
        : {}),
      ...(!form.assignees.length
        ? { assignees: '담당자를 한 명 이상 선택해 주세요.' }
        : total !== 100
          ? {
              assignees: `현재 합계는 ${total}%입니다. 균등 배분을 누르거나 합계를 100%로 맞춰 주세요.`,
            }
          : {}),
    });
    const errors =
      mobile && step < 2
        ? Object.fromEntries(
            Object.entries(allErrors).filter(([name]) =>
              step === 0
                ? ['title', 'description', 'startAt', 'dueAt'].includes(name)
                : !['title', 'description', 'startAt', 'dueAt'].includes(name),
            ),
          )
        : allErrors;
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      if (mobile && step === 2)
        setStep(
          ['title', 'description', 'startAt', 'dueAt'].some(
            (name) => errors[name],
          )
            ? 0
            : 1,
        );
      focusFirstFieldError(event.currentTarget, errors);
      return;
    }
    if (mobile && step < 2) {
      goToStep(step + 1);
      return;
    }
    if (!canReapply || (conflict && !recovery.latest)) return;
    const version = recovery.latest?.task.version ?? task?.version;
    if (
      recovery.latest &&
      !(await confirm({
        title: '최신 작업에 내 입력 반영',
        message:
          '확인한 최신 작업에 현재 제목·설명·작업량·시작일·마감·담당 배분를 반영합니다. 다른 팀원의 수정 내용을 덮어쓸 수 있습니다. 비교한 내용을 확인하고 저장할까요?',
        label: '내 입력으로 저장',
      }))
    )
      return;
    onSave(
      {
        title: form.title.trim(),
        description: form.description.trim(),
        weight: Number(form.weight),
        ...(!task ||
        startAt !== initialForm.startAt ||
        (recovery.latest &&
          startAt !== toDateInput(recovery.latest.task.startAt))
          ? { startAt: fromDateInput(startAt) }
          : {}),
        dueAt: fromDateInput(dueAt),
        assignees: form.assignees.map((assignment) => ({
          userId: assignment.userId,
          allocationPercent: Number(assignment.allocationPercent),
        })),
      },
      version,
    );
  };
  return (
    <Modal
      title={task ? '작업 수정' : '새 작업 만들기'}
      busy={busy || recovery.loading || recommending}
      onClose={onClose}
      wide
      editor
      dirty={dirty}
    >
      <form
        className="task-editor-form"
        ref={formElement}
        onSubmit={submit}
        noValidate
      >
        {mobile && (
          <ol className="task-form-steps" aria-label="작업 입력 단계">
            {['작업 내용', '담당·배분', '저장 전 확인'].map((label, index) => (
              <li
                key={label}
                aria-current={step === index ? 'step' : undefined}
              >
                <span>{index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
        )}
        <fieldset
          className="form-fields"
          disabled={busy || recovery.loading || blocked || recommending}
        >
          <div className="task-form-layout">
            <section
              hidden={mobile && step !== 0}
              className="task-form-section"
              aria-label="작업 내용 입력"
            >
              <h3
                tabIndex={-1}
                data-step-title="0"
                className="form-section-title"
              >
                작업 내용
              </h3>
              <TaskField label="작업 제목" error={fieldErrors.title}>
                <input
                  name="title"
                  required
                  maxLength={100}
                  placeholder="어떤 작업인가요?"
                  value={form.title}
                  onChange={(event) => update('title', event.target.value)}
                />
              </TaskField>
              <div className="task-description-field">
                <TaskField label="작업 설명" error={fieldErrors.description}>
                  <textarea
                    name="description"
                    required
                    maxLength={1000}
                    rows={4}
                    placeholder="수행할 내용과 결과물에 포함할 내용을 적어 주세요."
                    value={form.description}
                    onChange={(event) =>
                      update('description', event.target.value)
                    }
                  />
                </TaskField>
                <p className="character-count">
                  {form.description.length} / 1000자
                </p>
              </div>
              <div className="task-workload-field">
                <TaskField
                  label="예상 작업량"
                  labelAccessory={<TaskWorkloadHelp />}
                  help="담당자 전체의 예상 시간을 합산해 선택하세요."
                >
                  <select
                    required
                    value={form.weight}
                    onChange={(event) =>
                      update('weight', Number(event.target.value))
                    }
                  >
                    {expectedWorkloadOptions.map(({ weight, label }) => (
                      <option key={weight} value={weight}>
                        {label}
                      </option>
                    ))}
                  </select>
                </TaskField>
              </div>
              <section
                className="task-schedule-fields"
                aria-label="계획 일정 입력"
              >
                <h4>계획 일정</h4>
                <div className="two-columns">
                  <TaskField
                    label="시작일"
                    error={fieldErrors.startAt}
                    showRequiredIndicator={false}
                  >
                    <DateTimeInput
                      name="startAt"
                      compactTime
                      required
                      timeRequired={false}
                      showRequirements
                      value={form.startAt}
                      onChange={(event) =>
                        update('startAt', event.target.value)
                      }
                    />
                  </TaskField>
                  <TaskField
                    label="마감"
                    error={fieldErrors.dueAt}
                    showRequiredIndicator={false}
                  >
                    <DateTimeInput
                      name="dueAt"
                      compactTime
                      required
                      timeRequired={false}
                      showRequirements
                      value={form.dueAt}
                      onChange={(event) => update('dueAt', event.target.value)}
                    />
                  </TaskField>
                </div>
              </section>
            </section>
            <section
              hidden={mobile && step !== 1}
              className="task-form-section assignment-form-section"
              aria-label="담당·배분 설정 입력"
            >
              <h3
                tabIndex={-1}
                data-step-title="1"
                className="form-section-title"
              >
                담당자와 배분{' '}
                <span className="required-asterisk" aria-hidden="true">
                  *
                </span>
              </h3>
              <div className="assignment-allocation-panel">
                {!task && (
                  <div className="task-assignee-recommendation">
                    <p id="assignee-recommendation-help">
                      완료·미완료 작업의 예상 작업량과 담당 비율을 기준으로
                      선택합니다.
                    </p>
                    <div className="task-assignee-recommendation-controls">
                      <label>
                        자동 선택 인원
                        <input
                          type="number"
                          min={1}
                          max={Math.min(editingMembers.length, 100)}
                          step={1}
                          value={recommendationCount}
                          aria-describedby="assignee-recommendation-help"
                          onChange={(event) =>
                            setRecommendationCount(event.target.value)
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={editingMembers.length < 2}
                        onClick={selectRecommendedAssignees}
                      >
                        {recommending ? '선택 중…' : '작업량 기준 자동 선택'}
                      </button>
                    </div>
                    <ErrorNotice error={recommendationError} />
                    {recommendationNotice && (
                      <p role="status">{recommendationNotice}</p>
                    )}
                  </div>
                )}
                <div className="section-heading">
                  <p>담당자를 선택하면 자동으로 균등 배분됩니다.</p>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!form.assignees.length}
                    onClick={() =>
                      update('assignees', distributeEqually(form.assignees))
                    }
                  >
                    균등 배분
                  </button>
                </div>
                <div className="allocation-summary" role="status">
                  <span>담당 {form.assignees.length}명</span>
                  <strong
                    className={total === 100 ? 'allocation-complete' : ''}
                  >
                    합계 {total}%
                  </strong>
                </div>
                <div
                  className={`allocation-total-track ${total > 100 ? 'is-over' : ''}`}
                  aria-hidden="true"
                >
                  <span
                    style={{ width: `${Math.min(100, Math.max(0, total))}%` }}
                  />
                </div>
                <p
                  id="assignment-help"
                  className={
                    fieldErrors.assignees ? 'field-error' : 'field-help'
                  }
                  role={fieldErrors.assignees ? 'alert' : undefined}
                >
                  {fieldErrors.assignees ||
                    (total === 100
                      ? '100% 배분 완료'
                      : '합계를 100%로 맞춰 주세요.')}
                </p>
                <div className="assignment-inputs">
                  {editingMembers.map((member) => {
                    const assignment = form.assignees.find(
                      (item) => item.userId === member.userId,
                    );
                    return (
                      <div
                        key={member.userId}
                        className={`allocation-row ${assignment ? 'is-selected' : ''}`}
                      >
                        <label className="allocation-member">
                          <input
                            name="assignees"
                            aria-label={`${member.name} · ${memberRole(member)}`}
                            aria-describedby="assignment-help"
                            aria-invalid={Boolean(fieldErrors.assignees)}
                            type="checkbox"
                            checked={Boolean(assignment)}
                            onChange={(event) =>
                              toggle(member, event.target.checked)
                            }
                          />{' '}
                          <span
                            className="allocation-avatar"
                            aria-hidden="true"
                          >
                            {member.name.slice(0, 1)}
                          </span>
                          <span className="allocation-member-name">
                            {member.name}
                            <span className="allocation-role">
                              {memberRole(member)}
                            </span>
                          </span>
                        </label>
                        {assignment && (
                          <label className="allocation-value">
                            <span className="sr-only">배분</span>
                            <input
                              name={`allocation-${member.userId}`}
                              aria-invalid={Boolean(
                                fieldErrors[`allocation-${member.userId}`],
                              )}
                              aria-describedby={
                                fieldErrors[`allocation-${member.userId}`]
                                  ? `allocation-error-${member.userId}`
                                  : undefined
                              }
                              aria-label={`${member.name} 배분율`}
                              type="number"
                              required
                              min={1}
                              max={100}
                              value={assignment.allocationPercent}
                              onChange={(event) =>
                                update(
                                  'assignees',
                                  form.assignees.map((item) =>
                                    item.userId === member.userId
                                      ? {
                                          ...item,
                                          allocationPercent: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                            <span aria-hidden="true">%</span>
                            {fieldErrors[`allocation-${member.userId}`] && (
                              <span
                                id={`allocation-error-${member.userId}`}
                                className="field-error"
                                role="alert"
                              >
                                {fieldErrors[`allocation-${member.userId}`]}
                              </span>
                            )}
                          </label>
                        )}
                        {!assignment && (
                          <span className="allocation-unselected">미선택</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {form.assignees.some(
                (assignment) =>
                  !editingMembers.some(
                    (member) => member.userId === assignment.userId,
                  ),
              ) && (
                <p className="notice">
                  현재 팀원이 아닌 담당자가 포함되어 있습니다.{' '}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => update('assignees', [])}
                  >
                    담당 배분 다시 지정
                  </button>
                </p>
              )}
              {task &&
                task.assignees.some(
                  (assignment) => assignment.userId === user.id,
                ) &&
                !form.assignees.some(
                  (assignment) => assignment.userId === user.id,
                ) && (
                  <p className="notice">
                    자신을 담당자에서 제외하면 저장 후 수정 권한을 잃을 수
                    있습니다.
                  </p>
                )}
            </section>
            {mobile && step === 2 && (
              <section
                className="task-form-section task-form-review"
                aria-label="작업 저장 전 요약"
              >
                <h3
                  tabIndex={-1}
                  data-step-title="2"
                  className="form-section-title"
                >
                  저장 전 확인
                </h3>
                <dl className="review-facts">
                  <div>
                    <dt>작업 제목</dt>
                    <dd>{form.title}</dd>
                  </div>
                  <div>
                    <dt>작업 설명</dt>
                    <dd className="preserve-lines">{form.description}</dd>
                  </div>
                  <div>
                    <dt>예상 작업량</dt>
                    <dd>{formatExpectedWorkload(form.weight)}</dd>
                  </div>
                  <div>
                    <dt>시작일</dt>
                    <dd>
                      {startAt ? formatDate(fromDateInput(startAt)) : '미입력'}
                    </dd>
                  </div>
                  <div>
                    <dt>마감</dt>
                    <dd>
                      {dueAt ? formatDate(fromDateInput(dueAt)) : '미입력'}
                    </dd>
                  </div>
                  <div>
                    <dt>담당 배분</dt>
                    <dd>
                      {form.assignees.map((assignment) => (
                        <span key={assignment.userId}>
                          {memberName(editingMembers, assignment.userId)}{' '}
                          {assignment.allocationPercent}%<br />
                        </span>
                      ))}
                    </dd>
                  </div>
                </dl>
                <div className="heading-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => goToStep(0)}
                  >
                    작업 내용 수정
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => goToStep(1)}
                  >
                    담당·배분 수정
                  </button>
                </div>
                <p className="field-help">
                  아직 저장되지 않았습니다. 내용을 확인한 뒤 저장해 주세요.
                </p>
              </section>
            )}
          </div>
        </fieldset>
        {blocked && (
          <p className="notice">
            현재 팀 상태로는 작업을 저장할 수 없습니다. 창을 닫고 팀 상태를
            확인해 주세요.
          </p>
        )}
        <ErrorNotice error={error || serverError} />
        <SaveRecovery
          error={serverError}
          recovery={recovery}
          canReapply={canReapply}
          onLoadLatest={
            task
              ? () =>
                  recovery.refresh(async () => {
                    const [detail, context] = await Promise.all([
                      getTask(task.id),
                      getTeamWorkContext(task.teamId),
                    ]);
                    if (detail.task.teamId !== team.id)
                      throw new Error('현재 팀에 속한 작업이 아닙니다.');
                    return { ...context, task: detail.task };
                  })
              : undefined
          }
          rows={
            recovery.latest
              ? [
                  {
                    label: '작업 제목',
                    latest: recovery.latest.task.title,
                    input: form.title.trim(),
                  },
                  {
                    label: '작업 설명',
                    latest: recovery.latest.task.description,
                    input: form.description.trim(),
                  },
                  {
                    label: '예상 작업량',
                    latest: formatExpectedWorkload(recovery.latest.task.weight),
                    input: formatExpectedWorkload(form.weight),
                  },
                  {
                    label: '시작일',
                    latest: toDateInput(recovery.latest.task.startAt),
                    input: form.startAt || '미입력',
                  },
                  {
                    label: '마감',
                    latest: toDateInput(recovery.latest.task.dueAt),
                    input: form.dueAt,
                  },
                  {
                    label: '담당 배분',
                    latest: recovery.latest.task.assignees
                      .map(
                        (assignment) =>
                          `${memberName(editingMembers, assignment.userId)} ${assignment.allocationPercent}%`,
                      )
                      .join(' · '),
                    input: form.assignees
                      .map(
                        (assignment) =>
                          `${memberName(editingMembers, assignment.userId)} ${assignment.allocationPercent}%`,
                      )
                      .join(' · '),
                  },
                ]
              : []
          }
        >
          {recovery.latest && (
            <p>현재 작업 상태: {statusLabels[recovery.latest.task.status]}</p>
          )}
        </SaveRecovery>
        <FormActions
          busy={busy || recovery.loading}
          disabled={
            recommending ||
            blocked ||
            ((!mobile || step === 2) &&
              ((conflict && !recovery.latest) || !canReapply))
          }
          onCancel={onClose}
          label={
            mobile && step < 2
              ? step === 0
                ? '다음: 담당·배분'
                : '다음: 저장 전 확인'
              : recovery.latest
                ? '내 입력으로 다시 저장'
                : serverError
                  ? '다시 저장'
                  : '저장'
          }
          onBack={mobile && step > 0 ? () => goToStep(step - 1) : undefined}
        />
      </form>
    </Modal>
  );
}
