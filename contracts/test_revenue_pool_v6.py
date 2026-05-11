import os
from algosdk import account, mnemonic, logic, encoding
from algosdk.v2client import algod
from algosdk import transaction as txn_module
from algosdk.transaction import (
    PaymentTxn,
    AssetTransferTxn,
    ApplicationCallTxn,
    wait_for_confirmation,
)

# ─── Configuration ────────────────────────────────────────────────────────────
APP_ID            = int(os.getenv("APP_ID",            "762121971"))
ALGOD_ADDRESS     =     os.getenv("ALGOD_ADDRESS",     "https://testnet-api.algonode.cloud")
ALGOD_TOKEN       =     os.getenv("ALGOD_TOKEN",       "")
CREATOR_MNEMONIC  =     os.getenv("CREATOR_MNEMONIC",  "")
USDC_ASSET_ID     = int(os.getenv("USDC_ASSET_ID",     "10458941"))

FUND_TARGET_MICROALGOS = int(os.getenv("FUND_TARGET_MICROALGOS", "1000000"))  # 1 ALGO

IP_ID      = os.getenv("IP_ID",      "mw-demo-001").encode()
ASSET_NAME = os.getenv("ASSET_NAME", "MetaWork Revenue Token").encode()
UNIT_NAME  = os.getenv("UNIT_NAME",  "MWREV").encode()

STAKEHOLDERS = [
    (os.getenv("STK1_ADDR", "WNXGR6DCD4FWCK62JHWNI6OE37XMJGZFHO42FYFEGW5P3G4MYO4AJYJGTI"), 6000),
    (os.getenv("STK2_ADDR", "REPLACE_ME_WITH_REAL_TESTNET_ADDRESS"),                          4000),
]

ROUND_PAYEES = [
    (os.getenv("PAYEE1_ADDR", STAKEHOLDERS[0][0]), 6_000_000),
    (os.getenv("PAYEE2_ADDR", STAKEHOLDERS[1][0]), 4_000_000),
]
ROUND_TOTAL = sum(amt for _, amt in ROUND_PAYEES)


# ─── Helpers ─────────────────────────────────────────────────────────────────
def algod_client():
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)

def creator_keys():
    if not CREATOR_MNEMONIC:
        raise RuntimeError("Set CREATOR_MNEMONIC in environment")
    sk   = mnemonic.to_private_key(CREATOR_MNEMONIC)
    addr = account.address_from_private_key(sk)
    return sk, addr

def app_addr():
    return logic.get_application_address(APP_ID)

def pool_key(ip_id: bytes) -> bytes:
    return b"p_" + ip_id

def round_key(ip_id: bytes, round_id: int) -> bytes:
    return b"rnd_" + ip_id + round_id.to_bytes(8, "big")

def addr_to_bytes(addr_str: str) -> bytes:
    """Decode a standard base32 Algorand address to 32 raw bytes."""
    return encoding.decode_address(addr_str)

def encode_stakeholders(items) -> bytes:
    out = b""
    for addr, bps in items:
        out += addr_to_bytes(addr) + int(bps).to_bytes(2, "big")
    return out

def encode_round_payees(items) -> bytes:
    out = b""
    for addr, amt in items:
        out += addr_to_bytes(addr) + int(amt).to_bytes(8, "big")
    return out

def pool_box_mbr(ip_id: bytes, sh_count: int) -> int:
    key_len  = 2 + len(ip_id)
    box_size = 73 + sh_count * 35
    return 2500 + 400 * (key_len + box_size)

def round_box_mbr(ip_id: bytes, n_entries: int) -> int:
    key_len  = 4 + len(ip_id) + 8
    box_size = 18 + n_entries * 41
    return 2500 + 400 * (key_len + box_size)

def send_group(c, txns, *signers):
    txn_module.assign_group_id(txns)
    signed = [t.sign(sk) for t, sk in zip(txns, signers)]
    txid   = c.send_transactions(signed)
    return wait_for_confirmation(c, txid, 4)

def get_asa_id_from_logs(result) -> int:
    import base64
    prefix = b"asset_id:"
    for raw in result.get("logs", []):
        if isinstance(raw, str):
            raw = base64.b64decode(raw)
        if raw.startswith(prefix):
            return int.from_bytes(raw[len(prefix):], "big")
    raise RuntimeError("asset_id log not found in create_pool result")


# ─── Steps ───────────────────────────────────────────────────────────────────
def ensure_app_funded(c, creator_sk, creator_addr):
    balance = int(c.account_info(app_addr())["amount"])
    print(f"  App balance: {balance:,} microAlgos", end="")
    if balance >= FUND_TARGET_MICROALGOS:
        print(" — already funded, skipping.")
        return
    delta = FUND_TARGET_MICROALGOS - balance
    print(f" — funding with {delta:,} microAlgos...")
    sp  = c.suggested_params()
    pay = PaymentTxn(creator_addr, sp, app_addr(), delta)
    txid = c.send_transaction(pay.sign(creator_sk))
    wait_for_confirmation(c, txid, 4)
    print(f"  App balance after fund: {int(c.account_info(app_addr())['amount']):,} microAlgos")


