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
        <h1 className="mt-1 font-display text-4xl font-bold leading-none tracking-tight text-ink sm:text-5xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
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
