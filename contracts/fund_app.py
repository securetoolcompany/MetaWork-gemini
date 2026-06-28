# Run this standalone — paste into a new file fund_app.py in contracts/
import os
from algosdk import account, mnemonic
from algosdk.v2client import algod
from algosdk.transaction import PaymentTxn, wait_for_confirmation

ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
APP_ADDRESS   = "O3NVHXTEBBICZRRSCY5QWPF3FRNQPFVGLBAXAGHOF5F2WOVLT5A6V6WYHQ"

pk  = mnemonic.to_private_key(os.getenv("CREATOR_MNEMONIC"))
addr = account.address_from_private_key(pk)
client = algod.AlgodClient("", ALGOD_ADDRESS)

sp  = client.suggested_params()
txn = PaymentTxn(sender=addr, sp=sp, receiver=APP_ADDRESS, amt=200_000)
tx_id = client.send_transaction(txn.sign(pk))
wait_for_confirmation(client, tx_id, 6)
print(f"Funded. TXID: {tx_id}")