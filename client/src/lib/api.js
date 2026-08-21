// Shared API client — the single place that knows how to talk to the backend.
// Wraps fetch() with the base URL, the auth header, and consistent error handling,
// so pages don't each re-implement the "grab token + build header + parse JSON" dance.

const BASE_URL = import.meta.env.VITE_API_URL;

// Thrown for any failed request (network or non-2xx). `.message` is safe to show the user.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(method, path, { body, auth = true, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = localStorage.getItem("token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    // Preserve an abort so callers can show a "taking too long" message.
    if (e?.name === "AbortError") throw e;
    // Network failure (offline, DNS, CORS, etc.) — give the caller a friendly message
    throw new ApiError("Something went wrong. Please try again.", 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null; // empty body — defensive, this API always returns JSON
  }

  if (!res.ok) {
    throw new ApiError(data?.message || "Something went wrong", res.status);
  }

  return data;
}

export const api = {
  get: (path, opts) => request("GET", path, opts),
  post: (path, body, opts) => request("POST", path, { ...opts, body }),
  put: (path, body, opts) => request("PUT", path, { ...opts, body }),
  del: (path, opts) => request("DELETE", path, opts),
};
