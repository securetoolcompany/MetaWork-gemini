import { preflightGalaxyArc } from './lib/preflight-galaxy-arc.mjs';

await preflightGalaxyArc({
  id: 'galaxy-eurc-arc',
  name: 'Galaxy EURC on Arc',
  assetSymbol: 'EURC',
  underlyingVault: '0x389abdf4355e0cf4f19298179991705a98f21c18',
});