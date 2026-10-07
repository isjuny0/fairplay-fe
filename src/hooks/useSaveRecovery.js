import { useEffect, useState } from 'react';

export default function useSaveRecovery(error) {
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  useEffect(() => {
    setLatest(null);
    setLoadError(null);
  }, [error]);
  const refresh = async (load) => {
    setLoading(true);
    setLoadError(null);
    try {
      setLatest(await load());
    } catch (requestError) {
      setLatest(null);
      setLoadError(requestError);
    } finally {
      setLoading(false);
    }
  };
  return { latest, loading, loadError, refresh };
}
