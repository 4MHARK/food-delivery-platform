// Decode a JWT payload without verifying the signature. Returns null on failure.
export function decodeJWTPayload(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

// True when the token has an `exp` claim in the past. Treats un-decodable tokens as expired.
export function isTokenExpired(token) {
  const decoded = decodeJWTPayload(token);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp * 1000 < Date.now();
}
