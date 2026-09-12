import algosdk from 'algosdk';

const network = (
  process.env.NEXT_PUBLIC_ALGORAND_NETWORK || 'testnet'
).toLowerCase();

const server =
  network === 'mainnet'
    ? 'https://mainnet-api.algonode.cloud'
    : 'https://testnet-api.algonode.cloud';

export const publicAlgodClient = new algosdk.Algodv2('', server, '');

export function getPublicTransactionParams() {
  return publicAlgodClient.getTransactionParams().do();
}