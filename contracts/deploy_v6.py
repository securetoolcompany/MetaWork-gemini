import os
import base64
from algosdk import account, mnemonic, logic
from algosdk.v2client import algod
from algosdk.transaction import ApplicationCreateTxn, StateSchema, wait_for_confirmation

# Import OptimizeOptions
from pyteal import compileTeal, Mode, OptimizeOptions

# Make sure this matches your actual contract filename
import revenue_pool_v6 

# --- Configuration ---
ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN   = ""

CREATOR_MNEMONIC    = os.getenv("CREATOR_MNEMONIC", "your twenty five word mnemonic...")
CREATOR_PRIVATE_KEY = mnemonic.to_private_key(CREATOR_MNEMONIC)
CREATOR_ADDRESS     = account.address_from_private_key(CREATOR_PRIVATE_KEY)

USDC_ASSET_ID = 10458941  # testnet; change to 31566704 for mainnet

def compile_program(client, source_code):
    compile_response = client.compile(source_code)
    return base64.b64decode(compile_response["result"])

def deploy_contract():
    client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)
    
    print("1. Compiling PyTeal to TEAL with Scratch Slot Optimization...")
    
    # --- FIX 1: optimize=OptimizeOptions(scratch_slots=True) ---
    approval_teal = compileTeal(
        revenue_pool_v6.approval_program(), 
        mode=Mode.Application, 
        version=10,
        optimize=OptimizeOptions(scratch_slots=True)
    )
    
    clear_teal = compileTeal(
        revenue_pool_v6.clear_program(), 
        mode=Mode.Application, 
        version=10,
        optimize=OptimizeOptions(scratch_slots=True)
    )
    
    with open("contracts/approval.teal", "w") as f:
        f.write(approval_teal)

    with open("contracts/clear.teal", "w") as f:
        f.write(clear_teal)

    # Safe substitution
    approval_teal = approval_teal.replace("TMPL_USDC_ASSET_ID", str(USDC_ASSET_ID))
    
    print("2. Compiling TEAL to bytecode via Algod...")
    approval_bytes = compile_program(client, approval_teal)
    clear_bytes    = compile_program(client, clear_teal)
    
    global_schema = StateSchema(num_uints=0, num_byte_slices=0)
    local_schema  = StateSchema(num_uints=0, num_byte_slices=0)
    
    print("3. Building ApplicationCreateTxn with Extra Pages...")
    sp  = client.suggested_params()
    
    # --- FIX 2: extra_pages=3 ---
    txn = ApplicationCreateTxn(
        sender=CREATOR_ADDRESS,
        sp=sp,
        on_complete=0,
        approval_program=approval_bytes,
        clear_program=clear_bytes,
        global_schema=global_schema,
        local_schema=local_schema,
        extra_pages=3  # Allots up to 8192 bytes total
    )
    
    print("4. Signing and submitting...")
    signed_txn = txn.sign(CREATOR_PRIVATE_KEY)
    tx_id      = client.send_transaction(signed_txn)
    
    print(f"   Waiting for confirmation... TXID: {tx_id}")
    result = wait_for_confirmation(client, tx_id, 4)
    
    app_id      = result["application-index"]
    app_address = logic.get_application_address(app_id)
    
    print(f"\n✅ Deployment Successful!")
    print(f"   App ID:      {app_id}")
    print(f"   App Address: {app_address}")
    print("\nNext: fund the App Address with enough ALGO to cover the initial MBR before calling create_pool.")
    
    return app_id

if __name__ == "__main__":
    deploy_contract()