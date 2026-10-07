import { isPreviewPath } from '../mock/preview.js';
import Icon from './Icon.jsx';
import { useState } from 'react';
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
}) {
  const [initialForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    category: initial?.category || 'OTHER',
    type: initial?.type || 'TEXT',
    textOrUrl: initial?.textOrUrl || '',
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
  const fileExtensions = targetContract
    ? /\.(pdf|txt|md|hwp|hwpx|ppt|pptx|xls|xlsx)$/i
    : /\.(pdf|png|jpe?g|txt|md)$/i;
  const fileHelp = targetContract
    ? 'TXT·MD·PDF·HWP·HWPX·PPT·PPTX·XLS·XLSX'
    : 'PDF·PNG·JPEG·TXT·MD';
  const [file, setFile] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const update = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));
  const submit = (event) => {
    event.preventDefault();
    if (blocked) return;
    setValidationError(null);
    if (!form.title.trim()) {
      setValidationError(new Error('제목을 입력해 주세요.'));
      return;
    }
    if (
      file &&
      (file.size > 10 * 1024 * 1024 || !fileExtensions.test(file.name))
    ) {
      setValidationError(
        new Error(`${fileHelp} 파일을 10MiB 이하로 선택해 주세요.`),
      );
      return;
    }
    if (!initial && form.type === 'FILE' && !file) {
      setValidationError(new Error('파일을 선택해 주세요.'));
      return;
    }
    const input = { title: form.title.trim(), category: form.category };
    if (!initial || permissions.content)
      input.description = form.description.trim() || null;
    if (initial) {
      input.expectedVersion = initial.version;
      if (permissions.content && initial.type !== 'FILE')
        input.textOrUrl = form.textOrUrl.trim();
    } else {
      input.taskId = form.taskId === '' ? null : Number(form.taskId);
      if (form.type !== 'FILE') {
        input.type = form.type;
        input.textOrUrl = form.textOrUrl.trim();
      }
    }
    onSave(input, file, form.type);
  };
  return (
    <Modal
      title={initial ? '산출물 수정' : '산출물 등록'}
      busy={busy}
      onClose={onClose}
      wide
      dirty={
        Boolean(file) || JSON.stringify(form) !== JSON.stringify(initialForm)
      }
    >
      {targetContract && (
        <p className="mock-notice">
          최신 명세의 자료 유형·분류를 미리보기로 제공합니다. 실제 서버 업로드는
          현재 구현된 형식을 따릅니다.
        </p>
      )}
      <form onSubmit={submit}>
        <fieldset disabled={busy || blocked} className="form-fields">
          <Field label="제목">
            <input
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
          {(!initial || permissions.content) && (
            <Field
              label="설명"
              help="선택 사항입니다. 자료의 목적이나 확인할 내용을 적어주세요."
            >
              <textarea
                maxLength={2000}
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
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
                    setFile(null);
                  }}
                >
                  {(targetContract
                    ? ['TEXT', 'FILE']
                    : ['TEXT', 'URL', 'FILE']
                  ).map((type) => (
                    <option key={type} value={type}>
                      {
                        {
                          TEXT: '문서 작성',
                          FILE: '파일 업로드',
                          URL: '외부 링크',
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
          {(!initial || permissions.content) &&
            (form.type === 'FILE' ? (
              <Field
                label={initial ? '교체할 파일 (선택)' : '파일'}
                help={`${fileHelp} / 파일당 10MiB / 팀 전체 파일 1GiB`}
              >
                <input
                  type="file"
                  required={!initial}
                  accept={
                    targetContract
                      ? '.txt,.md,.pdf,.hwp,.hwpx,.ppt,.pptx,.xls,.xlsx'
                      : '.pdf,.png,.jpg,.jpeg,.txt,.md'
                  }
                  onChange={(event) => setFile(event.target.files[0] || null)}
                />
              </Field>
            ) : (
              <Field label={form.type === 'URL' ? 'URL' : '본문'}>
                {form.type === 'URL' ? (
                  <input
                    type="url"
                    required
                    maxLength={2000}
                    value={form.textOrUrl}
                    onChange={(event) =>
                      update('textOrUrl', event.target.value)
                    }
                  />
                ) : (
                  <textarea
                    required
                    maxLength={20000}
                    rows={6}
                    value={form.textOrUrl}
                    onChange={(event) =>
                      update('textOrUrl', event.target.value)
                    }
                  />
                )}
              </Field>
            ))}
          {initial && (
            <p className="field-help">
              유형과 작업 연결은 변경하지 않습니다. 파일 교체 시 이전 원본은
              삭제됩니다.
            </p>
          )}
          {file && (
            <div className="file-selection" role="status">
              <strong>{file.name}</strong>
              <p>
                {(file.size / 1024).toFixed(1)}KiB ·{' '}
                {initial
                  ? '저장하면 기존 파일이 삭제되고 이 파일로 교체됩니다.'
                  : '저장하면 업로드됩니다.'}
              </p>
            </div>
          )}
          {initial && !permissions.content && (
            <p className="notice">
              팀 공용 자료의 제목과 분류만 정리할 수 있습니다.
            </p>
          )}
        </fieldset>
        {blocked && (
          <p className="notice">
            현재 팀 상태로는 산출물을 저장할 수 없습니다. 창을 닫고 팀 상태를
            확인해 주세요.
          </p>
        )}
        <ErrorNotice error={validationError || error} />
        <FormActions busy={busy} disabled={blocked} onCancel={onClose} />
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
      <div className="section-heading">
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
      {taskId == null && tasks.length > 0 && (
        <Field label="작업별 조회">
          <select
            value={scope}
            onChange={(event) => {
              setScope(event.target.value);
            }}
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
      <ErrorNotice error={error} onRetry={resource.reload} />
      <ResourceState resource={resource}>
        {resource.data?.length ? (
          <div className="stack">
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
                      {
                        { TEXT: '문서', FILE: '파일', URL: '링크' }[
                          deliverable.type
                        ]
                      }{' '}
                      ·{' '}
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
                    · 등록 {memberName(members, deliverable.authorId)} · 수정{' '}
                    {formatDate(deliverable.updatedAt)}
                  </p>
                  {deliverable.description && (
                    <p className="preserve-lines">{deliverable.description}</p>
                  )}
                  {deliverable.type === 'TEXT' && (
                    <details>
                      <summary>본문 보기</summary>
                      <p className="preserve-lines deliverable-body">
                        {deliverable.textOrUrl}
                      </p>
                    </details>
                  )}
                  {deliverable.type === 'URL' && (
                    <a
                      href={deliverable.textOrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      링크 열기 ↗
                    </a>
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
        ) : (
          <EmptyState>등록된 산출물이 없습니다.</EmptyState>
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
          onClose={() => setEditing(undefined)}
          onSave={save}
        />
      )}
    </section>
  );
}
