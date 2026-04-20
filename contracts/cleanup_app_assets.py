# close_stale_optins.py
# Run this BEFORE deploy_v5.py to reclaim ALGO locked in stale ASA opt-ins

import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import algosdk
from algosdk.v2client import algod
from algosdk import transaction

ALGOD_URL     = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN   = ""
USDC_ASSET_ID = 10458941  # keep this one always

def get_client():
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_URL)

def sp(client):
    p = client.suggested_params()
    p.flat_fee = True
    p.fee = 1000
    return p

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

def close_stale_optins(client, pk, addr, keep_ids):
    info     = client.account_info(addr)
    assets   = info.get("assets", [])
    stale    = [a for a in assets if a["asset-id"] not in keep_ids]

    print(f"\nWallet: {addr}")
    print(f"  Total opted-in assets : {len(assets)}")
    print(f"  Keeping               : {keep_ids}")
    print(f"  Closing               : {len(stale)}")

    if not stale:
        print("  Nothing to close.")
        return

    recovered = 0
    for a in stale:
        asset_id = a["asset-id"]
        amount   = a["amount"]
        try:
            asset_info = client.asset_info(asset_id)
            creator    = asset_info["params"]["creator"]
        except Exception:
            creator = addr

        # If we hold a non-zero balance we must send it somewhere.
        # For revenue ASAs we created, the app is the creator/reserve —
        # but since the app may be deleted, fall back to addr (only valid at 0).
        close_to = creator if amount == 0 or creator != addr else addr

        txn = transaction.AssetTransferTxn(
            sender=addr,
            sp=sp(client),
            receiver=close_to,
            amt=amount,
            index=asset_id,
            close_assets_to=close_to,
        )
        try:
            txid = client.send_transaction(txn.sign(pk))
            wait(client, txid)
            recovered += 100_000  # 0.1 ALGO MBR per opt-in
            print(f"  ✅ Closed ASA {asset_id}  (balance was {amount})  +0.1 ALGO reclaimed")
        except Exception as e:
            print(f"  ⚠️  Skipped ASA {asset_id}: {e}")

    print(f"\n  Recovered ~{recovered/1e6:.1f} ALGO from {len(stale)} closed opt-ins")

    # Show updated balance
    info    = client.account_info(addr)
    bal     = info["amount"]
    min_bal = info["min-balance"]
    print(f"  New balance : {bal/1e6:.4f} ALGO")
    print(f"  MBR locked  : {min_bal/1e6:.4f} ALGO")
    print(f"  Free        : {(bal - min_bal)/1e6:.4f} ALGO")

def destroy_created_assets(client, pk, addr, keep_ids):
    """
    Destroy ASAs that were CREATED by this wallet (not just opted into).
    Requires the wallet to hold the full supply before destroying.
    """
    info = client.account_info(addr)
    
    # Find assets this wallet created
    created = []
    for a in info.get("assets", []):
        asset_id = a["asset-id"]
        if asset_id in keep_ids:
            continue
        try:
            asset_info = client.asset_info(asset_id)
            if asset_info["params"]["creator"] == addr:
                created.append((asset_id, a["amount"]))
        except Exception:
            pass

    if not created:
        print("  No created assets to destroy.")
        return

    print(f"  Destroying {len(created)} created asset(s)...")
    for asset_id, balance in created:
        try:
            # Step 1: if balance is 0, just send destroy tx
            # Step 2: if balance > 0, must clawback/send to self first — 
            #         but creator holding full supply can destroy directly
            txn = transaction.AssetConfigTxn(
                sender=addr,
                sp=sp(client),
                index=asset_id,
                strict_empty_address_check=False,
                # All zero addresses = destroy
                manager="",
                reserve="",
                freeze="",
                clawback="",
            )
            # Actually destroy requires AssetConfigTxn with no params at all:
            txn = transaction.AssetDestroyTxn(
                sender=addr,
                sp=sp(client),
                index=asset_id,
            )
            txid = client.send_transaction(txn.sign(pk))
            wait(client, txid)
            print(f"    ✅ Destroyed ASA {asset_id}")
        except Exception as e:
            print(f"    ⚠️  Could not destroy ASA {asset_id}: {e}")
            print(f"       (Must hold 100% of supply to destroy)")

def main():
    mnemonic = os.environ.get("AUTHORITY_MNEMONIC", "").strip()
    if not mnemonic:
        mnemonic = input("Enter authority mnemonic: ").strip()

    pk   = algosdk.mnemonic.to_private_key(mnemonic)
    addr = algosdk.account.address_from_private_key(pk)

    client = get_client()

    # Only keep USDC — everything else is a stale test ASA
    # If you want to keep the current active ASA too, add its ID here:
    #   keep_ids = {USDC_ASSET_ID, 759077634}
    keep_ids = {USDC_ASSET_ID}

    close_stale_optins(client, pk, addr, keep_ids)
    destroy_created_assets(client, pk, addr, keep_ids)  # destroy created ASAs
    print("\nDone. You can now run deploy_v5.py.")

if __name__ == "__main__":
    main()