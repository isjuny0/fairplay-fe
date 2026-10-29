import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, ChevronRight, CircleHelp } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router';
import '../manager-dashboard.css';
import RefreshButton from './RefreshButton.jsx';
import TeamProgressRing from './TeamProgressRing.jsx';
import ManagerTeamLinks from './ManagerTeamLinks.jsx';
import { getManagerDashboard } from '../api/dashboard.js';
import useResource from '../hooks/useResource.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { spacePath } from '../lib/routes.js';
import { completedWorkShare, formatPercent } from '../lib/evaluation.js';
import { EmptyState, Field, ResourceState } from './ui.jsx';

const teamFilters = {
  all: '모든 팀', overdue: '마감 지연 있음', stale: '장기 정체 있음',
  revising: '수정 중 있음', applications: '가입 대기 있음',
};
const quickFilterLabels = { all: '전체 팀', overdue: '마감 지연', stale: '장기 정체' };
const teamSorts = { name: '팀 이름순', overdue: '마감 지연 많은 순', progress: '진행률 낮은 순' };
const metricDescriptions = {
  progress: '완료된 작업의 예상 작업량을 전체 예상 작업량으로 나눈 비율입니다. 실제 수행 시간이나 최종 기여도 점수가 아닙니다.',
  overdue: '마감 시각이 지난 할 일·진행 중·수정 중 작업입니다. 같은 작업이 지연과 정체에 함께 포함될 수 있습니다.',
  stale: '마지막 활동 후 48시간 이상 지난 진행 중·수정 중 작업입니다. 지연과 정체에 함께 포함될 수 있으며, 무임승차 판정이 아닙니다.',
};

function TeamProgress({ team }) {
  return team.completionRate == null
    ? <span className="dashboard-progress-empty">작업 없음</span>
    : <TeamProgressRing value={team.completionRate} label={`${team.teamName} 팀 전체 진행률`} compact />;
}

const taskCountFields = [
  ['todoTaskCount', '할 일'], ['inProgressTaskCount', '진행 중'],
  ['revisingTaskCount', '수정 중'], ['doneTaskCount', '완료'],
];

function TeamTaskCounts({ team, compact = false, includeDeliverables = false }) {
  return <dl className={`dashboard-task-counts ${compact ? 'dashboard-inline-counts dashboard-team-work-counts' : 'dashboard-work-counts'}`}>
    {taskCountFields.map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{team[field]}건</dd></div>)}
    {includeDeliverables && <div><dt>산출물</dt><dd>{team.deliverableCount}개</dd></div>}
  </dl>;
}

function TeamIdentityMeta({ team }) {
  return <div className="dashboard-team-meta">
    <span>리더 {team.leaderName}</span>
    <span>팀원 {team.approvedMemberCount}명</span>
  </div>;
}

function DashboardHelp({ label, description }) {
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({});
  const showHelp = (element) => {
    const rect = element.getBoundingClientRect();
    setPosition({ position: 'fixed', left: Math.max(12, Math.min(rect.left, window.innerWidth - 272)), top: Math.min(rect.bottom + 6, window.innerHeight - 180) });
    setOpen(true);
  };
  return <span className="dashboard-help" onMouseEnter={(event) => showHelp(event.currentTarget)}
    onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setOpen(false); }}
    onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
    <button type="button" aria-label={`${label} 집계 기준`} aria-describedby={open ? descriptionId : undefined}
      onFocus={(event) => showHelp(event.currentTarget)} onBlur={() => setOpen(false)} onClick={(event) => showHelp(event.currentTarget)}>
      <CircleHelp size={15} aria-hidden="true" />
    </button>
    {open && createPortal(<span className="dashboard-summary-tooltip" style={position} role="tooltip" id={descriptionId}>{description}</span>, document.body)}
  </span>;
}

