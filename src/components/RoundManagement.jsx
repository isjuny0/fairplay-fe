import { useState } from 'react';
import { getRounds, requestPlanned } from '../api/planned.js';
import useResource from '../hooks/useResource.js';
import { formatDate, fromDateInput, toDateInput } from '../lib/domain.js';
import { roundLabels, roundStatusLabels } from '../lib/evaluation.js';
import { MockNotice } from './PlanningUi.jsx';
import {
  EmptyState,
  ErrorNotice,
  Field,
  FormActions,
  Modal,
  ResourceState,
} from './ui.jsx';

export default function RoundManagement({ context }) {
  const resource = useResource(() => getRounds(context), [context.space.id]);
  const submissions = useResource(
    () =>
      requestPlanned(
        context,
        `/api/spaces/${context.space.id}/manager-dashboard`,
      ),
    [context.space.id, resource.data],
  );
  const [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const [form, setForm] = useState({ type: 'MID', opensAt: '', closesAt: '' });
  const rounds = resource.data || [];
  const openForm = (kind, round) => {
    setError(null);
    setEditing({ kind, round });
    setForm({
      type:
        round?.type ||
        (!rounds.some((round) => round.type === 'MID') ? 'MID' : 'FINAL'),
      opensAt: toDateInput(
        round?.opensAt || new Date(Date.now() - 60000).toISOString(),
      ),
      closesAt: toDateInput(new Date(Date.now() + 7 * 86400000).toISOString()),
    });
  };
  const act = async (round, action) => {
    setBusy(true);
    setError(null);
    try {
      await requestPlanned(
        context,
        `/api/evaluation-rounds/${round.id}/${action}`,
        { method: 'POST' },
      );
      resource.reload();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">스페이스 단위 평가</span>
          <h1>평가 회차 관리</h1>
          <p>MID·FINAL 일정을 정하고 제출 상태에 맞춰 운영하세요.</p>
        </div>
        <button
          className="primary-button"
          disabled={busy || rounds.length >= 2}
          onClick={() => openForm('create')}
        >
          평가 회차 만들기
        </button>
      </div>
      <MockNotice />
      <section className="panel">
        <h2>팀 구성과 집계 기준</h2>
        <p>
          최초 MID 개방 시 팀 구성이 고정됩니다. 팀원 2명 미만인 팀이 있으면
          시작할 수 없습니다.
        </p>
        <p className="field-help">
          최초 FINAL 마감 시 작업 집계 기준 시각을 고정합니다. 재개방은 미제출
          보완이며 집계 기간을 늘리지 않습니다.
        </p>
      </section>
      <ErrorNotice error={error} />
      <ResourceState resource={resource}>
        {rounds.length ? (
          <div className="two-column">
            {rounds.map((round) => (
              <section className="panel round-card" key={round.id}>
                <div className="page-heading">
                  <h2>{roundLabels[round.type]}</h2>
                  <span
                    className={`status-badge ${round.status === 'CLOSED' ? 'task-state-done' : round.status === 'OPEN' ? 'task-state-in_progress' : ''}`}
                  >
                    {roundStatusLabels[round.status]}
                  </span>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>시작</dt>
                    <dd>{formatDate(round.opensAt)}</dd>
                  </div>
                  <div>
                    <dt>마감</dt>
                    <dd>{formatDate(round.closesAt)}</dd>
                  </div>
                  <div>
                    <dt>고정 참여자</dt>
                    <dd>{round.participantCount}명</dd>
                  </div>
                  <div>
                    <dt>작업 집계 기준</dt>
                    <dd>
                      {round.workCutoffAt
                        ? formatDate(round.workCutoffAt)
                        : '아직 고정되지 않음'}
                    </dd>
                  </div>
                </dl>
                {submissions.data?.missingPeerSubmissions
                  .find((item) => item.roundId === round.id)
                  ?.teams.map((team) => (
                    <p key={team.teamId} className="count-row">
                      <span>
                        {context.teamContexts.find(
                          (entry) => entry.team.id === team.teamId,
                        )?.team.name || '팀'}
                      </span>
                      <strong>
                        {team.submittedCount}/{team.requiredCount}명 제출
                      </strong>
                    </p>
                  ))}
                <div className="heading-actions">
                  {round.status === 'DRAFT' && (
                    <>
                      <button
                        className="secondary-button"
                        disabled={busy}
                        onClick={() => openForm('edit', round)}
                      >
                        {roundLabels[round.type]} 일정 수정
                      </button>
                      <button
                        className="primary-button"
                        disabled={busy}
                        onClick={() => act(round, 'open')}
                      >
                        {roundLabels[round.type]} 시작
                      </button>
                    </>
                  )}
                  {round.status === 'OPEN' && (
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => act(round, 'close')}
                    >
                      {roundLabels[round.type]} 마감
                    </button>
                  )}
                  {round.status === 'CLOSED' && (
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => openForm('reopen', round)}
                    >
                      {roundLabels[round.type]} 재개방
                    </button>
                  )}
                </div>
                <p className="field-help">
                  {round.status === 'DRAFT'
                    ? 'DRAFT는 아직 평가 작성이 시작되지 않은 상태입니다.'
                    : round.status === 'OPEN'
                      ? '기한 전에는 전원 제출 시에만 마감합니다. 기한이 지나면 미제출이 있어도 마감합니다.'
                      : '공개 리포트가 있으면 재개방할 수 없습니다. 이미 제출된 응답은 수정되지 않습니다.'}
                </p>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState>
            <h2>평가 회차를 설정해 주세요.</h2>
            <p>중간 평가와 최종 평가를 각각 한 번씩 만들 수 있습니다.</p>
          </EmptyState>
        )}
      </ResourceState>
      {editing && (
        <Modal
          title={
            editing.kind === 'create'
              ? '평가 회차 만들기'
              : editing.kind === 'reopen'
                ? '평가 회차 재개방'
                : '평가 일정 수정'
          }
          busy={busy}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const body = {
                  type: form.type,
                  opensAt: fromDateInput(form.opensAt),
                  closesAt: fromDateInput(form.closesAt),
                };
                if (editing.kind === 'create')
                  await requestPlanned(
                    context,
                    `/api/spaces/${context.space.id}/evaluation-rounds`,
                    { method: 'POST', body },
                  );
                else if (editing.kind === 'edit')
                  await requestPlanned(
                    context,
                    `/api/evaluation-rounds/${editing.round.id}`,
                    {
                      method: 'PATCH',
                      body: { ...body, expectedVersion: editing.round.version },
                    },
                  );
                else
                  await requestPlanned(
                    context,
                    `/api/evaluation-rounds/${editing.round.id}/reopen`,
                    {
                      method: 'POST',
                      body: {
                        closesAt: body.closesAt,
                        expectedVersion: editing.round.version,
                      },
                    },
                  );
                setEditing(null);
                resource.reload();
              } catch (error) {
                setError(error);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="평가 종류">
              <select
                disabled={editing.kind !== 'create' || busy}
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value })
                }
              >
                {['MID', 'FINAL']
                  .filter(
                    (type) =>
                      editing.kind !== 'create' ||
                      !rounds.some((round) => round.type === type),
                  )
                  .map((type) => (
                    <option key={type} value={type}>
                      {roundLabels[type]}
                    </option>
                  ))}
              </select>
            </Field>
            {editing.kind !== 'reopen' && (
              <Field label="평가 시작 시각">
                <input
                  required
                  type="datetime-local"
                  disabled={busy}
                  value={form.opensAt}
                  onChange={(event) =>
                    setForm({ ...form, opensAt: event.target.value })
                  }
                />
              </Field>
            )}
            <Field
              label={
                editing.kind === 'reopen' ? '새 마감 시각' : '평가 마감 시각'
              }
            >
              <input
                required
                type="datetime-local"
                disabled={busy}
                value={form.closesAt}
                onChange={(event) =>
                  setForm({ ...form, closesAt: event.target.value })
                }
              />
            </Field>
            <ErrorNotice error={error} />
            <FormActions
              busy={busy}
              onCancel={() => setEditing(null)}
              label={editing.kind === 'reopen' ? '재개방' : '저장'}
            />
          </form>
        </Modal>
      )}
    </section>
  );
}
