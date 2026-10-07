import { useState } from 'react';
import { requestPlanned } from '../api/planned.js';
import useResource from '../hooks/useResource.js';
import { canModifyTeamWork, isAssignee } from '../lib/domain.js';
import { MockNotice } from './PlanningUi.jsx';
import { EmptyState, ErrorNotice, ResourceState } from './ui.jsx';

const criterionLabels = {
  REQUIREMENT_FULFILLMENT: '요구 충족',
  ACCURACY_CONSISTENCY: '정확성·일관성',
  EVIDENCE_SUPPORT: '근거 뒷받침',
  CLARITY_USABILITY: '명확성·활용성',
};
const stateLabels = {
  PENDING: '평가 대기',
  PROCESSING: '평가 진행 중',
  COMPLETED: '평가 완료',
  NEEDS_REVIEW: '추가 확인 필요',
};
const materialFailures = [
  'EVALUATION_INPUT_INSUFFICIENT',
  'INPUT_FORMAT_UNSUPPORTED',
  'DOCUMENT_UNREADABLE',
  'INPUT_LIMIT_EXCEEDED',
];
const technicalFailures = ['UPSTREAM_UNAVAILABLE', 'OUTPUT_VALIDATION_FAILED'];
function Evidence({ evidence }) {
  const location = evidence.location;
  const position = location
    ? [
        location.page && `${location.page}쪽`,
        location.section,
        location.slide && `슬라이드 ${location.slide}`,
        location.sheetName,
        location.cellRange,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  return (
    <blockquote className="ai-evidence">
      <span className="eyebrow">
        {evidence.kind === 'TEXT_QUOTE' ? '원문 인용' : '내용 관찰'}
      </span>
      <p>{evidence.quote || evidence.observation}</p>
      {position && <small>모델이 식별한 위치 · {position}</small>}
    </blockquote>
  );
}
export default function AiEvaluation({ context, onChanged }) {
  const resource = useResource(
    () =>
      requestPlanned(context, `/api/tasks/${context.task.id}/ai-evaluation`),
    [context.task.id, context.task.status],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [notice, setNotice] = useState('');
  const evaluation = resource.data;
  const assigned = isAssignee(context.task, context.user.id),
    reviewer = context.approval?.reviewerId === context.user.id;
  const technical =
    evaluation && technicalFailures.includes(evaluation.failureCode);
  const mutate = async (action) => {
    setBusy(true);
    setError(null);
    try {
      await requestPlanned(context, `/api/tasks/${context.task.id}/${action}`, {
        method: 'POST',
        body:
          action === 'rework'
            ? { expectedVersion: context.task.version }
            : undefined,
      });
      setNotice(
        action === 'rework'
          ? '자료 보완을 허용했습니다. 목업 상태에만 반영되며 실제 서버 작업은 변경되지 않습니다.'
          : '재실행을 예약했습니다. 평가 대기 상태에서 결과를 확인해 주세요.',
      );
      resource.reload();
      onChanged?.();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">제출 결과의 품질</span>
          <h2>AI 작업 평가</h2>
        </div>
        <button
          className="secondary-button"
          onClick={resource.reload}
          disabled={busy}
        >
          평가 상태 확인
        </button>
      </div>
      <MockNotice />
      <ErrorNotice error={error} />
      {notice && <p role="status">{notice}</p>}
      {resource.error?.code === 'AI_EVALUATION_NOT_FOUND' ? (
        <EmptyState>완료 승인 후 평가가 예약됩니다.</EmptyState>
      ) : (
        <ResourceState resource={resource}>
          {evaluation && (
            <>
              <div className="ai-score">
                <span
                  className={`status-badge ${evaluation.status === 'COMPLETED' ? 'task-state-done' : ''}`}
                >
                  {stateLabels[evaluation.status]}
                </span>
                <strong>
                  {evaluation.score == null
                    ? '점수 없음'
                    : `${evaluation.score} / 100`}
                </strong>
              </div>
              <p>
                {evaluation.reason ||
                  '평가가 완료되면 결과와 근거를 확인할 수 있습니다.'}
              </p>
              {evaluation.unverified.length > 0 && (
                <div className="notice-panel">
                  <h3>자료에서 확인하지 못한 내용</h3>
                  <ul>
                    {evaluation.unverified.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {evaluation.status === 'NEEDS_REVIEW' &&
                context.task.status === 'DONE' && (
                  <div className="heading-actions">
                    {technical &&
                      assigned &&
                      canModifyTeamWork(context.team) &&
                      !context.manager && (
                        <button
                          className="secondary-button"
                          disabled={busy}
                          onClick={() => mutate('ai-evaluation/retry')}
                        >
                          AI 평가 다시 시도
                        </button>
                      )}
                    {materialFailures.includes(evaluation.failureCode) &&
                      reviewer &&
                      canModifyTeamWork(context.team) &&
                      !context.manager && (
                        <button
                          className="secondary-button"
                          disabled={busy}
                          onClick={() => mutate('rework')}
                        >
                          자료 보완 허용
                        </button>
                      )}
                  </div>
                )}
              <details>
                <summary>항목별 평가·원문 근거 보기</summary>
                {evaluation.criteria.map((criterion) => (
                  <section className="criterion-row" key={criterion.code}>
                    <div>
                      <h3>{criterionLabels[criterion.code]}</h3>
                      <strong>
                        {criterion.points} / {criterion.maxPoints}점 · 수준{' '}
                        {criterion.level}/4
                      </strong>
                    </div>
                    <p>{criterion.reason}</p>
                    {criterion.evidence?.map((evidence, index) => (
                      <Evidence key={index} evidence={evidence} />
                    ))}
                  </section>
                ))}
                {evaluation.evidence.map((evidence, index) => (
                  <Evidence key={index} evidence={evidence} />
                ))}
              </details>
              <details>
                <summary>0~4 수준 안내</summary>
                <p>
                  0 · 요구 결과를 충족하지 못함 / 1 · 주요 부분 부족 / 2 · 기본
                  기준 충족 / 3 · 대부분 충족 / 4 · 충분히 충족. 항목별 점수는
                  수준과 40·30·20·10 배점을 반영합니다.
                </p>
              </details>
              <p className="field-help">
                인용·위치는 모델이 식별한 안내이며 서버 검증을 뜻하지 않습니다.{' '}
                {context.task.status !== 'DONE' &&
                  '보완 전 진단 기록은 현재 원본의 검증 근거가 아닙니다.'}{' '}
              </p>
              <details>
                <summary>평가 기준·모델 정보</summary>
                <p>
                  {evaluation.model} · 기준 {evaluation.rubricVersion}
                </p>
              </details>
            </>
          )}
        </ResourceState>
      )}
    </section>
  );
}
