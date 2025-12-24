import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, Home, Menu, Swords, X } from "lucide-react";
import {
  loginUrl,
  logoutUrl,
  isLoggedIn,
  getUserEmail,
  clearAuth,
} from "../lib/auth.js";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const sync = () => setLoggedIn(isLoggedIn());
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    sync();
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const nav = useMemo(
    () => [
      { to: "/", label: "Dashboard", icon: Home, public: true },
      { to: "/court-booking", label: "Court Booking", icon: CalendarDays, public: false },
      { to: "/match-details", label: "Match Details", icon: Swords, public: false },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-950 to-fuchsia-950 text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-40 backdrop-blur bg-white/5 border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <button
            className="md:hidden inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-2"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 shadow-lg" />
            <div>
              <div className="text-lg font-semibold">PaddleHubs</div>
              <div className="text-xs text-white/70">pickleball club portal</div>
            </div>
          </div>

          {/* Login / Logout */}
          <div className="ml-auto flex items-center gap-2">
            {loggedIn ? (
              <>
                <div className="hidden sm:block text-xs text-white/70">
                  {getUserEmail() || "Signed in"}
                </div>

                {/* ✅ FIXED LOGOUT: button + correct /logout URL */}
                <button
                  onClick={() => {
                    clearAuth();
                    setLoggedIn(false);
                    window.location.href = logoutUrl();
                  }}
                  className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-2 text-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-2 text-sm"
                onClick={async () => {
                  const url = await loginUrl();
                  window.location.href = url;
                }}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-80 bg-slate-950 border-r border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Menu</div>
              <button
                className="rounded-xl border border-white/10 bg-white/5 p-2"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="mt-4 space-y-2">
              {nav
                .filter((n) => n.public || loggedIn)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        classNames(
                          "flex items-center gap-3 rounded-2xl px-3 py-3 border",
                          isActive
                            ? "bg-white/15 border-white/25"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        )
                      }
                    >
                      <Icon size={18} />
                      <span className="text-sm">{item.label}</span>
                    </NavLink>
                  );
                })}
            </nav>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60 uppercase">Founder</div>
              <div className="text-sm font-medium">Sai Sidharth Vinothkannan</div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop layout */}
      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="hidden md:block">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <nav className="space-y-2">
              {nav
                .filter((n) => n.public || loggedIn)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        classNames(
                          "flex items-center gap-3 rounded-2xl px-3 py-3 border",
                          isActive
                            ? "bg-gradient-to-r from-cyan-500/25 to-fuchsia-500/25 border-white/25"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        )
                      }
                    >
                      <Icon size={18} />
                      <span className="text-sm">{item.label}</span>
                    </NavLink>
                  );
                })}
            </nav>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">PaddleHubs</div>
              <div className="text-xs text-white/70 mt-1">
                Court bookings • Match tracking • Club hub
              </div>

              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-xs text-white/60 uppercase">Founder</div>
                <div className="text-sm font-medium">Sai Sidharth Vinothkannan</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0">
          <Outlet />
          <footer className="mt-8 text-xs text-white/50">
            © {new Date().getFullYear()} PaddleHubs • Founder: Sai Sidharth Vinothkannan
          </footer>
        </main>
      </div>
    </div>
  );
}

