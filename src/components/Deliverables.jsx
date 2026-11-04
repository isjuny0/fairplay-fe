import { usePreviewGuide } from "../lib/previewGuideContext.js";
import useAppNavigate from "../hooks/useAppNavigate.js";
import Icon from "./Icon.jsx";
import RefreshButton from "./RefreshButton.jsx";
import DeliverableTable from "./DeliverableTable.jsx";
import DeliverableContent from "./DeliverableContent.jsx";
import MarkdownEditor from "./MarkdownEditor.jsx";
import { ArrowRight, FileText, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { parseRouteId, teamMenuPath } from "../lib/routes.js";
import {
  createDeliverable,
  deleteDeliverable,
  downloadDeliverable,
  listDeliverables,
  updateDeliverable,
  uploadDeliverable,
} from "../api/deliverables.js";
import useResource from "../hooks/useResource.js";
import { useInteractions } from "../hooks/useInteractions.js";
import useSaveRecovery from "../hooks/useSaveRecovery.js";
import SaveRecovery from "./SaveRecovery.jsx";
import { getTask } from "../api/tasks.js";
import { getTeamWorkContext } from "../api/teams.js";
import {
  collectFieldErrors,
  focusFirstFieldError,
} from "../lib/formValidation.js";
import {
  canModifyTeamWork,
  deliverablePermissions,
  isApprovedMember,
  isAssignee,
  isMutable,
  memberName,
  teamWorkBlocked,
} from "../lib/domain.js";
import {
  EmptyState,
  ErrorNotice,
  Field,
  FormActions,
  Modal,
  ResourceState,
} from "./ui.jsx";

function DeliverableForm({
  initial,
  taskId,
  resourceName,
  createLabel,
  tasks,
  permissions,
  busy,
  blocked,
  error,
  onClose,
  onSave,
  onLoadLatest,
}) {
  const { confirm } = useInteractions();
  const guide = usePreviewGuide();
  const guideExample = !initial && guide?.guiding && guide.stepId === "deliverable" && Number(taskId) === guide.taskId
    ? guide.examples.deliverable : null;
  const recovery = useSaveRecovery(error);
  const conflict = error?.code === "VERSION_CONFLICT";
  const canReapply =
    !recovery.latest ||
    (recovery.latest.permissions.metadata &&
      (!permissions.content || recovery.latest.permissions.content));
  const [initialForm] = useState({
    title: initial?.title || "",
    description: initial?.description || "",
    type: initial?.type || "TEXT",
    text: initial?.text || "",
    ...guideExample,
    taskId: taskId ?? "",
  });
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(initial || guideExample ? "editor" : "choose");
  const [descriptionExpanded, setDescriptionExpanded] = useState(Boolean(initialForm.description));
  const formElement = useRef(null);
  const fileExtensions = /\.(txt|md|pdf|doc|docx|ppt|pptx|xls|xlsx)$/i;
  const fileHelp = "TXT, MD, PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX";
  const [file, setFile] = useState(null);
  const dirty =
    Boolean(file) ||
    ["title", "description", "text", "taskId"].some(
      (name) => form[name] !== initialForm[name],
    );
  const fileInput = useRef(null);
  const [fieldErrors, setFieldErrors] = useState({});
  useEffect(() => {
    formElement.current?.querySelector('.deliverable-editor-scroll')?.scrollTo(0, 0);
    const target = step === "choose"
      ? formElement.current?.querySelector(`[data-deliverable-type="${form.type}"]`)
      : formElement.current?.querySelector(!initial && form.type === "FILE" && !file
        ? 'input[name="file"]' : 'input[name="title"]');
    target?.focus({ preventScroll: true });
  }, [step]);
  const canEditContent = !initial || permissions.content;
  const linkedTaskId = initial ? initial.taskId : taskId;
  const linkedTaskName =
    linkedTaskId == null
      ? "팀 공용 자료"
      : tasks.find((task) => task.id === linkedTaskId)?.title ||
        "작업 정보 확인 불가";
  const clearSelectedFile = () => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setFieldErrors((current) => ({ ...current, file: undefined }));
  };
  const update = (name, value) => {
    setFieldErrors((current) => ({
      ...current,
      [name]: undefined,
      ...(name === "type" ? { file: undefined, text: undefined } : {}),
    }));
    setForm((current) => ({ ...current, [name]: value }));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (step !== "editor" || busy || recovery.loading || blocked) return;
    const errors = collectFieldErrors(event.currentTarget, {
      ...(form.type === "FILE" &&
      file &&
      (file.size > 10 * 1024 * 1024 || !fileExtensions.test(file.name))
        ? { file: `${fileHelp} 형식의 10MiB 이하 파일을 선택해 주세요.` }
        : {}),
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      focusFirstFieldError(event.currentTarget, errors);
      return;
    }
    if (!canReapply || (conflict && !recovery.latest)) return;
    if (
      recovery.latest &&
      !(await confirm({
        title: "최신 자료에 내 입력 반영",
        message:
          "비교한 최신 자료에 현재 입력을 저장합니다. 다른 팀원의 변경 내용을 덮어쓸 수 있으며, 파일을 선택했다면 최신 원본도 교체됩니다. 저장할까요?",
        label: "내 입력으로 저장",
      }))
    )
      return;
    const input = { title: form.title.trim() };
    if (!initial || permissions.content)
      input.description = form.description.trim() || null;
    if (initial) {
      input.expectedVersion =
        recovery.latest?.deliverable.version ?? initial.version;
      if (permissions.content && initial.type !== "FILE")
        input.text = form.text.trim();
    } else {
      input.taskId = form.taskId === "" ? null : Number(form.taskId);
      if (form.type !== "FILE") {
        input.text = form.text.trim();
      }
    }
    onSave(input, form.type === "FILE" ? file : null, form.type);
  };
  const fileContent = (
    <section className="deliverable-form-section deliverable-content-section" aria-label="자료 내용 입력">
      {initial?.type === "FILE" && (
        <div className="deliverable-current-file" role="group" aria-label="현재 원본 파일">
          <span className="eyebrow">현재 원본</span><strong>{initial.file.originalFilename}</strong>
          <span className="field-help">{(initial.file.sizeBytes / 1024).toFixed(1)}KiB</span>
          <p className="field-help">교체할 파일을 선택하지 않으면 현재 원본을 유지합니다. 파일을 교체하면 이전 원본은 삭제됩니다.</p>
        </div>
      )}
      <Field label={initial ? "교체할 파일 (선택)" : "파일"} error={fieldErrors.file}
        help={`${fileHelp} / 파일당 10MiB / 팀 전체 파일 1GiB`}>
        <input ref={fileInput} name="file" type="file" className="deliverable-file-input"
          required={!initial && !file} accept=".txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
          onChange={(event) => {
            const selectedFile = event.target.files[0] || null;
            setFile(selectedFile);
            setFieldErrors((current) => ({ ...current, file: undefined }));
            if (!initial && !form.title.trim() && selectedFile && fileExtensions.test(selectedFile.name) && selectedFile.size <= 10 * 1024 * 1024) {
              update("title", (selectedFile.name.replace(/\.[^.]+$/, "") || selectedFile.name).slice(0, 100));
            }
          }} />
      </Field>
      {form.type === "FILE" && file && (
        <div className="file-selection" role="status">
          <span className="eyebrow">{initial ? "교체할 파일" : "선택한 파일"}</span>
          <strong>{file.name}</strong>
          <p>{(file.size / 1024).toFixed(1)}KiB · {initial ? "저장하면 기존 파일이 삭제되고 이 파일로 교체됩니다." : "등록하면 업로드됩니다."}</p>
          <button type="button" className="secondary-button" onClick={clearSelectedFile}>파일 선택 해제</button>
        </div>
      )}
    </section>
  );
  return (
    <Modal
      title={initial ? `${resourceName} 수정` : step === "choose" ? createLabel : form.type === "FILE" ? "파일 업로드" : "문서 작성"}
      busy={busy || recovery.loading}
      onClose={onClose}
      wide
      editor={canEditContent}
      className={`deliverable-registration-modal${step === "choose" ? " deliverable-choice-modal" : form.type === "FILE" ? " is-file-registration" : ""}`}
      dirty={dirty}
    >
      <form
        ref={formElement}
        className="deliverable-editor-form"
        onSubmit={submit}
        noValidate
      >
        <div className="deliverable-editor-scroll">
          {guideExample && <p className="field-help" data-guide-deliverable-hint="">예시 문서가 자동 입력되었습니다. 내용을 확인하거나 수정한 뒤 저장하세요.</p>}
          {step === "choose" ? (
            <fieldset className="deliverable-type-picker" disabled={busy || recovery.loading || blocked}>
              <legend className="sr-only">추가 방식 선택</legend>
              <div className="deliverable-type-options">
                {[
                  ["TEXT", "문서 작성", "내용을 직접 작성하고 마크다운으로 정리합니다.", FileText],
                  ["FILE", "파일 업로드", "문서·발표 자료 등 준비한 파일을 올립니다.", Upload],
                ].map(([type, label, description, TypeIcon]) => (
                  <button type="button" key={type} className="deliverable-type-option"
                    aria-label={label} data-deliverable-type={type}
                    onClick={() => {
                      update("type", type);
                      setFieldErrors({});
                      setStep("editor");
                    }}>
                    <TypeIcon className="deliverable-type-icon" aria-hidden="true" />
                    <strong>{label}</strong>
                    <span>{description}</span>
                    <ArrowRight className="deliverable-type-arrow" size={18} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
          <fieldset
            disabled={busy || recovery.loading || blocked}
            className={`form-fields deliverable-form-layout${canEditContent ? "" : " deliverable-metadata-only"}`}
          >
              {canEditContent && <nav className="editor-section-links" aria-label="산출물 입력 위치">
                {['기본 정보', form.type === 'FILE' ? '파일 업로드' : '본문 작성'].map((label, index) => <button type="button" key={label} onClick={event => {
                  const section = event.currentTarget.closest('fieldset').querySelector(index === 0 ? '.deliverable-basic-section' : '.deliverable-content-section');
                  section?.scrollIntoView({block:'start',behavior:'auto'});
                  section?.querySelector('input:not([type="hidden"]), textarea, button')?.focus({preventScroll:true});
                }}>{label}</button>)}
              </nav>}
            {canEditContent && form.type === "FILE" && fileContent}
            <section className="deliverable-form-section deliverable-basic-section" aria-label={`${resourceName} 기본 정보 입력`}>
              <Field label="제목" error={fieldErrors.title}>
                <input name="title" required maxLength={100} value={form.title}
                  placeholder={form.type === "FILE" ? "파일을 선택하면 제목이 자동 입력됩니다." : "자료의 제목을 입력하세요."}
                  onChange={(event) => update("title", event.target.value)} />
              </Field>
              <div className="deliverable-metadata-row">
                {!initial && taskId == null ? (
                  <Field label="작업 연결">
                    <select value={form.taskId} onChange={(event) => update("taskId", event.target.value)}>
                      <option value="">팀 공용 자료</option>
                      {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                    </select>
                  </Field>
                ) : (
                  <div className="deliverable-linked-task">
                    <span className="field-label">연결 작업</span><strong>{linkedTaskName}</strong>
                  </div>
                )}
              </div>
              {initial && <p className="field-help">자료 유형: {form.type === "FILE" ? "파일" : "문서"} · 자료 유형과 작업 연결은 변경할 수 없습니다.</p>}
              {initial && !permissions.content && <p className="notice">팀 공용 자료의 제목만 정리할 수 있습니다.</p>}
            </section>
            {canEditContent && form.type !== "FILE" && (
              <section className="deliverable-form-section deliverable-content-section" aria-label="자료 내용 입력">
                  <>
                    <Field label="본문" error={fieldErrors.text}>
                      <MarkdownEditor name="text" required maxLength={20000} rows={14} value={form.text}
                        onChange={(event) => update("text", event.target.value)} onValueChange={(value) => update("text", value)} />
                    </Field>
                    <p className="character-count">{form.text.length.toLocaleString()} / 20,000자</p>
                  </>
              </section>
            )}
            {canEditContent && (
              <details className="deliverable-description" open={descriptionExpanded}
                onToggle={(event) => setDescriptionExpanded(event.currentTarget.open)}>
                <summary>{descriptionExpanded ? "설명 접기" : "설명 추가"}</summary>
                <Field label="설명">
                  <textarea maxLength={2000} value={form.description}
                    onChange={(event) => update("description", event.target.value)} />
                </Field>
              </details>
            )}
          </fieldset>
          )}
          {blocked && (
            <p className="notice">
              현재 팀 상태로는 자료를 저장할 수 없습니다. 창을 닫고 팀 상태를
              확인해 주세요.
            </p>
          )}
          <ErrorNotice error={error} />
          <SaveRecovery
            error={error}
            recovery={recovery}
            onLoadLatest={
              onLoadLatest ? () => recovery.refresh(onLoadLatest) : undefined
            }
            canReapply={canReapply}
            rows={
              recovery.latest
                ? [
                    {
                      label: "제목",
                      latest: recovery.latest.deliverable.title,
                      input: form.title.trim(),
                    },
                    ...(!permissions.content
                      ? []
                      : [
                          {
                            label: "설명",
                            latest:
                              recovery.latest.deliverable.description || "",
                            input: form.description.trim(),
                          },
                          form.type === "FILE"
                            ? {
                                label: "원본 파일",
                                latest:
                                  recovery.latest.deliverable.file
                                    ?.originalFilename,
                                input:
                                  file?.name ||
                                  "선택한 새 파일 없음 · 최신 원본 유지",
                              }
                            : {
                                label: "본문",
                                latest: recovery.latest.deliverable.text,
                                input: form.text.trim(),
                              },
                        ]),
                  ]
                : []
            }
          />
        </div>
        <FormActions
          busy={busy || recovery.loading}
          disabled={blocked || (conflict && !recovery.latest) || !canReapply}
          onCancel={onClose}
          hideSubmit={step === "choose"}
          backLabel="방식 변경"
          onBack={!initial && step === "editor" ? () => { setFieldErrors({}); setStep("choose"); } : undefined}
          label={recovery.latest ? "내 입력으로 다시 저장" : error ? (initial ? "다시 저장" : resourceName === "결과물" ? "다시 추가" : "다시 등록") : initial ? "저장" : createLabel}
        />
      </form>
    </Modal>
  );
}

export default function Deliverables({
  team,
  user,
  members,
  tasks = [],
  tasksResource,
  taskId,
  onChanged = () => {},
}) {
  const { confirm, notify } = useInteractions();
  const taskOptionsReady =
    !tasksResource ||
    (tasksResource.data != null &&
      !tasksResource.loading &&
      !tasksResource.error);
  const navigateToMaterials = useAppNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const requestedPage = Number(searchParams.get("page") || 0);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage >= 0
      ? requestedPage
      : 0;
  const scopeId = parseRouteId(searchParams.get("taskId"));
  const scope =
    searchParams.get("unlinkedOnly") === "true"
      ? "COMMON"
      : scopeId == null
        ? "ALL"
        : String(scopeId);
  const isCollection = taskId == null;
  const query = isCollection ? searchParams.get("q") || "" : "";
  const [queryInput, setQueryInput] = useState(query);
  const searchToolbar = useRef(null);
  const filterId = useId();
  const filterToggle = useRef(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => setQueryInput(query), [query]);
  const type =
    isCollection && ["TEXT", "FILE"].includes(searchParams.get("type"))
      ? searchParams.get("type")
      : "";
  const authorId = isCollection ? searchParams.get("authorId") || "" : "";
  const sort =
    isCollection &&
    ["UPDATED_DESC", "TITLE_ASC"].includes(searchParams.get("sort"))
      ? searchParams.get("sort")
      : "";
  const unlinkedOnly = isCollection && scope === "COMMON";
  const setSearchOption = (key, value) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("page");
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { state: location.state });
  const clearSearch = () => {
    searchToolbar.current?.querySelector("input")?.focus();
    setQueryInput("");
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const key of [
        "q",
        "type",
        "authorId",
        "sort",
        "taskId",
        "unlinkedOnly",
        "page",
      ])
        next.delete(key);
      return next;
    }, { state: location.state });
  };
  const hasSearch =
    isCollection &&
    Boolean(query || type || authorId || sort || scope !== "ALL");
  const hasResultFilters = Boolean(
    query || type || authorId || unlinkedOnly,
  );
  const setPage = (value) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === 0) next.delete("page");
      else next.set("page", String(value));
      return next;
    }, { state: location.state });
  const setScope = (value) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("page");
      next.delete("taskId");
      next.delete("unlinkedOnly");
      if (value === "COMMON") next.set("unlinkedOnly", "true");
      else if (value !== "ALL") next.set("taskId", value);
      return next;
    }, { state: location.state });
  const appliedFilters = [
    sort && {
      key: "sort",
      label: "정렬",
      value: sort === "TITLE_ASC" ? "이름 순" : "최근 수정 순",
    },
    query && { key: "q", label: "검색", value: query },
    scope !== "ALL" && {
      key: "scope",
      label: "작업",
      value:
        scope === "COMMON"
          ? "팀 공용"
          : tasks.find((task) => String(task.id) === scope)?.title ||
            "작업 정보 확인 불가",
    },
    type && {
      key: "type",
      label: "유형",
      value: type === "FILE" ? "파일" : "문서",
    },
    authorId && {
      key: "authorId",
      label: "등록자",
      value: memberName(members, authorId),
    },
  ].filter(Boolean);
  const selectedTaskId =
    taskId ?? (["ALL", "COMMON"].includes(scope) ? undefined : Number(scope));
  const searchOptions = {
    taskId: selectedTaskId,
    page,
    size: 20,
    q: query,
    type,
    authorId,
    unlinkedOnly,
    sort,
  };
  const resource = useResource(
    () => listDeliverables(team.id, searchOptions),
    [
      team.id,
      selectedTaskId,
      page,
      query,
      type,
      authorId,
      unlinkedOnly,
      sort,
    ],
  );
  const [editing, setEditing] = useState(undefined);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState(null);
  const selectedDeliverable = resource.data?.find(
    (item) => item.id === selectedDeliverableId,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const eligibleTasks = tasks.filter(
    (task) =>
      canModifyTeamWork(team) && isMutable(task) && isAssignee(task, user.id),
  );
  const resourceName = isCollection ? "팀 자료" : "결과물";
  const createLabel = isCollection ? "팀 자료 등록" : "결과물 추가";
  const canCreate =
    taskOptionsReady &&
    isApprovedMember(team) &&
    !teamWorkBlocked(team) &&
    (taskId == null || eligibleTasks.some((task) => task.id === taskId));
  const openRegistration = () => {
    if (!canCreate || busy || !taskOptionsReady) return;
    setError(null);
    setEditing(null);
  };
  const save = async (input, file, type) => {
    if (
      !taskOptionsReady ||
      teamWorkBlocked(team) ||
      (taskId != null && !canModifyTeamWork(team))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      if (editing) await updateDeliverable(editing.id, input, file);
      else if (type === "FILE") await uploadDeliverable(team.id, input, file);
      else await createDeliverable(team.id, input);
      setEditing(undefined);
      notify(`${resourceName}${isCollection ? "를" : "을"} ${editing ? "수정" : isCollection ? "등록" : "추가"}했습니다.`);
      resource.reload();
      onChanged();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (deliverable) => {
    if (
      !(await confirm({
        title: `${resourceName} 삭제`,
        message: `“${deliverable.title}”을 완전히 삭제합니다. 파일도 함께 삭제되며 복구할 수 없습니다.`,
        label: `${resourceName} 삭제`,
        danger: true,
      }))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await deleteDeliverable(deliverable.id, deliverable.version);
      notify(`${resourceName}${isCollection ? "를" : "을"} 삭제했습니다.`);
      resource.reload();
      onChanged();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  const download = async (deliverable) => {
    setError(null);
    try {
      const blob = await downloadDeliverable(deliverable.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = deliverable.file.originalFilename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError);
    }
  };
  return (
    <section className="stack deliverables-section">
      <div
        className={
          taskId == null
            ? "page-heading page-heading--compact"
            : "section-heading linked-deliverables-heading"
        }
      >
        {taskId == null ? (
          <div>
            <h1>팀 자료</h1>
          </div>
        ) : (
          <div className="linked-deliverables-title">
            <h2>연결된 결과물</h2>
          </div>
        )}
        <div className="heading-actions">
          {isCollection && isApprovedMember(team) && (
            <button
              className="secondary-button"
              onClick={() =>
                navigateToMaterials(
                  teamMenuPath(team.spaceId, team.id, "팀 자료 검색"),
                )
              }
            >
              <Icon name="search" />
              자료에 질문하기
            </button>
          )}
          <RefreshButton
            disabled={resource.loading}
            onClick={resource.reload}
          />
          {canCreate && (
            <button
              className="primary-button"
              data-guide="open-deliverable"
              onClick={openRegistration}
            >
              <Icon name="plus" />
              {createLabel}
            </button>
          )}
        </div>
      </div>
      {isCollection && (
        <div
          className="deliverable-collection-controls collection-controls"
          ref={searchToolbar}
        >
          <div className="deliverable-search-toolbar">
            <button
              ref={filterToggle}
              type="button"
              className="secondary-button deliverable-filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls={filterId}
              onClick={() => setFiltersOpen((value) => !value)}
            >
              필터{" "}
              {appliedFilters.filter(
                (filter) => !["q", "sort"].includes(filter.key),
              ).length || ""}{" "}
              {filtersOpen ? "접기" : "펼치기"}
            </button>
            <div
              id={filterId}
              className={`deliverable-filter-row${filtersOpen ? " is-expanded" : ""}`}
            >
              <label
                className="deliverable-filter-field"
                data-active={scope !== "ALL"}
              >
                <span>작업 범위</span>
                <select
                  aria-label="작업별 조회"
                  disabled={!taskOptionsReady}
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                >
                  <option value="ALL">전체 자료</option>
                  <option value="COMMON">팀 공용 자료</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="deliverable-filter-field"
                data-active={Boolean(type)}
              >
                <span>유형</span>
                <select
                  aria-label="자료 유형"
                  value={type}
                  onChange={(event) =>
                    setSearchOption("type", event.target.value)
                  }
                >
                  <option value="">전체 유형</option>
                  <option value="TEXT">문서</option>
                  <option value="FILE">파일</option>
                </select>
              </label>
              <label
                className="deliverable-filter-field"
                data-active={Boolean(authorId)}
              >
                <span>등록자</span>
                <select
                  aria-label="자료 등록자"
                  value={authorId}
                  onChange={(event) =>
                    setSearchOption("authorId", event.target.value)
                  }
                >
                  <option value="">전체 등록자</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                    </option>
                  ))}
                  {authorId &&
                    !members.some((member) => member.userId === authorId) && (
                      <option value={authorId}>
                        현재 팀원 목록에 없는 등록자
                      </option>
                    )}
                </select>
              </label>
            </div>
            {appliedFilters.length > 0 && (
              <div
                className="deliverable-applied-filters collection-applied-filters"
                role="group"
                aria-label="적용된 조회 조건"
              >
                <span className="deliverable-filter-caption collection-filter-caption">
                  적용 중
                </span>
                {appliedFilters.map((filter) => (
                  <button
                    key={filter.key}
                    className="deliverable-filter-chip collection-filter-chip"
                    title={`${filter.label}: ${filter.value}`}
                    aria-label={`${filter.label}: ${filter.value} 조건 해제`}
                    onClick={() => {
                      const controlLabels = {
                        q: "자료 검색",
                        sort: "자료 정렬",
                        scope: "작업별 조회",
                        type: "자료 유형",
                        authorId: "자료 등록자",
                      };
                      const selector =
                        filter.key === "q"
                          ? "input"
                          : `select[aria-label="${controlLabels[filter.key]}"]`;
                      const control =
                        searchToolbar.current?.querySelector(selector);
                      (control?.getClientRects().length
                        ? control
                        : filterToggle.current
                      )?.focus();
                      if (filter.key === "scope") setScope("ALL");
                      else setSearchOption(filter.key, "");
                    }}
                  >
                    <span className="deliverable-chip-label">
                      {filter.label}
                    </span>
                    <span className="deliverable-chip-value">
                      {filter.value}
                    </span>
                    <Icon name="close" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="deliverable-search-scope">
            <div>
              <h2>자료 목록</h2>
              {!resource.loading && !resource.error && (
                <span role="status">
                  현재 페이지 {resource.data?.length || 0}건
                </span>
              )}
              {hasSearch && (
                <button
                  className="text-button collection-reset-button"
                  title="검색·유형·등록자·작업 범위·정렬을 초기화하고 첫 페이지로 이동합니다."
                  onClick={clearSearch}
                >
                  조회 조건 초기화
                </button>
              )}
            </div>
            <div className="deliverable-search-primary">
              <label className="deliverable-sort-field">
                <span>정렬</span>
                <select
                  aria-label="자료 정렬"
                  value={sort}
                  onChange={(event) =>
                    setSearchOption("sort", event.target.value)
                  }
                >
                  <option value="">최근 등록 순</option>
                  <option value="UPDATED_DESC">최근 수정 순</option>
                  <option value="TITLE_ASC">이름 순</option>
                </select>
              </label>
              <form
                role="search"
                className="deliverable-query-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSearchOption("q", queryInput.trim());
                }}
              >
                <label className="sr-only" htmlFor="deliverable-search">
                  자료 검색
                </label>
                <div className="deliverable-query-input">
                  <Icon name="search" />
                  <input
                    id="deliverable-search"
                    type="search"
                    placeholder="제목 또는 파일명 검색"
                    maxLength={100}
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                  />
                  <button className="secondary-button" type="submit">
                    검색
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      <ErrorNotice error={error} onRetry={resource.reload} />
      {tasksResource && (
        <ResourceState resource={tasksResource} label="작업 필터 정보" />
      )}
      <ResourceState resource={resource} label={isCollection ? "팀 자료 목록" : "결과물 목록"}>
        {resource.data?.length ? (
          taskId == null ? (
            <DeliverableTable
              deliverables={resource.data}
              taskMap={taskMap}
              team={team}
              user={user}
              members={members}
              busy={busy}
              onOpen={setSelectedDeliverableId}
              onDownload={download}
              onEdit={(deliverable) => {
                setError(null);
                setEditing(deliverable);
              }}
              onRemove={remove}
            />
          ) : (
            <div className="stack linked-deliverables">
              {resource.data.map((deliverable) => {
                const permissions = deliverablePermissions(
                  deliverable,
                  taskMap.get(deliverable.taskId),
                  team,
                  user.id,
                );
                return (
                  <article
                    className="panel deliverable-card"
                    key={deliverable.id}
                  >
                    <DeliverableContent
                      deliverable={deliverable}
                      task={taskMap.get(deliverable.taskId)}
                      members={members}
                      previewDocument
                      showTaskContext={false}
                      onDownload={download}
                    />
                    {(permissions.metadata || permissions.remove) && (
                      <div className="heading-actions linked-deliverable-actions">
                        {permissions.metadata && (
                          <button
                            className="secondary-button"
                            disabled={busy}
                            onClick={() => {
                              setError(null);
                              setEditing(deliverable);
                            }}
                          >
                            수정
                          </button>
                        )}
                        {permissions.remove && (
                          <button
                            className="secondary-button danger"
                            disabled={busy}
                            onClick={() => remove(deliverable)}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )
        ) : (
          <EmptyState>
            <p>
              {page > 0
                ? "이 페이지에 자료가 없습니다."
                : hasResultFilters
                  ? "조건에 맞는 자료가 없습니다."
                  : selectedTaskId != null
                    ? "아직 결과물이 없습니다."
                    : "아직 등록된 자료가 없습니다."}
            </p>
            <span>
              {page > 0
                ? "이전 페이지로 돌아가 등록된 자료를 확인하세요."
                : hasResultFilters
                  ? "검색어·유형·등록자·작업 범위를 변경하거나 조회 조건을 초기화하세요."
                  : canCreate
                    ? "팀 공용 자료나 담당 작업의 결과를 문서·파일로 남겨주세요."
                    : "팀원이 등록한 최신 자료가 이곳에 표시됩니다."}
            </span>
            {page > 0 ? (
              <button
                className="secondary-button"
                onClick={() => setPage(page - 1)}
              >
                이전 자료 보기
              </button>
            ) : selectedTaskId != null && taskId == null ? (
              <button
                className="secondary-button"
                onClick={() => setScope("ALL")}
              >
                전체 팀 자료 보기
              </button>
            ) : (
              canCreate &&
              !hasResultFilters && (
                <button
                  className="primary-button"
                  onClick={() => {
                    setError(null);
                    setEditing(null);
                  }}
                >
                  첫 {createLabel}
                </button>
              )
            )}
          </EmptyState>
        )}
      </ResourceState>
      <div className={`pagination${isCollection ? "" : " linked-deliverable-pagination"}`}>
        <button
          className="secondary-button"
          disabled={page === 0 || resource.loading}
          onClick={() => setPage(page - 1)}
        >
          이전
        </button>
        <span>{page + 1} 페이지</span>
        <button
          className="secondary-button"
          disabled={
            resource.loading || resource.error || resource.data?.length !== 20
          }
          onClick={() => setPage(page + 1)}
        >
          다음
        </button>
      </div>
      {selectedDeliverable && (
        <Modal
          title={`${resourceName} 상세`}
          onClose={() => setSelectedDeliverableId(null)}
          wide
        >
          <div className="stack deliverable-detail">
            <DeliverableContent
              deliverable={selectedDeliverable}
              task={taskMap.get(selectedDeliverable.taskId)}
              members={members}
              onDownload={download}
            />
            <ErrorNotice error={error} />
            <div className="modal-actions">
              <button
                className="secondary-button close-action-button"
                onClick={() => setSelectedDeliverableId(null)}
                aria-label="산출물 상세 닫기"
              >
                닫기
              </button>
            </div>
          </div>
        </Modal>
      )}
      {editing !== undefined && (
        <DeliverableForm
          key={editing?.id || "new"}
          initial={editing}
          resourceName={resourceName}
          createLabel={createLabel}
          taskId={taskId}
          tasks={eligibleTasks}
          permissions={
            editing
              ? deliverablePermissions(
                  editing,
                  taskMap.get(editing.taskId),
                  team,
                  user.id,
                )
              : null
          }
          busy={busy}
          blocked={
            !taskOptionsReady ||
            teamWorkBlocked(team) ||
            ((editing?.taskId ?? taskId) != null && !canModifyTeamWork(team))
          }
          error={error}
          onLoadLatest={
            editing
              ? async () => {
                  const [latestPage, context] = await Promise.all([
                    listDeliverables(team.id, searchOptions),
                    getTeamWorkContext(team.id),
                  ]);
                  const deliverable = latestPage.find(
                    (item) => item.id === editing.id,
                  );
                  if (!deliverable)
                    throw new Error(
                      "현재 페이지에서 자료를 찾지 못했습니다. 입력은 유지됩니다. 창을 닫고 목록에서 위치를 다시 확인해 주세요.",
                    );
                  const task =
                    deliverable.taskId == null
                      ? null
                      : (await getTask(deliverable.taskId)).task;
                  return {
                    deliverable,
                    permissions: deliverablePermissions(
                      deliverable,
                      task,
                      context.team,
                      user.id,
                    ),
                  };
                }
              : undefined
          }
          onClose={() => setEditing(undefined)}
          onSave={save}
        />
      )}
    </section>
  );
}
