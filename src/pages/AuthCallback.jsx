import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exchangeCodeForTokens } from "../lib/auth.js";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const err = params.get("error");

      if (err) {
        setError(err);
        return;
      }

      if (!code) {
        setError("Missing authorization code.");
        return;
      }

      try {
        await exchangeCodeForTokens(code);

        // clean up URL
        window.history.replaceState({}, document.title, "/");

        // go to dashboard
        navigate("/", { replace: true });
      } catch (e) {
        setError(e.message || "Login failed");
      }
    }

    run();
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-white">
      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-4">
          <div className="font-semibold">Authentication Error</div>
          <div className="text-sm mt-2">{error}</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
          Signing you in…
        </div>
      )}
    </div>
  );
}
