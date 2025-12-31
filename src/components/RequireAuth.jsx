import { Navigate, useLocation } from "react-router-dom";
import { isLoggedIn } from "../lib/auth.js";

export default function RequireAuth({ children }) {
  const location = useLocation();

  if (!isLoggedIn()) {
    // Save where user wanted to go, so AuthCallback can send them back
    try {
      const target = location.pathname + (location.search || "");
      sessionStorage.setItem("ph_post_login_redirect", target);
    } catch {}

    // Send them to dashboard (they click Login button there)
    return <Navigate to="/" replace />;
  }

  return children;
}

