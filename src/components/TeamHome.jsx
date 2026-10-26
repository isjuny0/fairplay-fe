import { koreanDateTime } from '../lib/koreanTime.js';
import RefreshButton from './RefreshButton.jsx';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  LayoutDashboard,
  Plus,
  Settings2,
} from 'lucide-react';
import Icon from './Icon.jsx';
import TeamHomeCalendar from './TeamHomeCalendar.jsx';
import DashboardMetricHelp from './DashboardMetricHelp.jsx';
import DashboardWidgetFrame from './DashboardWidgetFrame.jsx';
import TeamHomeContribution from './TeamHomeContribution.jsx';
import { getHomePreferences, updateHomePreferences } from '../api/teamHome.js';
import {
  useInteractions,
  useUnsavedChanges,
} from '../hooks/useInteractions.js';
import { getTeamReport } from '../api/reports.js';
import '../team-dashboard.css';
import '../dashboard-layout.css';
import useResource from '../hooks/useResource.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { getMyWorkSummary } from '../api/teams.js';
import { listTasks } from '../api/tasks.js';
import { formatDate, statusLabels, toDateInput } from '../lib/domain.js';
import { formatPercent } from '../lib/evaluation.js';
import { dashboardWidgets, taskOverview } from '../lib/teamDashboard.js';
import { isPreviewPath } from '../lib/previewPath.js';
import { teamMenuPath } from '../lib/routes.js';
import { ErrorNotice, Modal, ResourceState } from './ui.jsx';
import { ProgressBar } from './PlanningUi.jsx';

function TeamProgressRing({ value }) {
  const available = value != null;
  const percent = available ? Math.min(100, Math.max(0, Number(value))) : 0;
  return (
    <div
      className="dashboard-progress-ring home-progress-ring"
      role="progressbar"
      aria-label="예상 작업량을 반영한 팀 진행률"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={available ? percent : undefined}
      aria-valuetext={available ? undefined : '계산할 작업 없음'}
    >
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle className="home-ring-track" cx="80" cy="80" r="68" />
        <circle
          className="home-ring-value"
          cx="80"
          cy="80"
          r="68"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - percent}
          strokeOpacity={percent > 0 ? 1 : 0}
        />
      </svg>
      <div>
        <strong>{available ? formatPercent(value) : '—'}</strong>
        <small>
          {available ? '완료한 만큼, 한 걸음 더' : '계산할 작업 없음'}
        </small>
      </div>
    </div>
  );
}

export default function TeamHome(props) {
  const { pathname } = useLocation();
  const { space, team, user } = props.context;
  const scopeKey = `${isPreviewPath(pathname)}:${space.id}:${team.id}:${user.id}`;
  return <TeamHomePreferences key={scopeKey} {...props} />;
}

function TeamHomePreferences(props) {
  const { team, user } = props.context;
  const resource = useResource(
    () => getHomePreferences(team.id),
    [team.id, user.id],
  );
  const summaryResource = useResource(
    () => getMyWorkSummary(team.id),
    [team.id, user.id],
  );
  return (
    <ResourceState resource={resource} label="팀 홈 설정">
      {resource.data && (
        <TeamDashboard
          {...props}
          initialPreferences={resource.data}
          summaryResource={summaryResource}
        />
      )}
    </ResourceState>
  );
}

