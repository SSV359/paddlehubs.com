// /opt/paddlehubs-site/src/components/Layout.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { CalendarDays, Home, Menu, Swords, User, X, Users, Trophy, BarChart3, Moon, Sun, Palette, Check, Medal, ShieldCheck, Activity } from "lucide-react";

import PaddleLogo from "./PaddleLogo.jsx";
import { loginUrl, logoutUrl, isLoggedIn, isAdmin, getUserEmail, clearAuth, openAuthUrl } from "../lib/auth.js";
import { api } from "../lib/api.js";
import { getPreferredMode, setMode, getPreferredPalette, setPalette, PALETTES } from "../lib/theme.js";
import { classNames } from "./ui.jsx";

function emailPrefix(email) {
  return (email || "").split("@")[0] || email || "";
}

function ModeToggle() {
  const [mode, setModeState] = useState(getPreferredMode());

  function toggle() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    setModeState(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex items-center justify-center rounded-xl border border-line bg-surface2 p-2.5 text-ink transition hover:bg-line"
    >
      {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function PalettePicker() {
  const [open, setOpen] = useState(false);
  const [palette, setPaletteState] = useState(getPreferredPalette());
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(id) {
    setPalette(id);
    setPaletteState(id);
    setOpen(false);
  }

  const current = PALETTES.find((p) => p.id === palette);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Choose color theme"
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-xl border border-line bg-surface2 p-2.5 text-ink transition hover:bg-line"
      >
        <Palette size={16} style={{ color: current?.swatch }} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(13rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-2 shadow-lg">
          <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted">Court surface</div>
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => choose(p.id)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-surface2"
            >
              <span
                className="h-4 w-4 rounded-full border border-line"
                style={{ backgroundColor: p.swatch }}
              />
              <span className="flex-1 text-left">{p.label}</span>
              {p.id === palette && <Check size={14} className="text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [admin, setAdmin] = useState(isAdmin());
  const [displayName, setDisplayName] = useState("");

  const location = useLocation();

  async function refreshMe() {
    const li = isLoggedIn();
    setLoggedIn(li);
    setAdmin(li && isAdmin());

    if (!li) {
      setDisplayName("");
      return;
    }

    const email = getUserEmail();
    const fallback = emailPrefix(email);
    setDisplayName((prev) => prev || fallback);

    try {
      const me = await api.getMe();
      const dn = (me?.displayName || "").trim();
      setDisplayName(dn || fallback);
    } catch {
      setDisplayName(fallback);
    }
  }

  useEffect(() => {
    const sync = () => refreshMe();

    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("ph_auth_changed", sync);

    refreshMe();

    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("ph_auth_changed", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setOpen(false);
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const nav = useMemo(
    () => [
      { to: "/", label: "Dashboard", icon: Home, public: true },
      { to: "/club-activity", label: "Club Activity", icon: Users, public: true },
      { to: "/rankings", label: "Rankings", icon: BarChart3, public: true },
      { to: "/player-rankings", label: "Player Rankings", icon: Medal, public: true },
      { to: "/court-booking", label: "Court Booking", icon: CalendarDays, public: false },
      { to: "/match-details", label: "Match Details", icon: Swords, public: false },
      { to: "/tournaments", label: "Tournaments", icon: Trophy, public: false },
      { to: "/profile", label: "My Profile", icon: User, public: false },
      { to: "/admin/users", label: "Registered Users", icon: ShieldCheck, public: false, adminOnly: true },
      { to: "/admin/analytics", label: "Site Analytics", icon: Activity, public: false, adminOnly: true },
    ],
    []
  );

  function NavItem({ item }) {
    const Icon = item.icon;
    return (
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          classNames(
            "group flex items-center gap-3 rounded-xl border-l-[3px] px-3 py-3 text-sm font-medium transition",
            isActive
              ? "border-l-signature bg-accent/10 text-ink"
              : "border-l-transparent text-muted hover:border-l-line hover:bg-surface2 hover:text-ink"
          )
        }
      >
        <Icon size={18} className={classNames("transition", "group-hover:text-accent")} />
        <span>{item.label}</span>
      </NavLink>
    );
  }

  return (
    <div className="court-field min-h-screen text-ink">
      <div className="sticky top-0 z-40 border-b border-line bg-bg/85 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <button
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-line bg-surface2 p-2 md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface2 sm:h-10 sm:w-10">
              <PaddleLogo size={22} className="sm:hidden" />
              <PaddleLogo size={26} className="hidden sm:block" />
            </div>
            <div className="min-w-0 leading-none">
              <div className="truncate font-display text-lg font-bold tracking-tight sm:text-xl">PaddleHubs</div>
              <div className="hidden font-score text-[10px] uppercase tracking-[0.2em] text-muted xs:block">
                Pickleball Club Portal
              </div>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <PalettePicker />
            <ModeToggle />
            {loggedIn ? (
              <>
                <div className="hidden max-w-[10rem] truncate text-xs text-muted lg:block">
                  {displayName || getUserEmail() || "Signed in"}
                </div>

                <button
                  onClick={() => {
                    clearAuth();
                    setLoggedIn(false);
                    setAdmin(false);
                    setDisplayName("");
                    openAuthUrl(logoutUrl());
                  }}
                  className="rounded-xl border border-line bg-surface2 px-2.5 py-2 text-xs font-medium transition hover:bg-line sm:px-3 sm:text-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition hover:opacity-90"
                onClick={async () => {
                  const url = await loginUrl();
                  openAuthUrl(url);
                }}
              >
                Login
              </button>
            )}
          </div>
        </div>
        <div className="kitchen-line" />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] border-r border-line bg-bg p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="font-display text-lg font-bold">Menu</div>
              <button
                className="rounded-xl border border-line bg-surface2 p-2"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="mt-4 space-y-2">
              {nav
                .filter((n) => (n.adminOnly ? admin : n.public || loggedIn))
                .map((item) => (
                  <NavItem key={item.to} item={item} />
                ))}
            </nav>
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[260px_1fr]">
        <aside className="hidden md:block">
          <div className="sticky top-24 rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <nav className="space-y-2">
              {nav
                .filter((n) => (n.adminOnly ? admin : n.public || loggedIn))
                .map((item) => (
                  <NavItem key={item.to} item={item} />
                ))}
            </nav>

            <div className="kitchen-line my-4" />

            <div className="rounded-xl border border-l-[3px] border-line border-l-signature bg-surface2 p-4">
              <div className="text-sm font-semibold">PaddleHubs</div>
              <div className="mt-1 text-xs text-muted">Court bookings • Match tracking • Club hub</div>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <Outlet />
          <div className="kitchen-line mt-10" />
          <footer className="mt-6 pb-6 text-xs text-muted">
            © {new Date().getFullYear()} PaddleHubs • Founder: Sai Sidharth Vinothkannan
          </footer>
        </main>
      </div>
    </div>
  );
}
