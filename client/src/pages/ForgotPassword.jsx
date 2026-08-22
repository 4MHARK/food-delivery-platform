import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email) { setError("Please enter your email."); return; }
    setLoading(true);
    try {
      await api.post("/users/forgot-password", { email }, { auth: false });
      setSent(true);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md p-8 rounded-2xl border border-slate-300 bg-white">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition mb-6"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to login
        </Link>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Forgot your password?</h1>
        <p className="text-slate-500 text-sm mb-6">
          Enter the email you signed up with and we&apos;ll send you a link to reset your password.
        </p>

        {sent ? (
          <div className="rounded-xl bg-green-50 px-4 py-4 text-sm text-green-700">
            If an account exists for that email, a reset link has been sent. Check your inbox (and spam).
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <p className="rounded-lg bg-red-100 px-4 py-3 text-sm text-red-600">{error}</p>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow text-base"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 transition-colors font-semibold text-white shadow-sm active:scale-[0.98] disabled:bg-amber-300"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
