import algosdk from 'algosdk';

import {
  StakingValidationError,
  assertStakingNetwork,
  assertStakingWritableAddresses,
} from './client.js';

function fail(message, code) {
  throw new StakingValidationError(message, { code });
}

function requireAddress(value, fieldName) {
  const address =
    typeof value === 'string' ? value : value?.toString?.();

  if (
    typeof address !== 'string' ||
    !/^[A-Z2-7]{58}$/.test(address) ||
    !algosdk.isValidAddress(address)
  ) {
    fail(
      `${fieldName} must be a canonical Algorand address`,
      'INVALID_TRANSACTION_ADDRESS',
    );
  }

  return address;
}

export function createDisposableSigner() {
  const account = algosdk.generateAccount();
  const address = account.addr.toString();

  assertStakingWritableAddresses([address]);

  function signTransaction(transaction, networkContext) {
    assertStakingNetwork(networkContext);

    if (!(transaction instanceof algosdk.Transaction)) {
      fail(
        'A constructed Algorand transaction is required',
        'INVALID_TRANSACTION',
      );
    }

    // Check the transaction itself, not only the node response.
    assertStakingNetwork({
      network: networkContext.network,
      expectedGenesisID: networkContext.expectedGenesisID,
      expectedGenesisHash: networkContext.expectedGenesisHash,
      suggestedParams: {
        genesisID: transaction.genesisID,
        genesisHash: transaction.genesisHash,
      },
    });

    const sender = requireAddress(transaction.sender, 'sender');

    assertStakingWritableAddresses([sender]);

    if (sender !== address) {
      fail(
        'Disposable signer may sign only its own account transactions',
        'DISPOSABLE_SENDER_MISMATCH',
      );
    }

    if (transaction.type !== 'pay' || !transaction.payment) {
      fail(
        'Only ordinary ALGO payments are currently supported',
        'UNSUPPORTED_TRANSACTION_TYPE',
      );
    }

    if (transaction.rekeyTo !== undefined && transaction.rekeyTo !== null) {
      fail(
        'Rekeying requires a dedicated initialization validator',
        'REKEY_FORBIDDEN',
      );
    }

    if (
      transaction.payment.closeRemainderTo !== undefined &&
      transaction.payment.closeRemainderTo !== null
    ) {
      fail(
        'Payment close-out is forbidden',
        'CLOSE_REMAINDER_FORBIDDEN',
      );
    }

    const receiver = requireAddress(
      transaction.payment.receiver,
      'payment.receiver',
    );

    assertStakingWritableAddresses([receiver]);

    if (
      typeof transaction.payment.amount !== 'bigint' ||
      transaction.payment.amount < 0n ||
      transaction.payment.amount > 0xffffffffffffffffn
    ) {
      fail(
        'Payment amount must be a uint64 bigint in microALGO',
        'INVALID_PAYMENT_AMOUNT',
      );
    }

    return transaction.signTxn(account.sk);
  }

  return Object.freeze({
    address,
    signTransaction,
  });
}