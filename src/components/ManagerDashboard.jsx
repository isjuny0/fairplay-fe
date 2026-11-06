import DetailBackButton from './DetailBackButton.jsx';
import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, CircleHelp } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router';
import '../manager-dashboard.css';
import RefreshButton from './RefreshButton.jsx';
import Icon from './Icon.jsx';
import TeamProgressRing from './TeamProgressRing.jsx';
import ManagerTeamLinks from './ManagerTeamLinks.jsx';
import { getManagerDashboard } from '../api/dashboard.js';
import useResource from '../hooks/useResource.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { spacePath } from '../lib/routes.js';
import { completedWorkShare, formatPercent } from '../lib/evaluation.js';
import { EmptyState, ResourceState } from './ui.jsx';

const quickFilterLabels = { all: '전체 팀', overdue: '마감 지연' };
const metricDescriptions = {
  progress: '팀 전체 작업량 중 완료한 작업량의 비율입니다. 예상 작업량이 큰 작업을 완료할수록 진행률도 더 많이 올라갑니다.',
  overdue: '마감 시각이 지난 할 일·진행 중·수정 중 작업입니다.',
  workShare: '현재 팀원들의 완료 작업량을 100%로 보았을 때, 이 팀원이 맡은 몫입니다. 작업별 예상 작업량과 담당 비율을 반영하며, 최종 평가 점수와는 별개입니다.',
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

function TeamTaskCounts({ team, compact = false, includeOverdue = false }) {
  return <dl className={`dashboard-task-counts ${compact ? 'dashboard-inline-counts dashboard-team-work-counts' : 'dashboard-work-counts'}${includeOverdue ? ' has-overdue-count' : ''}`}>
    {taskCountFields.map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{team[field]}건</dd></div>)}
    {includeOverdue && <div className={team.overdueTaskCount > 0 ? 'dashboard-count-overdue' : undefined}><dt>지연</dt><dd>{team.overdueTaskCount}건</dd></div>}
  </dl>;
}

function TeamIdentityMeta({ team }) {
  return <div className="dashboard-team-meta">
    <span>리더 {team.leaderName}</span>
    <span>팀원 {team.approvedMemberCount}명</span>
  </div>;
}

