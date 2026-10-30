export const GALAXY_QUALITY = {
  id: 'galaxy-usdc-quality-base',
  name: 'Galaxy USDC Quality',
  wrapperName: 'MetaWork Galaxy USDC Quality',
  wrapperSymbol: 'mwGUSDCq',

  chainId: 8453,
  network: 'Base',
  assetSymbol: 'USDC',
  assetDecimals: 6,
  shareDecimals: 18,

  assetAddress:
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,

  underlyingVault:
    '0x1e9e47583f15D45a10Df48c0b1846E0492c795D7' as `0x${string}`,

  wrapperAddress:
    '0xC8d488CF3A656E29FAa04BD9F88d5C124f23Fd3e' as `0x${string}`,

  wrapperAdapter:
    '0x10a282fE78B4c869F35875E8Da896f53aCd813A2' as `0x${string}`,

  administrator:
    '0x39Bb4A10626B58430AbFa8284B0F001f49734F70' as `0x${string}`,

  feeRecipient:
    '0x39Bb4A10626B58430AbFa8284B0F001f49734F70' as `0x${string}`,

  performanceFeeBps: 1000,
  managementFeeBps: 0,

  depositsEnabled: true,
  href: '/tokenized-funds/galaxy-usdc-quality',
} as const;