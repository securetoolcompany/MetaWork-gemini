// lib/tokenized-funds/nillion/config.js

export const NILLION_CHAIN_ID = 1;

export const NILLION_RPC_URL =
  process.env.NILLION_ETHEREUM_RPC_URL?.trim() ||
  'https://ethereum-rpc.publicnode.com';

export const NILLION_EXPLORER_URL = 'https://etherscan.io';

export const NIL_DECIMALS = 6;

export const NILLION_CONTRACTS = Object.freeze({
  emissions: '0xeff51614B2ccB89264e75a1303A17878cEA59C62',
  staking: '0xAcD5D3d8Eacb9f60CfEb6F26D65FB9CB9b06D21b',
  nodeRegistry: '0x9A2667ec55c769f49906d7aB718d36aE26c23be2',
  nilToken: '0x7Cf9a80db3B29eE8efE3710AadB7b95270572d47',
});

export const NILLION_EXPECTED_OWNER =
  '0x39Bb4A10626B58430AbFa8284B0F001f49734F70';

export const NILLION_NODES = Object.freeze([
  Object.freeze({
    id: '19',
    name: 'Nillion Node #19',
    rewardsStartBlock: '26134588',
    startTimestamp: '1791304835',
    startTimeUtc: '2026-10-06T16:40:35Z',
    startSource: 'verified_opening_enrollment_event',
    startTransactionHash:
      '0x0ee06daad55b9eceaac4414d12491211cd9d0096264e79bc88dc428b401e755e',
    startLogIndex: 252,
    originalStakeBaseUnits: '71472340000',
  }),
  Object.freeze({
    id: '20',
    name: 'Nillion Node #20',
    rewardsStartBlock: '26135144',
    startTimestamp: '1791311519',
    startTimeUtc: '2026-10-06T18:31:59Z',
    startSource: 'verified_opening_enrollment_event',
    startTransactionHash:
      '0x9ed1df3dfd34f0c0806fc6ef64cef62605633459e6fbe8c34446fd7d4690a31c',
    startLogIndex: 155,
    originalStakeBaseUnits: '72445360820',
  }),
]);

export const NILLION_REFRESH_INTERVAL_MS = 60_000;

export function getNillionNode(nodeId) {
  return (
    NILLION_NODES.find((node) => node.id === String(nodeId)) ?? null
  );
}