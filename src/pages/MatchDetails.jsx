import React, { useMemo, useState } from "react";
import { getMatches, saveMatches } from "../lib/storage.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function trim(v) {
  return (v || "").trim();
}

function calcWinner(labelA, labelB, scoreA, scoreB) {
  const a = Number(scoreA);
  const b = Number(scoreB);
  if (Number.isNaN(a) || Number.isNaN(b)) return "—";
  if (a === b) return "Tie";
  return a > b ? labelA : labelB;
}

function buildMatchup(form) {
  if (form.gameType === "singles") {
    const p1 = trim(form.singlesP1);
    const p2 = trim(form.singlesP2);
    return { labelA: p1, labelB: p2, matchup: `${p1} vs ${p2}` };
  }

  const a1 = trim(form.doublesT1P1);
  const a2 = trim(form.doublesT1P2);
  const b1 = trim(form.doublesT2P1);
  const b2 = trim(form.doublesT2P2);

  const labelA = `${a1} & ${a2}`;
  const labelB = `${b1} & ${b2}`;
  return { labelA, labelB, matchup: `${labelA} vs ${labelB}` };
}

function isValid(form) {
  if (form.gameType === "singles") {
    return trim(form.singlesP1) && trim(form.singlesP2);
  }
  return (
    trim(form.doublesT1P1) &&
    trim(form.doublesT1P2) &&
    trim(form.doublesT2P1) &&
    trim(form.doublesT2P2)
  );
}

