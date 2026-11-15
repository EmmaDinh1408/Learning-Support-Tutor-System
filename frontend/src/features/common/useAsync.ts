import { useEffect, useState, type DependencyList } from 'react';

export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): {
  data: T | null;
  loading: boolean;
  error: Error | null;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setData(null);
    setError(null);
    Promise.resolve().then(fn).then((d) => {
      if (alive) {
        setData(d);
        setLoading(false);
      }
    }).catch((reason: unknown) => {
      if (alive) {
        setError(reason instanceof Error ? reason : new Error('Không thể tải dữ liệu.'));
        setLoading(false);
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading, error };
}
