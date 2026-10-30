// lib/tokenized-funds/galaxy-quality/config.ts

export const GALAXY_QUALITY = {
  id: 'galaxy-usdc-quality-base',
  name: 'Galaxy USDC Quality',
  wrapperName: 'MetaWork Galaxy USDC Quality',
  wrapperSymbol: 'mwGUSDCq',

  chainId: 8453,
  network: 'Base',
  assetSymbol: 'USDC',

  // Verified by your read-only Base preflight.
  assetAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  assetDecimals: 6,

  underlyingVault: '0x1e9e47583f15D45a10Df48c0b1846E0492c795D7',

  administrator: '0x39Bb4A10626B58430AbFa8284B0F001f49734F70',
  feeRecipient: '0x39Bb4A10626B58430AbFa8284B0F001f49734F70',

  // Display configuration only—not contract fee encoding.
  performanceFeeBps: 1000,
  managementFeeBps: 0,

  // Never substitute the underlying vault address here.
  wrapperAddress: null as `0x${string}` | null,

  // Enabling customer transactions requires a separate validated integration.
  depositsEnabled: false,

  href: '/tokenized-funds/galaxy-usdc-quality',
} as const;