import { useRef, useState } from 'react';
import useMobileLayout from '../hooks/useMobileLayout.js';
import useSaveRecovery from '../hooks/useSaveRecovery.js';
import { getTask } from '../api/tasks.js';
import { getTeamWorkContext } from '../api/teams.js';
import { useInteractions } from '../hooks/useInteractions.js';
import SaveRecovery from './SaveRecovery.jsx';
import {
  fromDateInput,
  expectedWorkloadOptions,
  memberRole,
  reviewerCandidates,
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
  const [initialForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    weight: task?.weight || 3,
    dueAt: toDateInput(task?.dueAt),
    assignees: task?.assignees.map((assignment) => ({ ...assignment })) || [],
    completionReviewerId: task?.completionReviewerId || '',
  });
  const [form, setForm] = useState(initialForm);
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
    setFieldErrors((current) => ({
      ...Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => name !== 'assignees' || !key.startsWith('allocation-'),
        ),
      ),
      [name]: undefined,
      ...(name === 'assignees' ? { completionReviewerId: undefined } : {}),
    }));
    setForm((current) => ({ ...current, [name]: value }));
  };
  const candidates = reviewerCandidates(editingMembers, form.assignees);
  const selectedReviewer = candidates.some(
    (member) => member.userId === form.completionReviewerId,
  )
    ? form.completionReviewerId
    : '';
  const total = form.assignees.reduce(
    (sum, assignment) => sum + Number(assignment.allocationPercent),
    0,
  );
  const toggle = (member, checked) =>
    update(
      'assignees',
      checked
        ? [
            ...form.assignees,
            {
              userId: member.userId,
              allocationPercent: form.assignees.length ? 1 : 100,
            },
          ]
        : form.assignees.filter(
            (assignment) => assignment.userId !== member.userId,
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
    if (busy || recovery.loading || blocked) return;
    setError(null);
    if (editingMembers.length < 2) {
      setError(new Error('승인된 팀원이 2명 이상 필요합니다.'));
      return;
    }
    const allErrors = collectFieldErrors(event.currentTarget, {
      ...(!form.assignees.length
        ? { assignees: '담당자를 한 명 이상 선택해 주세요.' }
        : total !== 100
          ? {
              assignees: `현재 합계는 ${total}%입니다. 균등 배분을 누르거나 합계를 100%로 맞춰 주세요.`,
            }
          : {}),
      ...(!selectedReviewer
        ? { completionReviewerId: '목록에서 완료 승인자를 선택해 주세요.' }
        : {}),
    });
    const errors =
      mobile && step < 2
        ? Object.fromEntries(
            Object.entries(allErrors).filter(([name]) =>
              step === 0
                ? ['title', 'description', 'dueAt'].includes(name)
                : !['title', 'description', 'dueAt'].includes(name),
            ),
          )
        : allErrors;
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      if (mobile && step === 2)
        setStep(
          ['title', 'description', 'dueAt'].some((name) => errors[name])
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
          '확인한 최신 작업에 현재 제목·설명·작업량·마감·담당 배분·승인자를 반영합니다. 다른 팀원의 수정 내용을 덮어쓸 수 있습니다. 비교한 내용을 확인하고 저장할까요?',
        label: '내 입력으로 저장',
      }))
    )
      return;
    onSave(
      {
        title: form.title.trim(),
        description: form.description.trim(),
        weight: Number(form.weight),
        dueAt: fromDateInput(form.dueAt),
        assignees: form.assignees.map((assignment) => ({
          userId: assignment.userId,
          allocationPercent: Number(assignment.allocationPercent),
        })),
        completionReviewerId: selectedReviewer,
      },
      version,
    );
  };
  return (
    <Modal
      title={task ? '작업 수정' : '새 작업 만들기'}
      busy={busy || recovery.loading}
      onClose={onClose}
      wide
      editor
      dirty={dirty}
    >
      <form ref={formElement} onSubmit={submit} noValidate>
        {mobile && (
          <ol className="task-form-steps" aria-label="작업 입력 단계">
            {['작업 내용', '담당·승인', '저장 전 확인'].map((label, index) => (
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
          disabled={busy || recovery.loading || blocked}
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
              <Field label="작업 제목" error={fieldErrors.title}>
                <input
                  name="title"
                  required
                  maxLength={100}
                  value={form.title}
                  onChange={(event) => update('title', event.target.value)}
                />
              </Field>
              <Field
                label="작업 설명"
                error={fieldErrors.description}
                help="무엇을 수행할지, 결과에 어떤 내용이 포함되어야 할지 적어주세요."
              >
                <textarea
                  name="description"
                  required
                  maxLength={1000}
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    update('description', event.target.value)
                  }
                />
              </Field>
              <p className="character-count">
                {form.description.length} / 1000자
              </p>
              <div className="two-columns">
                <Field
                  label="예상 작업량"
                  help="모든 담당자의 준비·수행·검토 시간을 합산합니다. 대기 시간은 제외합니다."
                >
                  <select
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
                </Field>
                <Field label="마감 (한국 시간)" error={fieldErrors.dueAt}>
                  <input
                    name="dueAt"
                    required
                    type="datetime-local"
                    value={form.dueAt}
                    onChange={(event) => update('dueAt', event.target.value)}
                  />
                </Field>
              </div>
              <details className="form-help">
                <summary>예상 작업량과 담당 비율은 어떻게 사용되나요?</summary>
                <p className="field-help">
                  예상 작업량과 담당 비율은 기여도 계산에 반영됩니다. 실제로
                  오래 걸렸다는 이유로 자동 증가하지 않으며, 작업 범위가 바뀌면
                  팀과 합의해 조정해주세요.
                </p>
              </details>
            </section>
            <section
              hidden={mobile && step !== 1}
              className="task-form-section assignment-form-section"
              aria-label="담당·승인 설정 입력"
            >
              <div>
                <h3
                  tabIndex={-1}
                  data-step-title="1"
                  className="form-section-title"
                >
                  담당·승인 설정
                </h3>
                <div className="section-heading">
                  <h3>담당자와 배분 · 합계 {total}%</h3>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!form.assignees.length}
                    onClick={() =>
                      update(
                        'assignees',
                        form.assignees.map((assignment, index) => ({
                          ...assignment,
                          allocationPercent:
                            Math.floor(100 / form.assignees.length) +
                            (index < 100 % form.assignees.length ? 1 : 0),
                        })),
                      )
                    }
                  >
                    균등 배분
                  </button>
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
                      ? '담당 비율 합계가 100%입니다.'
                      : '담당자를 선택하고 비율 합계를 100%로 맞춰 주세요.')}
                </p>
                <div className="assignment-inputs">
                  {editingMembers.map((member) => {
                    const assignment = form.assignees.find(
                      (item) => item.userId === member.userId,
                    );
                    return (
                      <div key={member.userId} className="allocation-row">
                        <label>
                          <input
                            name="assignees"
                            aria-describedby="assignment-help"
                            aria-invalid={Boolean(fieldErrors.assignees)}
                            type="checkbox"
                            checked={Boolean(assignment)}
                            onChange={(event) =>
                              toggle(member, event.target.checked)
                            }
                          />{' '}
                          {member.name} · {memberRole(member)}
                        </label>
                        {assignment && (
                          <label>
                            배분 %
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
              <Field
                label="완료 승인자"
                error={fieldErrors.completionReviewerId}
                help="비담당 리더 → 비담당 부리더 → 비담당 팀원 순서입니다. 전원 담당이면 리더·부리더를 선택할 수 있습니다."
              >
                <select
                  name="completionReviewerId"
                  required
                  value={selectedReviewer}
                  onChange={(event) =>
                    update('completionReviewerId', event.target.value)
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
                    <dt>마감 (한국 시간)</dt>
                    <dd>
                      {form.dueAt
                        ? formatDate(fromDateInput(form.dueAt))
                        : '미입력'}
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
                  <div>
                    <dt>완료 승인자</dt>
                    <dd>{memberName(editingMembers, selectedReviewer)}</dd>
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
                    담당·승인 수정
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
                    label: '마감 (한국 시간)',
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
                  {
                    label: '완료 승인자',
                    latest: memberName(
                      editingMembers,
                      recovery.latest.task.completionReviewerId,
                    ),
                    input: selectedReviewer
                      ? memberName(editingMembers, selectedReviewer)
                      : '미선택',
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
            blocked ||
            ((!mobile || step === 2) &&
              ((conflict && !recovery.latest) || !canReapply))
          }
          onCancel={onClose}
          label={
            mobile && step < 2
              ? step === 0
                ? '다음: 담당·승인'
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
