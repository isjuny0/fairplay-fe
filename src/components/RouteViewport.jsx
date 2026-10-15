import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

export default function RouteViewport() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map());
  const previousPath = useRef(null);

  useLayoutEffect(() => {
    const path = location.pathname + location.search;
    const changedPage = previousPath.current?.pathname !== location.pathname;
    const restoredPosition =
      navigationType === 'POP'
        ? positions.current.get(location.key)
        : location.state?.restoreScrollY;
    const shouldRestore = restoredPosition != null;
    const shouldMove =
      changedPage ||
      (navigationType === 'POP' && previousPath.current?.path !== path) ||
      shouldRestore;
    previousPath.current = { pathname: location.pathname, path };
    let lastPosition = window.scrollY;
    const recordPosition = () => {
      lastPosition = window.scrollY;
    };
    window.addEventListener('scroll', recordPosition, { passive: true });
    let observer;
    let timeout;
    if (shouldMove) {
      const targetPosition = shouldRestore ? restoredPosition : 0;
      window.scrollTo({ top: targetPosition, behavior: 'instant' });
      const finish = () => {
        const main = document.querySelector('main');
        const title = main?.querySelector('h1');
        if (
          !title ||
          main.querySelector('.loading-placeholder') ||
          document.querySelector('[role="dialog"]')
        )
          return;
        if (
          shouldRestore &&
          document.documentElement.scrollHeight <
            targetPosition + window.innerHeight
        )
          return;
        title.setAttribute('tabindex', '-1');
        title.focus({ preventScroll: true });
        window.scrollTo({ top: targetPosition, behavior: 'instant' });
        lastPosition = window.scrollY;
        observer?.disconnect();
        clearTimeout(timeout);
      };
      observer = new MutationObserver(finish);
      observer.observe(document.body, { childList: true, subtree: true });
      timeout = setTimeout(() => observer.disconnect(), 5000);
      finish();
    }
    return () => {
      positions.current.set(location.key, lastPosition);
      window.removeEventListener('scroll', recordPosition);
      observer?.disconnect();
      clearTimeout(timeout);
    };
  }, [
    location.key,
    location.pathname,
    location.search,
    location.state,
    navigationType,
  ]);
  return null;
}
