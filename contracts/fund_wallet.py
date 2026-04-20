# fund_authority.py — one-time transfer from MetaWork to Authority
import algosdk
from algosdk.v2client import algod
from algosdk import transaction

client = algod.AlgodClient("", "https://testnet-api.algonode.cloud")

mw_mnemonic = input("MetaWork mnemonic: ").strip()
mw_pk   = algosdk.mnemonic.to_private_key(mw_mnemonic)
mw_addr = algosdk.account.address_from_private_key(mw_pk)

p = client.suggested_params()
p.flat_fee = True
p.fee = 1000

txn = transaction.PaymentTxn(
    sender=mw_addr,
    sp=p,
    receiver="MKWWYDMWT33CGMZPUW642EL5Z4N6UKDFNDJW3HKBRP3VMWVMEBGQOKZUBM",
    amt=10_000_000,  # 10 ALGO
)
txid = client.send_transaction(txn.sign(mw_pk))
print(f"Sent! TX: {txid}")

last = client.status()["last-round"]
for _ in range(10):
    r = client.pending_transaction_info(txid)
    if r.get("confirmed-round", 0) > 0:
        print("Confirmed ✅")
        break
    client.status_after_block(last + 1)
    last += 1