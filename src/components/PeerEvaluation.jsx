import { useCallback, useEffect, useState } from 'react';
import {
  useInteractions,
  useUnsavedChanges,
} from '../hooks/useInteractions.js';
import { useSearchParams } from 'react-router';
import { getRounds, requestPlanned } from '../api/planned.js';
import useResource from '../hooks/useResource.js';
import { formatDate } from '../lib/domain.js';
import { parseRouteId } from '../lib/routes.js';
import {
  roundLabels,
  roundStatusLabels,
  validatePeerResponse,
  isLowScore,
} from '../lib/evaluation.js';
import { peerCriteria, peerGuides } from '../mock/fixtures.js';
import { EmptyState, ErrorNotice, Field, Modal, ResourceState } from './ui.jsx';
import { MockNotice, ProgressBar, RoundPicker } from './PlanningUi.jsx';

function PeerResponseForm({
  target,
  response,
  locked,
  onSaved,
  context,
  round,
  onStateChanged,
  submitted,
}) {
  const [scores, setScores] = useState(
    response?.scores ||
      Object.fromEntries(Object.keys(peerCriteria).map((code) => [code, ''])),
  );
  const [reason, setReason] = useState(response?.reason || '');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const { notify } = useInteractions();
  const changed =
    Object.keys(peerCriteria).some(
      (code) => Number(scores[code]) !== Number(response?.scores?.[code] || 0),
    ) || reason.trim() !== (response?.reason || '').trim();
  useEffect(() => {
    onStateChanged(target.targetId, changed, busy);
    return () => onStateChanged(target.targetId, false, false);
  }, [target.targetId, changed, busy, onStateChanged]);
  return (
    <form
      className="panel peer-card"
      onSubmit={async (event) => {
        event.preventDefault();
        const validation = validatePeerResponse(scores, reason);
        if (validation) {
          setError(new Error(validation));
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await requestPlanned(
            context,
            `/api/evaluation-rounds/${round.id}/responses/${target.targetId}`,
            {
              method: 'PUT',
              body: {
                scores: Object.fromEntries(
                  Object.entries(scores).map(([code, score]) => [
                    code,
                    Number(score),
                  ]),
                ),
                reason: reason.trim() || null,
              },
            },
          );
          onSaved();
          notify(`${target.name}님의 평가를 저장했습니다.`);
        } catch (error) {
          setError(error);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="page-heading">
        <h2>{target.name}</h2>
        <span
          className={`status-badge ${!changed && response ? 'task-state-done' : ''}`}
        >
          {submitted
            ? '제출 완료'
            : busy
              ? '저장 중'
              : changed
                ? '미저장 변경'
                : response
                  ? '저장됨'
                  : '작성 필요'}
        </span>
      </div>
      {Object.entries(peerCriteria).map(([code, label]) => (
        <fieldset className="score-field" key={code} disabled={locked || busy}>
          <legend>{label}</legend>
          <div className="score-options">
            {[1, 2, 3, 4, 5].map((score) => (
              <label
                key={score}
                className={Number(scores[code]) === score ? 'selected' : ''}
              >
                <input
                  type="radio"
                  name={`${target.targetId}-${code}`}
                  aria-label={`${target.name} ${label} ${score}점`}
                  checked={Number(scores[code]) === score}
                  onChange={() =>
                    setScores((current) => ({ ...current, [code]: score }))
                  }
                />
                <span>{score}</span>
              </label>
            ))}
          </div>
          <p className="score-scale">
            1점 · 기준 미달 <span>3점 · 기준 충족</span> 5점 · 기준 초과
          </p>
          <details>
            <summary>점수별 행동 기준</summary>
            <p>1점 · {peerGuides[code][0]}</p>
            <p>3점 · {peerGuides[code][1]}</p>
            <p>5점 · {peerGuides[code][2]}</p>
            <p>2·4점은 인접 기준 사이의 수행 행동입니다.</p>
          </details>
        </fieldset>
      ))}
      <Field
        label="평가 사유"
        help={
          isLowScore(scores)
            ? '1~2점이 포함되면 10~500자 필수입니다. 구체적인 행동을 적어주세요.'
            : '선택 사항입니다. 호감보다 실제 수행 행동을 기준으로 작성하세요.'
        }
      >
        <textarea
          disabled={locked || busy}
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <p className="character-count">{reason.length} / 500자</p>
      <ErrorNotice error={error} />
      {!locked && (
        <button className="secondary-button" disabled={busy}>
          {busy ? '저장 중…' : `${target.name} 평가 저장`}
        </button>
      )}
    </form>
  );
}
function RoundResponses({ context, round, onSubmitted }) {
  const resource = useResource(async () => {
    const [targets, responses] = await Promise.all([
      requestPlanned(context, `/api/evaluation-rounds/${round.id}/targets`),
      requestPlanned(
        context,
        `/api/evaluation-rounds/${round.id}/responses/me`,
      ),
    ]);
    return { targets, responses };
  }, [round.id, round.status]);
  const [confirming, setConfirming] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const [formStates, setFormStates] = useState({});
  const [activeTargetId, setActiveTargetId] = useState(null);
  const onStateChanged = useCallback((targetId, changed, saving) => {
    setFormStates((current) => {
      if (
        Boolean(current[targetId]?.changed) === changed &&
        Boolean(current[targetId]?.saving) === saving
      )
        return current;
      return { ...current, [targetId]: { changed, saving } };
    });
  }, []);
  const hasChanges = Object.values(formStates).some((state) => state.changed);
  const saving = Object.values(formStates).some((state) => state.saving);
  useUnsavedChanges(hasChanges);
  const targets = resource.data?.targets || [],
    responses = resource.data?.responses || [];
  const submitted =
    round.mySubmissionStatus === 'SUBMITTED' ||
    targets.some((target) => target.submittedAt);
  const locked = round.status !== 'OPEN' || submitted;
  const currentTargetId = targets.some(
    (target) => target.targetId === activeTargetId,
  )
    ? activeTargetId
    : targets[0]?.targetId;
  const readyToSubmit =
    targets.length > 0 &&
    responses.length === targets.length &&
    !hasChanges &&
    !saving &&
    !resource.loading;
  return (
    <>
      <ResourceState resource={resource}>
        {resource.data && (
          <>
            <section className="panel">
              <div className="page-heading">
                <div>
                  <h2>
                    {submitted
                      ? '최종 제출 완료'
                      : '대상별로 저장 후 최종 제출하세요'}
                  </h2>
                  <p>
                    {responses.length} / {targets.length}명 저장 ·{' '}
                    {submitted
                      ? '제출한 응답은 수정할 수 없습니다.'
                      : '저장만으로 최종 제출되지 않습니다.'}
                  </p>
                </div>
              </div>
              <ProgressBar
                value={
                  targets.length ? (responses.length / targets.length) * 100 : 0
                }
                label="내 평가 작성 진행률"
              />
            </section>
            <div
              className="peer-target-picker"
              role="group"
              aria-label="평가할 팀원 선택"
            >
              {targets.map((target) => (
                <button
                  key={target.targetId}
                  className={
                    currentTargetId === target.targetId ? 'active' : ''
                  }
                  aria-pressed={currentTargetId === target.targetId}
                  onClick={() => setActiveTargetId(target.targetId)}
                >
                  {target.name}
                  <span>
                    {formStates[target.targetId]?.changed
                      ? '미저장'
                      : responses.some(
                            (response) => response.targetId === target.targetId,
                          )
                        ? '저장됨'
                        : '작성 필요'}
                  </span>
                </button>
              ))}
            </div>
            <div className="peer-grid">
              {targets.map((target) => {
                const response = responses.find(
                  (response) => response.targetId === target.targetId,
                );
                return (
                  <div
                    className={`peer-target ${currentTargetId === target.targetId ? 'is-active' : ''}`}
                    key={target.targetId}
                  >
                    <PeerResponseForm
                      key={`${target.targetId}-${response?.updatedAt || 'new'}`}
                      target={target}
                      response={response}
                      locked={locked}
                      onSaved={resource.reload}
                      context={context}
                      round={round}
                      onStateChanged={onStateChanged}
                      submitted={submitted}
                    />
                  </div>
                );
              })}
            </div>
            {!locked && (
              <section className="peer-submit-bar" aria-label="평가 최종 제출">
                <div>
                  <strong>
                    {responses.length} / {targets.length}명 저장
                  </strong>
                  <p>
                    {hasChanges
                      ? '미저장 변경 사항을 먼저 저장해 주세요.'
                      : saving || resource.loading
                        ? '저장 상태를 확인하고 있습니다.'
                        : readyToSubmit
                          ? '모든 평가를 저장했습니다. 최종 제출해 주세요.'
                          : '모든 대상의 평가를 저장하면 제출할 수 있습니다.'}
                  </p>
                </div>
                <button
                  className="primary-button"
                  disabled={!readyToSubmit || busy}
                  onClick={() => setConfirming(true)}
                >
                  최종 제출
                </button>
              </section>
            )}
          </>
        )}
      </ResourceState>
      {confirming && (
        <Modal
          title="동료 평가 최종 제출"
          busy={busy}
          onClose={() => setConfirming(false)}
        >
          <p>
            모든 대상의 저장된 응답을 최종 제출합니다. 제출 후에는 수정할 수
            없습니다.
          </p>
          <ErrorNotice error={error} />
          <div className="heading-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              취소
            </button>
            <button
              className="primary-button"
              disabled={busy || !readyToSubmit}
              onClick={async () => {
                if (!readyToSubmit) return;
                setBusy(true);
                try {
                  await requestPlanned(
                    context,
                    `/api/evaluation-rounds/${round.id}/submit`,
                    { method: 'POST' },
                  );
                  setConfirming(false);
                  resource.reload();
                  onSubmitted();
                } catch (error) {
                  setError(error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              제출 확정
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export default function PeerEvaluation({ context }) {
  const resource = useResource(
    () => getRounds(context),
    [context.space.id, context.user.id],
  );
  const [params, setParams] = useSearchParams();
  const rounds = resource.data || [];
  const round =
    rounds.find((round) => round.id === parseRouteId(params.get('roundId'))) ||
    rounds.find((round) => round.status === 'OPEN') ||
    rounds[0];
  return (
    <section className="stack">
      <div>
        <span className="eyebrow">협업 돌아보기</span>
        <h1>동료 평가</h1>
        <p>
          같은 팀의 동료가 수행한 행동을 기준으로 평가해 주세요. 본인은 평가
          대상에서 제외됩니다.
        </p>
      </div>
      <MockNotice />
      <ResourceState resource={resource}>
        {rounds.length ? (
          <>
            <RoundPicker
              rounds={rounds}
              selected={round?.id}
              onSelect={(id) => setParams({ roundId: String(id) })}
            />
            <section className="round-context">
              <strong>
                {roundLabels[round.type]} · {roundStatusLabels[round.status]}
              </strong>
              <span>
                {formatDate(round.opensAt)} ~ {formatDate(round.closesAt)}
              </span>
            </section>
            {round.status === 'DRAFT' ? (
              <EmptyState>
                <h2>평가 시작을 기다리고 있습니다.</h2>
                <p>관리자가 회차를 시작하면 평가할 팀원이 표시됩니다.</p>
              </EmptyState>
            ) : (
              <RoundResponses
                key={`${round.id}-${round.version}`}
                context={context}
                round={round}
                onSubmitted={resource.reload}
              />
            )}
          </>
        ) : (
          <EmptyState>
            <h2>평가 회차가 아직 없습니다.</h2>
            <p>
              관리자가 중간·최종 평가 일정을 설정하면 이곳에서 확인할 수
              있습니다.
            </p>
          </EmptyState>
        )}
      </ResourceState>
    </section>
  );
}
