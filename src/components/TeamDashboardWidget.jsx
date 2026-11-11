import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronRight } from 'lucide-react';
import RefreshButton from './RefreshButton.jsx';
import Icon from './Icon.jsx';
import TeamHomeCalendar from './TeamHomeCalendar.jsx';
import TeamHomeContribution from './TeamHomeContribution.jsx';
import TeamProgressRing from './TeamProgressRing.jsx';
import DashboardMetricHelp from './DashboardMetricHelp.jsx';
import { ProgressBar } from './PlanningUi.jsx';
import { ResourceState } from './ui.jsx';
import { useUnsavedChanges } from '../hooks/useInteractions.js';
import { formatDate, statusLabels } from '../lib/domain.js';
import { formatPercent } from '../lib/evaluation.js';
import { dashboardWidgets, taskOverview } from '../lib/teamDashboard.js';

const noop = () => {};

function DashboardMemo({ value, onSave, busy, onDirtyChange }) {
  const memoId = useId();
  const [draft, setDraft] = useState(value);
  const previousValue = useRef(value);
  useEffect(() => {
    const previous = previousValue.current;
    previousValue.current = value;
    setDraft((current) => (current === previous ? value : current));
  }, [value]);
  const changed = draft !== value;
  useUnsavedChanges(changed);
  useEffect(() => onDirtyChange(changed), [changed, onDirtyChange]);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (changed && !busy) await onSave({ memo: draft });
      }}
    >
      <label className="sr-only" htmlFor={memoId}>
        빠른 메모
      </label>
      <textarea
        id={memoId}
        className="dashboard-memo"
        maxLength={3000}
        placeholder="잊지 않을 아이디어를 적어 보세요."
        value={draft}
        disabled={busy}
        onChange={(event) => setDraft(event.target.value)}
      />
      <span className="dashboard-memo-foot">
        나만의 메모 · {draft.length.toLocaleString()} / 3,000
      </span>
      <button
        type="submit"
        className="secondary-button"
        disabled={busy || !changed}
      >
        {busy ? '저장 중…' : '메모 저장'}
      </button>
    </form>
  );
}


