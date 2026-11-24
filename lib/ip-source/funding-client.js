export async function readIpFundingStatus(pointer, headers, fetchImpl = fetch) {
  const { ipAssetId, operationKey } = pointer;
  const query = new URLSearchParams({ ipAssetId, operationKey });
  const response = await fetchImpl(`/api/ip/pool-funding?${query}`, { headers, cache: 'no-store' });
  const result = await response.json();
  if (!['confirmed', 'pending', 'review_required', 'awaiting_signature'].includes(result.status)) {
    throw new Error('Funding status unavailable');
  }
  return result.status;
}
