import { useCallback, useEffect, useRef, useState } from 'react';
import { invalidateSharedReads } from '../api/sharedReads.js';
export default function useResource(load, dependencies) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  const [requestDependencies, setRequestDependencies] = useState(dependencies);
  const matchesCurrentScope =
    requestDependencies.length === dependencies.length &&
    dependencies.every((value, index) =>
      Object.is(value, requestDependencies[index]),
    );
  const loader = useRef(load);
  loader.current = load;
  const reload = useCallback(() => {
    invalidateSharedReads();
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    let active = true;
    setRequestDependencies(dependencies);
    if (!matchesCurrentScope) setData(null);
    setLoading(true);
    setError(null);
    loader
      .current()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (active) setError(requestError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [...dependencies, revision]);
  return {
    data: matchesCurrentScope ? data : null,
    loading: !matchesCurrentScope || loading,
    error: matchesCurrentScope ? error : null,
    reload,
  };
}
