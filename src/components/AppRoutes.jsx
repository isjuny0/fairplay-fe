import { Navigate, Route, Routes, useParams } from 'react-router';
import { parseRouteId, spacePath, teamMenuPaths } from '../lib/routes.js';
import Spaces from './Spaces.jsx';
import SpaceWorkspace from './SpaceWorkspace.jsx';
import UnavailablePage from './UnavailablePage.jsx';
import useAppNavigate from '../hooks/useAppNavigate.js';

function WorkspaceRoute({ user, view = 'teams', teamMenu = '팀 홈' }) {
  const params = useParams();
  const navigate = useAppNavigate();
  const spaceId = parseRouteId(params.spaceId);
  const teamId = params.teamId == null ? null : parseRouteId(params.teamId);
  const taskId = params.taskId == null ? null : parseRouteId(params.taskId);
  if (
    spaceId == null ||
    (params.teamId != null && teamId == null) ||
    (params.taskId != null && taskId == null)
  )
    return (
      <main className="main-content">
        <UnavailablePage />
      </main>
    );
  return (
    <SpaceWorkspace
      key={spaceId}
      spaceId={spaceId}
      teamId={teamId}
      taskId={taskId}
      user={user}
      view={view}
      teamMenu={teamMenu}
      targetUserId={params.targetUserId}
      onBack={() => navigate('/main')}
    />
  );
}

function SpacesRoute() {
  const navigate = useAppNavigate();
  return (
    <main className="main-content spaces-main">
      <Spaces onSelect={(id) => navigate(spacePath(id))} />
    </main>
  );
}

export default function AppRoutes({ user, prefix = '' }) {
  return (
    <Routes>
      <Route
        path={prefix || '/'}
        element={<Navigate to={`${prefix}/main`} replace />}
      />
      <Route path={`${prefix}/main`} element={<SpacesRoute />} />
      <Route
        path={`${prefix}/spaces/:spaceId`}
        element={<WorkspaceRoute user={user} />}
      />
      <Route
        path={`${prefix}/spaces/:spaceId/settings`}
        element={<WorkspaceRoute user={user} view="settings" />}
      />
      {Object.entries(teamMenuPaths).map(([menu, segment]) => (
        <Route
          key={menu}
          path={`${prefix}/spaces/:spaceId/teams/:teamId${segment ? `/${segment}` : ''}`}
          element={<WorkspaceRoute user={user} view="team" teamMenu={menu} />}
        />
      ))}
      <Route
        path={`${prefix}/spaces/:spaceId/teams/:teamId/tasks/:taskId`}
        element={
          <WorkspaceRoute user={user} view="team" teamMenu="작업 보드" />
        }
      />
      <Route
        path={`${prefix}/spaces/:spaceId/teams/:teamId/approvals/tasks/:taskId`}
        element={
          <WorkspaceRoute user={user} view="team" teamMenu="승인 검토" />
        }
      />
      {['dashboard', 'rounds', 'reports'].map((view) => (
        <Route
          key={view}
          path={`${prefix}/spaces/:spaceId/${view}`}
          element={<WorkspaceRoute user={user} view={view} />}
        />
      ))}
      <Route
        path={`${prefix}/spaces/:spaceId/manager/teams/:teamId/members/:targetUserId`}
        element={<WorkspaceRoute user={user} view="contributions" />}
      />
      <Route
        path="*"
        element={
          <main className="main-content">
            <UnavailablePage />
          </main>
        }
      />
    </Routes>
  );
}
