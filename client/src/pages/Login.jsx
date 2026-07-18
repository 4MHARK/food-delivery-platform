import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import auth from "../assets/auth-bg.jpg";

const Login = () => {

  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({email: "", password: ""});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    if (!formData.email || !formData.password) {
      setError("All fields are required!");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/users/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
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
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex min-h-screen">
      {/* LEFT SIDE */}
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

      {/* RIGHT SIDE */}
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
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome back</h1>
            <p className="text-slate-500 text-base">Please enter your details to sign in.</p>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
              <div className="flex justify-between items-center mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>
                <a
                  href="#"
                  className="text-sm font-semibold text-amber-500 hover:text-amber-600 transition-colors"
                >
                  Forgot Password?
                </a>
              </div>
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 transition-colors font-semibold text-white shadow-sm active:scale-[0.98]"
            >
              {loading ? "Signing in..." : "Sign in"}
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

          {/* Sign Up Link */}
          <p className="mt-6 text-center text-base text-slate-500">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="font-semibold text-amber-500 hover:text-amber-600 transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
