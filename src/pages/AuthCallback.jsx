import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exchangeCodeForTokens } from "../lib/auth.js";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function run() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const err = params.get("error");

      if (err) {
        if (alive) setError(err);
        return;
      }

      if (!code) {
        if (alive) setError("Missing authorization code.");
        return;
      }

      try {
        // Exchange code → tokens (PKCE)
        await exchangeCodeForTokens(code);

        // Clean up the URL (remove ?code=...)
        window.history.replaceState({}, document.title, "/");

        // Redirect back to originally requested page (or dashboard)
        const target =
          sessionStorage.getItem("ph_post_login_redirect") || "/";
        sessionStorage.removeItem("ph_post_login_redirect");

        if (alive) {
          navigate(target, { replace: true });
        }
      } catch (e) {
        if (alive) {
          setError(e.message || "Login failed");
        }
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-white">
      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-4 max-w-md text-center">
          <div className="font-semibold text-lg">Authentication Error</div>
          <div className="text-sm mt-2 opacity-90">{error}</div>
          <div className="text-xs mt-4 opacity-70">
            Please try logging in again.
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
          Signing you in…
        </div>
      )}
    </div>
  );
}

