import useAppNavigate from "../hooks/useAppNavigate.js";
import Icon from "./Icon.jsx";
import RefreshButton from "./RefreshButton.jsx";
import DeliverableTable from "./DeliverableTable.jsx";
import DeliverableContent from "./DeliverableContent.jsx";
import MarkdownEditor from "./MarkdownEditor.jsx";
import { FileText, Upload, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  categoryLabels,
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
  const recovery = useSaveRecovery(error);
  const conflict = error?.code === "VERSION_CONFLICT";
  const canReapply =
    !recovery.latest ||
    (recovery.latest.permissions.metadata &&
      (!permissions.content || recovery.latest.permissions.content));
  const [initialForm] = useState({
    title: initial?.title || "",
    description: initial?.description || "",
    category: initial?.category || "OTHER",
    type: initial?.type || "TEXT",
    text: initial?.text || "",
    taskId: taskId ?? "",
  });
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(initial ? "editor" : "choose");
  const formElement = useRef(null);
  const fileExtensions = /\.(txt|md|pdf|doc|docx|ppt|pptx|xls|xlsx)$/i;
  const fileHelp = "TXT, MD, PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX";
  const [file, setFile] = useState(null);
  const dirty =
    Boolean(file) ||
    ["title", "description", "category", "text", "taskId"].some(
      (name) => form[name] !== initialForm[name],
    );
  const fileInput = useRef(null);
  const [fieldErrors, setFieldErrors] = useState({});
  useEffect(() => {
    formElement.current
      ?.querySelector(".deliverable-editor-scroll")
      ?.scrollTo(0, 0);
    const target =
      step === "choose"
        ? formElement.current?.querySelector(
            `[data-deliverable-type="${form.type === "FILE" ? "FILE" : "TEXT"}"]`,
          )
        : formElement.current?.querySelector('input[name="title"]');
    target?.focus({ preventScroll: true });
  }, [step]);
  const canEditContent = !initial || permissions.content;
  const linkedTaskId = initial ? initial.taskId : taskId;
  const linkedTaskName =
    linkedTaskId == null
      ? "팀 공용 산출물"
      : tasks.find((task) => task.id === linkedTaskId)?.title ||
        `작업 #${linkedTaskId}`;
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
        title: "최신 산출물에 내 입력 반영",
        message:
          "비교한 최신 산출물에 현재 입력을 저장합니다. 다른 팀원의 변경 내용을 덮어쓸 수 있으며, 파일을 선택했다면 최신 원본도 교체됩니다. 저장할까요?",
        label: "내 입력으로 저장",
      }))
    )
      return;
    const input = { title: form.title.trim(), category: form.category };
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
  return (
    <Modal
      title={initial ? "산출물 수정" : "산출물 등록"}
      busy={busy || recovery.loading}
      onClose={onClose}
      wide
      editor={canEditContent}
      className={`deliverable-registration-modal${step === "choose" ? " deliverable-choice-modal" : ""}`}
      dirty={dirty}
    >
      <form
        ref={formElement}
        className="deliverable-editor-form"
        onSubmit={submit}
        noValidate
      >
        <div className="deliverable-editor-scroll">
          {step === "choose" ? (
            <fieldset
              disabled={busy || recovery.loading || blocked}
              className="form-fields deliverable-type-picker"
            >
              <div className="deliverable-type-options">
                {[
                  [
                    "TEXT",
                    "문서 작성",
                    "내용을 직접 작성하고 마크다운으로 정리해요.",
                    FileText,
                  ],
                  [
                    "FILE",
                    "파일 업로드",
                    "문서·발표 자료 등 준비한 파일을 올려요.",
                    Upload,
                  ],
                ].map(([type, label, description, TypeIcon]) => (
                  <button
                    key={type}
                    type="button"
                    className="deliverable-type-option"
                    aria-label={label}
                    data-deliverable-type={type}
                    onClick={() => {
                      update("type", type);
                      setFieldErrors({});
                      setStep("editor");
                    }}
                  >
                    <TypeIcon
                      className="deliverable-type-icon"
                      aria-hidden="true"
                    />
                    <strong>{label}</strong>
                    <span>{description}</span>
                    <ArrowRight
                      className="deliverable-type-arrow"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <fieldset
              disabled={busy || recovery.loading || blocked}
              className={`form-fields deliverable-form-layout${canEditContent ? "" : " deliverable-metadata-only"}`}
            >
              <section
                className="deliverable-form-section"
                aria-label="산출물 기본 정보 입력"
              >
                <h3 className="form-section-title">기본 정보</h3>
                <Field label="제목" error={fieldErrors.title}>
                  <input
                    name="title"
                    required
                    maxLength={100}
                    value={form.title}
                    onChange={(event) => update("title", event.target.value)}
                  />
                </Field>
                <Field label="분류">
                  <select
                    value={form.category}
                    onChange={(event) => update("category", event.target.value)}
                  >
                    {Object.entries(categoryLabels).map(([category, label]) => (
                      <option key={category} value={category}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                {canEditContent && (
                  <Field
                    label="설명"
                    help="선택 사항입니다. 자료의 목적이나 확인할 내용을 적어주세요."
                  >
                    <textarea
                      maxLength={2000}
                      value={form.description}
                      onChange={(event) =>
                        update("description", event.target.value)
                      }
                    />
                  </Field>
                )}
                {!initial && (
                  <>
                    {taskId == null && (
                      <Field label="작업 연결">
                        <select
                          value={form.taskId}
                          onChange={(event) =>
                            update("taskId", event.target.value)
                          }
                        >
                          <option value="">팀 공용 산출물</option>
                          {tasks.map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.title}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                  </>
                )}
                {(initial || taskId != null) && (
                  <dl className="deliverable-edit-context">
                    {initial && (
                      <div>
                        <dt>자료 유형</dt>
                        <dd>{form.type === "FILE" ? "파일" : "문서"}</dd>
                      </div>
                    )}
                    <div>
                      <dt>연결 작업</dt>
                      <dd>{linkedTaskName}</dd>
                    </div>
                  </dl>
                )}
                {initial && (
                  <p className="field-help">
                    등록 후 자료 유형과 작업 연결은 변경하지 않습니다.
                  </p>
                )}
                {initial && !permissions.content && (
                  <p className="notice">
                    팀 공용 자료의 제목과 분류만 정리할 수 있습니다.
                  </p>
                )}
              </section>
              {canEditContent && (
                <section
                  className="deliverable-form-section deliverable-content-section"
                  aria-label="산출물 내용 입력"
                >
                  <h3 className="form-section-title">
                    {form.type === "FILE" ? "파일 업로드" : "문서 작성"}
                  </h3>
                  {initial?.type === "FILE" && (
                    <div
                      className="deliverable-current-file"
                      role="group"
                      aria-label="현재 원본 파일"
                    >
                      <span className="eyebrow">현재 원본</span>
                      <strong>{initial.file.originalFilename}</strong>
                      <span className="field-help">
                        {(initial.file.sizeBytes / 1024).toFixed(1)}KiB
                      </span>
                      <p className="field-help">
                        교체할 파일을 선택하지 않으면 현재 원본을 유지합니다.
                        파일을 교체하면 이전 원본은 삭제됩니다.
                      </p>
                    </div>
                  )}
                  {form.type === "FILE" ? (
                    <Field
                      label={initial ? "교체할 파일 (선택)" : "파일"}
                      error={fieldErrors.file}
                      help={`${fileHelp} / 파일당 10MiB / 팀 전체 파일 1GiB`}
                    >
                      <input
                        ref={fileInput}
                        name="file"
                        type="file"
                        className="deliverable-file-input"
                        required={!initial && !file}
                        accept=".txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                        onChange={(event) => {
                          setFile(event.target.files[0] || null);
                          setFieldErrors((current) => ({
                            ...current,
                            file: undefined,
                          }));
                        }}
                      />
                    </Field>
                  ) : (
                    <Field
                      label="본문"
                      error={fieldErrors.text}
                      help="작업 결과와 확인할 내용을 기록하세요. 제목·목록·표 등의 마크다운 서식을 사용할 수 있습니다."
                    >
                      <MarkdownEditor
                        name="text"
                        required
                        maxLength={20000}
                        rows={14}
                        value={form.text}
                        onChange={(event) => update("text", event.target.value)}
                        onValueChange={(value) => update("text", value)}
                      />
                    </Field>
                  )}
                  {form.type === "TEXT" && (
                    <p className="character-count">
                      {form.text.length.toLocaleString()} / 20,000자
                    </p>
                  )}
                  {form.type === "FILE" && file && (
                    <div className="file-selection" role="status">
                      <span className="eyebrow">
                        {initial ? "교체할 파일" : "선택한 파일"}
                      </span>
                      <strong>{file.name}</strong>
                      <p>
                        {(file.size / 1024).toFixed(1)}KiB ·{" "}
                        {initial
                          ? "저장하면 기존 파일이 삭제되고 이 파일로 교체됩니다."
                          : "저장하면 업로드됩니다."}
                      </p>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={clearSelectedFile}
                      >
                        파일 선택 해제
                      </button>
                    </div>
                  )}
                </section>
              )}
            </fieldset>
          )}
          {blocked && (
            <p className="notice">
              현재 팀 상태로는 산출물을 저장할 수 없습니다. 창을 닫고 팀 상태를
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
                    {
                      label: "분류",
                      latest:
                        categoryLabels[recovery.latest.deliverable.category],
                      input: categoryLabels[form.category],
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
        {step === "editor" && (
          <FormActions
            busy={busy || recovery.loading}
            disabled={blocked || (conflict && !recovery.latest) || !canReapply}
            onCancel={onClose}
            onBack={
              !initial
                ? () => {
                    setFieldErrors({});
                    setStep("choose");
                  }
                : undefined
            }
            label={
              recovery.latest
                ? "내 입력으로 다시 저장"
                : error
                  ? "다시 저장"
                  : "저장"
            }
          />
        )}
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
  useEffect(() => setQueryInput(query), [query]);
  const type =
    isCollection && ["TEXT", "FILE"].includes(searchParams.get("type"))
      ? searchParams.get("type")
      : "";
  const category =
    isCollection && Object.hasOwn(categoryLabels, searchParams.get("category"))
      ? searchParams.get("category")
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
        "category",
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
    Boolean(query || type || category || authorId || sort || scope !== "ALL");
  const hasResultFilters = Boolean(
    query || type || category || authorId || unlinkedOnly,
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
            `작업 #${scope}`,
    },
    type && {
      key: "type",
      label: "유형",
      value: type === "FILE" ? "파일" : "문서",
    },
    category && {
      key: "category",
      label: "분류",
      value: categoryLabels[category],
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
    category,
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
      category,
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
  const canCreate =
    taskOptionsReady &&
    isApprovedMember(team) &&
    !teamWorkBlocked(team) &&
    (taskId == null || eligibleTasks.some((task) => task.id === taskId));
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
      notify(editing ? "산출물을 수정했습니다." : "산출물을 등록했습니다.");
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
        title: "산출물 삭제",
        message: `“${deliverable.title}”을 완전히 삭제합니다. 파일도 함께 삭제되며 복구할 수 없습니다.`,
        label: "산출물 삭제",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await deleteDeliverable(deliverable.id, deliverable.version);
      notify("산출물을 삭제했습니다.");
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
            : "section-heading"
        }
      >
        {taskId == null ? (
          <div>
            <h1>산출물 관리</h1>
          </div>
        ) : (
          <h2>연결 산출물</h2>
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
          {isCollection && (
            <RefreshButton
              disabled={resource.loading}
              onClick={resource.reload}
            />
          )}
          {canCreate && (
            <button
              className="primary-button"
              onClick={() => {
                setError(null);
                setEditing(null);
              }}
            >
              <Icon name="plus" />
              산출물 등록
            </button>
          )}
        </div>
      </div>
      {isCollection ? (
        <div
          className="deliverable-search-toolbar collection-controls"
          ref={searchToolbar}
        >
          <div className="deliverable-search-primary">
            <form
              role="search"
              className="deliverable-query-form"
              onSubmit={(event) => {
                event.preventDefault();
                setSearchOption("q", queryInput.trim());
              }}
            >
              <label className="sr-only" htmlFor="deliverable-search">
                산출물 검색
              </label>
              <div className="deliverable-query-input">
                <Icon name="search" />
                <input
                  id="deliverable-search"
                  type="search"
                  placeholder="제목 또는 원본 파일명으로 검색"
                  maxLength={100}
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                />
                <button className="secondary-button" type="submit">
                  검색
                </button>
              </div>
            </form>
            <label className="deliverable-sort-field">
              <span>정렬</span>
              <select
                aria-label="산출물 정렬"
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
          </div>
          <div className="deliverable-filter-row">
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
                <option value="ALL">전체 산출물</option>
                <option value="COMMON">팀 공용 산출물</option>
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
                aria-label="산출물 유형"
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
              data-active={Boolean(category)}
            >
              <span>분류</span>
              <select
                aria-label="산출물 분류"
                value={category}
                onChange={(event) =>
                  setSearchOption("category", event.target.value)
                }
              >
                <option value="">전체 분류</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="deliverable-filter-field"
              data-active={Boolean(authorId)}
            >
              <span>등록자</span>
              <select
                aria-label="산출물 등록자"
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
                      q: "산출물 검색",
                      sort: "산출물 정렬",
                      scope: "작업별 조회",
                      type: "산출물 유형",
                      category: "산출물 분류",
                      authorId: "산출물 등록자",
                    };
                    const selector =
                      filter.key === "q"
                        ? "input"
                        : `select[aria-label="${controlLabels[filter.key]}"]`;
                    searchToolbar.current?.querySelector(selector)?.focus();
                    if (filter.key === "scope") setScope("ALL");
                    else setSearchOption(filter.key, "");
                  }}
                >
                  <span className="deliverable-chip-label">{filter.label}</span>
                  <span className="deliverable-chip-value">{filter.value}</span>
                  <Icon name="close" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="collection-toolbar">
          <span className="collection-count" role="status">
            {!resource.loading &&
              !resource.error &&
              `현재 페이지 ${resource.data?.length || 0}건`}
          </span>
          <RefreshButton
            disabled={resource.loading}
            onClick={resource.reload}
          />
        </div>
      )}
      {isCollection && (
        <div className="deliverable-search-scope">
          <div>
            <h2>자료 목록</h2>
            {!resource.loading && !resource.error && (
              <span role="status">
                현재 페이지 {resource.data?.length || 0}건
              </span>
            )}
          </div>
          {hasSearch ? (
            <button
              className="text-button collection-reset-button"
              title="검색·유형·분류·등록자·작업 범위·정렬을 초기화하고 첫 페이지로 이동합니다."
              onClick={clearSearch}
            >
              조회 조건 초기화
            </button>
          ) : (
            <p className="field-help">팀 전체 산출물에서 조회합니다.</p>
          )}
        </div>
      )}
      <ErrorNotice error={error} onRetry={resource.reload} />
      {tasksResource && (
        <ResourceState resource={tasksResource} label="작업 필터 정보" />
      )}
      <ResourceState resource={resource} label="산출물 목록">
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
                      onDownload={download}
                    />
                    {(permissions.metadata || permissions.remove) && (
                      <div className="heading-actions">
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
                ? "이 페이지에 산출물이 없습니다."
                : hasResultFilters
                  ? "조건에 맞는 산출물이 없습니다."
                  : selectedTaskId != null
                    ? "이 작업에 연결된 산출물이 없습니다."
                    : "아직 등록된 산출물이 없습니다."}
            </p>
            <span>
              {page > 0
                ? "이전 페이지로 돌아가 등록된 자료를 확인하세요."
                : hasResultFilters
                  ? "검색어·유형·분류·등록자·작업 범위를 변경하거나 조회 조건을 초기화하세요."
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
                전체 산출물 보기
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
                  첫 산출물 등록
                </button>
              )
            )}
          </EmptyState>
        )}
      </ResourceState>
      <div className="pagination">
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
          title="산출물 상세"
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
                className="secondary-button"
                onClick={() => setSelectedDeliverableId(null)}
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
                      "현재 페이지에서 산출물을 찾지 못했습니다. 입력은 유지됩니다. 창을 닫고 목록에서 위치를 다시 확인해 주세요.",
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
