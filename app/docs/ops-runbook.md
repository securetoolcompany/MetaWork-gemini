# MetaWork Ops Runbook

## 1. Compromised Admin Wallet Response

1. **Immediately** revoke access: rotate `TREASURY_MNEMONIC` in your secrets manager / Vercel env.
2. Redeploy the application so the new mnemonic is live.
3. For each active IP asset, call `POST /api/admin/asset-config` with the new manager address to rotate the on-chain ASA manager role.
4. Review the `assetconfigaudits` MongoDB collection for any unauthorized reconfigurations.
5. Notify affected creators if any assets were tampered with.

## 2. Manager / Control-Address Rotation

### Single wallet → new single wallet
1. Set `TREASURY_MNEMONIC` to the new wallet mnemonic in env.
2. Redeploy.
3. For each live asset, call `POST /api/admin/asset-config` with `newManager`, `newReserve`, `newFreeze`, `newClawback` set to the new address.
4. Confirm each tx in the audit log.

### Single wallet → multisig
1. Generate a multisig account: `algosdk.multisigAddress(msigParams)`.
2. Replace `getSigner()` in `lib/algorand.js` with a multisig signer implementation (sign with required threshold of keys, combine with `algosdk.mergeMultisigTransactions`).
3. Update env to reflect new signer type.
4. Follow the same asset-config rotation steps above.

> No API route changes are required — all callers use `getSigner()`.

## 3. Promotion Failure Triage

1. Query failed assets: `db.ipassets.find({ status: "quarantine", promotionAttempts: { $gt: 0 } })`.
2. Review `lastPromotionError` for root cause (insufficient fees, algod timeout, manifest validation error).
3. Fix the root cause, then call `POST /api/admin/promote-asset` with `{ assetId, action: "promote" }` to force retry.
4. If the asset is plagiarism/policy-violating, call with `action: "fail"` — prepaid fees are not refunded.

## 4. Audit Log Queries

```js
// All reconfigurations in last 7 days
db.assetconfigaudits.find({ timestamp: { $gte: new Date(Date.now() - 7*86400000) } })

// Reconfigurations for a specific asset
db.assetconfigaudits.find({ assetId: <YOUR_ASSET_ID> })
```