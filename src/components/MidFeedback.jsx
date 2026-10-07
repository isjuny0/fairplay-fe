import { getMidFeedback } from '../api/planned.js';
import useResource from '../hooks/useResource.js';
import { formatDate } from '../lib/domain.js';
import { FeedbackCards, MockNotice } from './PlanningUi.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

export default function MidFeedback({ context }) {
  const resource = useResource(
    () => getMidFeedback(context),
    [context.team.id, context.user.id],
  );
  return (
    <section className="stack">
      <div>
        <span className="eyebrow">나의 협업 피드백</span>
        <h1>중간 피드백</h1>
        <p>최종 평가 전에 내 협업 방식을 돌아보고 다음 작업을 준비하세요.</p>
      </div>
      <MockNotice />
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
                <FeedbackCards member={member} />
              </div>
            ))}
        </ResourceState>
      )}
      <p className="field-help">
        중간 평가 마감과 우리 팀 전원 제출 후 확인할 수 있습니다. 관리자
        공개와는 별개이며, 소규모 팀의 익명성을 보장하지 않습니다.
      </p>
    </section>
  );
}
