import React, { useMemo } from "react";
import { getBookings, getMatches } from "../lib/storage.js";
import { CalendarDays, Trophy } from "lucide-react";

function Card({ title, value, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><Icon size={18} /></div>
        <div className="text-sm text-white/70">{title}</div>
      </div>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const bookings = useMemo(() => getBookings(), []);
  const matches = useMemo(() => getMatches(), []);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/15 via-white/5 to-fuchsia-500/15 p-6">
        <div className="text-3xl font-semibold">PaddleHubs</div>
        <div className="text-sm text-white/70 mt-2">
          Book courts and log match details with a clean side-menu UI.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card title="Bookings (local)" value={bookings.length} icon={CalendarDays} />
        <Card title="Matches (local)" value={matches.length} icon={Trophy} />
      </div>

    </div>
  );
}
