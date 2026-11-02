# MetaWork ALGO Tokenizer — Disposable Day 1 Record

## Mandatory lockup warning

This immutable Day 1 application has no investor redemption or
post-initialization authority-restoration method. Once initialized, its
backing may remain inaccessible. A replacement deployment does not transfer
custody, backing, or share ownership. This version must not receive
production funds.

Policy approval is not authorization to deploy, fund, sign, submit
transactions, create identities, or transfer custody.

## Scope

Build a separate disposable-network Tokenizer foundation with:

- Application control of an explicitly approved disposable staking account.
- A fixed-supply ownership-share ASA.
- Separate outstanding-share accounting.
- Atomic staking-authority binding and seed initialization.
- Explicit authority restrictions and negative tests.

Do not extend or repurpose the disposable account-control proof application.
Do not modify unrelated revenue-distribution systems.

Investor deposits, investor redemption, reward settlement, fee collection,
production deployment, and automatic migration are outside Day 1 scope.

## Historical proof checkpoint

See [ACCOUNT_CONTROL_PROOF_RECORD.md](ACCOUNT_CONTROL_PROOF_RECORD.md).

That checkpoint concerns a separate disposable account-control proof.
Its application IDs, payment amount, balances, roles, and restoration
permission are not Tokenizer configuration or Tokenizer execution evidence.

Preserve the historical checkpoint and its associated public evidence.

## Local source checkpoint

Reported by the operator on November 2, 2026:

- Branch: main.
- HEAD: 188bde9dd352ff4a9ff187a5ee62b57ed9d25464.
- Commit subject: metawork earn page cleanup.
- contracts/algo_staking/ was untracked.
- lib/algorand/staking/ was untracked.
- Other working-tree changes exist and are outside this workstream.

Inspected files:

- account_control.py: standalone disposable proof with pay_once and restore.
- requirements.txt: pyteal==0.27.0 and py-algorand-sdk==2.11.1.
- compile.py: proof-only offline PyTeal-to-TEAL generation into
  artifacts/account_control; not an Algod compilation or deployment.
- ../../lib/algorand/staking/client.test.js: node:test source covering
  writable-address and network-identity validation.

Additional filenames observed but not yet source-reviewed for this continuation:

- ../../lib/algorand/staking/client.js
- ../../lib/algorand/staking/signer.js
- ../../lib/algorand/staking/signer.test.js

package.json has dev, build, start, and migrate-images scripts.
No package test script was present in the supplied output.

Active Python dependency versions have not been reverified.
Reading test source does not establish that tests passed.

## Approved Day 1 authority policy

### Updates and deletion

Reject application updates and deletion for every caller, including the
creator, initializer, and any administrator.

Enforce both restrictions on-chain and test them explicitly.

Do not implement placeholder methods or alternate branches that bypass
these restrictions.

This approval applies only to the disposable Day 1 application. It is not
approval of the eventual production upgrade or deletion policy.

Day 2 functionality absent from this application requires a new application.
A new deployment does not migrate the old application's custody, backing,
or ownership.

### Defensive pre-initialization restoration

Restoration is permitted only when all of the following hold:

- Successful seed initialization has not occurred.
- The caller is the fixed authorized initializer.
- The sender of the inner restoration payment is the fixed staking account.
- The sole rekey destination is that same staking account.

The inner payment must transfer zero principal, set no close address,
and set its transaction fee to zero. The caller funds the required outer
fee pool.

Do not copy the proof's operator-based restoration permission.

This defensive method does not authorize a separate custody-only setup.
The normal initialization sequence must bind custody and seed initialization
in one validated atomic group.

### Post-initialization restrictions

Successful initialization permanently disables restoration.

No caller may reclaim staking authority through recovery, rekey-away,
administrative withdrawal, or an equivalent alternate method.

Review every inner-transaction-capable method for authority changes,
principal movement, close fields, destinations, and fee behavior.

Do not add an escape hatch to simplify prototype cleanup.

Any migration or cleanup requires separately approved, tested behavior that
the deployed application actually supports. Later approval cannot add
missing functionality to this immutable application.

## Atomic initialization requirements

Prepare the application, ASA, inventory, and application funding before
the authority-binding initialization group.

