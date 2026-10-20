import { getMidFeedback } from '../api/evaluations.js';
import useResource from '../hooks/useResource.js';
import { formatDate } from '../lib/domain.js';
import { FeedbackSummary } from './PlanningUi.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

export default function MidFeedback({ context }) {
  const resource = useResource(
    () => getMidFeedback(context.team.id),
    [context.team.id, context.user.id],
  );
  return (
    <section className="stack mid-feedback-page">
      <div className="page-heading page-heading--compact">
        <div>
          <span className="eyebrow">나의 협업 피드백</span>
          <h1>중간 피드백</h1>
        </div>
        <button
          className="secondary-button"
          disabled={resource.loading}
          onClick={resource.reload}
        >
          피드백 새로고침
        </button>
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
        <ResourceState resource={resource}>
          {resource.data?.members
            .filter((member) => member.userId === context.user.id)
            .map((member) => (
              <div className="stack" key={member.userId}>
                <section className="round-context">
                  <strong>팀원들이 평가한 {member.name}님의 협업 평균</strong>
                  <span>중간 평가 · {formatDate(resource.data.asOf)}</span>
                </section>
                <FeedbackSummary member={member} />
              </div>
            ))}
        </ResourceState>
      )}
    </section>
  );
}
