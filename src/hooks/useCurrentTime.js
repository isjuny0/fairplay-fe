import { useEffect, useState } from 'react';

export default function useCurrentTime() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const interval = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);
  return now;
}
