'use client';

import { useEffect, useState } from 'react';
import GalaxyMetrics from '../galaxy/GalaxyMetrics';

export default function ArcLiveMetrics({
  initialMetrics,
  endpoint,
  ...props
}) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    let pending = false;
    let controller = null;

    async function refresh() {
      if (pending || stopped) return;
      pending = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 40_000);

      try {
        const response = await fetch(endpoint, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json();

        if (!response.ok || !payload.metrics) {
          throw new Error('Metrics unavailable.');
        }

        if (!stopped) {
          setMetrics(payload.metrics);
          setError('');
        }
      } catch {
        if (!stopped) {
          setError(
            'Live metrics refresh is unavailable. ' +
            (metrics ? 'The last successful readings remain displayed.' : ''),
          );
        }
      } finally {
        window.clearTimeout(timeout);
        pending = false;
      }
    }

    void refresh();

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 60_000);

    const focused = () => void refresh();
    window.addEventListener('focus', focused);

    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', focused);
    };
  }, [endpoint]);

  return (
    <div>
      {error && (
        <p role="status" className="mb-3 text-xs leading-5 text-amber-300">
          {error}
        </p>
      )}
      <GalaxyMetrics metrics={metrics} {...props} />
    </div>
  );
}
