import Icon from './Icon.jsx';
import DateTimeInput from './DateTimeInput.jsx';
import { currentDateTime } from '../lib/dateTime.js';
import { useState } from 'react';
import { createSpace, joinSpace, listSpaces } from '../api/spaces.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { buildingLabels, formatDate, fromDateInput } from '../lib/domain.js';
import {
  collectFieldErrors,
  focusFirstFieldError,
} from '../lib/formValidation.js';
import {
  EmptyState,
  ErrorNotice,
  Field,
  FormActions,
  Modal,
  ResourceState,
} from './ui.jsx';

export default function Spaces({ onSelect }) {
  const { notify, clearChanges } = useInteractions();
  const resource = useResource(listSpaces, []);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const visibleSpaces = (resource.data || []).filter(
    (space) =>
      space.name
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()) &&
      (role === 'ALL' || space.myRole === role),
  );
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [initialForm, setInitialForm] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    startAt: '',
    endAt: '',
    code: '',
  });
  const update = (key, value) => {
    setFieldErrors((current) => ({
      ...current,
      [key]: undefined,
      ...(key === 'startAt' ? { endAt: undefined } : {}),
    }));
    setForm((current) => ({ ...current, [key]: value }));
  };
  const open = (type) => {
    setError(null);
    setFieldErrors({});
    setModal(type);
    const current = currentDateTime();
    const next = {
      name: '',
      description: '',
      startAt: type === 'create' ? current : '',
      endAt: type === 'create' ? current : '',
      code: '',
    };
    setForm(next);
    setInitialForm(next);
  };
  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    const errors = collectFieldErrors(event.currentTarget, {
      ...(modal === 'create' &&
      form.startAt &&
      form.endAt &&
      form.startAt >= form.endAt
        ? { endAt: '프로젝트 종료 시각을 시작 시각보다 늦게 지정해 주세요.' }
        : {}),
      ...(modal === 'join' && !/^[0-9A-F]{8}$/.test(form.code)
        ? { code: '숫자 0–9와 영문 A–F로 된 8자리 참여 코드를 입력해 주세요.' }
        : {}),
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      focusFirstFieldError(event.currentTarget, errors);
      return;
    }
    setBusy(true);
    try {
      const result =
        modal === 'create'
          ? await createSpace({
              name: form.name.trim(),
              description: form.description.trim() || null,
              startAt: fromDateInput(form.startAt),
              endAt: fromDateInput(form.endAt),
            })
          : await joinSpace(form.code.trim().toUpperCase());
      setModal(null);
      clearChanges();
      notify(
        modal === 'create'
          ? '스페이스를 생성했습니다.'
          : '스페이스에 참여했습니다.',
      );
      resource.reload();
      onSelect(result.id);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-directory stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">함께 만드는 프로젝트</span>
          <h1>내 스페이스</h1>
          <p>프로젝트 공간을 만들거나 참여 코드로 함께 시작하세요.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={() => open('join')}>
            코드로 참여
          </button>
          <button className="primary-button" onClick={() => open('create')}>
            <Icon name="plus" />
            스페이스 만들기
          </button>
        </div>
      </div>
      <ResourceState resource={resource}>
        {resource.data?.length ? (
          <section className="directory-section" aria-label="스페이스 목록">
            <div className="directory-toolbar">
              <label className="directory-search">
                <span className="sr-only">스페이스 이름 검색</span>
                <input
                  type="search"
                  placeholder="스페이스 이름 검색"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label>
                <span className="sr-only">내 역할 필터</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                >
                  <option value="ALL">모든 역할</option>
                  <option value="MANAGER">관리자</option>
                  <option value="USER">참여자</option>
                </select>
              </label>
              <span className="directory-count" role="status">
                {visibleSpaces.length} / {resource.data.length}개
              </span>
              <button
                className="secondary-button directory-refresh"
                onClick={resource.reload}
                disabled={resource.loading}
              >
                <Icon name="refresh" />
                새로고침
              </button>
            </div>
            <div className="space-directory-columns" aria-hidden="true">
              <span>스페이스</span>
              <span>내 역할</span>
              <span>팀 빌딩</span>
              <span />
            </div>
            {visibleSpaces.length ? (
              <ul className="space-list">
                {visibleSpaces.map((space) => (
                  <li key={space.id}>
                    <button onClick={() => onSelect(space.id)}>
                      <span className="directory-space-name">
                        <strong>{space.name}</strong>
                        <small>
                          프로젝트 · {formatDate(space.startAt)} ~{' '}
                          {formatDate(space.endAt)}
                        </small>
                      </span>
                      <span
                        className={`role-badge ${space.myRole === 'MANAGER' ? 'role-manager' : ''}`}
                      >
                        {space.myRole === 'MANAGER' ? '관리자' : '참여자'}
                      </span>
                      <span className="building-status">
                        <span
                          className={`status-dot building-${space.teamBuildingStatus.toLowerCase()}`}
                        />
                        {buildingLabels[space.teamBuildingStatus]}
                      </span>
                      <Icon name="arrow" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>
                <p>조건에 맞는 스페이스가 없습니다.</p>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setSearch('');
                    setRole('ALL');
                  }}
                >
                  검색·필터 초기화
                </button>
              </EmptyState>
            )}
          </section>
        ) : (
          <EmptyState>
            <p>아직 참여한 스페이스가 없습니다.</p>
            <span>새 스페이스를 만들거나 관리자의 참여 코드를 입력하세요.</span>
            <div className="empty-actions">
              <button className="primary-button" onClick={() => open('join')}>
                참여 코드 입력
              </button>
              <button
                className="secondary-button"
                onClick={() => open('create')}
              >
                첫 스페이스 만들기
              </button>
            </div>
          </EmptyState>
        )}
      </ResourceState>
      {modal && (
        <Modal
          title={modal === 'create' ? '스페이스 만들기' : '코드로 참여'}
          busy={busy}
          onClose={() => setModal(null)}
          dirty={JSON.stringify(form) !== JSON.stringify(initialForm)}
        >
          <form onSubmit={submit} noValidate>
            <fieldset disabled={busy} className="form-fields">
              {modal === 'create' ? (
                <>
                  <Field label="스페이스 이름" error={fieldErrors.name}>
                    <input
                      name="name"
                      required
                      maxLength={100}
                      value={form.name}
                      onChange={(event) => update('name', event.target.value)}
                    />
                  </Field>
                  <Field
                    label="소개"
                    help="선택 사항입니다. 프로젝트의 목적을 간단히 적어주세요."
                  >
                    <textarea
                      maxLength={500}
                      value={form.description}
                      onChange={(event) =>
                        update('description', event.target.value)
                      }
                    />
                  </Field>
                  <Field label="프로젝트 시작" error={fieldErrors.startAt}>
                    <DateTimeInput
                      name="startAt"
                      required
                      value={form.startAt}
                      onChange={(event) =>
                        update('startAt', event.target.value)
                      }
                    />
                  </Field>
                  <Field label="프로젝트 종료" error={fieldErrors.endAt}>
                    <DateTimeInput
                      name="endAt"
                      required
                      value={form.endAt}
                      onChange={(event) => update('endAt', event.target.value)}
                    />
                  </Field>
                  <p className="field-help">
                    생성자는 관리자가 됩니다. 팀 빌딩 기간은 생성 후 스페이스
                    관리에서 지정합니다.
                  </p>
                </>
              ) : (
                <Field
                  label="참여 코드"
                  error={fieldErrors.code}
                  help="관리자가 공유한 8자리 코드를 붙여넣으세요."
                >
                  <input
                    name="code"
                    required
                    pattern="[0-9A-Fa-f]{8}"
                    maxLength={8}
                    value={form.code}
                    onChange={(event) =>
                      update(
                        'code',
                        event.target.value.replace(/\s/g, '').toUpperCase(),
                      )
                    }
                    placeholder="8자리 참여 코드"
                  />
                </Field>
              )}
            </fieldset>
            <ErrorNotice error={error} />
            <FormActions
              busy={busy}
              onCancel={() => setModal(null)}
              label={modal === 'create' ? '만들기' : '참여'}
            />
          </form>
        </Modal>
      )}
    </section>
  );
}
