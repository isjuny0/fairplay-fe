import { useLocation } from 'react-router';
import LandingPage from './components/LandingPage.jsx';
import { deferScreen } from './components/DeferredScreen.jsx';
import { isPreviewPath } from './lib/previewPath.js';
import Application from './components/Application.jsx';
import { preloadRoute } from './lib/routeScreens.js';

const PreviewApplication = deferScreen(async () => {
  const [screen] = await Promise.all([
    import('./components/PreviewApplication.jsx'),
    preloadRoute(window.location.pathname),
  ]);
  return screen;
}, '미리보기 화면');

export default function App() {
  const { pathname } = useLocation();
  if (pathname === '/') return <LandingPage />;
  if (!isPreviewPath(pathname)) return <Application />;
  return <PreviewApplication />;
}
