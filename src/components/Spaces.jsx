import { useState } from 'react';
import { createSpace, joinSpace, listSpaces } from '../api/spaces.js';
import useResource from '../hooks/useResource.js';
import { buildingLabels, fromDateInput } from '../lib/domain.js';
import {
  EmptyState,
  ErrorNotice,
  Field,
  FormActions,
  Modal,
  ResourceState,
} from './ui.jsx';

export default function Spaces({ onSelect }) {
  const resource = useResource(listSpaces, []);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    startAt: '',
    endAt: '',
    code: '',
  });
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const open = (type) => {
    setError(null);
    setModal(type);
    setForm({ name: '', description: '', startAt: '', endAt: '', code: '' });
  };
  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (modal === 'create' && form.startAt >= form.endAt) {
      setError(new Error('종료 시각은 시작 시각보다 늦어야 합니다.'));
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
          <h1>내 스페이스</h1>
          <p>프로젝트 공간을 만들거나 참여 코드로 함께 시작하세요.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={() => open('join')}>
            코드로 참여
          </button>
          <button className="primary-button" onClick={() => open('create')}>
            스페이스 만들기
          </button>
        </div>
      </div>
      <ResourceState resource={resource}>
        {resource.data?.length ? (
          <ul className="space-list">
            {resource.data.map((space) => (
              <li key={space.spaceId}>
                <button onClick={() => onSelect(space.spaceId)}>
                  <strong>{space.name}</strong>
                  <span>
                    {space.role === 'MANAGER' ? '관리자' : '참여자'} ·{' '}
                    {buildingLabels[space.teamBuildingStatus]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>
            <p>아직 참여한 스페이스가 없습니다.</p>
            <span>새 스페이스를 만들거나 관리자의 참여 코드를 입력하세요.</span>
          </EmptyState>
        )}
      </ResourceState>
      {modal && (
        <Modal
          title={modal === 'create' ? '스페이스 만들기' : '코드로 참여'}
          busy={busy}
          onClose={() => setModal(null)}
        >
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="form-fields">
              {modal === 'create' ? (
                <>
                  <Field label="스페이스 이름">
                    <input
                      required
                      maxLength={100}
                      value={form.name}
                      onChange={(event) => update('name', event.target.value)}
                    />
                  </Field>
                  <Field label="소개">
                    <textarea
                      maxLength={500}
                      value={form.description}
                      onChange={(event) =>
                        update('description', event.target.value)
                      }
                    />
                  </Field>
                  <Field label="프로젝트 시작 (한국 시간)">
                    <input
                      required
                      type="datetime-local"
                      value={form.startAt}
                      onChange={(event) =>
                        update('startAt', event.target.value)
                      }
                    />
                  </Field>
                  <Field label="프로젝트 종료 (한국 시간)">
                    <input
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
                <Field label="참여 코드">
                  <input
                    required
                    pattern="[0-9A-Fa-f]{8}"
                    maxLength={8}
                    value={form.code}
                    onChange={(event) => update('code', event.target.value)}
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
