import "server-only";
import algosdk from "algosdk";

export function getAlgodClient() {
  const server = process.env.ALGOD_SERVER;
  const gatewaySecret = process.env.ALGOD_GATEWAY_SECRET;

  if (!server || !gatewaySecret) {
    throw new Error(
      "Missing ALGOD_SERVER or ALGOD_GATEWAY_SECRET environment variable"
    );
  }

  return new algosdk.Algodv2("", server, "", {
    "X-API-Key": gatewaySecret,
  });
}