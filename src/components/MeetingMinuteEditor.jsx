import { useEffect, useRef, useState } from "react";
import {
  assertMeetingTeam,
  createMeetingMinute,
  getMeetingMinute,
  updateMeetingMinute,
} from "../api/meetingMinutes.js";
import { useInteractions } from "../hooks/useInteractions.js";
import {
  meetingDraft,
  meetingInput,
  meetingLimits,
  meetingSections,
  isMeetingConflict,
  validateMeetingMinute,
} from "../lib/meetingMinutes.js";
import { focusFirstFieldError } from "../lib/formValidation.js";
import DateTimeInput from "./DateTimeInput.jsx";
import { defaultFormDateTime } from "../lib/dateTime.js";
import MarkdownEditor from "./MarkdownEditor.jsx";
import SaveRecovery from "./SaveRecovery.jsx";
import { ErrorNotice, Field, FormActions, Modal } from "./ui.jsx";

export default function MeetingMinuteEditor({
  team,
  members,
  initial = null,
  onClose,
  onSaved,
  onAccessError,
}) {
  const [initialForm] = useState(() => ({
    ...meetingDraft(initial),
    ...(!initial ? { meetingAt: defaultFormDateTime() } : {}),
  }));
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(0);
  const steps = ["기본 정보", ...meetingSections.map(([, label]) => label)];
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState({
    latest: null,
    loading: false,
    loadError: null,
  });
  const element = useRef(null),
    titleInput = useRef(null),
    active = useRef(true),
    inFlight = useRef(false);
  const { confirm, clearChanges } = useInteractions();
  const input = meetingInput(form, initial);
  const dirty = initial ? Object.keys(input).length > 0
    : JSON.stringify(form) !== JSON.stringify(initialForm);
  const conflict = isMeetingConflict(error);
  const blocked =
    team.workFrozen ||
    team.workStateUnknown ||
    [401, 403, 404].includes(error?.status) ||
    [401, 403, 404].includes(recovery.loadError?.status) ||
    error?.code === "TEAM_DELETION_IN_PROGRESS";
  const participants = [
    ...members,
    ...(initial?.attendees || []).filter(
      (person) => !members.some((member) => member.userId === person.userId),
    ),
  ];
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    const target = step === 0 ? titleInput.current
      : element.current?.querySelector(`[data-meeting-step="${step}"]`);
    target?.focus({ preventScroll: true });
    const scroll = element.current?.querySelector('.meeting-editor-scroll');
    if (scroll) scroll.scrollTop = 0;
  }, [step]);
  const validateStep = () => {
    const fields = step === 0 ? ["title", "meetingAt", "attendeeIds"]
      : [meetingSections[step - 1][0]];
    const invalid = Object.fromEntries(Object.entries(validateMeetingMinute(form))
      .filter(([key]) => fields.includes(key)));
    setErrors(current => ({ ...current,
      ...Object.fromEntries(fields.map(key => [key, undefined])), ...invalid }));
    if (Object.keys(invalid).length) {
      focusFirstFieldError(element.current, invalid);
      return false;
    }
    return true;
  };
  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const reportError = (failure) => {
    setError(failure);
    // Revoked permission must hide both the editor and the previous document immediately.
    if (
      [401, 403].includes(failure.status) &&
      failure.code !== "INVALID_CSRF_TOKEN"
    )
      onAccessError(failure);
  };
  const loadLatest = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRecovery((current) => ({ ...current, loading: true, loadError: null }));
    try {
      const latest = assertMeetingTeam(
        await getMeetingMinute(initial.id),
        team.id,
      );
      if (active.current)
        setRecovery({ latest, loading: false, loadError: null });
    } catch (failure) {
      if (active.current) {
        setRecovery({ latest: null, loading: false, loadError: failure });
        if ([401, 403].includes(failure.status)) reportError(failure);
      }
    } finally {
      inFlight.current = false;
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current || blocked) return;
    if (step < steps.length - 1) {
      if (validateStep()) setStep(current => current + 1);
      return;
    }
    if (!dirty || (conflict && !recovery.latest)) return;
    const invalid = validateMeetingMinute({
      ...form,
      title: form.title.trim(),
    });
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      const invalidSection = meetingSections.findIndex(([key]) => invalid[key]);
      setStep(invalid.title || invalid.meetingAt || invalid.attendeeIds ? 0 : invalidSection + 1);
      focusFirstFieldError(element.current, invalid);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      if (
        conflict &&
        !(await confirm({
          title: "최신 내용에 내 수정 반영",
          message:
            "비교한 수정 항목을 현재 입력으로 반영합니다. 다른 팀원의 최신 내용을 확인했나요?",
          label: "내 수정 저장",
          neutral: true,
        }))
      )
        return;
      const saved = initial
        ? await updateMeetingMinute(initial.id, {
            ...input,
            expectedVersion: conflict
              ? recovery.latest.version
              : initial.version,
          })
        : await createMeetingMinute(team.id, input);
      if (!active.current) return;
      assertMeetingTeam(saved, team.id);
      clearChanges();
      onSaved(saved);
    } catch (failure) {
      if (active.current) {
        reportError(failure);
        setRecovery({ latest: null, loading: false, loadError: null });
      }
    } finally {
      inFlight.current = false;
      if (active.current) setBusy(false);
    }
  };
  const displayValue = (key, item) =>
    key === "attendeeIds"
      ? (item?.attendees || [])
          .map((person) => `${person.name} (${person.userId})`)
          .join(", ")
      : item?.[key];
  return (
    <Modal
      title={initial ? "팀 회의록 수정" : "팀 회의록 등록"}
      onClose={onClose}
      busy={busy || recovery.loading}
      dirty={dirty}
      wide
      editor
      className="meeting-minute-modal"
    >
      <form
        ref={element}
        className="meeting-editor-form"
        onSubmit={submit}
        noValidate
      >
        <ol className="task-form-steps meeting-form-steps" aria-label="회의록 입력 단계">
          {steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}>
            <span>{index + 1}</span>{label}
          </li>)}
        </ol>
        <div className="meeting-editor-scroll">
          <ErrorNotice error={error} />
          {blocked && (
            <p className="notice">
              현재 회의록 변경이 제한되어 있습니다. 작성 중인 내용은 유지됩니다.
            </p>
          )}
          <fieldset
            disabled={busy || recovery.loading || blocked}
            className="meeting-editor-layout"
          >
            <section className="meeting-form-section" hidden={step !== 0} aria-label="기본 정보 입력">
              <h3 className="form-section-title">기본 정보</h3>
              <Field label="제목" error={errors.title}>
                <input
                  ref={titleInput}
                  name="title"
                  required
                  maxLength={meetingLimits.title}
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                />
              </Field>
              <Field
                label="회의일시"
                error={errors.meetingAt}
              >
                <DateTimeInput
                  name="meetingAt"
                  required
                  value={form.meetingAt}
                  onChange={(event) => update("meetingAt", event.target.value)}
                />
              </Field>
              <fieldset className="meeting-attendee-options">
                <legend>
                  참석자{" "}
                  <span className="field-help">
                    {form.attendeeIds.length} / {participants.length}명
                  </span>
                </legend>
                <p className="field-help">
                  참석자를 선택하지 않아도 저장할 수 있습니다.
                </p>
                <div className="meeting-attendee-list">
                  {participants.map((person) => {
                    const former = !members.some(
                      (member) => member.userId === person.userId,
                    );
                    return (
                      <label className="checkbox-row" key={person.userId}>
                        <input
                          type="checkbox"
                          checked={form.attendeeIds.includes(person.userId)}
                          disabled={
                            !form.attendeeIds.includes(person.userId) &&
                            form.attendeeIds.length >= meetingLimits.attendees
                          }
                          onChange={(event) =>
                            update(
                              "attendeeIds",
                              event.target.checked
                                ? [...form.attendeeIds, person.userId]
                                : form.attendeeIds.filter(
                                    (id) => id !== person.userId,
                                  ),
                            )
                          }
                        />
                        <span title={person.userId}>
                          {person.name}
                          {participants.filter(
                            (item) => item.name === person.name,
                          ).length > 1
                            ? ` · ${person.userId.slice(-6)}`
                            : ""}
                          {former && <small> · 이전 참석자</small>}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {errors.attendeeIds && (
                  <p className="field-error" role="alert">
                    {errors.attendeeIds}
                  </p>
                )}
              </fieldset>
            </section>
            {meetingSections.map(([key, label], index) => (
              <section className="meeting-form-section" hidden={step !== index + 1} key={key} aria-label={`${label} 입력`}>
                <h3 className="form-section-title" tabIndex={-1} data-meeting-step={index + 1}>{label}</h3>
                <Field
                  label={label}
                  error={errors[key]}
                  help={`${form[key].length.toLocaleString()} / ${meetingLimits[key].toLocaleString()}자 · 선택 사항`}
                >
                  <MarkdownEditor
                    name={key}
                    value={form[key]}
                    maxLength={meetingLimits[key]}
                    rows={12}
                    onValueChange={(value) => update(key, value)}
                    onChange={(event) => update(key, event.target.value)}
                  />
                </Field>
              </section>
            ))}
          </fieldset>
          <SaveRecovery
            error={error}
            recovery={recovery}
            onLoadLatest={initial && conflict ? loadLatest : undefined}
            canReapply={!blocked}
            rows={Object.keys(input).map((key) => ({
              label: {
                title: "제목",
                meetingAt: "회의일시",
                attendeeIds: "참석자",
                agenda: "안건",
                content: "논의 내용",
                decisions: "결정사항",
              }[key],
              latest: displayValue(key, recovery.latest),
              input:
                key === "attendeeIds"
                  ? participants
                      .filter((person) =>
                        form.attendeeIds.includes(person.userId),
                      )
                      .map((person) => `${person.name} (${person.userId})`)
                      .join(", ")
                  : input[key],
            }))}
          />
        </div>
        <FormActions
          busy={busy || recovery.loading}
          disabled={blocked || (step === steps.length - 1 && (!dirty || (conflict && !recovery.latest)))}
          onCancel={onClose}
          onBack={step > 0 ? () => setStep(current => current - 1) : undefined}
          label={step < steps.length - 1 ? "다음" : initial ? "수정 저장" : "등록"}
        />
      </form>
    </Modal>
  );
}
