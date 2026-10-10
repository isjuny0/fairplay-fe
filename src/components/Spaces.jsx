import Icon from './Icon.jsx';
import { useState } from 'react';
import { createSpace, joinSpace, listSpaces } from '../api/spaces.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { buildingLabels, fromDateInput } from '../lib/domain.js';
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
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
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
    setForm({ name: '', description: '', startAt: '', endAt: '', code: '' });
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
      onSelect(result.id ?? result.spaceId);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
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
          <ul className="space-list">
            {resource.data.map((space) => (
              <li key={space.id}>
                <button onClick={() => onSelect(space.id)}>
                  <span className="space-card-top">
                    <span className="space-symbol">
                      <Icon name="grid" />
                    </span>
                    <span
                      className={`role-badge ${space.myRole === 'MANAGER' ? 'role-manager' : ''}`}
                    >
                      {space.myRole === 'MANAGER' ? '관리자' : '참여자'}
                    </span>
                  </span>
                  <strong>{space.name}</strong>
                  <span className="space-card-footer">
                    <span className="building-status">
                      <span
                        className={`status-dot building-${space.teamBuildingStatus.toLowerCase()}`}
                      />
                      {buildingLabels[space.teamBuildingStatus]}
                    </span>
                    <Icon name="arrow" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
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
          dirty={Object.values(form).some(Boolean)}
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
                  <Field
                    label="프로젝트 시작 (한국 시간)"
                    error={fieldErrors.startAt}
                  >
                    <input
                      name="startAt"
                      required
                      type="datetime-local"
                      value={form.startAt}
                      onChange={(event) =>
                        update('startAt', event.target.value)
                      }
                    />
                  </Field>
                  <Field
                    label="프로젝트 종료 (한국 시간)"
                    error={fieldErrors.endAt}
                  >
                    <input
                      name="endAt"
                      required
                      type="datetime-local"
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
