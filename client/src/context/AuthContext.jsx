import { createContext, useContext, useState } from "react";

// Step 1: Create the context (the "radio channel")
const AuthContext = createContext(null);

// ── Helpers ──

/** Decode a JWT payload without verifying the signature.  Returns null on failure. */
function decodeJWTPayload(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/** True when the token has an `exp` claim in the past.  Treats un-decodable tokens as expired. */
function isTokenExpired(token) {
  const decoded = decodeJWTPayload(token);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp * 1000 < Date.now();
}

// Step 2: The provider — wraps the entire app, broadcasts auth state
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem("token");
    if (stored && isTokenExpired(stored)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return null;
    }
    return stored;
  });

  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    // Only restore user if token is still present (it may have been cleared above)
    if (stored && localStorage.getItem("token")) {
      try { return JSON.parse(stored); } catch { return null; }
    }
    return null;
  });

  // Called after successful login
  const login = (newToken, newUser) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  // Called on logout
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  // Called after profile update — keeps context in sync
  const updateUser = (updatedUser) => {
    localStorage.setItem("user", JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  // The value every component will receive
  const value = {
    user,
    token,
    isAuthenticated: !!(token && user),
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Step 3: The hook — how components access the context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth() must be used inside <AuthProvider>");
  }
  return context;
}
