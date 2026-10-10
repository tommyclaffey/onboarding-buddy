import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';

/** Load JSON from a GET endpoint. `reload()` refetches without flashing the loading state. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!url) return;
    try {
      setData(await api.get<T>(url));
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}
