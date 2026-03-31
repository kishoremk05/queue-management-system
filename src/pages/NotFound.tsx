import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 text-slate-100 [font-family:'Space_Grotesk',system-ui,sans-serif]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-br from-blue-600/30 via-violet-500/20 to-cyan-400/20 blur-3xl" />
        <div className="absolute -left-24 top-44 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
      </div>
      <div className="relative max-w-lg rounded-2xl border border-slate-700/70 bg-slate-900/70 p-8 text-center shadow-2xl shadow-blue-900/25 backdrop-blur-xl">
        <h1 className="mb-2 text-6xl font-bold tracking-tight">404</h1>
        <p className="mb-6 text-xl text-slate-300">Oops! Page not found</p>
        <a
          href="/"
          className="inline-flex rounded-md bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-2.5 font-medium text-white transition hover:opacity-95"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
