const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

export function isAllowedUrl(input: string): boolean {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "[::1]"
  ) {
    return false;
  }

  return !PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

export function normalizeUrl(input: string): string {
  const url = new URL(input);
  // Drop fragment, keep search params
  url.hash = "";
  return url.toString();
}
