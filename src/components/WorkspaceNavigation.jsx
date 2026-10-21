import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import useAppNavigate from '../hooks/useAppNavigate.js';
import useSpaceList from '../hooks/useSpaceList.js';
import { isApprovedMember } from '../lib/domain.js';
import { spacePath, teamMenuPath } from '../lib/routes.js';
import {
  availableTeamMenus,
  teamNavigationGroups,
} from '../lib/teamNavigation.js';
import Icon from './Icon.jsx';
import { ErrorNotice } from './ui.jsx';
import WorkspaceContextSelect from './WorkspaceContextSelect.jsx';

const sidebarPreferenceKey = 'fairplay:workspace-sidebar-collapsed';

function readSidebarPreference() {
  try {
    return window.localStorage.getItem(sidebarPreferenceKey) === 'true';
  } catch {
    return false;
  }
}

export default function WorkspaceNavigation({
  space,
  spaceId,
  teams,
  team,
  view,
  teamMenu,
  teamRole,
  user,
  onBack,
}) {
  const navigate = useAppNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readSidebarPreference);
  const [desktopLayout, setDesktopLayout] = useState(
    () => window.matchMedia('(min-width: 721px)').matches,
  );
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 721px)');
    const updateLayout = () => setDesktopLayout(query.matches);
    updateLayout();
    query.addEventListener('change', updateLayout);
    return () => query.removeEventListener('change', updateLayout);
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(sidebarPreferenceKey, String(collapsed));
    } catch {
      // Keep the control usable when browser storage is unavailable.
    }
  }, [collapsed]);
  const spaces = useSpaceList(user.id);
  const isManager = space?.myRole === 'MANAGER';
  const selectedTeam = team || teams.find(isApprovedMember);
  const menus = team ? availableTeamMenus(team) : [];
  const navButton = (label, icon, destination, active) => (
    <button
      key={label}
      className={`nav-item ${active ? 'active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={() => {
        setOpen(false);
        navigate(destination);
      }}
    >
      <Icon name={icon} />
      <span className="nav-item-label" title={label}>
        {label}
      </span>
    </button>
  );
  const sidebarCollapsed = desktopLayout && collapsed;
  return (
    <>
      <aside
        className={`sidebar workspace-sidebar ${open ? 'is-mobile-open' : ''} ${sidebarCollapsed ? 'is-collapsed' : ''}`}
        aria-hidden={sidebarCollapsed || undefined}
        inert={sidebarCollapsed ? '' : undefined}
      >
      <button
        className="mobile-space-toggle"
        aria-expanded={open}
        aria-controls="workspace-navigation"
        aria-label={`스페이스 메뉴 ${open ? '접기' : '펼치기'}`}
        onClick={() => setOpen(!open)}
      >
        <span className="mobile-workspace-context">
          <strong>{space?.name || '스페이스'}</strong>
          {team && (
            <span>
              {team.name} · {teamRole}
            </span>
          )}
        </span>
        <span>메뉴 {open ? '⌃' : '⌄'}</span>
      </button>
      <nav id="workspace-navigation" aria-label="스페이스 메뉴">
        <div className="workspace-navigation-context">
          <button
            className="nav-item workspace-back-link"
            onClick={() => {
              setOpen(false);
              onBack();
            }}
          >
            <Icon name="back" />내 스페이스
          </button>
          <div className="workspace-selectors">
            <WorkspaceContextSelect
              label="공간"
              accessibleLabel="스페이스 선택"
              icon="space"
              value={spaceId}
              disabled={spaces.loading && !spaces.data}
              options={[
                ...(!(spaces.data || []).some((item) => item.id === spaceId)
                  ? [{ value: spaceId, label: space?.name || '현재 스페이스' }]
                  : []),
                ...(spaces.data || []).map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
              onChange={(nextValue) => {
                setOpen(false);
                navigate(spacePath(Number(nextValue)));
              }}
            />
            <ErrorNotice error={spaces.error} onRetry={spaces.reload} />

          </div>
        </div>
        <div className="workspace-navigation-links">
          {navButton('스페이스 홈', 'space', spacePath(spaceId), view === 'teams')}
          {isManager && (
            <div className="workspace-nav-group manager-workspace-navigation">
              <p className="nav-section">스페이스 운영</p>
              {[
                ['dashboard', '관리자 대시보드', 'dashboard'],
                ['rounds', '평가 회차 관리', 'calendar'],
                ['reports', '리포트 검토·공개', 'chart'],
                ['settings', '스페이스 관리', 'settings'],
              ].map(([segment, label, icon]) =>
                navButton(
                  label,
                  icon,
                  `${spacePath(spaceId)}/${segment}`,
                  view === segment ||
                    (segment === 'dashboard' && view === 'contributions'),
                ),
              )}
            </div>
          )}
          {!team &&
            selectedTeam &&
            !isManager &&
            navButton(
              `내 팀 · ${selectedTeam.name}`,
              'team',
              teamMenuPath(spaceId, selectedTeam.id, '팀 홈'),
              false,
            )}
          {team && (isManager || isApprovedMember(team)) && (
            <nav className="desktop-team-navigation" aria-label="팀 메뉴">
              {!isApprovedMember(team) ? (
                <div className="workspace-nav-group">
                  <p className="nav-section">팀 자료 조회</p>
                  {menus.map((label) =>
                    navButton(
                      label,
                      label === '산출물' ? 'file' : 'member',
                      teamMenuPath(spaceId, team.id, label),
                      view === 'team' && teamMenu === label,
                    ),
                  )}
                </div>
              ) : (
                teamNavigationGroups.map((group, index) => {
                  const items = group.items.filter(([label]) =>
                    menus.includes(label),
                  );
                  return (
                    items.length > 0 && (
                      <div
                        className="workspace-nav-group"
                        data-navigation-group={group.label}
                        key={group.label || index}
                      >
                        {group.label && (
                          <p className="nav-section">{group.label}</p>
                        )}
                        {items.map(([label, icon]) =>
                          navButton(
                            label,
                            icon,
                            teamMenuPath(spaceId, team.id, label),
                            view === 'team' && teamMenu === label,
                          ),
                        )}
                      </div>
                    )
                  );
                })
              )}
            </nav>
          )}
        </div>
      </nav>
      </aside>
      <div
        className={`workspace-sidebar-rail ${sidebarCollapsed ? 'is-collapsed' : ''}`}
      >
        <button
          className="workspace-sidebar-toggle"
          type="button"
          aria-controls="workspace-navigation"
          aria-expanded={!sidebarCollapsed}
          aria-label={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          title={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          onClick={() => setCollapsed((value) => !value)}
        >
          <span
            className={`sidebar-toggle-glyph ${sidebarCollapsed ? 'is-collapsed' : 'is-expanded'}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </>
  );
}
