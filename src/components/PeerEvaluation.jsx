import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { apiTimeToEpoch } from '../lib/koreanTime.js';
import RefreshButton from './RefreshButton.jsx';
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
import { memberName } from '../lib/domain.js';
import { ArrowRight } from 'lucide-react';
import { parseRouteId } from '../lib/routes.js';
import {
  validatePeerResponse,
  isLowScore,
} from '../lib/evaluation.js';
import { peerCriteria, peerCriteriaDescriptions, peerEvaluationNotes, peerGuides, peerScoreOptions } from '../lib/peerCriteria.js';
import { EmptyState, ErrorNotice, Field, Modal, ResourceState } from './ui.jsx';
import { RoundPicker } from './PlanningUi.jsx';

const scheduleDateFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
});
const scheduleTimeFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false,
});

function EvaluationScheduleDate({ label, value }) {
  const timestamp = apiTimeToEpoch(value);
  const date = Number.isFinite(timestamp) ? new Date(timestamp) : null;
  return <div className="evaluation-schedule-date">
    <span className="evaluation-schedule-label">{label}</span>
    {date ? <time dateTime={value}>
      <strong>{scheduleDateFormat.format(date)}</strong>
      <span>{scheduleTimeFormat.format(date)}</span>
    </time> : <span className="evaluation-schedule-unset">미설정</span>}
  </div>;
}

function PeerResponseSummary({ target, response }) {
  return <section className="peer-response-summary" aria-label={`${target.name} 저장된 평가`}>
    <div className="page-heading"><h2 tabIndex={-1}>{target.name}</h2></div>
    {response ? <>
      <table className="data-table peer-saved-scores">
        <caption className="sr-only">{target.name}에게 작성한 평가</caption>
        <thead><tr><th scope="col">평가 항목</th><th scope="col">내가 선택한 평가</th><th scope="col">점수</th></tr></thead>
        <tbody>{Object.entries(peerCriteria).map(([code, label]) => {
          const option = peerScoreOptions.find((option) => option.score === response.scores?.[code]);
          return <tr key={code}><th scope="row">{label}</th><td>{option?.label || '확인 불가'}</td>
            <td>{option ? <><strong>{option.score}</strong><span> / 5</span></> : '—'}</td></tr>;
        })}</tbody>
      </table>
      <section className="peer-saved-reason"><h3>평가 사유</h3>
        <p className="preserve-lines">{response.reason?.trim() || '작성한 사유가 없습니다.'}</p></section>
    </> : <EmptyState>이 팀원에게 저장한 평가가 없습니다.</EmptyState>}
  </section>;
}

