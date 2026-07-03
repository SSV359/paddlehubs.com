// /opt/paddlehubs-site/src/pages/AuthCallback.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { exchangeCodeForTokens } from "../lib/auth.js";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [err, setErr] = useState("");

  useEffect(() => {
    async function run() {
      try {
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const error = params.get("error");
        const errorDesc = params.get("error_description");

        if (error) throw new Error(errorDesc || error);
        if (!code) throw new Error("Missing code in callback URL.");

        await exchangeCodeForTokens(code);

        // ✅ Land on rankings after successful login
        navigate("/rankings", { replace: true });
      } catch (e) {
        setErr(String(e?.message || e));
      }
    }

    run();
  }, [location.search, navigate]);

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="rounded-2xl border border-line bg-surface p-6 text-ink">
        <div className="text-xl font-semibold">Signing you in…</div>
        <div className="text-sm text-muted mt-2">
          Please wait while we finish login.
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {err}
          </div>
        ) : null}
      </div>
    </div>
  );
}

