import { useCallback, useEffect, useState } from 'react';
import { apiGet, readCache } from './api';

/**
 * Cache-first loader: renders the last cached copy instantly, then swaps in
 * fresh data when the network answers.
 */
export function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(() => readCache<T>(path));
  const [loading, setLoading] = useState(data === null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    apiGet<T>(path)
      .then((d) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
