import { useState } from 'react';
import { getRounds, requestPlanned } from '../api/planned.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
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
  const { notify } = useInteractions();
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
  const [initialForm, setInitialForm] = useState(null);
  const rounds = resource.data || [];
  const openForm = (kind, round) => {
    setError(null);
    setEditing({ kind, round });
    const nextForm = {
      type:
        round?.type ||
        (!rounds.some((round) => round.type === 'MID') ? 'MID' : 'FINAL'),
      opensAt: toDateInput(
        round?.opensAt || new Date(Date.now() - 60000).toISOString(),
      ),
      closesAt: toDateInput(
        round?.closesAt && kind === 'edit'
          ? round.closesAt
          : new Date(Date.now() + 7 * 86400000).toISOString(),
      ),
    };
    setForm(nextForm);
    setInitialForm(nextForm);
  };
  const openRound = async (round) => {
    setBusy(true);
    setError(null);
    try {
      await requestPlanned(
        context,
        `/api/evaluation-rounds/${round.id}/open`,
        { method: 'POST' },
      );
      resource.reload();
      notify(
        `${roundLabels[round.type]}를 시작했습니다.`,
      );
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  };
  const blockReason = (round) => {
    if (submissions.loading && !submissions.data)
      return '참여 팀과 제출 조건을 확인하고 있습니다.';
    if (submissions.error) return '제출 현황을 다시 불러온 뒤 진행해 주세요.';
    if (round.status === 'DRAFT') {
      if (!context.teamContexts.length) return '평가에 참여할 팀이 필요합니다.';
      if (context.teamContexts.some(({ team }) => team.approvedMemberCount < 2))
        return '모든 팀에 승인된 팀원 2명 이상이 필요합니다.';
      if (new Date(context.space.teamBuildingClosesAt) > new Date())
        return '팀 빌딩 기간이 종료된 뒤 시작할 수 있습니다.';
      if (
        round.type === 'FINAL' &&
        rounds.find((entry) => entry.type === 'MID')?.status !== 'CLOSED'
      )
        return '중간 평가를 먼저 마감해 주세요.';
      if (
        new Date(round.opensAt) > new Date() ||
        new Date(round.closesAt) <= new Date()
      )
        return '설정한 시작 시각부터 마감 시각 전까지만 시작할 수 있습니다.';
    }
    return null;
  };
  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">스페이스 단위 평가</span>
          <h1>평가 회차 관리</h1>
          <p>중간·최종 평가 일정을 정하고 제출 상태에 맞춰 운영하세요.</p>
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
      <ol className="process-steps" aria-label="평가 진행 순서">
        <li>1. 일정 설정</li>
        <li>2. 평가 시작·작성</li>
        <li>3. 제출 확인·마감</li>
      </ol>
      {rounds.length >= 2 && (
        <p className="field-help">
          중간·최종 평가 회차가 모두 있습니다. 각 회차에서 일정을 수정하거나
          진행 상태를 확인하세요.
        </p>
      )}
      <section className="panel">
        <h2>팀 구성과 집계 기준</h2>
        <p>
          최초 중간 평가 시작 시 팀 구성이 고정됩니다. 팀원 2명 미만인 팀이
          있으면 시작할 수 없습니다.
        </p>
        <p className="field-help">
          최초 최종 평가 마감 시 작업 집계 기준 시각을 고정합니다. 재개방은
          미제출 보완이며 집계 기간을 늘리지 않습니다.
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
                      {round.type === 'MID'
                        ? '해당 없음 · 최종 평가에서 고정'
                        : formatDate(round.closesAt)}
                    </dd>
                  </div>
                </dl>
                {blockReason(round) && (
                  <p className="notice">{blockReason(round)}</p>
                )}
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
                        disabled={busy || Boolean(blockReason(round))}
                        onClick={() => openRound(round)}
                      >
                        {roundLabels[round.type]} 시작
                      </button>
                    </>
                  )}
                  {round.status === 'OPEN' && (
                    <button className="secondary-button" disabled={busy}
                      onClick={() => openForm('edit', round)}>
                      {roundLabels[round.type]} 마감 시각 수정
                    </button>
                  )}
                </div>
                <p className="field-help">
                  {round.status === 'DRAFT'
                    ? '일정 대기 상태입니다. 기간과 참여 조건이 충족되면 평가를 시작할 수 있습니다.'
                    : round.status === 'OPEN'
                      ? '설정된 마감 시각에 자동으로 종료합니다. 종료 전에는 마감 시각을 수정할 수 있습니다.'
                      : '마감된 회차는 일정 수정·추가 제출을 허용하지 않습니다.'}
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
              : '평가 일정 수정'
          }
          busy={busy}
          onClose={() => setEditing(null)}
          dirty={JSON.stringify(form) !== JSON.stringify(initialForm)}
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
                      body: {
                        ...(editing.round.status === 'DRAFT' ? { opensAt: body.opensAt } : {}),
                        closesAt: body.closesAt, expectedVersion: editing.round.version,
                      },
                    },
                  );
                setEditing(null);
                notify('평가 일정을 저장했습니다.');
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
            <Field label="평가 시작 시각">
                <input
                  required
                  type="datetime-local"
                  disabled={busy || editing.round?.status === 'OPEN'}
                  value={form.opensAt}
                  onChange={(event) =>
                    setForm({ ...form, opensAt: event.target.value })
                  }
                />
            </Field>
            <Field label="평가 마감 시각">
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
