import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import auth from "../assets/auth-bg.jpg";

const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

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

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Signup failed");
        return;
      }

      navigate("/login");
    } catch (error) {
      console.log(error)
      setError("Something went wrong. Please try again.");
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
          <h1>Get Started!</h1>
          <p>Sign up to order from your favorite restaurants.</p>
          {error && (
            <p className="mb-4 rounded-lg bg-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col mb-4">
            <label htmlFor="name" className="mb-2">
              Full name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="border-2 w-full rounded-lg border-slate-300 px-4 py-2 mb-4"
            />

            <label htmlFor="email" className="mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className=" border-2 w-full rounded-lg border-slate-300 px-4 py-2 mb-4"
            />

            <label htmlFor="password" className="mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              className=" w-full border-2 rounded-lg border-slate-300 px-4 py-2 mb-4"
            />

            <label htmlFor="confirmPassword" className="mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className=" w-full border-2 rounded-lg border-slate-300 px-4 py-2 mb-4"
            />
            <button
              type="submit"
              disabled={loading}
              className="self-start rounded-lg bg-amber-500 px-6 py-3 font-semibold text-white mb-5"
            >
              {loading ? "Creating..." : "Create account"}
            </button>
            <p>
              Already have an account{" "}
              <Link to="/login" className="text-amber-500">
                Log in
              </Link>
            </p>
          </form>
          {/* <button type="submit" className="flex bg-blue-500 px-6 py-2 rounded-lg text-white">SUBMIT</button> */}
        </div>
      </div>
    </div>
  );
};

export default Signup;
