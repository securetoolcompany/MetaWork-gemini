export const GALAXY_USDC = {
  id: 'galaxy-usdc',
  name: 'Galaxy USDC Enhanced',

  chainId: 1,
  network: 'Ethereum',
  assetSymbol: 'USDC',

  underlyingVault:
    '0xd95fE7adF5075fad9D6Bf853E0f9Fe53369E8D96',

  feeRecipient:
    '0x39Bb4A10626B58430AbFa8284B0F001f49734F70',

  // Verified Ethereum wrapper configuration.
  performanceFeeBps: 1000,
  managementFeeBps: 0,

  // Deployed and validated on Ethereum mainnet.
  // Never replace this with the underlying vault address.
  wrapperAddress: '0x687a789c8BfAF4Bd8162c2D211bbBce4DfDFC64e' as `0x${string}` | null,

  href: '/tokenized-funds/galaxy-usdc',

  morphoUrl:
    'https://app.morpho.org/ethereum/vault/0xd95fE7adF5075fad9D6Bf853E0f9Fe53369E8D96/galaxy-usdc-enhanced',
} as const;