"""
cleanup_app_assets.py
Closes out all non-USDC assets held by the app address back to the authority,
then verifies the app address MBR is back to baseline.

Usage:
  python cleanup_app_assets.py
"""

import os, sys, base64
import algosdk
from algosdk.v2client import algod
from algosdk import transaction

ALGOD_URL     = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN   = ""
USDC_ASSET_ID = 10458941
APP_ID_FILE   = "app_id.txt"

def get_client():
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_URL)

def wait(client, txid, rounds=10):
    last = client.status()["last-round"]
    for _ in range(rounds):
        try:
            r = client.pending_transaction_info(txid)
            if r.get("confirmed-round", 0) > 0:
                return r
        except Exception:
            pass
        client.status_after_block(last + 1)
        last += 1
    raise Exception(f"Timeout waiting for {txid}")

def sp(client, fee=2000):
    p = client.suggested_params()
    p.flat_fee = True
    p.fee = fee
    return p

def main():
    if not os.path.exists(APP_ID_FILE):
        print("ERROR: app_id.txt not found.")
        sys.exit(1)
    with open(APP_ID_FILE) as f:
        app_id = int(f.read().strip())

    auth_mnemonic = os.environ.get("AUTHORITY_MNEMONIC", "").strip()
    if not auth_mnemonic:
        auth_mnemonic = input("Enter AUTHORITY mnemonic: ").strip()
    auth_pk   = algosdk.mnemonic.to_private_key(auth_mnemonic)
    auth_addr = algosdk.account.address_from_private_key(auth_pk)
    app_addr  = algosdk.logic.get_application_address(app_id)

    client = get_client()
    info   = client.account_info(app_addr)
    assets = info.get("assets", [])

    print(f"\nApp address : {app_addr}")
    print(f"App balance : {info['amount'] / 1e6:.6f} ALGO")
    print(f"Assets held : {len(assets)}")

    stale = [a for a in assets if a["asset-id"] != USDC_ASSET_ID]
    usdc  = [a for a in assets if a["asset-id"] == USDC_ASSET_ID]

    if usdc:
        print(f"  USDC balance: {usdc[0]['amount'] / 1e6:.6f} — keeping opt-in")

    if not stale:
        print("\nNo stale assets to close. Nothing to do.")
        return

    print(f"\nClosing {len(stale)} stale asset(s):")
    for a in stale:
        print(f"  ASA {a['asset-id']}  balance={a['amount']}")

    # Each close-out is an inner txn called via app call
    # We use an asset transfer with close_assets_to=auth_addr and amount=0
    # This must be signed by the app (inner txn) — so we call a special
    # admin method. If the contract doesn't have one, we use the low-level
    # approach: send an app call that issues an inner AssetTransfer close-out.
    #
    # Fallback: if contract has no close_asset method, we need to call
    # whatever admin op does an inner asset close. Print instructions.

    print("\nNOTE: To close stale assets the app must issue inner transactions.")
    print("If revenue_pool_v5.py has a 'close_asset' or 'admin_close_asset' method,")
    print("this script will call it. Otherwise add one (see below).\n")

    # Try calling b"close_asset" with the asset ID for each stale asset
    closed = 0
    for a in stale:
        asset_id = a["asset-id"]
        try:
            txn = transaction.ApplicationNoOpTxn(
                sender=auth_addr,
                sp=sp(client, fee=3000),
                index=app_id,
                app_args=[b"close_asset", asset_id.to_bytes(8, "big")],
                foreign_assets=[asset_id],
            )
            txid = client.send_transaction(txn.sign(auth_pk))
            wait(client, txid)
            print(f"  ✅ Closed ASA {asset_id}")
            closed += 1
        except Exception as e:
            print(f"  ❌ ASA {asset_id} — close_asset call failed: {e}")
            print(f"     → Add close_asset handler to contract (see instructions below)")

    if closed < len(stale):
        print("\n──────────────────────────────────────────────────")
        print("Add this to revenue_pool_v5.py approval_program():")
        print("──────────────────────────────────────────────────")
        print("""
    # In your router / method dispatch:
    If(method == Bytes("close_asset"),
        Seq(
            Assert(Txn.sender() == Global.creator_address()),
            asset_id := ScratchVar(),
            asset_id.store(Btoi(Txn.application_args[1])),
            InnerTxnBuilder.Execute({
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: asset_id.load(),
                TxnField.asset_amount: Int(0),
                TxnField.asset_receiver: Global.creator_address(),
                TxnField.asset_close_to: Global.creator_address(),
                TxnField.fee: Int(0),
            }),
            Approve(),
        )
    ),
""")

    info2 = client.account_info(app_addr)
    print(f"\nApp balance after cleanup: {info2['amount'] / 1e6:.6f} ALGO")
    print(f"Assets remaining: {len(info2.get('assets', []))}")

if __name__ == "__main__":
    main()