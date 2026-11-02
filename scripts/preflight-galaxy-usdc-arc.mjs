import { preflightGalaxyArc } from './lib/preflight-galaxy-arc.mjs';

await preflightGalaxyArc({
  id: 'galaxy-usdc-arc',
  name: 'Galaxy USDC on Arc',
  assetSymbol: 'USDC',
  underlyingVault: '0x8e357432cc12ff425c36432f312968aeb16112af',
});