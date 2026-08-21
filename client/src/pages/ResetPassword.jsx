import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await api.post("/users/reset-password", { token, password }, { auth: false });
      setDone(true);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md p-8 rounded-2xl border border-slate-300 bg-white">
        {done ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-green-500">check_circle</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Password updated</h1>
            <p className="text-slate-500 text-sm mb-6">You can now sign in with your new password.</p>
            <Link
              to="/login"
              className="inline-flex w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 transition-colors font-semibold text-white shadow-sm active:scale-[0.98] items-center justify-center"
            >
              Go to login
            </Link>
          </div>
        ) : !token ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-red-400">error_outline</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid reset link</h1>
            <p className="text-slate-500 text-sm mb-6">
              This link is missing its token. Please request a new reset link.
            </p>
            <Link to="/forgot-password" className="text-amber-500 font-semibold hover:text-amber-600 transition">
              Request a new link
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Choose a new password</h1>
            <p className="text-slate-500 text-sm mb-6">Enter and confirm your new password below.</p>

            {error && (
              <p className="mb-4 rounded-lg bg-red-100 px-4 py-3 text-sm text-red-600">{error}</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  New password
                </label>
                <input
                  type="password"
                  id="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow text-base"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Confirm password
                </label>
                <input
                  type="password"
                  id="confirm"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow text-base"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 transition-colors font-semibold text-white shadow-sm active:scale-[0.98] disabled:bg-amber-300"
              >
                {loading ? "Resetting..." : "Reset password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