export default function ManagerDashboard({ context }) {
  const guide = usePreviewGuide();
  const guidedManager = guide?.guiding && guide.scenarioId === 'team-management' && context.manager;
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const teamId = params.get('teamId') || '';
  const navigate = useAppNavigate();
  const resource = useResource(() => getManagerDashboard(context.space.id, teamId), [context.space.id, teamId, guide?.scope]);
  const dashboard = resource.data;
  const selectedTeam = dashboard?.teams.find((team) => String(team.teamId) === teamId);
  const reportManagerState = guide?.setManagerState;
  useEffect(() => {
    if (!guidedManager) return;
    reportManagerState(!resource.loading && !resource.error && selectedTeam ? { kind: 'team', team: selectedTeam } : null);
    return () => reportManagerState(null);
  }, [guidedManager, reportManagerState, resource.loading, resource.error, selectedTeam]);
  const selectedTeamName = selectedTeam?.teamName || context.teams.find((team) => String(team.id) === teamId)?.name || '팀 상세';
  const teamQuery = params.get('teamQuery') || '';
  const teamFilter = Object.hasOwn(teamFilters, params.get('teamFilter')) ? params.get('teamFilter') : 'all';
  const teamSort = Object.hasOwn(teamSorts, params.get('teamSort')) ? params.get('teamSort') : 'name';
  const listConditionsChanged = Boolean(teamQuery || teamFilter !== 'all' || teamSort !== 'name');
  const visibleTeams = (dashboard?.teams || []).filter((team) => {
    const matchesQuery = `${team.teamName} ${team.leaderName}`.toLocaleLowerCase('ko').includes(teamQuery.trim().toLocaleLowerCase('ko'));
    const matchesFilter = teamFilter === 'all' || (teamFilter === 'overdue' && team.overdueTaskCount > 0)
      || (teamFilter === 'stale' && team.staleTaskCount > 0) || (teamFilter === 'revising' && team.revisingTaskCount > 0)
      || (teamFilter === 'applications' && team.pendingApplications > 0);
    return matchesQuery && matchesFilter;
  }).sort((first, second) => {
    if (teamSort === 'overdue' && first.overdueTaskCount !== second.overdueTaskCount) return second.overdueTaskCount - first.overdueTaskCount;
    if (teamSort === 'progress' && first.completionRate !== second.completionRate) {
      if (first.completionRate == null) return 1;
      if (second.completionRate == null) return -1;
      return Number(first.completionRate) - Number(second.completionRate);
    }
    return first.teamName.localeCompare(second.teamName, 'ko');
  });
  const changeListCondition = (name, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value); else next.delete(name);
    setParams(next, { replace: true, preventScrollReset: true, state: { dashboardListScrollY: location.state?.dashboardListScrollY || 0 } });
  };
  const resetListConditions = () => {
    const next = new URLSearchParams(params);
    ['teamQuery', 'teamFilter', 'teamSort'].forEach((name) => next.delete(name));
    setParams(next, { replace: true, preventScrollReset: true, state: { dashboardListScrollY: location.state?.dashboardListScrollY || 0 } });
  };
  const selectTeam = (nextTeamId) => {
    const next = new URLSearchParams(params);
    next.delete('tab');
    if (nextTeamId) next.set('teamId', String(nextTeamId));
    else { next.delete('teamId'); next.delete('tab'); }
    const listScrollY = teamId ? location.state?.dashboardListScrollY || 0 : window.scrollY;
    setParams(next, { state: { dashboardListScrollY: listScrollY, restoreScrollY: nextTeamId ? 0 : listScrollY } });
  };
  const openTeamFromRow = (event, id) => {
    if (event.defaultPrevented || event.target.closest('button, a, input, select, textarea, summary, [role="button"], [role="tooltip"]')
      || window.getSelection()?.isCollapsed === false) return;
    selectTeam(id);
  };
  const openMember = (id, userId) => navigate(`${spacePath(context.space.id)}/manager/teams/${id}/members/${userId}`, {
    state: { dashboardSearch: params.toString(), dashboardListScrollY: location.state?.dashboardListScrollY || 0, dashboardScrollY: window.scrollY },
  });
  return <section className="stack space-operation-page manager-dashboard">
    {teamId && <button type="button" className="ghost-button dashboard-back" onClick={() => selectTeam('')}>← 팀 목록</button>}
    <div className="page-heading page-heading--compact dashboard-page-heading">
      <div><h1>{teamId ? selectedTeamName : '팀 관리'}</h1></div>
      <div className="dashboard-heading-actions">
        {selectedTeam && <ManagerTeamLinks spaceId={context.space.id} teamId={selectedTeam.teamId}
          dashboardSearch={params.toString()} dashboardListScrollY={location.state?.dashboardListScrollY || 0} />}
        <RefreshButton label="현황 새로고침" disabled={resource.loading} onClick={resource.reload} />
      </div>
    </div>
    <ResourceState resource={resource} label="팀 현황">
      {dashboard && <>
        {teamId && !selectedTeam && <EmptyState>팀 정보를 찾을 수 없습니다. 팀 목록에서 다시 선택해 주세요.</EmptyState>}
        {teamId && <div className="dashboard-detail-panel">
          {selectedTeam && <>
            <section className="dashboard-work-overview" aria-label="선택한 팀 정보">
              <div className="dashboard-work-progress"><h2>팀 진행률 <DashboardHelp label="팀 진행률" description={metricDescriptions.progress} /></h2><TeamProgress team={selectedTeam} /></div>
              <TeamTaskCounts team={selectedTeam} includeDeliverables />
            </section>
            <div className="dashboard-team-notices">
              <div className="dashboard-work-notices" aria-label="확인할 작업">
                {selectedTeam.overdueTaskCount > 0 && <span className="dashboard-signal signal-overdue">마감 지연 {selectedTeam.overdueTaskCount}건 <DashboardHelp label="마감 지연" description={metricDescriptions.overdue} /></span>}
                {selectedTeam.staleTaskCount > 0 && <span className="dashboard-signal signal-stale">장기 정체 {selectedTeam.staleTaskCount}건 <DashboardHelp label="장기 정체" description={metricDescriptions.stale} /></span>}
                {!selectedTeam.overdueTaskCount && !selectedTeam.staleTaskCount && <span>지연·정체 작업 없음</span>}
              </div>
              {(selectedTeam.pendingApplications > 0 || selectedTeam.hasMinimumMembers === false) && <div className="dashboard-membership-notices" aria-label="팀 참여 현황">
                {selectedTeam.pendingApplications > 0 && <span>가입 대기 {selectedTeam.pendingApplications}명</span>}
                {selectedTeam.hasMinimumMembers === false && <span>작업 진행에 팀원 2명 이상 필요</span>}
              </div>}
            </div>
          </>}
            {(teamId ? dashboard.teams : [])
              .filter((team) => String(team.teamId) === teamId && team.members)
              .map((team) => (
                <section
                  className="panel dashboard-member-overview"
                  key={team.teamId}
                >
                  <h2>팀원 수행 현황</h2>
                  <div className="table-scroll desktop-data-table">
                    <table className="data-table dashboard-members-table">
                      <caption className="sr-only">
                        {team.teamName} 팀원 수행 현황
                      </caption>
                      <thead>
                        <tr>
                          <th>팀원</th>
                          <th>담당 작업</th>
                          <th>완료 작업 비중 <DashboardHelp label="완료 작업 비중" description="현재 팀원의 완료 작업에서 예상 작업량과 담당 비율을 반영한 각자의 몫입니다. 최종 기여도 점수가 아닙니다." /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {team.members.map((member) => (
                          <tr key={member.userId}>
                            <th scope="row">
                              <button type="button" className="dashboard-member-link" data-guide-manager-member={member.userId} aria-label={`${member.name} 수행 상세`}
                                title={`${member.name} 수행 상세 보기`} onClick={() => openMember(team.teamId, member.userId)}>
                                <span>{member.name}</span><ArrowUpRight size={14} aria-hidden="true" />
                              </button>
                            </th>
                            <td>
                              <div className="dashboard-member-work">
                                <span className="dashboard-member-assigned">담당 <strong>{member.assignedTaskCount}건</strong></span>
                                {member.assignedTaskCount > 0 ? <dl className="dashboard-task-counts dashboard-inline-counts dashboard-member-task-counts">
                                  <div><dt>진행 중</dt><dd>{member.inProgressTaskCount}</dd></div>
                                  <div><dt>수정 중</dt><dd>{member.revisingTaskCount}</dd></div>
                                  <div><dt>완료</dt><dd>{member.doneTaskCount}</dd></div>
                                </dl> : <span className="dashboard-member-empty">배정된 작업 없음</span>}
                              </div>
                            </td>
                            <td className="dashboard-numeric-cell">
                              <span className={`dashboard-member-share${completedWorkShare(member, team.members) == null ? ' is-empty' : ''}`}>
                                {formatPercent(completedWorkShare(member, team.members), '완료 작업 없음')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mobile-data-cards">
                    {team.members.map((member) => (
                      <article key={member.userId}>
                        <h3>{member.name}</h3>
                        <dl className="card-facts">
                          <div>
                            <dt>담당 / 진행 / 수정 중 / 완료</dt>
                            <dd>
                              {member.assignedTaskCount} /{' '}
                              {member.inProgressTaskCount} /{' '}
                              {member.revisingTaskCount} /{' '}
                              {member.doneTaskCount}건
                            </dd>
                          </div>
                        </dl>
                        <details className="member-extra-facts">
                          <summary>완료 비중·계산 기준</summary>
                          <dl className="card-facts">
                            <div>
                              <dt>완료 작업 비중</dt>
                              <dd>
                                {formatPercent(
                                  completedWorkShare(member, team.members),
                                  '완료 작업 없음',
                                )}
                              </dd>
                            </div>
                          </dl>
                          <p className="field-help">
                            예상 작업량과 담당 비율을 반영한 현재 팀원의 완료
                            작업 비중입니다. 최종 기여도 점수가 아닙니다.
                          </p>
                        </details>
                        <button
                          className="secondary-button"
                          data-guide-manager-member={member.userId}
                          onClick={() =>
                            openMember(team.teamId, member.userId)
                          }
                        >
                          {member.name} 수행 상세
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              ))}

        </div>}
            {!teamId && (
              <section className="panel dashboard-team-overview">
                <div className="dashboard-team-list-header">
                {dashboard.teams.length > 0 && (
                    <div
                      className="dashboard-list-toolbar"
                      role="group"
                      aria-label="팀 목록 조건"
                    >
                      <Field label="팀·리더 검색">
                        <input
                          type="search"
                          value={teamQuery}
                          placeholder="팀 이름 또는 리더 이름"
                          onChange={(event) =>
                            changeListCondition('teamQuery', event.target.value)
                          }
                        />
                      </Field>
                      <Field label="팀 상태">
                        <select
                          value={teamFilter}
                          onChange={(event) =>
                            changeListCondition(
                              'teamFilter',
                              event.target.value === 'all'
                                ? ''
                                : event.target.value,
                            )
                          }
                        >
                          {Object.entries(teamFilters).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="팀 정렬">
                        <select
                          value={teamSort}
                          onChange={(event) =>
                            changeListCondition(
                              'teamSort',
                              event.target.value === 'name'
                                ? ''
                                : event.target.value,
                            )
                          }
                        >
                          {Object.entries(teamSorts).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {listConditionsChanged && (
                        <button
                          className="ghost-button"
                          onClick={resetListConditions}
                        >
                          목록 조건 초기화
                        </button>
                      )}
                    </div>
                )}
                </div>
                {dashboard.teams.length > 0 && <div className="dashboard-quick-filters" role="group" aria-label="팀 빠른 필터">
                  {Object.keys(quickFilterLabels).map((value) => (
                    <button type="button" key={value} aria-pressed={teamFilter === value}
                      onClick={() => changeListCondition('teamFilter', value === 'all' ? '' : value)}>
                      {quickFilterLabels[value]}
                    </button>
                  ))}
                </div>}
                {dashboard.teams.length > 0 && (
                    <div className="dashboard-list-context">
                      <span role="status">
                        목록 {visibleTeams.length} / {dashboard.teams.length}팀
                      </span>

                    </div>
                )}
                {visibleTeams.length ? (
                  <div className="table-scroll desktop-data-table">
                    <table className="data-table dashboard-teams-table">
                      <caption className="sr-only">팀 관리</caption>
                      <thead>
                        <tr>
                          <th>팀</th>
                          <th>팀 진행률 <DashboardHelp label="팀 진행률" description={metricDescriptions.progress} /></th>
                          <th>작업 현황</th>
                          <th>확인 사항 <DashboardHelp label="확인 사항" description={<>
                            마감 지연: 마감 시각이 지난 할 일·진행 중·수정 중 작업입니다.<br /><br />
                            장기 정체: 마지막 활동 후 48시간 이상 지난 진행 중·수정 중 작업입니다.
                          </>} /></th>
                          <th>산출물</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTeams.map((team) => (
                          <tr key={team.teamId} className="dashboard-team-row" data-guide-manager-team-row={team.teamId} onClick={(event) => openTeamFromRow(event, team.teamId)}>
                            <th scope="row">
                              <button
                                className="table-name-button"
                                data-guide-manager-team={team.teamId}
                                aria-label={`${team.teamName} 현황 보기`}
                                onClick={() => selectTeam(team.teamId)}
                              >
                                <span className="dashboard-team-name" title={team.teamName}>{team.teamName}</span><ChevronRight className="dashboard-team-open-icon" size={14} aria-hidden="true" />
                              </button>
                              <TeamIdentityMeta team={team} />
                            </th>
                            <td>
                              <TeamProgress team={team} />
                            </td>
                            <td>
                              <TeamTaskCounts team={team} compact />
                            </td>
                            <td>{team.overdueTaskCount > 0 || team.staleTaskCount > 0 ? <dl className="dashboard-work-signals">
                              {team.overdueTaskCount > 0 && <div className="signal-overdue"><dt>마감 지연</dt><dd>{team.overdueTaskCount}건</dd></div>}
                              {team.staleTaskCount > 0 && <div className="signal-stale"><dt>장기 정체</dt><dd>{team.staleTaskCount}건</dd></div>}
                            </dl> : <span className="dashboard-no-signal" aria-label="지연·정체 없음">—</span>}</td>
                            <td className="dashboard-numeric-cell">{team.deliverableCount}개</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState>
                    {dashboard.teams.length ? (
                      <>
                        <p>조건에 맞는 팀이 없습니다.</p>
                        <button
                          className="secondary-button"
                          onClick={resetListConditions}
                        >
                          목록 조건 초기화
                        </button>
                      </>
                    ) : (
                      '생성된 팀이 없습니다.'
                    )}
                  </EmptyState>
                )}
                <div className="mobile-data-cards">
                  {visibleTeams.map((team) => (
                    <article key={team.teamId} className="dashboard-team-card" data-guide-manager-team-row={team.teamId} onClick={(event) => openTeamFromRow(event, team.teamId)}>
                      <h3>
                        <button
                          className="table-name-button"
                          data-guide-manager-team={team.teamId}
                          aria-label={`${team.teamName} 현황 보기`}
                          onClick={() => selectTeam(team.teamId)}
                        >
                          {team.teamName}
                        </button>
                      </h3>
                      <TeamIdentityMeta team={team} />
                      <dl className="card-facts">
                        <div>
                          <dt>팀 진행률 <DashboardHelp label="팀 진행률" description={metricDescriptions.progress} /></dt>
                          <dd>
                            <TeamProgress team={team} />
                          </dd>
                        </div>
                        <div>
                          <dt>마감 지연 <DashboardHelp label="마감 지연" description={metricDescriptions.overdue} /></dt>
                          <dd>{team.overdueTaskCount}건</dd>
                        </div>
                        <div>
                          <dt>장기 정체 <DashboardHelp label="장기 정체" description={metricDescriptions.stale} /></dt>
                          <dd>{team.staleTaskCount}건</dd>
                        </div>
                      </dl>
                      <TeamTaskCounts team={team} compact />
                      <details>
                        <summary>산출물·팀 참여 상태</summary>
                        <p>
                          산출물 {team.deliverableCount}개 · 가입 대기{' '}
                          {team.pendingApplications}명
                        </p>
                      </details>
                    </article>
                  ))}
                </div>
              </section>
            )}

      </>}
    </ResourceState>
  </section>;
}
