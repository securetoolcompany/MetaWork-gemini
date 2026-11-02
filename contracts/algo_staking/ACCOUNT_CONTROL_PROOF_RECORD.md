# Disposable LocalNet Account-Control Proof

## Scope

This checkpoint covers the disposable account-control proof only.
It is not the Tokenizer implementation and does not mark Day 1 complete.

Network: localnet
Genesis ID: dockernet-v1
Genesis hash: 0TJVyrVwfL/CRhaQzRG1mF29GzfDdG4Dzr2M5uXbg2o=

## Primary proof — application 1012

Public record:
artifacts/account_control/kmd-proof-wallet.json

Result: primary_account_control_proof_passed

Confirmed behavior:
- Existing KMD-held disposable accounts were used.
- Staking authority was bound to the proof application.
- Unauthorized payment and restoration calls were rejected.
- Original-key spending was rejected while application custody was active.
- Exactly 10,000 microALGO was paid to the fixed recipient.
- Repeat payment was rejected.
- Original authority was restored.
- Payment and repeat restoration were rejected after restoration.
- An original-key transaction confirmed after restoration, at round 17.

Rejected cases recorded unchanged tracked account/state snapshots.

## Separate-process recovery — application 1020

Public record:
artifacts/account_control/kmd-recovery-test.json

A separate setup process established application custody and exited.
The recovery process reopened the same existing KMD wallet.

Result: original authority restored and verified
Confirmed round: 21
Recovery transaction:
V3N3A36MIC35QTGTEQZ2BDU2CYTME6TEGIUN2NI5UQGB5TYP5AQQ

Verified effects:
- paid remained 0.
- restored changed from 0 to 1.
- Staking authority returned to the original address.
- Staking principal remained 1,987,000 microALGO.
- Only the operator balance changed during restoration:
  a 2,000 microALGO fee.
- Asset holdings remained unchanged.

This establishes restoration without a successful proof payment and
recovery across a deliberate process boundary. It does not establish
abrupt-kill or container-restart recovery during custody.

## Guard simulations — application 1012

Separate report:
artifacts/account_control/kmd-guard-simulations.json

Result: four_guard_simulations_passed

Verified intended assertion failures:
- Application update.
- Application deletion.
- Nonzero outer RekeyTo.
- Transaction group size greater than one.

Each case matched the reported failure PC to the intended assertion
in a source map for bytecode matching the deployed approval program.
Tracked ledger snapshots remained unchanged.

Evidence type: Algod simulation, not submitted-transaction rejection.
Signing: not performed.
Submission: not performed.
Primary proof record: unchanged.

## Evidence limits and preservation

- Nonzero close fields reaching application AVM assertions were not tested.
- The four simulated cases were not submitted as signed transactions.
- Existing wallet restart/signature verification is separate from recovery
  during active application custody.
- Container removal or LocalNet reset survival is not guaranteed.
- Preserve the existing KMD wallet and all three public evidence records.
- Do not rerun completed setup runners or overwrite their records.
- Remaining-test lists in older records describe their creation-time
  checkpoint; this document summarizes the subsequent evidence.