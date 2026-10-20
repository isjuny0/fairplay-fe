import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useInteractions,
  useUnsavedChanges,
} from '../hooks/useInteractions.js';
import { useSearchParams } from 'react-router';
import {
  listEvaluationRounds,
  listPeerTargets,
  getMyPeerResponses,
  savePeerResponse,
  submitPeerEvaluation,
} from '../api/evaluations.js';
import useResource from '../hooks/useResource.js';
import useCurrentTime from '../hooks/useCurrentTime.js';
import { formatDate, memberName } from '../lib/domain.js';
import { parseRouteId } from '../lib/routes.js';
import {
  roundLabels,
  roundStatusLabels,
  validatePeerResponse,
  isLowScore,
} from '../lib/evaluation.js';
import { peerCriteria, peerGuides } from '../lib/peerCriteria.js';
import { EmptyState, ErrorNotice, Field, Modal, ResourceState } from './ui.jsx';
import { ProgressBar, RoundPicker } from './PlanningUi.jsx';

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
  const formElement = useRef(null);
  const reasonInput = useRef(null);
  const [reasonError, setReasonError] = useState('');
  const [scoreError, setScoreError] = useState(null);
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
      id={`peer-response-${round.id}-${target.targetId}`}
      ref={formElement}
      onSubmit={async (event) => {
        event.preventDefault();
        if (locked || busy) return;
        const validation = validatePeerResponse(scores, reason);
        if (validation) {
          const missingCode = Object.keys(peerCriteria).find(
            (code) => !scores[code],
          );
          if (missingCode) {
            setScoreError({ code: missingCode, message: validation });
            formElement.current
              ?.querySelector(`input[name="${target.targetId}-${missingCode}"]`)
              ?.focus();
          } else {
            setReasonError(validation);
            reasonInput.current?.focus();
          }
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await savePeerResponse(round.id, target.targetId, {
            scores: Object.fromEntries(
              Object.entries(scores).map(([code, score]) => [
                code,
                Number(score),
              ]),
            ),
            reason: reason.trim() || null,
          });
          onSaved();
          notify(`${target.name}님의 평가를 저장했습니다.`);
        } catch (error) {
          setError(error);
          formElement.current?.scrollIntoView({ block: 'start' });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="page-heading">
        <h2 tabIndex={-1}>{target.name}</h2>
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
      <ErrorNotice error={error} />
      <div className="peer-score-grid">
        {Object.entries(peerCriteria).map(([code, label]) => (
          <fieldset
            className="score-field"
            key={code}
            disabled={locked || busy}
            aria-invalid={scoreError?.code === code}
            aria-describedby={
              scoreError?.code === code
                ? `${target.targetId}-${code}-error`
                : undefined
            }
          >
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
                    onChange={() => {
                      setScores((current) => ({ ...current, [code]: score }));
                      setScoreError(null);
                      setError(null);
                    }}
                  />
                  <span>{score}</span>
                </label>
              ))}
            </div>
            <p className="score-scale" aria-label="점수 기준">
              <span>
                1점
                <br />
                기준 미달
              </span>
              <span>
                3점
                <br />
                기준 충족
              </span>
              <span>
                5점
                <br />
                기준 초과
              </span>
            </p>
            {scoreError?.code === code && (
              <p
                className="field-error"
                role="alert"
                id={`${target.targetId}-${code}-error`}
              >
                {scoreError.message}
              </p>
            )}
            <details>
              <summary>점수별 행동 기준</summary>
              <p>1점 · {peerGuides[code][0]}</p>
              <p>3점 · {peerGuides[code][1]}</p>
              <p>5점 · {peerGuides[code][2]}</p>
              <p>2·4점은 인접 기준 사이의 수행 행동입니다.</p>
            </details>
          </fieldset>
        ))}
      </div>
      <Field
        label="평가 사유"
        error={reasonError}
        help={
          isLowScore(scores)
            ? '1~2점이 포함되면 10~500자 필수입니다. 구체적인 행동을 적어주세요.'
            : '선택 사항입니다. 호감보다 실제 수행 행동을 기준으로 작성하세요.'
        }
      >
        <textarea
          ref={reasonInput}
          disabled={locked || busy}
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setReasonError('');
            setError(null);
          }}
        />
      </Field>
      <p className="character-count">{reason.length} / 500자</p>
    </form>
  );
}
function RoundResponses({ context, round, onSubmitted }) {
  const now = useCurrentTime();
  const resource = useResource(async () => {
    const responses = await getMyPeerResponses(round.id);
    const targets =
      round.status === 'CLOSED'
        ? responses.map((response) => ({
            targetId: response.targetId,
            name: memberName(context.members, response.targetId),
            submittedAt: response.submittedAt,
          }))
        : await listPeerTargets(round.id);
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
  const locked =
    round.status !== 'OPEN' || Date.parse(round.closesAt) <= now || submitted;
  const currentTargetId = targets.some(
    (target) => target.targetId === activeTargetId,
  )
    ? activeTargetId
    : targets[0]?.targetId;
  const currentTarget = targets.find(
    (target) => target.targetId === currentTargetId,
  );
  const currentState = formStates[currentTargetId];
  const currentResponse = responses.find(
    (response) => response.targetId === currentTargetId,
  );
  const nextTarget =
    targets[
      (targets.findIndex((target) => target.targetId === currentTargetId) + 1) %
        targets.length
    ];
  useEffect(() => {
    if (activeTargetId)
      document
        .getElementById(`peer-target-${round.id}-${activeTargetId}`)
        ?.querySelector('h2')
        ?.focus();
  }, [activeTargetId, round.id]);
  const readyToSubmit =
    !locked &&
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
            {round.status === 'OPEN' &&
              Date.parse(round.closesAt) <= now &&
              !submitted && (
                <p className="notice" role="status">
                  평가 시간이 마감되어 저장·제출할 수 없습니다. 저장한 응답을
                  확인하세요.
                </p>
              )}
            <div className="peer-response-layout">
              <aside className="peer-response-sidebar">
                <section className="evaluation-progress">
                  <div className="page-heading">
                    <div>
                      <h2>
                        {round.status === 'CLOSED'
                          ? '마감된 평가 · 내가 저장한 응답'
                          : submitted
                            ? '최종 제출 완료'
                            : '평가 저장 현황'}
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
                      targets.length
                        ? (responses.length / targets.length) * 100
                        : 0
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
                      aria-controls={`peer-target-${round.id}-${target.targetId}`}
                      onClick={() => setActiveTargetId(target.targetId)}
                    >
                      {target.name}
                      <span>
                        {formStates[target.targetId]?.changed
                          ? '미저장'
                          : responses.some(
                                (response) =>
                                  response.targetId === target.targetId,
                              )
                            ? '저장됨'
                            : '작성 필요'}
                      </span>
                    </button>
                  ))}
                </div>
              </aside>
              <div className="peer-grid">
                {targets.map((target) => {
                  const response = responses.find(
                    (response) => response.targetId === target.targetId,
                  );
                  return (
                    <div
                      className={`peer-target ${currentTargetId === target.targetId ? 'is-active' : ''}`}
                      id={`peer-target-${round.id}-${target.targetId}`}
                      hidden={currentTargetId !== target.targetId}
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
            </div>
            {!locked && currentTarget && (
              <div
                className="review-action-dock peer-evaluation-actions"
                role="region"
                aria-label="평가 저장 및 제출"
              >
                <div className="peer-current-action">
                  <div className="review-action-context">
                    <strong>현재 대상 · {currentTarget.name}</strong>
                    <span>
                      {currentState?.saving
                        ? '현재 평가 저장 중'
                        : currentState?.changed
                          ? '변경 내용을 저장해 주세요.'
                          : currentResponse
                            ? '저장한 평가입니다.'
                            : '점수를 선택하고 대상별로 저장하세요.'}
                    </span>
                  </div>
                  <div className="review-action-buttons">
                    <button
                      type="submit"
                      form={`peer-response-${round.id}-${currentTargetId}`}
                      className="secondary-button"
                      disabled={busy || saving || resource.loading}
                    >
                      {currentState?.saving
                        ? '저장 중…'
                        : `${currentTarget.name} 평가 저장`}
                    </button>
                    {targets.length > 1 && (
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={busy || saving}
                        onClick={() => setActiveTargetId(nextTarget.targetId)}
                        aria-label={`다음 팀원 · ${nextTarget.name}`}
                      >
                        다음 팀원 →
                      </button>
                    )}
                  </div>
                </div>
                <section
                  className="peer-submit-bar"
                  aria-label="평가 최종 제출"
                >
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
              </div>
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
          {locked && (
            <p className="notice" role="status">
              평가가 마감되어 제출할 수 없습니다. 창을 닫고 저장한 응답을
              확인하세요.
            </p>
          )}
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
                  await submitPeerEvaluation(round.id);
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
    () => listEvaluationRounds(context.space.id),
    [context.space.id, context.user.id],
  );
  const [params, setParams] = useSearchParams();
  const rounds = resource.data || [];
  const round =
    rounds.find((round) => round.id === parseRouteId(params.get('roundId'))) ||
    rounds.find((round) => round.status === 'OPEN') ||
    rounds[0];
  return (
    <section className="stack peer-evaluation-page">
      <div className="page-heading page-heading--compact">
        <div>
          <span className="eyebrow">협업 돌아보기</span>
          <h1>동료 평가</h1>
        </div>
        <button
          className="secondary-button"
          disabled={resource.loading}
          onClick={resource.reload}
        >
          평가 상태 새로고침
        </button>
      </div>
      <ResourceState resource={resource}>
        {rounds.length ? (
          <>
            <div className="peer-round-overview">
              <RoundPicker
                rounds={rounds}
                selected={round?.id}
                onSelect={(id) => setParams({ roundId: String(id) })}
              />
              <section
                className="round-context evaluation-round-context"
                aria-label="선택한 평가 회차"
              >
                <strong>
                  {roundLabels[round.type]} · {roundStatusLabels[round.status]}
                </strong>
                <span>시작 {formatDate(round.opensAt)}</span>
                <span className="round-deadline">
                  마감 {formatDate(round.closesAt)}
                </span>
              </section>
              <p className="field-help">
                마감 후 스페이스 관리자가 최종 제출된 점수와 사유를 열람할 수
                있습니다.
              </p>
            </div>
            {round.status === 'DRAFT' ? (
              <EmptyState>
                <h2>평가 시작을 기다리고 있습니다.</h2>
                <p>관리자가 회차를 시작하면 평가할 팀원이 표시됩니다.</p>
              </EmptyState>
            ) : round.mySubmissionStatus === 'NOT_PARTICIPATING' ? (
              <EmptyState>이 평가 회차의 고정 참여자가 아닙니다.</EmptyState>
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
