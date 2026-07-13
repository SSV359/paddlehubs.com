import React from "react";

export function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

/** Signature divider — the pickleball "kitchen line" (non-volley-zone line). */
export function KitchenLine({ className = "" }) {
  return <div className={classNames("kitchen-line my-8", className)} />;
}

/** Base surface/card container. */
export function Surface({ as: Tag = "div", className = "", children, ...rest }) {
  return (
    <Tag
      className={classNames(
        "rounded-2xl border border-line bg-surface shadow-sm",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Scoreboard-style stat card — the signature stat treatment. */
export function StatCard({ title, value, icon: Icon, hint }) {
  return (
    <Surface className="card-lift p-5">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="rounded-xl border border-line bg-surface2 p-2.5 text-accent">
            <Icon size={18} />
          </div>
        )}
        <div className="text-xs uppercase tracking-wider text-muted">{title}</div>
      </div>
      <div className="stat-score mt-3 text-3xl font-bold text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Surface>
  );
}

const PILL_TONES = {
  neutral: "border-line bg-surface2 text-muted",
  live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  upcoming: "border-court/30 bg-court/10 text-court dark:text-sky-300",
  final: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  signature: "border-signature/40 bg-signature/15 text-ink",
};

export function Pill({ tone = "neutral", children }) {
  return (
    <span
      className={classNames(
        "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        PILL_TONES[tone] || PILL_TONES.neutral
      )}
    >
      {children}
    </span>
  );
}

export function SectionEyebrow({ children }) {
  return (
    <div className="font-score text-xs uppercase tracking-[0.2em] text-accent">
      {children}
    </div>
  );
}

export function PageHeading({ eyebrow, title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <SectionEyebrow>{eyebrow}</SectionEyebrow>}
        <h1 className="mt-1 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Row of pill/rectangle tab buttons, one active — PPA Tour's category
 *  selector style (e.g. "Men's Doubles / Women's Singles"), used instead
 *  of a dropdown wherever there are just a few options to switch between. */
export function PillTabs({ options, value, onChange, className = "" }) {
  return (
    <div className={classNames("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const optValue = typeof opt === "string" ? opt : opt.value;
        const optLabel = typeof opt === "string" ? opt : opt.label;
        const active = optValue === value;
        return (
          <button
            key={optValue}
            type="button"
            onClick={() => onChange(optValue)}
            className={classNames(
              "rounded-xl border-2 px-4 py-2 text-xs font-bold uppercase tracking-wide transition",
              active
                ? "border-accent bg-accent text-accent-ink"
                : "border-line bg-surface text-ink hover:border-accent/50"
            )}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}

/** Big bold "01" / "02" style rank number, PPA Tour's leaderboard treatment. */
export function BigRankNumber({ rank, className = "" }) {
  const padded = String(rank).padStart(2, "0");
  return (
    <div className={classNames("font-display text-4xl font-black italic leading-none text-accent", className)}>
      {padded}
    </div>
  );
}

export const AVATAR_PALETTE = [
  "#E4572E", "#1C4E80", "#2F9E44", "#F2B705", "#8338EC", "#E63980",
  "#0FA3B1", "#B5651D", "#6C757D", "#D62828", "#3A86FF", "#2A9D8F",
];

function colorForName(name) {
  const s = String(name || "?");
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

/** Circular initials avatar — stands in for a player photo we don't have,
 *  colored deterministically per name so the same person is always the
 *  same color. */
export function InitialsAvatar({ name, size = 64, className = "" }) {
  const initials = String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";
  return (
    <div
      className={classNames("flex shrink-0 items-center justify-center rounded-full border-2 border-line font-display font-bold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.36, background: colorForName(name) }}
    >
      {initials}
    </div>
  );
}

// Original, simple cartoon-style avatar icons (hand-drawn shapes, not a
// photo or any existing character) — used as the fallback when a player
// has set their gender but hasn't uploaded a photo.
function MaleCartoonAvatar({ size = 64, bg }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill={bg || "#8fd3f4"} />
      <path d="M15 100 C15 75 32 62 50 62 C68 62 85 75 85 100 Z" fill="#37474f" />
      <circle cx="50" cy="42" r="19" fill="#f4c294" />
      <path d="M31 40 C31 22 69 22 69 40 C69 30 60 25 50 25 C40 25 31 30 31 40 Z" fill="#4e342e" />
    </svg>
  );
}

function FemaleCartoonAvatar({ size = 64, bg }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill={bg || "#f8bbd0"} />
      <path d="M15 100 C15 75 32 62 50 62 C68 62 85 75 85 100 Z" fill="#6a1b4d" />
      <path
        d="M27 45 C24 65 30 72 34 78 C30 65 30 50 32 42 L68 42 C70 50 70 65 66 78 C70 72 76 65 73 45 C73 25 60 20 50 20 C40 20 27 25 27 45 Z"
        fill="#3e2723"
      />
      <circle cx="50" cy="44" r="18" fill="#f4c294" />
    </svg>
  );
}

/** Same as InitialsAvatar, but shows a real uploaded photo when one is
 *  available (avatarDataUrl); otherwise a gender-based cartoon icon if
 *  gender is set; otherwise a colored initials circle (custom
 *  avatarColor if set, else deterministic per name). Used anywhere a
 *  player's identity is shown — rankings, team rosters, standings. */
export function PlayerAvatar({ name, avatarDataUrl, avatarColor, gender, size = 64, className = "" }) {
  if (avatarDataUrl) {
    return (
      <img
        src={avatarDataUrl}
        alt={name || "Player"}
        className={classNames("shrink-0 rounded-full border-2 border-line object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  if (gender === "male" || gender === "female") {
    const Cartoon = gender === "male" ? MaleCartoonAvatar : FemaleCartoonAvatar;
    return (
      <div
        className={classNames("shrink-0 overflow-hidden rounded-full border-2 border-line", className)}
        style={{ width: size, height: size }}
      >
        <Cartoon size={size} bg={avatarColor} />
      </div>
    );
  }
  const initials = String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";
  return (
    <div
      className={classNames("flex shrink-0 items-center justify-center rounded-full border-2 border-line font-display font-bold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.36, background: avatarColor || colorForName(name) }}
    >
      {initials}
    </div>
  );
}

/** Small "C" captain badge, worn like an armband next to a captain's name. */
export function CaptainBadge({ size = 16, className = "" }) {
  return (
    <span
      title="Team Captain"
      className={classNames(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-signature bg-signature/20 font-display font-black text-ink",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.62, lineHeight: 1 }}
    >
      C
    </span>
  );
}

/** Small "M" / "F" gender badge — same color language as the cartoon
 *  avatar fallback (blue for male, pink for female) so the two stay
 *  visually consistent wherever both appear. Renders nothing if gender
 *  isn't one of "male"/"female" (unset is just... not shown). */
export function GenderBadge({ gender, size = 15, className = "" }) {
  if (gender !== "male" && gender !== "female") return null;
  const isMale = gender === "male";
  return (
    <span
      title={isMale ? "Male" : "Female"}
      className={classNames(
        "inline-flex shrink-0 items-center justify-center rounded-full border font-display font-black",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.6,
        lineHeight: 1,
        background: isMale ? "#8fd3f4" : "#f8bbd0",
        color: isMale ? "#0c4a6e" : "#831843",
        borderColor: isMale ? "#0c4a6e40" : "#83184340",
      }}
    >
      {isMale ? "M" : "F"}
    </span>
  );
}

/** Horizontal-scroll row with left/right arrow buttons — PPA Tour's
 *  player-card and tournament-card carousels. Native scroll-snap under
 *  the hood, arrows just nudge scrollLeft. */
export function HScroll({ children, className = "" }) {
  const ref = React.useRef(null);
  function nudge(dir) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  }
  return (
    <div className={classNames("relative", className)}>
      <div ref={ref} className="flex gap-4 overflow-x-auto scroll-smooth pb-2" style={{ scrollSnapType: "x proximity" }}>
        {children}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => nudge(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-line bg-surface text-ink transition hover:border-accent"
          aria-label="Scroll left"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => nudge(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent bg-accent text-accent-ink transition hover:opacity-90"
          aria-label="Scroll right"
        >
          ›
        </button>
      </div>
    </div>
  );
}

/** Promo card — PPA Tour's "Upcoming Tournaments" image-card treatment.
 *  No real photos to work with, so this uses a bold gradient block with
 *  a corner badge and a dark bottom info bar instead. */
export function PromoCard({ badge, title, subtitle, gradientFrom, gradientTo, logoUrl, className = "" }) {
  return (
    <div
      className={classNames("relative h-40 w-64 shrink-0 overflow-hidden rounded-2xl border border-line", className)}
      style={{ scrollSnapAlign: "start" }}
    >
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${gradientFrom || "#1C4E80"}, ${gradientTo || "#0b1319"})` }}
      />
      {logoUrl && (
        <img src={logoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {badge && (
        <div className="absolute right-2 top-2 rounded-lg bg-black/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          {badge}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-black/55 p-3 backdrop-blur-sm">
        <div className="font-display text-sm font-bold uppercase leading-tight text-white">{title}</div>
        {subtitle && <div className="mt-0.5 text-[11px] text-white/70">{subtitle}</div>}
      </div>
    </div>
  );
}

export function PrimaryButton({ className = "", children, ...rest }) {
  return (
    <button
      className={classNames(
        "rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-40",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function GhostButton({ className = "", children, ...rest }) {
  return (
    <button
      className={classNames(
        "rounded-xl border border-line bg-surface2 px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-line disabled:opacity-40",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
