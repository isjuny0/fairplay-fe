import { isPreviewPath } from '../mock/preview.js';
import Icon from './Icon.jsx';
import DeliverableTable from './DeliverableTable.jsx';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { parseRouteId } from '../lib/routes.js';
import {
  createDeliverable,
  deleteDeliverable,
  downloadDeliverable,
  listDeliverables,
  updateDeliverable,
  uploadDeliverable,
} from '../api/deliverables.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import useSaveRecovery from '../hooks/useSaveRecovery.js';
import SaveRecovery from './SaveRecovery.jsx';
import { getTask } from '../api/tasks.js';
import { getTeamWorkContext } from '../api/teams.js';
import {
  collectFieldErrors,
  focusFirstFieldError,
} from '../lib/formValidation.js';
import {
  categoryLabels,
  canModifyTeamWork,
  deliverablePermissions,
  formatDate,
  isApprovedMember,
  isAssignee,
  isMutable,
  memberName,
  teamWorkBlocked,
} from '../lib/domain.js';
import {
  EmptyState,
  ErrorNotice,
  Field,
  FormActions,
  Modal,
  ResourceState,
} from './ui.jsx';

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
  const conflict = error?.code === 'VERSION_CONFLICT';
  const canReapply =
    !recovery.latest ||
    (recovery.latest.permissions.metadata &&
      (!permissions.content || recovery.latest.permissions.content));
  const [initialForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    category: initial?.category || 'OTHER',
    type: initial?.type || 'TEXT',
    text: initial?.text || '',
    taskId: taskId ?? '',
  });
  const [form, setForm] = useState(initialForm);
  const targetContract = isPreviewPath(window.location.pathname);
  const categories = targetContract
    ? {
        ...categoryLabels,
        RESEARCH: '조사·분석',
        PRESENTATION: '발표',
        OPERATION: '행사·운영',
      }
    : categoryLabels;
  const fileExtensions = /\.(txt|md|pdf|doc|docx|ppt|pptx|xls|xlsx)$/i;
  const fileHelp = 'TXT, MD, PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX';
  const [file, setFile] = useState(null);
  const fileInput = useRef(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const canEditContent = !initial || permissions.content;
  const linkedTaskId = initial ? initial.taskId : taskId;
  const linkedTaskName =
    linkedTaskId == null
      ? '팀 공용 산출물'
      : tasks.find((task) => task.id === linkedTaskId)?.title ||
        `작업 #${linkedTaskId}`;
  const clearSelectedFile = () => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
    setFieldErrors((current) => ({ ...current, file: undefined }));
  };
  const update = (name, value) => {
    setFieldErrors((current) => ({
      ...current,
      [name]: undefined,
      ...(name === 'type' ? { file: undefined, text: undefined } : {}),
    }));
    setForm((current) => ({ ...current, [name]: value }));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy || recovery.loading || blocked) return;
    const errors = collectFieldErrors(event.currentTarget, {
      ...(file &&
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
        title: '최신 산출물에 내 입력 반영',
        message:
          '비교한 최신 산출물에 현재 입력을 저장합니다. 다른 팀원의 변경 내용을 덮어쓸 수 있으며, 파일을 선택했다면 최신 원본도 교체됩니다. 저장할까요?',
        label: '내 입력으로 저장',
      }))
    )
      return;
    const input = { title: form.title.trim(), category: form.category };
    if (!initial || permissions.content)
      input.description = form.description.trim() || null;
    if (initial) {
      input.expectedVersion =
        recovery.latest?.deliverable.version ?? initial.version;
      if (permissions.content && initial.type !== 'FILE')
        input.text = form.text.trim();
    } else {
      input.taskId = form.taskId === '' ? null : Number(form.taskId);
      if (form.type !== 'FILE') {
        input.text = form.text.trim();
      }
    }
    onSave(input, file, form.type);
  };
  return (
    <Modal
      title={initial ? '산출물 수정' : '산출물 등록'}
      busy={busy || recovery.loading}
      onClose={onClose}
      wide
      editor={canEditContent}
      dirty={
        Boolean(file) || JSON.stringify(form) !== JSON.stringify(initialForm)
      }
    >
      <form className="deliverable-editor-form" onSubmit={submit} noValidate>
        {targetContract && (
          <p className="mock-notice">
            최신 명세의 자료 유형·분류를 미리보기로 제공합니다. 실제 서버
            업로드는 현재 구현된 형식을 따릅니다.
          </p>
        )}
        <fieldset
          disabled={busy || recovery.loading || blocked}
          className={`form-fields deliverable-form-layout${canEditContent ? '' : ' deliverable-metadata-only'}`}
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
                onChange={(event) => update('title', event.target.value)}
              />
            </Field>
            <Field label="분류">
              <select
                value={form.category}
                onChange={(event) => update('category', event.target.value)}
              >
                {Object.entries(categories).map(([category, label]) => (
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
                    update('description', event.target.value)
                  }
                />
              </Field>
            )}
            {!initial && (
              <>
                <Field label="자료 유형">
                  <select
                    value={form.type}
                    onChange={(event) => {
                      update('type', event.target.value);
                      clearSelectedFile();
                    }}
                  >
                    {['TEXT', 'FILE'].map((type) => (
                      <option key={type} value={type}>
                        {
                          {
                            TEXT: '문서 작성',
                            FILE: '파일 업로드',
                          }[type]
                        }
                      </option>
                    ))}
                  </select>
                </Field>
                {taskId == null && (
                  <Field label="작업 연결">
                    <select
                      value={form.taskId}
                      onChange={(event) => update('taskId', event.target.value)}
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
                    <dd>{form.type === 'FILE' ? '파일' : '문서'}</dd>
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
                {form.type === 'FILE' ? '파일' : '문서 본문'}
              </h3>
              {initial?.type === 'FILE' && (
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
                    교체할 파일을 선택하지 않으면 현재 원본을 유지합니다. 파일을
                    교체하면 이전 원본은 삭제됩니다.
                  </p>
                </div>
              )}
              {form.type === 'FILE' ? (
                <Field
                  label={initial ? '교체할 파일 (선택)' : '파일'}
                  error={fieldErrors.file}
                  help={`${fileHelp} / 파일당 10MiB / 팀 전체 파일 1GiB`}
                >
                  <input
                    ref={fileInput}
                    name="file"
                    type="file"
                    required={!initial}
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
                  help="작업 결과와 확인할 내용을 기록하세요. 파일이 없는 활동도 문서로 남길 수 있습니다."
                >
                  <textarea
                    name="text"
                    required
                    maxLength={20000}
                    rows={14}
                    value={form.text}
                    onChange={(event) => update('text', event.target.value)}
                  />
                </Field>
              )}
              {form.type === 'TEXT' && (
                <p className="character-count">
                  {form.text.length.toLocaleString()} / 20,000자
                </p>
              )}
              {file && (
                <div className="file-selection" role="status">
                  <span className="eyebrow">
                    {initial ? '교체할 파일' : '선택한 파일'}
                  </span>
                  <strong>{file.name}</strong>
                  <p>
                    {(file.size / 1024).toFixed(1)}KiB ·{' '}
                    {initial
                      ? '저장하면 기존 파일이 삭제되고 이 파일로 교체됩니다.'
                      : '저장하면 업로드됩니다.'}
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
                    label: '제목',
                    latest: recovery.latest.deliverable.title,
                    input: form.title.trim(),
                  },
                  {
                    label: '분류',
                    latest: categories[recovery.latest.deliverable.category],
                    input: categories[form.category],
                  },
                  ...(!permissions.content
                    ? []
                    : [
                        {
                          label: '설명',
                          latest: recovery.latest.deliverable.description || '',
                          input: form.description.trim(),
                        },
                        form.type === 'FILE'
                          ? {
                              label: '원본 파일',
                              latest:
                                recovery.latest.deliverable.file
                                  ?.originalFilename,
                              input:
                                file?.name ||
                                '선택한 새 파일 없음 · 최신 원본 유지',
                            }
                          : {
                              label: '본문',
                              latest: recovery.latest.deliverable.text,
                              input: form.text.trim(),
                            },
                      ]),
                ]
              : []
          }
        />
        <FormActions
          busy={busy || recovery.loading}
          disabled={blocked || (conflict && !recovery.latest) || !canReapply}
          onCancel={onClose}
          label={
            recovery.latest
              ? '내 입력으로 다시 저장'
              : error
                ? '다시 저장'
                : '저장'
          }
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
  taskId,
  onChanged = () => {},
}) {
  const { confirm, notify } = useInteractions();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPage = Number(searchParams.get('page') || 0);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage >= 0
      ? requestedPage
      : 0;
  const scopeId = parseRouteId(searchParams.get('taskId'));
  const scope = scopeId == null ? 'ALL' : String(scopeId);
  const setPage = (value) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === 0) next.delete('page');
      else next.set('page', String(value));
      return next;
    });
  const setScope = (value) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('page');
      if (value === 'ALL') next.delete('taskId');
      else next.set('taskId', value);
      return next;
    });
  const selectedTaskId =
    taskId ?? (scope === 'ALL' ? undefined : Number(scope));
  const resource = useResource(
    () => listDeliverables(team.id, { taskId: selectedTaskId, page, size: 20 }),
    [team.id, selectedTaskId, page],
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
    isApprovedMember(team) &&
    !teamWorkBlocked(team) &&
    (taskId == null || eligibleTasks.some((task) => task.id === taskId));
  const save = async (input, file, type) => {
    if (teamWorkBlocked(team) || (taskId != null && !canModifyTeamWork(team)))
      return;
    setBusy(true);
    setError(null);
    try {
      if (editing) await updateDeliverable(editing.id, input, file);
      else if (type === 'FILE') await uploadDeliverable(team.id, input, file);
      else await createDeliverable(team.id, input);
      setEditing(undefined);
      notify(editing ? '산출물을 수정했습니다.' : '산출물을 등록했습니다.');
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
        title: '산출물 삭제',
        message: `“${deliverable.title}”을 완전히 삭제합니다. 파일도 함께 삭제되며 복구할 수 없습니다.`,
        label: '산출물 삭제',
        danger: true,
      }))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await deleteDeliverable(deliverable.id, deliverable.version);
      notify('산출물을 삭제했습니다.');
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
      const link = document.createElement('a');
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
      <div className={taskId == null ? 'page-heading' : 'section-heading'}>
        {taskId == null ? (
          <div>
            <h1>산출물 관리</h1>
            <p>팀 공용 자료와 작업에 연결된 최신 산출물을 확인하세요.</p>
          </div>
        ) : (
          <h2>연결 산출물</h2>
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
      <div className="collection-toolbar">
        {taskId == null && tasks.length > 0 && (
          <Field label="작업별 조회">
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              <option value="ALL">전체 산출물</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <span className="collection-count" role="status">
          {!resource.loading &&
            !resource.error &&
            `현재 페이지 ${resource.data?.length || 0}건`}
        </span>
        <button
          className="secondary-button"
          disabled={resource.loading}
          onClick={resource.reload}
        >
          <Icon name="refresh" />
          새로고침
        </button>
      </div>
      <ErrorNotice error={error} onRetry={resource.reload} />
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
                    <div className="section-heading">
                      <div className="deliverable-title">
                        <span className="file-symbol">
                          <Icon name="file" />
                        </span>
                        <h3>{deliverable.title}</h3>
                      </div>
                      <span className="role-badge">
                        {{ TEXT: '문서', FILE: '파일' }[deliverable.type]} ·{' '}
                        {categoryLabels[deliverable.category] ||
                          {
                            RESEARCH: '조사·분석',
                            PRESENTATION: '발표',
                            OPERATION: '행사·운영',
                          }[deliverable.category] ||
                          deliverable.category}
                      </span>
                    </div>
                    <p className="field-help">
                      {deliverable.taskId == null
                        ? '팀 공용'
                        : `작업 연결${taskMap.get(deliverable.taskId) ? ` · ${taskMap.get(deliverable.taskId).title}` : ''}`}{' '}
                    </p>
                    <details className="deliverable-record">
                      <summary>등록·수정 정보</summary>
                      <p className="field-help">
                        등록 {memberName(members, deliverable.authorId)} · 수정{' '}
                        {formatDate(deliverable.updatedAt)}
                      </p>
                    </details>
                    {deliverable.description && (
                      <p className="preserve-lines">
                        {deliverable.description}
                      </p>
                    )}
                    {deliverable.type === 'TEXT' && (
                      <details>
                        <summary>본문 보기</summary>
                        <p className="preserve-lines deliverable-body">
                          {deliverable.text}
                        </p>
                      </details>
                    )}
                    {deliverable.type === 'FILE' && (
                      <p>
                        {deliverable.file.originalFilename} ·{' '}
                        {(deliverable.file.sizeBytes / 1024).toFixed(1)}KiB
                      </p>
                    )}
                    <div className="heading-actions">
                      {deliverable.type === 'FILE' && (
                        <button
                          className="secondary-button"
                          onClick={() => download(deliverable)}
                        >
                          파일 다운로드
                        </button>
                      )}
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
                  </article>
                );
              })}
            </div>
          )
        ) : (
          <EmptyState>
            <p>
              {page > 0
                ? '이 페이지에 산출물이 없습니다.'
                : selectedTaskId != null
                  ? '이 작업에 연결된 산출물이 없습니다.'
                  : '아직 등록된 산출물이 없습니다.'}
            </p>
            <span>
              {page > 0
                ? '이전 페이지로 돌아가 등록된 자료를 확인하세요.'
                : canCreate
                  ? '팀 공용 자료나 담당 작업의 결과를 문서·파일로 남겨주세요.'
                  : '팀원이 등록한 최신 자료가 이곳에 표시됩니다.'}
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
                onClick={() => setScope('ALL')}
              >
                전체 산출물 보기
              </button>
            ) : (
              canCreate && (
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
            <div>
              <span className="eyebrow">
                {selectedDeliverable.type === 'FILE' ? '파일' : '문서'} ·{' '}
                {categoryLabels[selectedDeliverable.category] ||
                  selectedDeliverable.category}
              </span>
              <h3>{selectedDeliverable.title}</h3>
            </div>
            <dl className="deliverable-facts">
              <div>
                <dt>연결 작업</dt>
                <dd>
                  {selectedDeliverable.taskId == null
                    ? '팀 공용'
                    : taskMap.get(selectedDeliverable.taskId)?.title ||
                      `작업 #${selectedDeliverable.taskId}`}
                </dd>
              </div>
              <div>
                <dt>등록자</dt>
                <dd>{memberName(members, selectedDeliverable.authorId)}</dd>
              </div>
              <div>
                <dt>최종 수정일</dt>
                <dd>{formatDate(selectedDeliverable.updatedAt)}</dd>
              </div>
            </dl>
            {selectedDeliverable.description && (
              <section>
                <h4>설명</h4>
                <p className="preserve-lines">
                  {selectedDeliverable.description}
                </p>
              </section>
            )}
            {selectedDeliverable.type === 'TEXT' ? (
              <section>
                <h4>본문</h4>
                <p className="preserve-lines">{selectedDeliverable.text}</p>
              </section>
            ) : (
              <section>
                <h4>현재 파일</h4>
                <p className="preserve-lines">
                  {selectedDeliverable.file.originalFilename} ·{' '}
                  {(selectedDeliverable.file.sizeBytes / 1024).toFixed(1)}KiB
                </p>
                <p className="field-help">
                  최신 파일만 보관합니다. 파일을 교체하면 이전 원본은
                  삭제됩니다.
                </p>
              </section>
            )}
            <ErrorNotice error={error} />
            <div className="modal-actions">
              {selectedDeliverable.type === 'FILE' && (
                <button
                  className="primary-button"
                  onClick={() => download(selectedDeliverable)}
                >
                  파일 다운로드
                </button>
              )}
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
          key={editing?.id || 'new'}
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
            teamWorkBlocked(team) ||
            ((editing?.taskId ?? taskId) != null && !canModifyTeamWork(team))
          }
          error={error}
          onLoadLatest={
            editing
              ? async () => {
                  const [latestPage, context] = await Promise.all([
                    listDeliverables(team.id, {
                      taskId: selectedTaskId,
                      page,
                      size: 20,
                    }),
                    getTeamWorkContext(team.id),
                  ]);
                  const deliverable = latestPage.find(
                    (item) => item.id === editing.id,
                  );
                  if (!deliverable)
                    throw new Error(
                      '현재 페이지에서 산출물을 찾지 못했습니다. 입력은 유지됩니다. 창을 닫고 목록에서 위치를 다시 확인해 주세요.',
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
