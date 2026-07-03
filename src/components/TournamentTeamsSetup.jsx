import React, { useMemo, useState } from "react";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function trim(v) {
  return String(v || "").trim();
}

export default function TournamentTeamsSetup({
  loading,
  canEdit,
  initialTeamCount = 4,
  initialPlayersPerTeam = 2,
  initialTeams = [],
  onSave, // async (payload) => void
}) {
  const [teamCount, setTeamCount] = useState(Number(initialTeamCount || 4));
  const [playersPerTeam, setPlayersPerTeam] = useState(Number(initialPlayersPerTeam || 2));

  const [teams, setTeams] = useState(() => {
    if (Array.isArray(initialTeams) && initialTeams.length) {
      return initialTeams.map((t, idx) => ({
        id: String(t.id || ""),
        name: t.name || `Team ${idx + 1}`,
        players: Array.isArray(t.players) ? t.players.slice() : [],
      }));
    }
    return [];
  });

  const teamsReady = useMemo(() => Array.isArray(teams) && teams.length > 0, [teams]);

  function buildInputs() {
    const tc = Math.max(1, Math.min(64, Number(teamCount || 1)));
    const pp = Math.max(1, Math.min(20, Number(playersPerTeam || 1)));

    const next = Array.from({ length: tc }, (_, i) => ({
      id: "",
      name: `Team ${i + 1}`,
      players: Array.from({ length: pp }, () => ""),
    }));

    setTeams(next);
  }

  function setTeamName(idx, value) {
    setTeams((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], name: value };
      return next;
    });
  }

  function setPlayer(idx, pIdx, value) {
    setTeams((prev) => {
      const next = prev.slice();
      const t = next[idx];
      const players = (t.players || []).slice();
      players[pIdx] = value;
      next[idx] = { ...t, players };
      return next;
    });
  }

  async function save() {
    const payload = {
      teamCount: Number(teamCount),
      playersPerTeam: Number(playersPerTeam),
      teams: (teams || []).map((t) => ({
        id: t.id || undefined,
        name: trim(t.name),
        players: (t.players || []).map((p) => trim(p)).filter(Boolean),
      })),
    };

    if (!payload.teams.length) throw new Error("Please build teams first.");
    if (payload.teams.some((t) => !t.name)) throw new Error("Each team must have a name.");

    await onSave(payload);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Teams & Players</div>
        {!canEdit ? <div className="text-xs text-muted">Owner/Admin only</div> : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted"># Teams</label>
          <input
            type="number"
            value={teamCount}
            min={1}
            max={64}
            onChange={(e) => setTeamCount(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
            disabled={!canEdit || loading}
          />
        </div>
        <div>
          <label className="text-xs text-muted">Players/Team</label>
          <input
            type="number"
            value={playersPerTeam}
            min={1}
            max={20}
            onChange={(e) => setPlayersPerTeam(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
            disabled={!canEdit || loading}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={buildInputs}
        className={classNames(
          "mt-3 w-full rounded-2xl border py-2 text-sm",
          "border-line bg-surface2 hover:bg-surface2",
          (!canEdit || loading) ? "opacity-40" : ""
        )}
        disabled={!canEdit || loading}
      >
        Build Team Inputs
      </button>

      {!teamsReady ? (
        <div className="mt-3 text-xs text-amber-200/80">
          ⚠️ Teams not built yet. Click “Build Team Inputs”.
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {(teams || []).map((t, idx) => (
          <div key={idx} className="rounded-xl border border-line bg-surface2 p-3">
            <label className="text-xs text-muted">Team {idx + 1} name</label>
            <input
              value={t.name}
              onChange={(e) => setTeamName(idx, e.target.value)}
              className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
              disabled={!canEdit || loading}
            />

            <div className="mt-3 grid grid-cols-1 gap-2">
              {(t.players || []).map((p, pIdx) => (
                <input
                  key={pIdx}
                  value={p}
                  onChange={(e) => setPlayer(idx, pIdx, e.target.value)}
                  placeholder={`Player ${pIdx + 1}`}
                  className="w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                  disabled={!canEdit || loading}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={save}
        className={classNames(
          "mt-4 w-full rounded-2xl border py-2.5 font-semibold",
          "border-line bg-surface2 hover:bg-line",
          (!canEdit || loading) ? "opacity-40" : ""
        )}
        disabled={!canEdit || loading}
      >
        {loading ? "Saving..." : "Save Teams"}
      </button>
    </div>
  );
}