def step_create_pool(c, creator_sk, creator_addr):
    sh_bytes = encode_stakeholders(STAKEHOLDERS)
    box_name = pool_key(IP_ID)
    mbr      = pool_box_mbr(IP_ID, len(STAKEHOLDERS))
    print(f"  Pool box MBR: {mbr:,} microAlgos")

    sp  = c.suggested_params()
    pay = PaymentTxn(creator_addr, sp, app_addr(), mbr)

    sp2          = c.suggested_params()
    sp2.flat_fee = True
    sp2.fee      = 3000  # outer + USDC opt-in inner + AssetConfig inner
    app = ApplicationCallTxn(
        sender         = creator_addr,
        sp             = sp2,
        index          = APP_ID,
        on_complete    = 0,
        app_args       = [
            b"create_pool",
            IP_ID,
            ASSET_NAME,
            UNIT_NAME,
            sh_bytes,
            (0).to_bytes(8, "big"),  # companion tx is index 0 in group
        ],
        boxes          = [(APP_ID, box_name)],
        foreign_assets = [USDC_ASSET_ID],
    )

    result = send_group(c, [pay, app], creator_sk, creator_sk)
    asa_id = get_asa_id_from_logs(result)
    print(f"  Pool created. Revenue ASA ID: {asa_id}")
    return asa_id


def step_deposit_usdc(c, creator_sk, creator_addr, amount_micro_usdc: int):
    box_name = pool_key(IP_ID)
    print(f"  Depositing {amount_micro_usdc:,} micro-USDC...")

    sp   = c.suggested_params()
    xfer = AssetTransferTxn(
        sender   = creator_addr,
        sp       = sp,
        receiver = app_addr(),
        amt      = amount_micro_usdc,
        index    = USDC_ASSET_ID,
    )

    sp2 = c.suggested_params()
    app = ApplicationCallTxn(
        sender         = creator_addr,
        sp             = sp2,
        index          = APP_ID,
        on_complete    = 0,
        app_args       = [
            b"deposit_usdc",
            IP_ID,
            (0).to_bytes(8, "big"),  # companion tx is index 0 in group
        ],
        boxes          = [(APP_ID, box_name)],
        foreign_assets = [USDC_ASSET_ID],
    )

    send_group(c, [xfer, app], creator_sk, creator_sk)
    print(f"  Deposited {amount_micro_usdc:,} micro-USDC")


def step_create_payout_round(c, creator_sk, creator_addr):
    pool_box  = pool_key(IP_ID)
    rnd_box   = round_key(IP_ID, 1)
    payees    = encode_round_payees(ROUND_PAYEES)
    mbr       = round_box_mbr(IP_ID, len(ROUND_PAYEES))
    print(f"  Round box MBR: {mbr:,} microAlgos")

    sp  = c.suggested_params()
    pay = PaymentTxn(creator_addr, sp, app_addr(), mbr)

    sp2          = c.suggested_params()
    sp2.flat_fee = True
    sp2.fee      = 1000
    app = ApplicationCallTxn(
        sender      = creator_addr,
        sp          = sp2,
        index       = APP_ID,
        on_complete = 0,
        app_args    = [
            b"create_payout_round",
            IP_ID,
            ROUND_TOTAL.to_bytes(8, "big"),
            payees,
            (0).to_bytes(8, "big"),  # companion tx is index 0 in group
        ],
        boxes = [(APP_ID, pool_box), (APP_ID, rnd_box)],
    )

    send_group(c, [pay, app], creator_sk, creator_sk)
    print("  Created payout round 1")


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    c                        = algod_client()
    creator_sk, creator_addr = creator_keys()

    print(f"App ID:      {APP_ID}")
    print(f"App Address: {app_addr()}")
    print(f"Creator:     {creator_addr}\n")

    for addr, _ in STAKEHOLDERS:
        if "REPLACE_ME" in addr:
            raise RuntimeError(f"Replace placeholder stakeholder address: {addr}")

    print("=== STEP 0: Ensure app is funded ===")
    ensure_app_funded(c, creator_sk, creator_addr)

    print("\n=== STEP 1: create_pool ===")
    asa_id = step_create_pool(c, creator_sk, creator_addr)

    print("\n=== STEP 2: deposit_usdc ===")
    step_deposit_usdc(c, creator_sk, creator_addr, ROUND_TOTAL)

    print("\n=== STEP 3: create_payout_round ===")
    step_create_payout_round(c, creator_sk, creator_addr)

    print(f"""
=== All setup steps completed successfully ===
  Revenue ASA ID : {asa_id}
  Pool box       : {pool_key(IP_ID)}
  Round 1 box    : {round_key(IP_ID, 1)}

Next manual tests:
  claim_revenue_round  — from a stakeholder account
  claim_revenue_all    — from a stakeholder account, multiple rounds
  cleanup_round        — after all entries claimed, to recover MBR
  claim_tokens         — distribute the revenue ASA to stakeholders
""")


if __name__ == "__main__":
    main()