function PeerResponseForm({
  target,
  response,
  locked,
  onSaved,
  context,
  round,
  onStateChanged,
}) {
  const guide = usePreviewGuide();
  const example = guide?.guiding && guide.scenarioId === 'peer-evaluation' && guide.stepId === 'peer-responses';
  const manuallyEdited = useRef(false);
  const [scores, setScores] = useState(
    response?.scores ||
      Object.fromEntries(Object.keys(peerCriteria).map((code) => [code, ''])),
  );
  const [reason, setReason] = useState(response?.reason || '');
  useEffect(() => {
    if (example && !response && !manuallyEdited.current) {
      setScores({ ...guide.examples.peerScores });
      setReason(guide.examples.peerReason);
    }
  }, [example, response, guide?.examples]);
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
    onStateChanged(target.targetId, !locked && changed, busy);
    return () => onStateChanged(target.targetId, false, false);
  }, [target.targetId, changed, busy, locked, onStateChanged]);
  if (locked) return <PeerResponseSummary target={target} response={response} />;
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
      </div>
      <ErrorNotice error={error} />
      {example && !response && <p className="field-help">가이드용 예시 점수와 사유입니다. 실제 팀원의 행동에 맞춰 평가하는 방식으로 확인하거나 수정한 뒤 저장하세요.</p>}
      <div className="peer-score-column-headings" aria-hidden="true">
        <span>평가 항목</span><div>{peerScoreOptions.map(({ score, label }) => <span key={score}><strong>{score}</strong>{label}</span>)}</div>
      </div>
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
            <legend className="sr-only">{label}</legend>
            <div className="peer-score-row">
            <div className="peer-score-criterion">
              <strong aria-hidden="true">{label}</strong>
              <details>
                <summary>점수별 행동 기준</summary>
                <div className="peer-criterion-popover"><p>{peerCriteriaDescriptions[code]}</p>
                <p>1점 · 매우 미흡 · {peerGuides[code][0]}</p>
                <p>3점 · 보통 · {peerGuides[code][1]}</p>
                <p>5점 · 매우 우수 · {peerGuides[code][2]}</p>
                <p>2·4점은 인접 기준 사이의 수행 행동입니다.</p>
                <p>{peerEvaluationNotes[code]}</p></div>
              </details>
            </div>
            <div className="peer-score-controls">
            <div className="score-options">
              {peerScoreOptions.map(({ score }) => (
                <label
                  key={score}
                  className={Number(scores[code]) === score ? 'selected' : ''}
                >
                  <input
                    type="radio"
                    name={`${target.targetId}-${code}`}
                    aria-label={`${target.name} ${label} ${score}점`}
                    aria-describedby={`${target.targetId}-${code}-${score}-description`}
                    checked={Number(scores[code]) === score}
                    onChange={() => {
                      manuallyEdited.current = true;
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
              {peerScoreOptions.map(({ score, label: scoreLabel }) => (
                <span key={score} id={`${target.targetId}-${code}-${score}-description`}>
                  {scoreLabel}
                </span>
              ))}
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
            </div>
            </div>
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
            manuallyEdited.current = true;
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
  const guide = usePreviewGuide();
  const guidedPeer = guide?.guiding && guide.scenarioId === 'peer-evaluation';
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
    round.status !== 'OPEN' || apiTimeToEpoch(round.closesAt) <= now || submitted;
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
              apiTimeToEpoch(round.closesAt) <= now &&
              !submitted && (
                <p className="notice" role="status">
                  평가 시간이 마감되어 저장·제출할 수 없습니다. 저장한 응답을
                  확인하세요.
                </p>
              )}
            {guidedPeer && guide.stepId === 'peer-overview' && <div className="heading-actions">
              <button className="secondary-button" data-guide="confirm-peer-overview"
                disabled={resource.loading || Boolean(resource.error) || !targets.length || locked}
                onClick={() => guide.confirmPeerStep('peer-overview')}>평가 대상 확인 완료</button>
            </div>}
            <div className="peer-response-layout">
              <div className="peer-response-navigation">
                <section className="evaluation-progress">
                  <div className="page-heading">
                    <div>
                      <h2>
                        {submitted ? '최종 제출 완료' : locked ? '마감된 내 응답' : '평가 대상'}
                      </h2>
                      <span className="peer-progress-count">{responses.length} / {targets.length}명 저장</span>
                    </div>
                  </div>
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
                        {formStates[target.targetId]?.saving ? '저장 중' : formStates[target.targetId]?.changed ? '미저장' : responses.some((response) => response.targetId === target.targetId) ? '저장됨' : '작성 필요'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
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
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            {guidedPeer && guide.stepId === 'peer-result' && submitted && <div className="heading-actions">
              <button className="secondary-button" data-guide="confirm-peer-result"
                disabled={resource.loading || Boolean(resource.error)}
                onClick={() => guide.confirmPeerStep('peer-result')}>제출 결과 확인 완료</button>
            </div>}
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
                      data-guide={!currentResponse || currentState?.changed ? 'save-peer-response' : undefined}
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
                        data-guide={currentResponse && !currentState?.changed ? 'next-peer-target' : undefined}
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
                    <strong>전체 평가 제출</strong>
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
                    data-guide="submit-peer-evaluation"
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
              data-guide="confirm-peer-submit"
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
  const guide = usePreviewGuide();
  return <PeerEvaluationScreen key={`${context.space.id}:${context.user.id}:${guide?.scope || 'free'}`} context={context} />;
}
function PeerEvaluationScreen({ context }) {
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
          <h1>동료 평가</h1>
        </div>
        <RefreshButton
          label="평가 상태 새로고침"
          disabled={resource.loading}
          onClick={resource.reload}
        />
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
                className="evaluation-round-context"
                aria-label="선택한 평가 일정"
              >
                <EvaluationScheduleDate label="시작" value={round.opensAt} />
                <ArrowRight className="evaluation-schedule-arrow" size={16} aria-hidden="true" />
                <EvaluationScheduleDate label="마감" value={round.closesAt} />
              </section>
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
