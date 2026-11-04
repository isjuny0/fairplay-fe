import { ArrowUpRight } from 'lucide-react';
import { listTasks } from '../api/tasks.js';
import useCurrentTime from '../hooks/useCurrentTime.js';
import { workSummary } from '../lib/evaluation.js';
import TeamProgressRing from './TeamProgressRing.jsx';
import { getMidFeedback } from '../api/evaluations.js';
import useResource from '../hooks/useResource.js';
import RefreshButton from './RefreshButton.jsx';
import { FeedbackHelp, FeedbackSummary } from './PlanningUi.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

function CurrentWork({ tasks, teamId, userId, onNavigate }) {
  const now = useCurrentTime();
  const summary = workSummary(teamId, userId, tasks, now);
  const share = summary.teamDoneWeight > 0
    ? (summary.myDoneWeight / summary.teamDoneWeight) * 100
    : null;
  const myTasks = tasks.filter((task) =>
    task.assignees.some((assignment) => assignment.userId === userId),
  );
  const completed = myTasks.filter((task) => task.status === 'DONE').length;
  const inProgress = myTasks.filter((task) =>
    ['IN_PROGRESS', 'REVISING'].includes(task.status),
  ).length;

  return (
    <div className="mid-work-overview">
      <div className="mid-work-share">
        {share === null ? (
          <p className="field-help">아직 완료된 작업이 없어요.</p>
        ) : (
          <TeamProgressRing value={share} label="팀 완료 작업량 중 내 비율" compact />
        )}
        <div className="mid-work-share-label">
          <span>팀 완료 작업량 중 내 비율</span>
          <FeedbackHelp
            label="팀 완료 작업량 중 내 비율"
            description="현재 완료된 작업의 작업량에 내 담당 비율을 곱해 합산한 뒤, 팀 전체 완료 작업량으로 나눕니다. 작업량이 4인 작업을 50% 맡았다면 내 완료 작업량에 2가 더해집니다."
          />
        </div>
      </div>
      <div className="mid-work-details">
        <dl className="mid-work-counts">
          <div><dt>완료</dt><dd>{completed}건</dd></div>
          <div><dt>진행·수정 중</dt><dd>{inProgress}건</dd></div>
          <div><dt>마감 지연</dt><dd>{summary.myOverdueTaskCount}건</dd></div>
        </dl>
        <button
          type="button"
          className="text-button mid-work-link"
          onClick={() => onNavigate('작업', { mine: '1', view: 'list' })}
        >
          내 작업 보기 <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function MidFeedback({ context, onNavigate }) {
  const { team, user } = context;
  const tasks = useResource(() => listTasks(team.id), [team.id, user.id]);
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
          disabled={resource.loading || tasks.loading}
          onClick={() => { resource.reload(); tasks.reload(); }}
        />
      </div>
      <div className="mid-feedback-columns">
        <div className="mid-feedback-card mid-feedback-evaluation">
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
                <FeedbackSummary member={feedback} />
              ) : (
                <EmptyState>
                  <h2>확인할 수 있는 내 피드백이 없습니다.</h2>
                  <p>평가 정보를 새로고침해 다시 확인해 주세요.</p>
                </EmptyState>
              )}
            </ResourceState>
          )}
        </div>
        <section className="mid-feedback-card mid-work-section" aria-labelledby="mid-work-heading">
          <header className="feedback-score-heading">
            <h2 id="mid-work-heading">내 작업 현황</h2>
            <span>현재 작업 기준</span>
          </header>
          <ResourceState resource={tasks} label="내 작업 현황">
            {tasks.data && (
              <CurrentWork tasks={tasks.data} teamId={team.id} userId={user.id} onNavigate={onNavigate} />
            )}
          </ResourceState>
        </section>
      </div>
    </section>
  );
}