export default function TeamDashboardWidget({
  id, context, summaryResource, taskResource, reportResource,
  today, now, needsTasks = false, onNavigate = noop, taskLink = noop, onRefreshTime = noop,
  memo = '', onSaveMemo = noop, saving = false, onMemoDirty = noop, preview = false,
}) {
  const tasks = taskResource.data || [];
  const summary = summaryResource.data;
  const overview = taskOverview(tasks, context.user.id, now);
  const overdueCount = summaryResource.error
    ? overview.overdue.length
    : (summary?.myOverdueTaskCount ?? overview.overdue.length);
  const widgetContent = (id) => {
    if (id === 'calendar')
      return <TeamHomeCalendar team={context.team} today={today} preview={preview} />;
    if (id === 'contribution')
      return (
        <TeamHomeContribution
          resource={reportResource}
          userId={context.user.id}
          onNavigate={onNavigate}
        />
      );
    if (id === 'progress')
      return (
        <section
          className="dashboard-card dashboard-team-progress" data-guide="team-progress"
          aria-label="팀 진행 현황"
        >
          <header className="dashboard-card-heading">
            <div className="dashboard-title">
              <span className="dashboard-icon">
                <Icon name="chart" />
              </span>
              <h2>팀 전체 진행률</h2>
              <DashboardMetricHelp title="팀 전체 진행률" />
            </div>
            <RefreshButton
              className="dashboard-icon-button"
              label="현황 새로고침"
              disabled={
                summaryResource.loading || (needsTasks && taskResource.loading)
              }
              onClick={() => {
                summaryResource.reload();
                if (needsTasks) taskResource.reload();
                onRefreshTime(Date.now());
              }}
            />
          </header>
          <ResourceState resource={summaryResource} label="팀 진행 현황">
            {summary && (
              <>
                <TeamProgressRing value={summary.teamProgressRate} />
                <div className="dashboard-progress-copy">
                  <p>현재 등록된 작업의 예상 작업량 기준</p>
                </div>
                {summary.asOf && (
                  <time className="dashboard-caption" dateTime={summary.asOf}>
                    {formatDate(summary.asOf)} 기준
                  </time>
                )}
                <button
                  className="dashboard-shortcut-button"
                  data-guide="open-tasks"
                  onClick={() => onNavigate('작업', { view: 'board' })}
                >
                  작업 보드 보기 <ArrowUpRight size={16} />
                </button>
              </>
            )}
          </ResourceState>
        </section>
      );
    if (id === 'attention')
      return (
        <ResourceState resource={taskResource} label="확인할 작업">
          <div className="dashboard-attention">
            <button
              title="내가 담당한 마감 지연 작업 목록으로 이동"
              onClick={() =>
                onNavigate('작업', { mine: '1', overdue: 'work', view: 'list' })
              }
            >
              <span
                className={`dashboard-icon${overdueCount > 0 ? ' is-red' : ''}`}
              >
                <Icon name="clock" />
              </span>
              <span>내 마감 지연</span>
              <strong className={overdueCount > 0 ? 'is-red' : undefined}>
                {overdueCount}
                <small>건</small>
              </strong>
              <ChevronRight size={16} />
            </button>
            <button
              title="내가 담당한 7일 내 마감 작업 목록으로 이동"
              onClick={() =>
                onNavigate('작업', { mine: '1', due: 'week', view: 'list' })
              }
            >
              <span className="dashboard-icon is-amber">
                <Icon name="calendar" />
              </span>
              <span>7일 내 마감</span>
              <strong>
                {overview.soon.length}
                <small>건</small>
              </strong>
              <ChevronRight size={16} />
            </button>
          </div>
          <p className="dashboard-caption">
            {overdueCount || overview.soon.length
              ? '내 담당 미완료 작업 기준'
              : '확인할 작업 없음'}
          </p>
        </ResourceState>
      );
    if (id === 'upcoming')
      return (
        <ResourceState resource={taskResource} label="다가오는 작업">
          {overview.upcoming.length ? (
            <ul className="dashboard-task-list">
              {overview.upcoming.slice(0, 4).map((task) => (
                <li key={task.id}>
                  <button onClick={() => taskLink(task)}>
                    <span
                      className={`dashboard-status-dot status-${task.status}`}
                    />
                    <span>
                      <strong>{task.title}</strong>
                      <small>{formatDate(task.dueAt)}</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dashboard-empty">
              <Check size={22} />
              <p>다가오는 내 작업이 없어요.</p>
            </div>
          )}
          <button
            className="dashboard-text-button dashboard-widget-link"
            onClick={() => onNavigate('작업', { mine: '1', view: 'list' })}
          >
            내 작업 전체 보기 <ArrowUpRight size={15} />
          </button>
        </ResourceState>
      );
    if (id === 'mywork')
      return (
        <ResourceState resource={summaryResource} label="본인 작업 현황">
          {summary && (
            <div className="dashboard-work-metrics">
              {[
                ['내 담당 비중', '팀 전체 기준', summary.myAssignedShare],
                [
                  '내 완료 비중',
                  '팀 전체 기준',
                  summary.myCompletedContributionRate,
                ],
                [
                  '내 작업 완료율',
                  '내 담당 기준',
                  summary.myTaskCompletionRate,
                ],
              ].map(([label, scope, value]) => (
                <div className="dashboard-work-metric" key={label}>
                  <small>{scope}</small>
                  <h3>{label}</h3>
                  <strong>
                    {formatPercent(
                      value,
                      summary.teamTotalWeight
                        ? '담당 작업 없음'
                        : '계산할 작업 없음',
                    )}
                  </strong>
                  <ProgressBar value={value} label={`${label} · ${scope}`} />
                </div>
              ))}
            </div>
          )}
        </ResourceState>
      );
    if (id === 'evaluation' || id === 'report')
      return (
        <>
          <button
            className="dashboard-shortcut-button"
            onClick={() =>
              onNavigate(id === 'evaluation' ? '동료 평가' : '기여도 리포트')
            }
          >
            {id === 'evaluation' ? '동료 평가 작성' : '공개 리포트 보기'}
            <ArrowUpRight size={16} />
          </button>
        </>
      );
    if (id === 'members')
      return (
        <>
          <ul className="dashboard-members">
            {context.members.map((member) => (
              <li key={member.userId}>
                <span className="dashboard-avatar">
                  {member.name?.slice(0, 1) || '?'}
                </span>
                <strong className={member.userId === context.user.id ? 'self-identity' : undefined}>{member.name}</strong>
                {member.role === 'LEADER' && (
                  <span className="dashboard-leader">
                    <i />팀 리더
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="dashboard-caption">
            함께하는 인원 {context.members.length}명
          </p>
        </>
      );
    if (id === 'memo')
      return (
        <DashboardMemo
          value={memo}
          onSave={onSaveMemo}
          busy={saving}
          onDirtyChange={onMemoDirty}
        />
      );
    if (id === 'status')
      return (
        <ResourceState resource={taskResource} label="작업 상태 요약">
          <div className="dashboard-status-bar" aria-hidden="true">
            {Object.keys(statusLabels).map((status) => (
              <span
                className={`status-${status}`}
                style={{
                  flexGrow: tasks.filter((task) => task.status === status)
                    .length,
                }}
                key={status}
              />
            ))}
          </div>
          <ul className="dashboard-status-list">
            {Object.entries(statusLabels).map(([status, label]) => (
              <li key={status}>
                <span className={`dashboard-status-dot status-${status}`} />
                <span>{label}</span>
                <strong>
                  {tasks.filter((task) => task.status === status).length}
                  <small>개</small>
                </strong>
              </li>
            ))}
          </ul>
          <button
            className="dashboard-text-button dashboard-widget-link"
            onClick={() => onNavigate('작업', { view: 'board' })}
          >
            작업 보드 열기 <ArrowUpRight size={15} />
          </button>
        </ResourceState>
      );
    return null;
  };
  const widget = dashboardWidgets.find(item => item.id === id);
  if (['calendar', 'progress', 'contribution'].includes(id)) return widgetContent(id);
  return (
    <section className="dashboard-card dashboard-optional-card" aria-label={id === 'mywork' ? '본인 작업 현황' : widget.title}>
      <header className="dashboard-card-heading">
        <div className="dashboard-title">
          <span className="dashboard-icon"><Icon name={widget.icon} /></span>
          <h2>{widget.title}</h2>
          {id === 'mywork' && <DashboardMetricHelp title="내 작업 현황" />}
        </div>
      </header>
      {widgetContent(id)}
    </section>
  );
}