The validated group must atomically bind:

- The designated staking-account rekey.
- The fixed initializer's authorized initialization call.
- Seed-recipient opt-in when required.
- Execution-time backing measurement.
- Seed-share transfer.
- Outstanding-share and accounting-baseline recording.

Validate transaction ordering, references, fee pooling, writable resources,
and signer assignments. Do not assign one signer to every transaction by
default.

Test visibility of the preceding grouped rekey.

Reject repeated initialization, unauthorized callers, substituted accounts,
insufficient backing, and insufficient share inventory.

Failed initialization must leave pre-group account authority, balances,
asset holdings, and application state unchanged. Exceptions alone are not
sufficient evidence.

## Accounting requirements already decided

- Use integer accounting only.
- Use a fixed-supply ASA; issue and redeem by transferring existing units.
- Keep unused share inventory in the application.
- Track outstanding shares separately from application inventory.
- Seed shares are ordinary ownership with no permanent lock or stake floor.
- Start fee configuration and accrued ALGO fee liability at zero.
- Preserve ALGO-denominated fee-liability accounting for Day 2.
- Unsolicited share returns do not reduce outstanding shares or authorize
  payment.

Excluded funds consist of non-overlapping amounts:

1. Current staking-account minimum balance.
2. Additional approved operating reserve above that minimum balance.
3. Other explicitly approved exclusions.
4. Accrued ALGO fee liability.

Redeemable seed backing equals execution-time staking balance minus those
exclusions. Do not subtract minimum balance twice.

Application funding remains outside staking backing unless explicitly
approved otherwise.

Initial conversion is one share atomic unit per microALGO of redeemable
seed backing, subject to approved ASA capacity and decimals.

Reject zero backing or insufficient inventory. Never silently cap issuance.

## Decisions still required before dependent implementation

- Fixed initializer, staking account, and seed recipient.
- Whether any preserved disposable proof identities may be reused.
- ASA name, unit name, decimals, total supply, default-frozen setting,
  manager, reserve, freeze, and clawback authorities.
- Additional operating reserve and any other exclusions.
- Whether any reserve changes are allowed after initialization and by whom.
- Any additional administrative capability; none is implied by role names.

No unresolved decision authorizes a permissive default.

## Execution boundaries

No MainNet interaction is authorized.

Never use the following protected production account as sender or writable
target:

73C6PQVLAPE6M2GFV3ZKXJRHCNZ4P75GY3LMTHJ7MS2MALZJ6RRJKNWHBU

Before any future transaction execution:

- Obtain separate approval of the specific effects.
- Use explicitly approved disposable identities and test funds accepted
  as potentially unrecoverable.
- Require explicit network selection and live genesis validation.
- Refuse MainNet and protected writable targets before signing.
- Separate public inspection configuration from signing configuration.
- Do not silently inherit production defaults.

TestNet requires separate explicit approval.

Do not create replacement identities, reset LocalNet, delete wallet
storage, or rerun custody setup merely to reproduce earlier proof evidence.

## Reference-review gate

Before using Folks Finance implementation patterns, inspect the pinned
implementation, applicable tests, and license at:

67467b8d23488bbb114e3b2667316268f0b15cc1

Reference repository:

https://github.com/Folks-Finance/algo-liquid-staking-contracts

Record exact source paths, function names, commit, and applicable license
before copying or adapting source.

Distinguish current implementation from older versions and testing fixtures.
Do not import upstream privileges, dependencies, or accounting assumptions
without explicit review.

The attempted pinned source and license retrieval during this continuation
failed. No completed upstream implementation or license review is claimed.

## Required acceptance evidence

Record each case with its actual evidence level: source inspection,
syntax-only, PyTeal-generated, Algod-compiled, simulated, LocalNet-executed,
or explicitly authorized TestNet-executed.

Required cases include:

- Update and deletion rejected for creator, initializer, and any other caller.
- Authorized defensive restoration before initialization only.
- Unauthorized or substituted restoration rejected.
- Restoration transfers no principal and charges no inner fee.
- Restoration and equivalent authority-transfer paths unavailable after
  initialization.
