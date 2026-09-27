export async function trackIpView(ipId, viewKey) {
  const id = String(ipId || '').trim();

  if (!id || typeof window === 'undefined') {
    return;
  }

  if (!viewKey) {
    throw new Error('trackIpView requires a viewKey');
  }

  const response = await fetch(`/api/ip/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ viewKey }),
    keepalive: true,
  });

  const result = await response.json();

  console.log('[IP view]', {
    id,
    status: response.status,
    result,
  });

  return result;
}