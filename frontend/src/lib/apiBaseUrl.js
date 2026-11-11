export function getApiBaseUrl(configuredOrigin, isProduction) {
  if (isProduction || typeof configuredOrigin !== "string") return "";
  return configuredOrigin.trim().replace(/\/+$/, "");
}
