import { useEffect, useState } from 'react';
import { getAiReview, requestAiReview } from '../api/aiReviews.js';
import useResource from '../hooks/useResource.js';
import { canModifyTeamWork, isAssignee, isMutable } from '../lib/domain.js';
import { EmptyState, ErrorNotice, ResourceState } from './ui.jsx';

const statusLabels = {
  PENDING: '검토 대기',
  PROCESSING: '검토 진행 중',
  COMPLETED: '검토 완료',
  FAILED: '검토 실패',
};
const failureMessages = {
  REVIEW_INPUT_CHANGED:
    '검토 중 작업 설명이나 산출물이 바뀌었습니다. 현재 자료로 다시 요청해 주세요.',
  REVIEW_NOT_EXECUTABLE:
    '작업 상태나 팀 조건이 바뀌어 검토를 진행할 수 없습니다.',
  UNSUPPORTED_REVIEW_FORMAT:
    '연결 자료 중 AI 검토를 지원하지 않는 형식이 있습니다.',
  DOCUMENT_UNREADABLE:
    '연결 자료의 필요한 내용을 읽지 못했습니다. 자료를 확인해 주세요.',
  UPSTREAM_UNAVAILABLE:
    'AI 제공자에 연결하지 못했습니다. 잠시 후 직접 다시 요청해 주세요.',
  REVIEW_TIMEOUT: '검토 시간이 초과됐습니다. 잠시 후 직접 다시 요청해 주세요.',
  INVALID_REVIEW_RESPONSE:
    '검토 결과를 확인하지 못했습니다. 잠시 후 직접 다시 요청해 주세요.',
  REVIEW_INTERRUPTED:
    '검토가 중단됐습니다. 현재 상태를 확인한 뒤 직접 다시 요청해 주세요.',
};
function References({ references }) {
  return references.map((reference, index) => (
    <blockquote
      className="ai-evidence"
      key={`${reference.deliverableId}-${index}`}
    >
      <span className="eyebrow">
        산출물 #{reference.deliverableId} ·{' '}
        {reference.quote ? '원문 인용' : '내용 관찰'}
      </span>
      <p>{reference.quote || reference.observation}</p>
      {reference.location && <small>자료 위치 · {reference.location}</small>}
    </blockquote>
  ));
}
export default function AiReview({ context }) {
  const resource = useResource(
    () => getAiReview(context.task.id),
    [context.task.id, context.task.version],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const review = resource.data;
  const active = review && ['PENDING', 'PROCESSING'].includes(review.status);
  const canRequest =
    context.task.completionBlockReason !== 'WORK_PERIOD_CLOSED' &&
    error?.code !== 'TASK_WORK_CLOSED' &&
    ![401, 403].includes(resource.error?.status) &&
    ![401, 403].includes(error?.status) &&
    !context.manager &&
    isAssignee(context.task, context.user.id) &&
    isMutable(context.task) &&
    canModifyTeamWork(context.team);
  useEffect(() => {
    if (
      !active ||
      resource.error ||
      resource.loading ||
      document.visibilityState !== 'visible'
    )
      return;
    const timer = setTimeout(() => {
      if (document.visibilityState === 'visible') resource.reload();
    }, 5000);
    return () => clearTimeout(timer);
  }, [
    active,
    resource.data,
    resource.error,
    resource.loading,
    resource.reload,
  ]);
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === 'visible' && active && !resource.error)
        resource.reload();
    };
    document.addEventListener('visibilitychange', resume);
    return () => document.removeEventListener('visibilitychange', resume);
  }, [active, resource.error, resource.reload]);
  const requestReview = async () => {
    if (busy || active || !canRequest) return;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const submitted = await requestAiReview(context.task.id);
      setNotice(
        submitted.status === 'COMPLETED'
          ? '현재 입력의 검토 결과를 다시 확인합니다.'
          : 'AI 검토를 요청했습니다. 진행 상태를 확인합니다.',
      );
      resource.reload();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel stack ai-review-panel" aria-label="AI 검토">
      <div className="ai-review-heading">
        <div>
          <span className="eyebrow">완료 요청 전 선택 사항</span>
          <h2>AI 검토</h2>
        </div>
        <div className="ai-review-actions">
          {canRequest && (
            <button
              className="secondary-button"
              disabled={
                busy ||
                active ||
                resource.loading ||
                (review?.isCurrent &&
                  review.status === 'COMPLETED' &&
                  !resource.error)
              }
              onClick={requestReview}
            >
              {busy
                ? '검토 요청 중…'
                : active
                  ? '검토 진행 중'
                  : review?.isCurrent &&
                      review.status === 'COMPLETED' &&
                      !resource.error
                    ? '현재 입력 검토 완료'
                    : 'AI 검토 요청'}
            </button>
          )}
          <button
            className="secondary-button"
            disabled={busy || resource.loading}
            onClick={resource.reload}
          >
            검토 상태 확인
          </button>
        </div>
      </div>
      <div className="ai-review-introduction">
        <p>
          작업 설명과 제출 자료를 바탕으로 잘된 점과 보완할 내용을 안내합니다.
          AI 제안과 근거를 확인하고 필요한 내용을 수정해 주세요.
        </p>
        <p className="field-help">
          검토 실행과 결과는 완료 요청·승인의 필수 조건이 아닙니다. 지정
          승인자가 최종 완료 여부를 판단합니다. 저장 가능한 파일도 AI 검토에서는
          지원하지 않을 수 있습니다.
        </p>
      </div>
      {(context.task.completionBlockReason === 'WORK_PERIOD_CLOSED' ||
        error?.code === 'TASK_WORK_CLOSED') && (
        <p className="notice">
          최종 평가 마감 이후에는 새 검토를 요청할 수 없습니다. 기존 결과는
          조회할 수 있습니다.
        </p>
      )}
      <ErrorNotice error={error} />
      {notice && (
        <p className="field-help" role="status">
          {notice}
        </p>
      )}
      {resource.error?.code === 'AI_REVIEW_NOT_FOUND' ? (
        <EmptyState>
          아직 요청한 AI 검토가 없습니다. 담당자가 완료 요청 전에 선택적으로
          요청할 수 있습니다.
        </EmptyState>
      ) : (
        <ResourceState resource={resource}>
          {review && (
            <div className="ai-review-result">
              <div className="ai-review-result-context">
                <span
                  className={`status-badge ${review.status === 'COMPLETED' ? 'task-state-done' : ''}`}
                >
                  {statusLabels[review.status]}
                </span>
                <span>
                  {review.isCurrent ? '현재 입력 기준' : '이전 입력 기준'}
                </span>
              </div>
              {!review.isCurrent && (
                <p className="notice">
                  검토 접수 후 입력이 변경되었습니다. 아래 결과는 현재 자료의
                  검토 결과가 아닙니다.
                </p>
              )}
              {active && (
                <p className="field-help" role="status">
                  결과를 준비하고 있습니다. 진행 중에만 5초 간격으로 상태를
                  확인합니다.
                </p>
              )}
              {review.status === 'FAILED' && (
                <p className="notice">
                  {failureMessages[review.failureCode] ||
                    '검토를 완료하지 못했습니다.'}
                  {review.failureDeliverableId != null &&
                    ` 실패 대상 산출물 #${review.failureDeliverableId}`}
                </p>
              )}
              {review.status === 'COMPLETED' && (
                <>
                  <section className="ai-review-summary" aria-label="검토 요약">
                    <h3>검토 요약</h3>
                    <p>{review.summary}</p>
                  </section>
                  <section className="ai-review-findings" aria-label="잘된 점">
                    <h3>잘된 점</h3>
                    {review.strengths.length ? (
                      <ol className="ai-finding-list">
                        {review.strengths.map((strength, index) => (
                          <li key={index}>
                            <p>{strength.message}</p>
                            <References references={strength.references} />
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="field-help">
                        별도로 제시된 내용이 없습니다.
                      </p>
                    )}
                  </section>
                  <section
                    className="ai-review-findings"
                    aria-label="보완할 내용·확인할 질문"
                  >
                    <h3>보완할 내용·확인할 질문</h3>
                    {review.improvements.length ? (
                      <ol className="ai-finding-list">
                        {review.improvements.map((improvement, index) => (
                          <li key={index}>
                            <span className="ai-finding-type">
                              {improvement.type === 'QUESTION'
                                ? '확인 질문'
                                : '확인된 문제'}
                            </span>
                            <dl className="ai-improvement-facts">
                              <div>
                                <dt>확인 내용</dt>
                                <dd>{improvement.issue}</dd>
                              </div>
                              <div>
                                <dt>제안</dt>
                                <dd>{improvement.suggestion}</dd>
                              </div>
                            </dl>
                            <References references={improvement.references} />
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="field-help">
                        별도로 제시된 보완 사항이 없습니다.
                      </p>
                    )}
                  </section>
                  {review.limitations.length > 0 && (
                    <section
                      className="ai-review-limitations"
                      aria-label="검토 한계"
                    >
                      <h3>검토 한계</h3>
                      <ul>
                        {review.limitations.map((limitation, index) => (
                          <li key={index}>{limitation}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              )}
            </div>
          )}
        </ResourceState>
      )}
    </section>
  );
}