function MemberTaskCounts({ member }) {
  return <dl className="dashboard-task-counts dashboard-member-task-counts">
    {[
      ['assignedTaskCount', '담당'], ['inProgressTaskCount', '진행 중'],
      ['revisingTaskCount', '수정 중'], ['doneTaskCount', '완료'],
      ['overdueTaskCount', '지연'],
    ].map(([field, label]) => <div key={field} className={field === 'overdueTaskCount' && member[field] > 0 ? 'dashboard-count-overdue' : undefined}><dt>{label}</dt><dd>{member[field]}건</dd></div>)}
  </dl>;
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
  const teamFilter = Object.hasOwn(quickFilterLabels, params.get('teamFilter')) ? params.get('teamFilter') : 'all';
  const visibleTeams = (dashboard?.teams || []).filter((team) => {
    const matchesQuery = `${team.teamName} ${team.leaderName}`.toLocaleLowerCase('ko').includes(teamQuery.trim().toLocaleLowerCase('ko'));
    const matchesFilter = teamFilter === 'all' || (teamFilter === 'overdue' && team.overdueTaskCount > 0);
    return matchesQuery && matchesFilter;
  }).sort((first, second) => first.teamName.localeCompare(second.teamName, 'ko'));
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
  const openMemberFromRow = (event, id, userId) => {
    if (event.defaultPrevented || event.target.closest('button, a, input, select, textarea, summary, [role="button"], [role="tooltip"]')
      || window.getSelection()?.isCollapsed === false) return;
    openMember(id, userId);
  };
  return <section className={`stack space-operation-page manager-dashboard${teamId ? ' manager-dashboard--team' : ''}`}>
    {teamId && <DetailBackButton onClick={() => selectTeam('')}>팀 목록</DetailBackButton>}
    <div className="page-heading page-heading--compact dashboard-page-heading">
      <div><h1>{teamId ? selectedTeamName : '팀 관리'}</h1></div>
      {teamId && <div className="dashboard-heading-actions">
        {selectedTeam && <ManagerTeamLinks spaceId={context.space.id} teamId={selectedTeam.teamId}
          materialCount={selectedTeam.deliverableCount} dashboardSearch={params.toString()} dashboardListScrollY={location.state?.dashboardListScrollY || 0} />}
        <RefreshButton label="현황 새로고침" disabled={resource.loading} onClick={resource.reload} />
      </div>}
    </div>
    <ResourceState resource={resource} label="팀 현황">
      {dashboard && <>
        {teamId && !selectedTeam && <EmptyState>팀 정보를 찾을 수 없습니다. 팀 목록에서 다시 선택해 주세요.</EmptyState>}
        {teamId && <div className="dashboard-detail-panel">
          {selectedTeam && <>
            <section className="dashboard-work-overview" aria-label="선택한 팀 정보">
              <div className="dashboard-work-progress"><h2>팀 진행률 <DashboardHelp label="팀 진행률" description={metricDescriptions.progress} /></h2><TeamProgress team={selectedTeam} /></div>
              <TeamTaskCounts team={selectedTeam} includeOverdue />
              {(selectedTeam.pendingApplications > 0 || selectedTeam.hasMinimumMembers === false) && <div className="dashboard-team-notices">
                <div className="dashboard-membership-notices" aria-label="팀 참여 현황">
                  {selectedTeam.pendingApplications > 0 && <span>가입 대기 {selectedTeam.pendingApplications}명</span>}
                  {selectedTeam.hasMinimumMembers === false && <span>작업 진행에 팀원 2명 이상 필요</span>}
                </div>
              </div>}
            </section>
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
                          <th>완료 작업 비중 <DashboardHelp label="완료 작업 비중" description={metricDescriptions.workShare} /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {team.members.map((member) => (
                          <tr key={member.userId} className="dashboard-member-row"
                            onClick={(event) => openMemberFromRow(event, team.teamId, member.userId)}>
                            <th scope="row">
                              <button type="button" className="dashboard-member-link" data-guide-manager-member={member.userId} aria-label={`${member.name} 수행 상세`}
                                title={`${member.name} 수행 상세 보기`} onClick={() => openMember(team.teamId, member.userId)}>
                                <span>{member.name}</span>
                              </button>
                            </th>
                            <td>
                              <MemberTaskCounts member={member} />
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
                      <article key={member.userId} className="dashboard-member-card"
                        onClick={(event) => openMemberFromRow(event, team.teamId, member.userId)}>
                        <h3><button type="button" className="dashboard-member-link" data-guide-manager-member={member.userId}
                          aria-label={`${member.name} 수행 상세`} onClick={() => openMember(team.teamId, member.userId)}>
                          <span>{member.name}</span>
                        </button></h3>
                        <MemberTaskCounts member={member} />
                        <div className="dashboard-mobile-member-share">
                          <span>완료 작업 비중 <DashboardHelp label="완료 작업 비중" description={metricDescriptions.workShare} /></span>
                          <span className={`dashboard-member-share${completedWorkShare(member, team.members) == null ? ' is-empty' : ''}`}>
                            {formatPercent(completedWorkShare(member, team.members), '완료 작업 없음')}
                          </span>
                        </div>
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
                      <label className="form-field">
                        <span className="sr-only">팀·리더 검색</span>
                        <span className="dashboard-team-search">
                          <Icon name="search" />
                          <input
                            type="search"
                            value={teamQuery}
                            placeholder="팀 이름 또는 리더 이름"
                            onChange={(event) =>
                              changeListCondition('teamQuery', event.target.value)
                            }
                          />
                        </span>
                      </label>
                      <div className="dashboard-quick-filters" role="group" aria-label="팀 빠른 필터">
                        {Object.keys(quickFilterLabels).map((value) => (
                          <button type="button" key={value} aria-pressed={teamFilter === value}
                            onClick={() => changeListCondition('teamFilter', value === 'all' ? '' : value)}>
                            {quickFilterLabels[value]}
                          </button>
                        ))}
                      </div>
                    </div>
                )}
                </div>

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
                          <th>자료</th>
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
                              <TeamTaskCounts team={team} compact includeOverdue />
                            </td>
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
                      </dl>
                      <TeamTaskCounts team={team} compact />
                      <details>
                        <summary>자료·팀 참여 상태</summary>
                        <p>
                          자료 {team.deliverableCount}개 · 가입 대기{' '}
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
