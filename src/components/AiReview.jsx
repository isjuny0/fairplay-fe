import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { getAiReview, requestAiReview } from '../api/aiReviews.js';
import useResource from '../hooks/useResource.js';
import { canModifyTeamWork, formatDate, isAssignee, isMutable } from '../lib/domain.js';
import { EmptyState, ErrorNotice, ResourceState } from './ui.jsx';
import AiReviewFeedback from './AiReviewFeedback.jsx';

const statusLabels = {
  PENDING: '검토 대기',
  PROCESSING: '검토 진행 중',
  COMPLETED: '검토 완료',
  FAILED: '검토 실패',
};
const failureMessages = {
  REVIEW_INPUT_CHANGED:
    '검토 중 작업 설명이나 결과물이 바뀌었습니다. 현재 자료로 다시 요청해 주세요.',
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
export default function AiReview({ context, onEditSource }) {
  const guide = usePreviewGuide();
  const guidedFeedback = Boolean(guide?.guiding && guide.stepId === 'ai-feedback' && context.task.id === guide.taskId);
  const resource = useResource(
    () => getAiReview(context.task.id),
    [context.task],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const review = resource.data;
  const active = ['PENDING', 'PROCESSING'].includes(review?.status);
  const waitingForReview = active && !resource.error;
  let loadingTitle;
  if (busy) loadingTitle = '피드백 요청 중';
  else if (waitingForReview) loadingTitle = statusLabels[review.status];
  else if (!review && resource.loading) loadingTitle = '피드백 불러오는 중';
  const hasFeedback = Array.isArray(review?.findings);
  const reportFeedbackReady = guide?.setAiFeedbackReady;
  const feedbackReady = Boolean(review?.status === 'COMPLETED' && hasFeedback && review.isCurrent && !resource.loading && !resource.error);
  useEffect(() => {
    if (!guidedFeedback) return;
    reportFeedbackReady(feedbackReady);
    return () => reportFeedbackReady(false);
  }, [guidedFeedback, feedbackReady, reportFeedbackReady]);
  const canRequest =
    context.task.completionBlockReason !== 'WORK_PERIOD_CLOSED' &&
    error?.code !== 'TASK_WORK_CLOSED' &&
    ![401, 403].includes(resource.error?.status) &&
    ![401, 403].includes(error?.status) &&
    !context.manager &&
    isAssignee(context.task, context.user.id) &&
    isMutable(context.task) &&
    canModifyTeamWork(context.team);
  const showRequest = canRequest && !active && !resource.loading &&
    (!resource.error || resource.error.code === 'AI_REVIEW_NOT_FOUND') && !feedbackReady;
  const requestAgain = Boolean(error || review?.status === 'FAILED' || (review && !review.isCurrent));
  const isPreviousResult = review?.status === 'COMPLETED' && !review.isCurrent;
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
    try {
      await requestAiReview(context.task.id);
      resource.reload();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel stack ai-review-panel" aria-label="AI 피드백">
      <div className="ai-review-heading">
        <div className="ai-review-title">
          <h2>AI 피드백</h2>
          {review && !loadingTitle && !resource.error && (
            <span className={`status-badge${review.status === 'COMPLETED' ? ' task-state-done' : ''}`} role="status">
              {isPreviousResult ? '이전 검토 결과' : statusLabels[review.status]}
            </span>
          )}
        </div>
        {showRequest && <div className="ai-review-actions">
            <button
              className="secondary-button"
              disabled={busy || active || resource.loading}
              data-guide="request-ai-review"
              onClick={requestReview}
            >
              {busy ? '요청 중…' : requestAgain ? '피드백 다시 받기' : '피드백 받기'}
            </button>
        </div>}
      </div>
      {guidedFeedback && <p className="field-help">사용자 가이드의 예시 피드백입니다. 실제 AI 모델을 호출하지 않습니다.</p>}
      {!loadingTitle && resource.error?.code === 'AI_REVIEW_NOT_FOUND' && canRequest && <div className="ai-review-introduction">
        <p>
          작업 설명과 결과물을 살펴보고 보완할 점과 개선 방법을 제안합니다.
        </p>
        <p className="field-help">
          AI 피드백 없이도 작업을 완료할 수 있습니다. 일부 파일 형식은 검토가 제한될 수 있습니다.
        </p>
      </div>}
      {(context.task.completionBlockReason === 'WORK_PERIOD_CLOSED' ||
        error?.code === 'TASK_WORK_CLOSED') && (
        <p className="notice">
          최종 평가 마감 이후에는 새 검토를 요청할 수 없습니다. 기존 결과는
          조회할 수 있습니다.
        </p>
      )}
      <ErrorNotice error={error} />
      {loadingTitle ? (
        <div className="ai-review-loading" role="status">
          <span className="ai-review-loading-icon" aria-hidden="true">
            <span className="loading-spinner" />
            <Sparkles size={16} />
          </span>
          <div>
            <strong>{loadingTitle}</strong>
            {waitingForReview && <p>{review.status === 'PENDING'
              ? '검토 순서를 기다리고 있습니다.'
              : '작업 설명과 연결된 결과물을 검토하고 있습니다.'} 결과가 준비되면 자동으로 표시됩니다.</p>}
          </div>
        </div>
      ) : resource.error?.code === 'AI_REVIEW_NOT_FOUND' ? (
        <EmptyState>
          {canRequest ? '아직 받은 AI 피드백이 없습니다. 결과물을 추가한 뒤 피드백을 받아보세요.' : '저장된 AI 피드백이 없습니다.'}
        </EmptyState>
      ) : (
        <ResourceState resource={resource}>
          {review && (
            <div className="ai-review-result">
              {review.status === 'FAILED' && (
                <p className="notice">
                  {failureMessages[review.failureCode] ||
                    '검토를 완료하지 못했습니다.'}
                  {review.failureDeliverableId != null &&
                    ' 연결된 결과물을 확인해 주세요.'}
                </p>
              )}
              {review.status === 'COMPLETED' && (
                <>
                  {hasFeedback ? <AiReviewFeedback key={review.id} review={review} context={context} onEditSource={onEditSource} />
                    : <ErrorNotice error={new Error('피드백 내용을 표시하지 못했습니다. 잠시 후 다시 불러와 주세요.')} onRetry={resource.reload} />}
                  {review.completedAt && <div className="ai-review-result-context">
                    <time dateTime={review.completedAt}>검토 {formatDate(review.completedAt)}</time>
                  </div>}
                  {guidedFeedback && (
                    <div className="heading-actions">
                      <button
                        className="secondary-button"
                        data-guide="confirm-ai-feedback"
                        disabled={!feedbackReady}
                        onClick={guide.confirmAiFeedback}
                      >피드백 확인 완료</button>
                    </div>
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
