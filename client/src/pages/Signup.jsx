import React from "react";
import auth from "../assets/auth-bg.jpg";

const Signup = () => {
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
              Order from the best restaurants around you, fast, fresh and always on time.
            </p>
           </div>
          </div>
      </div>

      {/* RIGHT_SIDE */}
      <div className="w-full md:w-1/2">
        <h1>Welcome!</h1>
        <p>Sign up to order from your favorite restaurants.</p>
        <div>

        </div>
      </div>
    </div>
  );
};

export default Signup;
