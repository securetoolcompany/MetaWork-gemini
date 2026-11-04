'use client';

import React, { useRef, useState } from 'react';

const h = React.createElement;
const API = '/api/creation';
const TXID = 'HAQMKRU6ZAO3AI2AGFLPIHSOUIIC7RRSMC5J76SWQAJJYVQ5DEYA';
const HASH = '4cee0b8eef2197a564c62cce8885a83c60508e74f5f5186f3ccbe2f8c16e5f5d';
const CREATOR = 'BR5RLDLNCHCXHATTP7GVWGAUJTBREOXPUAYUMKHX5YDZFTVR3XEGPNQN2Y';
function requireValue(ok, message) { if (!ok) throw new Error(message); }
function bytes(base64) { return Uint8Array.from(atob(base64), c => c.charCodeAt(0)); }
function base64(value) { let text = ''; for (const byte of value) text += String.fromCharCode(byte); return btoa(text); }

export default function TestNetOperator() {
  const [token, setToken] = useState('');
  const [verification, setVerification] = useState(null);
  const [approval, setApproval] = useState('');
  const [authorization, setAuthorization] = useState(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [message, setMessage] = useState('Verification only. No wallet is opened on page load.');
  const wallet = useRef(null);
  const signingUsed = useRef(false);
  const connectionUsed = useRef(false);

  async function call(action, body) {
    const response = await fetch(API + '?action=' + action, {
      method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || data.status || 'Operator operation blocked');
    return data;
  }
  async function verify() {
    if (busy || authorization) return;
    setBusy(true);
    try {
      const data = await call('verify');
      requireValue(data.txid === TXID && data.rawHash === HASH, 'Server returned another candidate');
      setVerification(data); setApproval('');
      setMessage(data.executionEnabled ? 'Verified unsigned. Execution still requires separate approval.' : 'Verified unsigned. Execution is disabled on this server.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function authorize() {
    if (busy || authorization || stopped) return;
    setBusy(true);
    try {
      requireValue(verification?.executionEnabled, 'Execution disabled; separate approval required');
      requireValue(approval === verification.approvalPhrase, 'Type the exact displayed approval phrase');
      const data = await call('authorize', { action: 'authorize', nonce: verification.nonce, approval });
      requireValue(data.status === 'authorized_once_guard_preserved' && data.txid === TXID && data.rawHash === HASH, 'Authorization/candidate mismatch');
      setAuthorization(data);
      setMessage('Persistent guard acquired. Pera remains disconnected until you explicitly connect.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function connect() {
    if (busy || stopped || connectionUsed.current) return;
    setBusy(true);
    try {
      requireValue(authorization?.status === 'authorized_once_guard_preserved', 'Acquire the exact-candidate guard first');
      connectionUsed.current = true;
      const { PeraWalletConnect } = await import('@perawallet/connect');
      wallet.current = new PeraWalletConnect({ chainId: 416002, shouldShowSignTxnToast: false });
      // Never reconnectSession(), signData(), or use the shared wallet provider.
      const accounts = await wallet.current.connect();
      requireValue(Array.isArray(accounts) && accounts.includes(CREATOR), 'Selected wallet does not expose the fixed creator');
      setConnected(true); setMessage('Creator connected on explicit TestNet Pera instance. Nothing signed.');
    } catch (error) {
      setStopped(true); setMessage(error.message + ' Guard preserved; do not retry automatically.');
      try { await wallet.current?.disconnect(); } catch {}
    } finally { setBusy(false); }
  }
  async function signOnce() {
    if (busy || stopped || signingUsed.current) return;
    setBusy(true);
    try {
      requireValue(connected && wallet.current && authorization, 'Explicit authorized creator connection required');
      signingUsed.current = true; // Set before any signing request; never clear.
      const { default: algosdk } = await import('algosdk');
      const raw = bytes(authorization.unsigned);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)), b => b.toString(16).padStart(2, '0')).join('');
      requireValue(hash === HASH, 'Unsigned artifact hash mismatch');
      const txn = algosdk.decodeUnsignedTransaction(raw);
      requireValue(txn.txID() === TXID && txn.sender.toString() === CREATOR &&
        base64(algosdk.encodeUnsignedTransaction(txn)) === authorization.unsigned, 'Exact transaction mismatch');
      const signed = await wallet.current.signTransaction([[{ txn, signers: [CREATOR] }]], CREATOR);
      requireValue(Array.isArray(signed) && signed.length === 1 && signed[0], 'Expected exactly one signed transaction');
      const decoded = algosdk.decodeSignedTransaction(signed[0]);
      requireValue(decoded.txn.txID() === TXID &&
        base64(algosdk.encodeUnsignedTransaction(decoded.txn)) === authorization.unsigned,
        'Wallet returned different transaction bytes');
      // Server reuses the existing real cryptographic verifier and strict signed
      // simulation. This page never broadcasts directly to Algod.
      await wallet.current.disconnect(); setConnected(false);
      const result = await call('submit', { action: 'submit', signed: base64(signed[0]) });
      setStopped(true); setMessage(JSON.stringify(result, null, 2));
    } catch (error) {
      setStopped(true); setMessage(error.message + ' Preserve the guard; use read-only reconciliation.');
      try { await wallet.current?.disconnect(); } catch {}
      setConnected(false);
    } finally { setBusy(false); }
  }
  async function reconcile() {
    if (busy) return;
    setBusy(true);
    try { setMessage(JSON.stringify(await call('reconcile'), null, 2)); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  const button = (id, label, onClick, disabled) => h('button', { key: id, 'data-testid': id, type: 'button', onClick, disabled, style: { margin: '8px', padding: '10px' } }, label);
  return h('main', { style: { maxWidth: '960px', padding: '24px', margin: 'auto', fontFamily: 'sans-serif', overflowWrap: 'anywhere' } },
    h('h1', null, 'Disposable TestNet Tokenizer operator'),
    h('p', null, 'Local-only. Creation is not initialization. No redemption or post-initialization recovery. Never use MainNet or real-value funds.'),
    h('p', null, 'Transaction: ' + TXID), h('p', null, 'Unsigned SHA-256: ' + HASH),
    h('label', null, 'Local operator credential (memory only)',
      h('input', { 'data-testid': 'token', type: 'password', autoComplete: 'off', value: token, onChange: e => setToken(e.target.value), style: { display: 'block', width: '100%' } })),
    button('verify', 'Verify saved candidate — no wallet', verify, busy || Boolean(authorization)),
    verification ? h('section', null,
      h('pre', null, JSON.stringify({ binding: verification.binding, fee: verification.fee, creator: verification.creator,
        firstValid: verification.firstValid, lastValid: verification.lastValid,
        simulationRound: verification.simulationRound, creatorSnapshot: verification.creatorSnapshot,
        conditionalAdditionalMinimum: verification.conditionalAdditionalMinimum,
        conditionalHeadroom: verification.conditionalHeadroom, effects: verification.effects,
        executionEnabled: verification.executionEnabled }, null, 2)),
      h('p', null, 'Only after separate execution approval, type this exact phrase:'),
      h('code', null, verification.approvalPhrase),
      h('input', { 'data-testid': 'approval', value: approval, autoComplete: 'off', onChange: e => setApproval(e.target.value), style: { display: 'block', width: '100%' } }),
      button('authorize', 'Authorize one exact attempt / acquire guard', authorize,
        busy || stopped || Boolean(authorization) || !verification.executionEnabled || approval !== verification.approvalPhrase)) : null,
    button('connect', 'Connect Pera on TestNet', connect, busy || stopped || !authorization || connectionUsed.current),
    button('sign', 'Sign once, validate, and submit once', signOnce, busy || stopped || !connected || signingUsed.current),
    button('reconcile', 'Read-only reconciliation', reconcile, busy),
    h('pre', { 'data-testid': 'message', style: { whiteSpace: 'pre-wrap' } }, message),
    h('p', null, 'After interruption/reload: do not reconnect, re-sign, clear guards, or refresh the candidate. Reconcile the recorded transaction ID.'));
}
