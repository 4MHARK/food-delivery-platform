import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import auth from "../assets/auth-bg.jpg";

const Signup = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "CUSTOMER",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Wake up the Render server on page load (cold start workaround)
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/`).catch(() => {});
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (
      !formData.name ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError("All fields are required");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Signup failed");
        return;
      }

      login(data.token, data.user);

      if (data.user.role === "OWNER") {
        navigate("/dashboard");
      } else {
        navigate("/restaurants");
      }
    } catch (error) {
      console.log(error);
      if (error.name === "AbortError") {
        setError("Server is taking too long to respond. Please try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* LEFT_SIDE */}
      <div
        className="hidden md:block md:w-1/2 bg-slate-900 bg-cover bg-center relative"
        style={{ backgroundImage: `url(${auth})` }}
      >
        <div className="absolute bg-slate-900/70 inset-0"></div>
        <div>
          <h1 className=" animate-fade-in text-white text-3xl font-semibold p-10 absolute z-10 top-0 left-0">
            <span className="text-amber-500">Chow</span>Zilla
          </h1>
        </div>

        <div className="inset-0 absolute z-10 flex items-center justify-center">
          <div className="text-left max-w-lg px-6 animate-fade-up">
            <h2 className=" mb-4 text-4xl font-bold leading-tight text-white">
              The definitive food experience, right at your fingertips.
            </h2>
            <p className="text-slate-300 max-w-lg text-lg leading-relaxed">
              Order from the best restaurants around you, fast, fresh and always
              on time.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT_SIDE */}
      <div className="flex w-full md:w-1/2 items-center justify-center px-4 sm:px-6 animate-slide-in">
        <div className="w-full max-w-md p-8 rounded-2xl border border-slate-300">
          {/* Mobile Branding */}
          <div className="md:hidden mb-6 text-center">
            <h1 className="text-2xl font-bold">
              <span className="text-amber-500">Chow</span>Zilla
            </h1>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Get Started!
            </h1>
            <p className="text-slate-500 text-base">
              Sign up to order from your favorite restaurants.
            </p>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
                Full name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleChange}
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow placeholder:text-slate-400 text-base"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow placeholder:text-slate-400 text-base"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow placeholder:text-slate-400 text-base"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                required
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow placeholder:text-slate-400 text-base"
              />
            </div>

            {/* Role Selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                I want to...
              </label>
              <div className="flex gap-4">
                <label
                  className={`flex-1 flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition ${
                    formData.role === "CUSTOMER"
                      ? "border-amber-500 bg-amber-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="CUSTOMER"
                    checked={formData.role === "CUSTOMER"}
                    onChange={handleChange}
                    className="accent-amber-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Customer</p>
                    <p className="text-xs text-slate-400">Order food</p>
                  </div>
                </label>

                <label
                  className={`flex-1 flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition ${
                    formData.role === "OWNER"
                      ? "border-amber-500 bg-amber-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="OWNER"
                    checked={formData.role === "OWNER"}
                    onChange={handleChange}
                    className="accent-amber-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Owner</p>
                    <p className="text-xs text-slate-400">Run a restaurant</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 transition-colors font-semibold text-white shadow-sm active:scale-[0.98]"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>

          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Or continue with
              </span>
            </div>
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 transition-colors font-semibold text-sm text-slate-700 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-xl">login</span>
              Google
            </button>
            <button
              type="button"
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 transition-colors font-semibold text-sm text-slate-700 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-xl">apps</span>
              Apple
            </button>
          </div>

          {/* Login Link */}
          <p className="mt-6 text-center text-base text-slate-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-amber-500 hover:text-amber-600 transition-colors"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