function DashboardMemo({ value, onSave, busy, onDirtyChange }) {
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
      <label className="sr-only" htmlFor="dashboard-memo">
        빠른 메모
      </label>
      <textarea
        id="dashboard-memo"
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

function TeamDashboard({
  context,
  onNavigate,
  initialPreferences,
  summaryResource,
}) {
  const [dashboard, setDashboard] = useState(initialPreferences);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { confirm } = useInteractions();
  const [memoDirty, setMemoDirty] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [dropId, setDropId] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [now, setNow] = useState(Date.now());
  const navigate = useAppNavigate();
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const today = toDateInput(koreanDateTime(now)).slice(0, 10);
  const save = async (patch) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await updateHomePreferences(context.team.id, patch);
      setDashboard(saved);
      return true;
    } catch (error) {
      setSaveError(error);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const reportResource = useResource(async () => {
    if (!dashboard.widgets.includes('contribution')) return null;
    try {
      return await getTeamReport(context.team.id);
    } catch (error) {
      if (
        error.status === 404 &&
        ['REPORT_NOT_FOUND', 'NOT_FOUND'].includes(error.code)
      )
        return null;
      throw error;
    }
  }, [
    context.team.id,
    context.user.id,
    dashboard.widgets.includes('contribution'),
  ]);
  const needsTasks = dashboard.widgets.some((id) =>
    ['attention', 'upcoming', 'status'].includes(id),
  );
  const taskResource = useResource(
    () => (needsTasks ? listTasks(context.team.id) : Promise.resolve([])),
    [context.team.id, context.user.id, needsTasks],
  );
  const tasks = taskResource.data || [];
  const summary = summaryResource.data;
  const overview = taskOverview(tasks, context.user.id, now);
  const overdueCount = summaryResource.error
    ? overview.overdue.length
    : (summary?.myOverdueTaskCount ?? overview.overdue.length);
  const move = (index, direction) => {
    const widgets = [...dashboard.widgets];
    [widgets[index], widgets[index + direction]] = [
      widgets[index + direction],
      widgets[index],
    ];
    save({ widgets });
  };
  const taskLink = (task) =>
    navigate(
      `${teamMenuPath(context.space.id, context.team.id, '작업')}/${task.id}`,
    );
  const finishDrag = (id) => {
    setDraggedId(id);
    if (!id) setDropId(null);
  };
  const dropWidget = async (source, target) => {
    setDraggedId(null);
    setDropId(null);
    const from = dashboard.widgets.indexOf(source),
      to = dashboard.widgets.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    const widgets = [...dashboard.widgets];
    widgets.splice(from, 1);
    widgets.splice(to, 0, source);
    if (!(await save({ widgets }))) return;
    setAnnouncement(
      dashboardWidgets.find((widget) => widget.id === source).title +
        ' 위젯을 ' +
        (to + 1) +
        '번째로 이동했습니다.',
    );
  };
  const widgetContent = (id) => {
    if (id === 'calendar')
      return <TeamHomeCalendar team={context.team} today={today} />;
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
          className="dashboard-card dashboard-team-progress"
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
                setNow(Date.now());
              }}
            />
          </header>
          <ResourceState resource={summaryResource} label="팀 진행 현황">
            {summary && (
              <>
                <TeamProgressRing value={summary.teamProgressRate} />
                <div className="dashboard-progress-copy">
                  <strong>
                    {summary.teamProgressRate == null
                      ? '첫 작업을 기다리고 있어요'
                      : Number(summary.teamProgressRate) >= 100
                        ? '함께 목표에 도착했어요'
                        : '조금씩, 함께 앞으로'}
                  </strong>
                  <p>현재 등록된 작업의 예상 작업량 기준</p>
                </div>
                {summary.asOf && (
                  <time className="dashboard-caption" dateTime={summary.asOf}>
                    {formatDate(summary.asOf)} 기준
                  </time>
                )}
                <button
                  className="dashboard-shortcut-button"
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
              onClick={() =>
                onNavigate('작업', { mine: '1', overdue: 'work', view: 'list' })
              }
            >
              <span className="dashboard-icon is-red">
                <Icon name="clock" />
              </span>
              <span>내 마감 지연</span>
              <strong className="is-red">
                {overdueCount}
                <small>건</small>
              </strong>
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => {
                save({
                  widgets: dashboard.widgets.includes('upcoming')
                    ? dashboard.widgets
                    : [...dashboard.widgets, 'upcoming'],
                });
                requestAnimationFrame(() =>
                  document
                    .getElementById('dashboard-widget-upcoming')
                    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
                );
              }}
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
              ? '내가 담당한 미완료 작업 기준이에요.'
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
            onClick={() => onNavigate('작업', { mine: '1' })}
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
          <div className="dashboard-shortcut-art" aria-hidden="true">
            <Icon name={id === 'evaluation' ? 'review' : 'chart'} />
            <span>
              {id === 'evaluation'
                ? '서로의 협업을 돌아보는 시간'
                : '함께 쌓은 기록을 한눈에'}
            </span>
          </div>
          <p className="dashboard-caption">
            {id === 'evaluation'
              ? '동료의 노력과 협업 경험을 피드백으로 남겨 주세요.'
              : '우리 팀의 공개된 기여도 리포트를 확인해 보세요.'}
          </p>
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
                <strong>{member.name}</strong>
                {member.userId === context.user.id && (
                  <span className="dashboard-tag">나</span>
                )}
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
          value={dashboard.memo}
          onSave={save}
          busy={saving}
          onDirtyChange={setMemoDirty}
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
  return (
    <section className="team-dashboard">
      <header className="dashboard-heading">
        <div>
          <span className="dashboard-eyebrow">
            <LayoutDashboard size={14} />팀 홈
          </span>
          <h1>{context.team.name}</h1>
          <p>우리 팀의 흐름을 한눈에, 필요한 정보는 내 방식대로.</p>
        </div>
        <div className="dashboard-heading-actions">
          <button
            className="secondary-button"
            onClick={() => onNavigate('팀 자료 검색')}
          >
            <Icon name="search" />자료에 질문하기
          </button>
          <button
            className={`secondary-button ${editing ? 'is-active' : ''}`}
            onClick={() => setEditing(!editing)}
            aria-pressed={editing}
            disabled={saving}
          >
            <Settings2 size={15} />
            {editing ? '편집 완료' : '위젯 편집'}
          </button>
          <button
            className="primary-button"
            disabled={saving}
            onClick={() => setCatalog(true)}
          >
            <Plus size={16} />
            위젯 추가
          </button>
        </div>
      </header>
      <ErrorNotice error={saveError} />
      {saving && (
        <p role="status" className="field-help">
          개인 홈 설정을 저장하는 중…
        </p>
      )}
      {editing && (
        <p className="dashboard-edit-hint" role="status">
          <Settings2 size={15} />
          손잡이를 끌거나 화살표를 눌러 순서를 바꾸세요. 모든 위젯을 이동·제거할
          수 있어요.
        </p>
      )}
      <span className="sr-only" role="status">
        {announcement}
      </span>
      <div className="dashboard-widget-grid dashboard-arrange-grid">
        {dashboard.widgets.map((id, index) => {
          const widget = dashboardWidgets.find((item) => item.id === id);
          const base = ['calendar', 'progress', 'contribution'].includes(id);
          return (
            <DashboardWidgetFrame
              key={id}
              widget={widget}
              index={index}
              count={dashboard.widgets.length}
              editing={editing}
              disabled={saving}
              draggedId={draggedId}
              dropId={dropId}
              onDrag={finishDrag}
              onTarget={setDropId}
              onDrop={dropWidget}
              onMove={move}
              onRemove={async (removed) => {
                if (
                  removed === 'memo' &&
                  memoDirty &&
                  !(await confirm({
                    title: '저장하지 않은 메모',
                    message:
                      '메모를 저장하지 않았습니다. 입력 내용을 버리고 위젯을 제거할까요?',
                    label: '위젯 제거',
                  }))
                )
                  return;
                await save({
                  widgets: dashboard.widgets.filter((item) => item !== removed),
                });
              }}
            >
              {base ? (
                widgetContent(id)
              ) : (
                <section
                  className="dashboard-card dashboard-optional-card"
                  aria-label={id === 'mywork' ? '본인 작업 현황' : widget.title}
                >
                  <header className="dashboard-card-heading">
                    <div className="dashboard-title">
                      <span className="dashboard-icon">
                        <Icon name={widget.icon} />
                      </span>
                      <h2>{widget.title}</h2>
                      {id === 'mywork' && (
                        <DashboardMetricHelp title="내 작업 현황" />
                      )}
                    </div>
                  </header>
                  {widgetContent(id)}
                </section>
              )}
            </DashboardWidgetFrame>
          );
        })}
      </div>
      <button
        className="dashboard-add-placeholder"
        disabled={saving}
        onClick={() => setCatalog(true)}
      >
        <Plus size={18} />
        <strong>필요한 위젯 추가하기</strong>
      </button>
      <footer className="dashboard-local-note">
        일정은 팀원 모두와 공유됩니다. 위젯 구성과 메모는 내 계정에만
        저장됩니다.
      </footer>
      {catalog && (
        <Modal title="위젯 추가" onClose={() => setCatalog(false)} wide>
          <p className="dashboard-catalog-intro">
            우리 팀 홈에 필요한 정보를 골라 보세요.
          </p>
          <div className="dashboard-catalog">
            {dashboardWidgets.map((widget) => {
              const added = dashboard.widgets.includes(widget.id);
              return (
                <button
                  className={added ? 'is-added' : ''}
                  disabled={added || saving}
                  aria-label={`${widget.title} ${added ? '추가됨' : '추가'}`}
                  key={widget.id}
                  onClick={() =>
                    save({ widgets: [...dashboard.widgets, widget.id] })
                  }
                >
                  <span className="dashboard-icon">
                    <Icon name={widget.icon} />
                  </span>
                  <span>
                    <strong>{widget.title}</strong>
                    <small>{widget.description}</small>
                  </span>
                  <span className="dashboard-catalog-action">
                    {added ? <Check size={16} /> : <Plus size={16} />}
                    {added ? '추가됨' : '추가'}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="modal-actions">
            <button
              className="primary-button"
              onClick={() => setCatalog(false)}
            >
              완료
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
