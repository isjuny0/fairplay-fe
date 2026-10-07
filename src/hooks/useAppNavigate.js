import { useLocation, useNavigate } from 'react-router';
import { isPreviewPath } from '../mock/preview.js';

export default function useAppNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = isPreviewPath(location.pathname) ? '/preview' : '';
  return (target, options) => {
    if (typeof target === 'number') return navigate(target);
    const path = typeof target === 'string' ? target : target.pathname;
    const nextPath = prefix && !isPreviewPath(path) ? prefix + path : path;
    return navigate(
      typeof target === 'string' ? nextPath : { ...target, pathname: nextPath },
      options,
    );
  };
}