- Correct atomic initialization and seed ownership.
- Missing opt-in causes atomic failure.
- Reinitialization rejected.
- Unauthorized initializer and substituted staking or recipient rejected.
- Insufficient backing, reserve, or inventory rejected.
- Forbidden close and rekey fields rejected except the designated grouped
  initialization rekey and narrowly scoped defensive restoration.
- Failed initialization preserves authority, balances, holdings, and state.
- MainNet configuration and protected writable targets refused before signing.
- Public inspection requires no signing secrets.

Distinguish intended assertion failures from malformed transactions,
protocol errors, and unrelated branch failures.

## Tokenizer execution record

No Tokenizer compilation, simulation, or execution output has been supplied
for this continuation.

- Tokenizer application ID/address: not established.
- Share ASA ID and verified parameters: not established.
- Approved Tokenizer identities: not established.
- Gross staking balance and exclusions: not established.
- Redeemable backing: not established.
- Seed shares, outstanding shares, and inventory: not established.
- Atomic seed initialization: not executed in supplied evidence.
- TestNet: not executed.
- Independent security approval: not obtained.

Append actual commands, results, public identifiers, dependency versions,
transaction IDs, rejection evidence, and unresolved issues as work proceeds.
Do not substitute historical proof values for Tokenizer values.
## Continuation checkpoint — 2026-11-02: saved creation evidence

The earlier execution-record statements above describe the evidence available
when they were written. This checkpoint records subsequently supplied evidence;
it does not rewrite the historical preparation artifacts.

### Local source checkpoint

- Reported branch: main.
- Reported HEAD: 188bde9dd352ff4a9ff187a5ee62b57ed9d25464.
- The Day 1 implementation and artifacts were reported as untracked.
- HEAD alone therefore does not identify the complete local implementation.
- The preparation record includes local Python source hashes.

### Unsigned creation preparation

Artifact directory:

artifacts/tokenizer/creation-localnet-def0d6df347a4090b0a833cfd86c3205

- Network recorded: LocalNet, dockernet-v1.
- Creator: QAVXZK43SGUJC7DQ2QC6LBWTAYCKDGOG7XUSFYQRJBE23GZMHN3ORHFG3M.
- Unsigned transaction ID:
  ZCFVYTKDS552FMUJKWDOIGFVIGKRVPLM4ABGAQYPIUKYEE7AZGYA.
- Unsigned MessagePack SHA-256:
  30b2714a50e0eb09395d38bc22119d27981ceda7a14ab681b1919ff02d818f52.
- Recorded validity window: rounds 22 through 1022.
- Recorded fee: 1,000 microALGO.
- Global schema: eight uints and three byte slices.
- Local schema: zero uints and zero byte slices.
- Extra program pages: zero.
- Preparation approval field: not_requested.
- Creator minimum-balance commitment: pending_verification.

### Saved creation simulation

Evidence level: supplied saved LocalNet simulation response, followed by
user-reported offline artifact-consistency tests. No new live query was
performed for this checkpoint.

The saved response reports:

- Simulation last-round: 22.
- One group containing one outer transaction.
- No reported group failure or pool error.
- No inner transactions.
- Group fees paid: 1,000 microALGO.
- Application budget added: 700; consumed: 69.
- Simulated application index: 1028.

Index 1028 is a simulation result, not evidence of deployed application
creation. Empty signatures were allowed; signing authority was not verified.
The recorded validity window was checked against the saved simulation round,
not against a newly queried live round.

### Offline regression evidence

Command:

python -m unittest discover -s contracts/algo_staking -p 'test_tokenizer_creation_evidence.py' -v

User-reported result: five tests passed, zero failures or errors.

Checks cover:

- Saved unsigned artifact hash, transaction ID, and serialization round-trip.
- Exact recorded simulation settings and returned evaluation overrides.
- One successful outer result without inner transactions.
- Full returned-transaction comparison with the saved unsigned transaction,
  allowing only omission of the expected zero-valued apan field.
- Recorded creator, fee, validity window, and selected network metadata.
- Preservation of the preparation record's unapproved, historical status.

These checks establish consistency under the implemented assertions.
They do not independently establish source-to-bytecode correctness, complete
initial-state correctness, current network state, signing authority, or
minimum-balance sufficiency.

### Remaining execution gates

