const imports = {
  Spaces: () => import('../components/Spaces.jsx'),
  SpaceWorkspace: () => import('../components/SpaceWorkspace.jsx'),
  TeamWorkspace: () => import('../components/TeamWorkspace.jsx'),
  SpaceSettings: () => import('../components/SpaceSettings.jsx'),
  SpaceAnnouncements: () => import('../components/SpaceAnnouncements.jsx'),
  ManagerDashboard: () => import('../components/ManagerDashboard.jsx'),
  SpaceParticipants: () => import('../components/SpaceParticipants.jsx'),
  RoundManagement: () => import('../components/RoundManagement.jsx'),
  ReportReview: () => import('../components/ReportReview.jsx'),
  MemberContributions: () => import('../components/MemberContributions.jsx'),
  TeamHome: () => import('../components/TeamHome.jsx'),
  TeamRagSearch: () => import('../components/TeamRagSearch.jsx'),
  TaskBoard: () => import('../components/TaskBoard.jsx'),
  TaskDetail: () => import('../components/TaskDetail.jsx'),
  TaskForm: () => import('../components/TaskForm.jsx'),
  Deliverables: () => import('../components/Deliverables.jsx'),
  MeetingMinutes: () => import('../components/MeetingMinutes.jsx'),
  TeamMembers: () => import('../components/TeamMembers.jsx'),
  TeamSettings: () => import('../components/TeamSettings.jsx'),
  PeerEvaluation: () => import('../components/PeerEvaluation.jsx'),
  MidFeedback: () => import('../components/MidFeedback.jsx'),
  ContributionReport: () => import('../components/ContributionReport.jsx'),
};

// Reuse preloaded modules on first render instead of suspending again at every nested screen.
export const screenLoaders = Object.fromEntries(Object.entries(imports).map(([name, load]) => {
  let request;
  const loader = () => {
    request ??= load().then(module => {
      loader.component = module.default;
      return module;
    });
    return request;
  };
  return [name, loader];
}));

export function preloadRoute(pathname) {
  const path = pathname.replace(/^\/preview(?=\/|$)/, '');
  if (path === '/main') return screenLoaders.Spaces();
  if (!path.startsWith('/spaces/')) return Promise.resolve();
  const loaders = [screenLoaders.SpaceWorkspace];
  if (/\/teams\/\d+(?:\/|$)/.test(path) && !path.includes('/manager/')) {
    loaders.push(screenLoaders.TeamWorkspace);
    const menu = path.split('/')[5] || '';
    const screen = {
      'materials-search': 'TeamRagSearch',
      'meeting-minutes': 'MeetingMinutes',
      '': 'TeamHome', tasks: 'TaskBoard', deliverables: 'Deliverables',
      members: 'TeamMembers', settings: 'TeamSettings',
      'peer-evaluations': 'PeerEvaluation', 'mid-feedback': 'MidFeedback',
      reports: 'ContributionReport',
    }[menu];
    if (screen) loaders.push(screenLoaders[screen]);
    if (/\/tasks\/\d+$/.test(path)) loaders.push(screenLoaders.TaskDetail);
  } else {
    const screen = path.includes('/manager/') ? 'MemberContributions' : {
      dashboard: 'ManagerDashboard', participants: 'SpaceParticipants', rounds: 'RoundManagement',
      reports: 'ReportReview', settings: 'SpaceSettings',
      announcements: 'SpaceAnnouncements',
    }[path.split('/')[3]];
    if (screen) loaders.push(screenLoaders[screen]);
  }
  return Promise.all(loaders.map(load => load()));
}
