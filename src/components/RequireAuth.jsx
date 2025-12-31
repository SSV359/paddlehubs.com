import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { isLoggedIn, loginUrl } from "../lib/auth.js";

export default function RequireAuth({ children }) {
  const location = useLocation();

  useEffect(() => {
    async function goLogin() {
      if (isLoggedIn()) return;

      // remember where user tried to go (so we can return after login)
      const next = location.pathname + location.search;
      sessionStorage.setItem("ph_post_login_redirect", next);

      const url = await loginUrl();
      window.location.href = url;
    }

    goLogin();
  }, [location.pathname, location.search]);

  // While redirecting to Hosted UI
  if (!isLoggedIn()) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
          Redirecting to login…
        </div>
      </div>
    );
  }

  return children;
}

