import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const GATEWAY_SECRET_HEADER = "x-timecloud-gateway-secret";
export const CLIENT_IP_HEADER = "x-timecloud-client-ip";

const gatewaySecretPattern = /^[a-f\d]{64}$/i;

export function getGatewaySecretBytes(secret) {
  if (typeof secret !== "string" || !gatewaySecretPattern.test(secret)) {
    return null;
  }
  return Buffer.from(secret, "hex");
}

export function gatewaySecretsMatch(expectedSecret, suppliedSecret) {
  if (!expectedSecret || typeof suppliedSecret !== "string") return false;
  if (!gatewaySecretPattern.test(suppliedSecret)) return false;
  const suppliedBytes = Buffer.from(suppliedSecret, "hex");
  return (
    expectedSecret.length === suppliedBytes.length &&
    timingSafeEqual(expectedSecret, suppliedBytes)
  );
}

export function isValidCanonicalClientIp(value) {
  return typeof value === "string" && isIP(value) !== 0;
}