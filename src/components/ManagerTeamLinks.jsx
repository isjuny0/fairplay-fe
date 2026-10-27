import { useLocation } from 'react-router';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { spacePath, teamMenuPath } from '../lib/routes.js';
import '../manager-team-links.css';

export default function ManagerTeamLinks({ spaceId, teamId, activeMenu, dashboardSearch, dashboardListScrollY }) {
  const location = useLocation();
  const navigate = useAppNavigate();
  const dashboardState = {
    dashboardSearch: dashboardSearch || location.state?.dashboardSearch || `teamId=${teamId}`,
    dashboardListScrollY: dashboardListScrollY ?? location.state?.dashboardListScrollY ?? 0,
    dashboardScrollY: activeMenu ? location.state?.dashboardScrollY || 0 : window.scrollY,
  };
  return <nav className="manager-team-links" aria-label="팀 조회 바로가기">
    {activeMenu && <button type="button" className="ghost-button" onClick={() => navigate(
      `${spacePath(spaceId)}/dashboard?${dashboardState.dashboardSearch}`,
      { state: { dashboardListScrollY: dashboardState.dashboardListScrollY, restoreScrollY: dashboardState.dashboardScrollY } },
    )}>← 팀 현황</button>}
    {[[ '작업', '작업 보기' ], [ '산출물', '산출물 보기' ]].map(([menu, label]) => <button
      type="button" key={menu} className="secondary-button" aria-current={activeMenu === menu ? 'page' : undefined}
      onClick={() => { if (activeMenu !== menu) navigate(teamMenuPath(spaceId, teamId, menu), { state: dashboardState }); }}>
      {label}
    </button>)}
  </nav>;
}
