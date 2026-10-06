import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { parseRouteId, spacePath, teamMenuPaths } from '../lib/routes.js';
import Spaces from './Spaces.jsx';
import SpaceWorkspace from './SpaceWorkspace.jsx';
import UnavailablePage from './UnavailablePage.jsx';

function WorkspaceRoute({ user, view = 'teams', teamMenu = '팀 홈' }) {
  const params = useParams();
  const navigate = useNavigate();
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
      onBack={() => navigate('/main')}
    />
  );
}

function SpacesRoute() {
  const navigate = useNavigate();
  return (
    <main className="main-content spaces-main">
      <Spaces onSelect={(id) => navigate(spacePath(id))} />
    </main>
  );
}

export default function AppRoutes({ user }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/main" replace />} />
      <Route path="/main" element={<SpacesRoute />} />
      <Route path="/spaces/:spaceId" element={<WorkspaceRoute user={user} />} />
      <Route
        path="/spaces/:spaceId/settings"
        element={<WorkspaceRoute user={user} view="settings" />}
      />
      {Object.entries(teamMenuPaths).map(([menu, segment]) => (
        <Route
          key={menu}
          path={`/spaces/:spaceId/teams/:teamId${segment ? `/${segment}` : ''}`}
          element={<WorkspaceRoute user={user} view="team" teamMenu={menu} />}
        />
      ))}
      <Route
        path="/spaces/:spaceId/teams/:teamId/tasks/:taskId"
        element={
          <WorkspaceRoute user={user} view="team" teamMenu="작업 보드" />
        }
      />
      <Route
        path="/spaces/:spaceId/teams/:teamId/approvals/tasks/:taskId"
        element={
          <WorkspaceRoute user={user} view="team" teamMenu="승인 검토" />
        }
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
