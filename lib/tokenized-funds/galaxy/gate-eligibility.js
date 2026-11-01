import { zeroAddress } from 'viem';

export const UNDERLYING_GATES = Object.freeze([
  { gate: 'receiveSharesGate', setter: 'setReceiveSharesGate(address)' },
  { gate: 'sendSharesGate', setter: 'setSendSharesGate(address)' },
  { gate: 'receiveAssetsGate', setter: 'setReceiveAssetsGate(address)' },
  { gate: 'sendAssetsGate', setter: 'setSendAssetsGate(address)' },
]);

// state: { value: address|null, abdicated: boolean|null, error?: string }
export function classifyGate(state) {
  if (!state || state.error || state.value == null || typeof state.abdicated !== 'boolean') {
    return 'unknown-blocked'; // fail closed
  }
  const isZero = state.value.toLowerCase() === zeroAddress;
  if (!state.abdicated) return isZero ? 'zero-setter-mutable' : 'set-setter-mutable';
  return isZero ? 'permissionless-locked' : 'restrictive-locked';
}

export function underlyingGatesEligible(states) {
  return UNDERLYING_GATES.every(
    ({ gate }) => classifyGate(states[gate]) === 'permissionless-locked',
  );
}