function escapeCsvCell(v) {
  const s = String(v ?? "");
  // Escape quotes and wrap if needed
  const needsWrap = /[",\n]/.test(s);
  const escaped = s.replaceAll('"', '""');
  return needsWrap ? `"${escaped}"` : escaped;
}

function downloadBlob({ content, filename, mime }) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function MatchDetails() {
  const [matches, setMatches] = useState(() => getMatches());

  const [form, setForm] = useState({
    date: "",
    court: "Court 1",
    gameType: "doubles",
    scoreA: 11,
    scoreB: 7,
    notes: "",

    singlesP1: "",
    singlesP2: "",

    doublesT1P1: "",
    doublesT1P2: "",
    doublesT2P1: "",
    doublesT2P2: "",
  });

  const sorted = useMemo(() => {
    return matches.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [matches]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function addMatch(e) {
    e.preventDefault();
    if (!form.date || !isValid(form)) return;

    const { labelA, labelB, matchup } = buildMatchup(form);
    const winner = calcWinner(labelA, labelB, form.scoreA, form.scoreB);

    const item = {
      id: uid(),
      date: form.date,
      court: form.court,
      gameType: form.gameType,
      scoreA: Number(form.scoreA),
      scoreB: Number(form.scoreB),
      matchup,
      winner,
      notes: form.notes,
      createdAt: new Date().toISOString(),
    };

    const next = [item, ...matches];
    setMatches(next);
    saveMatches(next);

    setForm((f) => ({
      ...f,
      scoreA: 11,
      scoreB: 7,
      notes: "",
      singlesP1: "",
      singlesP2: "",
      doublesT1P1: "",
      doublesT1P2: "",
      doublesT2P1: "",
      doublesT2P2: "",
    }));
  }

  function remove(id) {
    const next = matches.filter((m) => m.id !== id);
    setMatches(next);
    saveMatches(next);
  }

  // ---------- EXPORTS ----------
  function exportCSV() {
    const rows = sorted.map((m) => ({
      date: m.date || "",
      court: m.court || "",
      type: m.gameType || "",
      matchup: m.matchup || "",
      score: `${m.scoreA ?? ""}-${m.scoreB ?? ""}`,
      winner: m.winner || "",
      notes: m.notes || "",
    }));

    const header = ["Date", "Court", "Type", "Matchup", "Score", "Winner", "Notes"];
    const csvLines = [
      header.map(escapeCsvCell).join(","),
      ...rows.map((r) =>
        [
          r.date,
          r.court,
          r.type,
          r.matchup,
          r.score,
          r.winner,
          r.notes,
        ].map(escapeCsvCell).join(",")
      ),
    ];

    // Add UTF-8 BOM so Excel opens it nicely
    const csv = "\uFEFF" + csvLines.join("\n");
    downloadBlob({
      content: csv,
      filename: "paddlehubs_match_history.csv",
      mime: "text/csv;charset=utf-8",
    });
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

    doc.setFontSize(16);
    doc.text("PaddleHubs — Match History", 40, 50);

    doc.setFontSize(10);
    doc.text(`Exported: ${new Date().toLocaleString()}`, 40, 70);

    const tableBody = sorted.map((m) => [
      m.date || "",
      m.court || "",
      m.gameType || "",
      m.matchup || "",
      `${m.scoreA ?? ""}-${m.scoreB ?? ""}`,
      m.winner || "",
      m.notes || "",
    ]);

    autoTable(doc, {
      startY: 90,
      head: [["Date", "Court", "Type", "Matchup", "Score", "Winner", "Notes"]],
      body: tableBody,
      styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 55 },
        2: { cellWidth: 55 },
        3: { cellWidth: 170 },
        4: { cellWidth: 55 },
        5: { cellWidth: 70 },
        6: { cellWidth: 140 },
      },
      margin: { left: 40, right: 40 },
    });

    doc.save("paddlehubs_match_history.pdf");
  }

  const preview = isValid(form) ? buildMatchup(form).matchup : "Enter player names";

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-500/15 via-white/5 to-amber-500/15 p-6">
        <div className="text-2xl font-semibold">Match Details</div>
        <div className="text-sm text-white/70 mt-1">Singles & Doubles match tracking</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <form onSubmit={addMatch} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={onChange}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              />

              <select
                name="court"
                value={form.court}
                onChange={onChange}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <option>Court 1</option>
                <option>Court 2</option>
                <option>Court 3</option>
                <option>Court 4</option>
              </select>

              <select
                name="gameType"
                value={form.gameType}
                onChange={onChange}
                className="sm:col-span-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
              </select>
            </div>

            {/* Player inputs */}
            {form.gameType === "singles" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  name="singlesP1"
                  value={form.singlesP1}
                  onChange={onChange}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                />
                <input
                  name="singlesP2"
                  value={form.singlesP2}
                  onChange={onChange}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  name="doublesT1P1"
                  value={form.doublesT1P1}
                  onChange={onChange}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                />
                <input
                  name="doublesT1P2"
                  value={form.doublesT1P2}
                  onChange={onChange}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                />
                <input
                  name="doublesT2P1"
                  value={form.doublesT2P1}
                  onChange={onChange}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                />
                <input
                  name="doublesT2P2"
                  value={form.doublesT2P2}
                  onChange={onChange}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                />
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-semibold">
              {preview}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                name="scoreA"
                value={form.scoreA}
                onChange={onChange}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              />
              <input
                type="number"
                name="scoreB"
                value={form.scoreB}
                onChange={onChange}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              />
            </div>

            <textarea
              name="notes"
              value={form.notes}
              onChange={onChange}
              rows="3"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
            />

            <button className="w-full rounded-2xl bg-white/10 hover:bg-white/20 py-2 font-semibold">
              Add Match
            </button>
          </form>
        </div>

        {/* History */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold">Match History</div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportCSV}
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs"
                disabled={sorted.length === 0}
                title={sorted.length === 0 ? "No matches to export" : "Export CSV"}
              >
                Export CSV
              </button>
              <button
                onClick={exportPDF}
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs"
                disabled={sorted.length === 0}
                title={sorted.length === 0 ? "No matches to export" : "Export PDF"}
              >
                Export PDF
              </button>
            </div>
          </div>

          <div className="mt-3 text-xs text-white/60">{sorted.length} total</div>

          <div className="mt-4">
            {sorted.length === 0 ? (
              <div className="text-sm text-white/60">No matches yet</div>
            ) : (
              sorted.map((m) => (
                <div
                  key={m.id}
                  className="mb-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="font-semibold">{m.matchup}</div>
                  <div className="text-xs text-white/60">
                    {m.date} • {m.court} • {m.gameType}
                  </div>
                  <div className="text-xs text-white/60">
                    Score: {m.scoreA} - {m.scoreB} • Winner: {m.winner}
                  </div>
                  {m.notes ? (
                    <div className="text-xs text-white/60 mt-1">Notes: {m.notes}</div>
                  ) : null}
                  <button
                    onClick={() => remove(m.id)}
                    className="mt-2 text-xs underline text-white/70"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

