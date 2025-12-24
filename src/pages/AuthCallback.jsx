import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exchangeCodeForTokens } from "../lib/auth.js";

export default function AuthCallback() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (!code) throw new Error("Missing code in callback URL");

        await exchangeCodeForTokens(code);

        // ✅ remove ?code=... from address bar
        window.history.replaceState({}, document.title, "/match-details");

        // ✅ go to a protected page to confirm login is active
        nav("/match-details", { replace: true });
      } catch (e) {
        console.error(e);
        setMsg("Login failed: " + (e?.message || "unknown error"));
      }
    })();
  }, [nav]);

  return (
    <div className="mx-auto max-w-xl mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
      <div className="text-xl font-semibold">Login</div>
      <div className="mt-2 text-sm text-white/70">{msg}</div>
    </div>
  );
}

