import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import * as previewRuntime from '../mock/preview.js';
import { getMockState } from '../mock/planned.js';
import { clearGuideSession } from '../mock/guide.js';
import Application from './Application.jsx';
import PreviewGuideProvider from './PreviewGuideProvider.jsx';

const runtime = { ...previewRuntime, getMockState };
const exhibitionSessionKey = 'fairplay:exhibition-guide';

export default function PreviewApplication() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const enteringExhibition = pathname === '/preview/exhibition';
  const enteringPreview = pathname === '/preview' || pathname === '/preview/';
  const [exhibition, setExhibition] = useState(() => {
    try { return sessionStorage.getItem(exhibitionSessionKey) === '1'; }
    catch { return false; }
  });

  useEffect(() => {
    if (enteringPreview) {
      clearGuideSession();
      try { sessionStorage.removeItem(exhibitionSessionKey); }
      catch { /* Explicit preview entry also works without storage. */ }
      setExhibition(false);
      navigate('/preview/main', { replace: true });
      return;
    }
    if (!enteringExhibition) return;
    clearGuideSession();
    try { sessionStorage.setItem(exhibitionSessionKey, '1'); }
    catch { /* The current preview still works without persistence. */ }
    setExhibition(true);
    navigate('/preview/main?guide=start', { replace: true });
  }, [enteringExhibition, enteringPreview, navigate]);

  const exitExhibition = () => {
    clearGuideSession();
    try { sessionStorage.removeItem(exhibitionSessionKey); }
    catch { /* There is no stored exhibition access to clear. */ }
    setExhibition(false);
  };

  if (enteringExhibition || enteringPreview) return null;
  if (!exhibition) return <Application previewRuntime={runtime} />;
  return (
    <PreviewGuideProvider onExit={exitExhibition}>
      <Application previewRuntime={runtime} onPreviewExit={exitExhibition} />
    </PreviewGuideProvider>
  );
}
