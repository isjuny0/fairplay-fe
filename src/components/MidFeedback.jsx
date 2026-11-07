import { formatDate } from '../lib/domain.js';
import TeamProgressRing from './TeamProgressRing.jsx';
import { getMidFeedback } from '../api/evaluations.js';
import useResource from '../hooks/useResource.js';
import { FeedbackHelp, FeedbackSummary } from './PlanningUi.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

function WorkSnapshot({ summary }) {
  const { completedWorkSharePercent, completedTaskCount, inProgressTaskCount, overdueTaskCount } = summary;

  return (
    <div className="mid-work-overview">
      <div className="mid-work-share">
        {completedWorkSharePercent === null ? (
          <p className="field-help">마감 시점에 완료된 작업이 없습니다.</p>
        ) : (
          <TeamProgressRing value={completedWorkSharePercent} label="팀 완료 작업량 중 내 비율" compact />
        )}
        <div className="mid-work-share-label">
          <span>팀 완료 작업량 중 내 비율</span>
          <FeedbackHelp
            label="팀 완료 작업량 중 내 비율"
            description="평가 마감까지 완료한 작업의 작업량에 내 담당 비율을 곱해 합산한 뒤, 팀 전체 완료 작업량으로 나눕니다. 작업량이 4인 작업을 50% 맡았다면 내 완료 작업량에 2가 더해집니다."
          />
        </div>
      </div>
      <dl className="mid-work-counts">
        <div><dt>완료</dt><dd>{completedTaskCount}건</dd></div>
        <div><dt>진행·수정 중</dt><dd>{inProgressTaskCount}건</dd></div>
        <div><dt>마감 지연</dt><dd>{overdueTaskCount}건</dd></div>
      </dl>
    </div>
  );
}

export default function MidFeedback({ context }) {
  const { team, user } = context;
  const resource = useResource(() => getMidFeedback(team.id), [team.id, user.id]);
  const feedback = resource.data?.members?.find((member) => member.userId === user.id);
  const snapshotAt = resource.data?.workSnapshotAt;
  const pending = ['MID_FEEDBACK_NOT_READY', 'ROUND_NOT_FOUND'].includes(resource.error?.code);

  return (
    <section className="stack mid-feedback-page">
      <div className="page-heading page-heading--compact">
        <h1>중간 피드백</h1>
      </div>
      {pending ? (
        <EmptyState>
          <h2>피드백을 준비하고 있습니다.</h2>
          <p>{resource.error.message}</p>
        </EmptyState>
      ) : (
        <ResourceState resource={resource} label="중간 피드백">
          {feedback ? (
            <div className="mid-feedback-columns">
              <div className="mid-feedback-card mid-feedback-evaluation">
                <FeedbackSummary member={feedback} />
              </div>
              <section className="mid-feedback-card mid-work-section" aria-labelledby="mid-work-heading">
                <header className="feedback-score-heading">
                  <h2 id="mid-work-heading">내 작업 현황</h2>
                  {snapshotAt && feedback.workSummary && (
                    <span>
                      중간 동료 평가 마감 기준
                      <time dateTime={snapshotAt}>{formatDate(snapshotAt)}</time>
                    </span>
                  )}
                </header>
                {snapshotAt && feedback.workSummary ? (
                  <WorkSnapshot summary={feedback.workSummary} />
                ) : (
                  <p className="field-help">마감 시점의 작업 현황을 확인할 수 없습니다.</p>
                )}
              </section>
            </div>
          ) : (
            <EmptyState>
              <h2>확인할 수 있는 내 피드백이 없습니다.</h2>
            </EmptyState>
          )}
        </ResourceState>
      )}
    </section>
  );
}
