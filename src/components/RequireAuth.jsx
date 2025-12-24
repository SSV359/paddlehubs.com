import { Navigate, useLocation } from "react-router-dom";
import { isLoggedIn } from "../lib/auth.js";

export default function RequireAuth({ children }) {
  const location = useLocation();

  if (!isLoggedIn()) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  return children;
}

