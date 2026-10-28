import { getMidFeedback } from '../api/evaluations.js';
import useResource from '../hooks/useResource.js';
import { formatDate } from '../lib/domain.js';
import RefreshButton from './RefreshButton.jsx';
import { FeedbackSummary } from './PlanningUi.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

export default function MidFeedback({ context }) {
  const resource = useResource(
    () => getMidFeedback(context.team.id),
    [context.team.id, context.user.id],
  );
  const feedback = resource.data?.members?.find(
    (member) => member.userId === context.user.id,
  );
  return (
    <section className="stack mid-feedback-page">
      <div className="page-heading page-heading--compact">
        <div>
          <h1>중간 피드백</h1>
        </div>
        <RefreshButton
          label="피드백 새로고침"
          disabled={resource.loading}
          onClick={resource.reload}
        />
      </div>
      {resource.error?.code === 'MID_FEEDBACK_NOT_READY' ||
      resource.error?.code === 'ROUND_NOT_FOUND' ? (
        <EmptyState>
          <h2>피드백을 준비하고 있습니다.</h2>
          <p>{resource.error.message}</p>
          <button className="secondary-button" onClick={resource.reload}>
            상태 다시 확인
          </button>
        </EmptyState>
      ) : (
        <ResourceState resource={resource} label="중간 피드백">
          {feedback ? (
            <div className="stack mid-feedback-result">
              <section className="feedback-context" aria-label="평가 정보">
                <strong>{feedback.name}님이 받은 평가</strong>
                <div className="feedback-meta">
                  <span>받은 평가 <strong>{feedback.receivedEvaluationCount == null ? '확인 불가' : `${feedback.receivedEvaluationCount}개`}</strong></span>
                  <span>기준 시각 <time dateTime={resource.data.asOf}>{formatDate(resource.data.asOf)}</time></span>
                </div>
              </section>
              <FeedbackSummary member={feedback} />
            </div>
          ) : (
            <EmptyState>
              <h2>확인할 수 있는 내 피드백이 없습니다.</h2>
              <p>평가 정보를 새로고침해 다시 확인해 주세요.</p>
            </EmptyState>
          )}
        </ResourceState>
      )}
    </section>
  );
}
