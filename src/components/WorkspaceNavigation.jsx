import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { ChevronDown } from 'lucide-react';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { isApprovedMember } from '../lib/domain.js';
import { announcementsPath, spacePath, teamMenuPath } from '../lib/routes.js';
import {
  availableTeamMenus,
  teamNavigationGroups,
} from '../lib/teamNavigation.js';
import Icon from './Icon.jsx';

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
  teamId,
  view,
  navigationView = view,
  teamMenu,
  teamRole,
  onBack,
}) {
  const navigate = useAppNavigate();
  const [open, setOpen] = useState(false);
  const mobileToggle = useRef(null);
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
  const isManager = space?.myRole === 'MANAGER';
  const selectedTeam = team || teams.find(isApprovedMember);
  const isTeamContext = navigationView === 'team';
  const navigationTeam = team || teams.find((entry) => String(entry.id) === String(teamId));
  const menus = navigationTeam ? availableTeamMenus(navigationTeam) : [];
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
  const currentMenuLabel = view === 'personal' ? '알림함' : view === 'team' ? (teamMenu === '팀 회의록' ? '회의록' : teamMenu) : ({ teams: '스페이스 홈', announcements: '공지사항', dashboard: '팀 관리', participants: '참여자 관리', rounds: '동료 평가 관리', reports: '리포트 관리', settings: '스페이스 관리', contributions: '수행 상세' }[view] || '메뉴');
  useEffect(() => {
    if (!open) return;
    const close = (event) => { if (event.key === 'Escape') { setOpen(false); mobileToggle.current?.focus(); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  return (
    <>
      <aside
        className={`sidebar workspace-sidebar ${view === 'personal' ? 'is-personal-context' : ''} ${open ? 'is-mobile-open' : ''} ${sidebarCollapsed ? 'is-collapsed' : ''}`}
        aria-hidden={sidebarCollapsed || undefined}
        inert={sidebarCollapsed ? '' : undefined}
      >
      <button
        className="mobile-space-toggle"
        ref={mobileToggle}
        aria-expanded={open}
        aria-controls="workspace-navigation"
        aria-label={`스페이스 메뉴 ${open ? '접기' : '펼치기'}`}
        onClick={() => setOpen(!open)}
      >
        <span className="mobile-workspace-context">
          <strong>{space?.name || '스페이스'}</strong>
          {team && (
            <span>
              {teamRole === '리더' ? team.name : `${team.name} · ${teamRole}`}
            </span>
          )}
        </span>
        <span className="mobile-menu-location">
          <span className="mobile-menu-current">{currentMenuLabel}</span>
          <span className="mobile-menu-action">메뉴</span>
          <ChevronDown size={14} aria-hidden="true" />
        </span>
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
        </div>
        <div className="workspace-navigation-links">
          {navButton('스페이스 홈', 'home', spacePath(spaceId), view === 'teams')}
          <div
            key={isTeamContext ? `team-${teamId}` : 'space'}
            className="workspace-navigation-contextual"
            data-navigation-context={isTeamContext ? 'team' : 'space'}
          >
            {!isTeamContext &&
              navButton('공지사항', 'announcement', announcementsPath(spaceId), view === 'announcements')}
            {isManager && (
              <div className="workspace-nav-group manager-workspace-navigation">
                <p className="nav-section">스페이스 운영</p>
                {[
                  ['dashboard', '팀 관리', 'dashboard'],
                  ['participants', '참여자 관리', 'users'],
                  ['rounds', '동료 평가 관리', 'calendar'],
                  ['reports', '리포트 관리', 'chart'],
                  ['settings', '스페이스 관리', 'settings'],
                ].map(([segment, label, icon]) =>
                  navButton(
                    label,
                    icon,
                    `${spacePath(spaceId)}/${segment}`,
                    view === segment ||
                      (segment === 'dashboard' && (view === 'contributions' || (view === 'team' && navigationTeam && !isApprovedMember(navigationTeam)))),
                  ),
                )}
              </div>
            )}
            {!isTeamContext &&
              selectedTeam &&
              !isManager &&
              navButton(
                `내 팀 · ${selectedTeam.name}`,
                'team',
                teamMenuPath(spaceId, selectedTeam.id, '팀 홈'),
                false,
              )}
            {isTeamContext && navigationTeam && isApprovedMember(navigationTeam) && (
              <nav className="desktop-team-navigation" aria-label="팀 메뉴">
                {teamNavigationGroups.map((group, index) => {
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
                              label === '팀 회의록' ? '회의록' : label,
                              icon,
                              teamMenuPath(spaceId, navigationTeam.id, label),
                              view === 'team' && teamMenu === label,
                            ),
                          )}
                        </div>
                      )
                    );
                  })}
              </nav>
            )}
          </div>
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