- Verify the creator's application-creation minimum-balance commitment.
- Review any additional creation-state acceptance assertions.
- Recheck live network identity, container identity, account authority,
  balances, and transaction validity before any proposed execution.
- Present exact effects and costs for separate approval before signing
  or submitting application creation.
- Do not regenerate, overwrite, or submit the saved transaction automatically.

No deployment, ASA creation, opt-in, initialization, rekey, or custody change
is established or authorized by this checkpoint. No MainNet or TestNet
execution is authorized.
## Continuation checkpoint — 2026-11-02: read-only creation preflight

Command reported:

python -B contracts/algo_staking/inspect_tokenizer_creation.py --network localnet

Evidence level: user-supplied output from a live read-only LocalNet
preflight, including eight passing offline evidence tests.

### Observed public state

- Container ID:
  b604c779920fde24732e79348e6cb7063fced4021c23b5a73fbb572ce96bd257.
- Genesis ID: dockernet-v1.
- Genesis hash:
  0TJVyrVwfL/CRhaQzRG1mF29GzfDdG4Dzr2M5uXbg2o=.
- Creator:
  QAVXZK43SGUJC7DQ2QC6LBWTAYCKDGOG7XUSFYQRJBE23GZMHN3ORHFG3M.
- Effective creator authority matched the creator address.
- Creator account round: 22.
- Node last round and suggested first round: 22.
- Creator amount: 1,000,000 microALGO.
- Creator current minimum balance: 100,000 microALGO.
- Live minimum transaction fee: 1,000 microALGO.
- Saved transaction window: rounds 22 through 1022.
- Saved transaction fee: 1,000 microALGO.
- Reported blockers: none under the implemented checks.

Reported node protocol version:

https://github.com/algorandfoundation/specs/tree/73c43b4a9699390884c51e2a9598d49e28373d10

### Balance projection

Under the previously reviewed schedule:

- Additional creator minimum-balance requirement: 478,000 microALGO.
- Projected total creator minimum balance: 578,000 microALGO.
- Projected creator amount after the fee: 999,000 microALGO.
- Projected headroom: 421,000 microALGO.

The running node's applicable consensus cost parameters were not independently
verified. Do not relabel this projection as verified live consensus accounting.

### Boundaries and remaining work

- Reads were separate, not an atomic same-round snapshot.
- Public effective authority does not prove signing-key access.
- No fresh simulation was performed.
- No wallet access, signing, or submission was performed.
- Execution approval remains not_requested.
- The empty blocker list does not authorize deployment.
- Original preparation and simulation artifacts remain unchanged.
- No deployed application ID is established by this checkpoint.

Before proposing creation execution, resolve the applicable consensus-cost
verification and review the exact signing/submission implementation.
Any future execution requires its own explicit approval of exact effects
and costs, with fresh network, container, authority, balance, and validity
checks. No automatic rebuild or retry is authorized.
## Continuation checkpoint — 2026-11-02: offline creation safeguards

User-reported combined regression result: 24 tests passed.

- Eight saved-creation-evidence tests.
- Ten signature-boundary tests using mocked cryptographic verification.
- Six consensus-cost helper tests using synthetic inputs.

The creation-evidence suite checks saved artifact identity, returned
transaction consistency, reviewed initial global state, recorded source
identity, and historical balance arithmetic.

The signature helper performs verification only. It contains no wallet,
signing, or submission path. Its tests establish input rejection and verifier
call behavior, not acceptance of a real cryptographic signature.

The consensus helper rejects a missing exact protocol entry, missing cost
fields, incorrect types, and values outside the reviewed schedule. Its tests
do not establish the running node's loaded consensus parameters.

The creation preflight now explicitly reports unresolved live consensus-cost
verification as a blocker. The earlier empty-blocker output predates this
correction and must not be treated as execution clearance.

Remaining gates:
- Verify applicable parameters for the running node's active protocol.
- Establish real signature-verification evidence before signer integration.
- Review any future wallet and submission implementation separately.
- Obtain explicit approval of exact effects and costs before execution.

No new signing, submission, application deployment, ASA creation, opt-in,
initialization, rekey, or custody change is established by these test results.
Original creation artifacts remain unchanged.