import { useState } from 'react';
import {
  fromDateInput,
  memberRole,
  reviewerCandidates,
  toDateInput,
} from '../lib/domain.js';
import { ErrorNotice, Field, FormActions, Modal } from './ui.jsx';

export default function TaskForm({
  task,
  members,
  user,
  busy,
  blocked = false,
  serverError,
  onSave,
  onClose,
}) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    weight: task?.weight || 3,
    dueAt: toDateInput(task?.dueAt),
    assignees: task?.assignees.map((assignment) => ({ ...assignment })) || [],
    completionReviewerId: task?.completionReviewerId || '',
  });
  const [error, setError] = useState(null);
  const update = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));
  const candidates = reviewerCandidates(members, form.assignees);
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
  const submit = (event) => {
    event.preventDefault();
    if (blocked) return;
    setError(null);
    if (members.length < 2) {
      setError(new Error('승인된 팀원이 2명 이상 필요합니다.'));
      return;
    }
    if (
      !form.title.trim() ||
      !form.description.trim() ||
      total !== 100 ||
      !selectedReviewer
    ) {
      setError(
        new Error(
          '제목·설명·승인자를 입력하고 담당 배분 합계를 100%로 맞춰 주세요.',
        ),
      );
      return;
    }
    onSave({
      title: form.title.trim(),
      description: form.description.trim(),
      weight: Number(form.weight),
      dueAt: fromDateInput(form.dueAt),
      assignees: form.assignees.map((assignment) => ({
        userId: assignment.userId,
        allocationPercent: Number(assignment.allocationPercent),
      })),
      completionReviewerId: selectedReviewer,
    });
  };
  return (
    <Modal
      title={task ? '작업 수정' : '새 작업 만들기'}
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <fieldset className="form-fields" disabled={busy || blocked}>
          <Field label="작업 제목">
            <input
              required
              maxLength={100}
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
            />
          </Field>
          <Field
            label="작업 설명"
            help="무엇을 수행할지, 결과에 어떤 내용이 포함되어야 할지 적어주세요."
          >
            <textarea
              required
              maxLength={1000}
              rows={5}
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
            />
          </Field>
          <div className="two-columns">
            <Field
              label="가중치"
              help="같은 프로젝트 안에서 합의한 상대적인 작업 규모입니다."
            >
              <select
                value={form.weight}
                onChange={(event) => update('weight', event.target.value)}
              >
                {[1, 2, 3, 5, 8].map((weight) => (
                  <option key={weight}>{weight}</option>
                ))}
              </select>
            </Field>
            <Field label="마감 (한국 시간)">
              <input
                required
                type="datetime-local"
                value={form.dueAt}
                onChange={(event) => update('dueAt', event.target.value)}
              />
            </Field>
          </div>
          <div>
            <h3>담당자와 배분 · 합계 {total}%</h3>
            <div className="assignment-inputs">
              {members.map((member) => {
                const assignment = form.assignees.find(
                  (item) => item.userId === member.userId,
                );
                return (
                  <div key={member.userId} className="allocation-row">
                    <label>
                      <input
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
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <Field
            label="완료 승인자"
            help="비담당 리더 → 비담당 부리더 → 비담당 팀원 순서입니다. 전원 담당이면 리더·부리더를 선택할 수 있습니다."
          >
            <select
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
                자신을 담당자에서 제외하면 저장 후 수정 권한을 잃을 수 있습니다.
              </p>
            )}
        </fieldset>
        {blocked && (
          <p className="notice">
            현재 팀 상태로는 작업을 저장할 수 없습니다. 창을 닫고 팀 상태를
            확인해 주세요.
          </p>
        )}
        <ErrorNotice error={error || serverError} />
        <FormActions busy={busy} disabled={blocked} onCancel={onClose} />
      </form>
    </Modal>
  );
}
