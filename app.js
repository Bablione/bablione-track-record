// Public track-record dashboard. Reads ./data/{summary,trades,runs,manifest}.json
// emitted by `python3 -m pol.tools.publish_track_record --write` from the bot.

const $ = (id) => document.getElementById(id);

const POLYMARKET_BASE = "https://polymarket.com/event/";

async function fetchJSON(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function fmtMoney(v, signed = false) {
  if (v == null || !isFinite(v)) return "—";
  const s = signed && v > 0 ? "+" : "";
  return `${s}$${Math.abs(v).toFixed(v >= 100 ? 2 : 4)}`;
}
function fmtPct(v, signed = false) {
  if (v == null || !isFinite(v)) return "—";
  const s = signed && v > 0 ? "+" : "";
  return `${s}${(v * 100).toFixed(2)}%`;
}
function fmtPctRaw(v, signed = false) {
  // already a percentage number (e.g. 0.98 for 0.98%)
  if (v == null || !isFinite(v)) return "—";
  const s = signed && v > 0 ? "+" : "";
  return `${s}${v.toFixed(2)}%`;
}
function fmtInt(v) { return v == null ? "—" : String(v); }
function fmtTime(unix) {
  if (!unix) return "—";
  return new Date(unix * 1000).toISOString().replace("T", " ").slice(0, 19) + "Z";
}
function pnlClass(v) { return v > 0 ? "good" : v < 0 ? "bad" : ""; }

function chipForType(t) {
  if (t.bypass) return `<span class="chip chip-snip">SNIP</span>`;
  if (t.entry_type === "certainty") return `<span class="chip chip-beast">BEAST</span>`;
  if (t.entry_type === "approach")  return `<span class="chip chip-ext">EXT</span>`;
  return `<span class="chip chip-cert">CERT</span>`;
}

function renderKPIs(s) {
  $("k-trades").textContent     = fmtInt(s.trades_resolved);
  $("k-trades-sub").textContent = `${s.wins}W / ${s.losses}L`;

  const wrEl = $("k-wr");
  wrEl.textContent = s.win_rate != null ? `${(s.win_rate * 100).toFixed(2)}%` : "—";
  wrEl.classList.toggle("good", (s.win_rate ?? 0) >= 0.7);
  wrEl.classList.toggle("bad",  (s.win_rate ?? 0) < 0.5);
  $("k-wr-sub").textContent = s.trades_resolved
    ? `over ${s.trades_resolved} resolved`
    : "—";

  const pnlEl = $("k-pnl");
  pnlEl.textContent = fmtMoney(s.total_pnl, true);
  pnlEl.classList.toggle("good", s.total_pnl > 0);
  pnlEl.classList.toggle("bad",  s.total_pnl < 0);

  const ret = s.return_pct;
  const retEl = $("k-ret");
  retEl.textContent = fmtPctRaw(ret, true);
  retEl.classList.toggle("good", ret > 0);
  retEl.classList.toggle("bad",  ret < 0);

  $("k-streak").textContent = fmtInt(s.longest_win_streak);
  $("k-vol").textContent    = fmtMoney(s.total_volume);

  $("subtitle").textContent = `${s.trades_resolved ?? 0} resolved trades · `
    + `last snapshot ${s.snapshot_at || "—"}`;
}

function renderByCoin(by_coin) {
  const rows = Object.entries(by_coin || {})
    .sort((a, b) => b[1].pnl - a[1].pnl)
    .map(([coin, b]) => `
      <tr>
        <td>${coin}</td>
        <td class="num">${b.trades}</td>
        <td class="num">${b.wins}W / ${b.losses}L</td>
        <td class="num">${(b.win_rate * 100).toFixed(1)}%</td>
        <td class="num ${pnlClass(b.pnl)}">${fmtMoney(b.pnl, true)}</td>
      </tr>
    `).join("");
  $("by-coin").innerHTML = `
    <thead><tr><th></th><th>N</th><th>W/L</th><th>WR</th><th>PnL</th></tr></thead>
    <tbody>${rows}</tbody>`;
}

function renderByDay(by_day) {
  const days = Object.entries(by_day || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const rows = days.map(([day, b]) => `
    <tr>
      <td>${day}</td>
      <td class="num">${b.trades}</td>
      <td class="num">${b.wins}W / ${b.losses}L</td>
      <td class="num ${pnlClass(b.pnl)}">${fmtMoney(b.pnl, true)}</td>
    </tr>
  `).join("");
  $("by-day").innerHTML = `
    <thead><tr><th></th><th>N</th><th>W/L</th><th>PnL</th></tr></thead>
    <tbody>${rows}</tbody>`;
}

function renderByType(s) {
  const blocks = [
    {label: "CERT",  data: {trades: s.trades_resolved - (s.beast?.trades ?? 0) - (s.snip?.trades ?? 0)}},
    {label: "BEAST", data: s.beast || {}},
    {label: "SNIP",  data: s.snip  || {}},
  ];
  // Build CERT row using totals minus beast/snip — but cleaner is to derive
  // by_type directly. The summary doesn't, so we approximate.
  const rows = [
    ["CERT",  s.trades_resolved - (s.beast?.trades ?? 0) - (s.snip?.trades ?? 0)],
    ["BEAST", s.beast?.trades ?? 0],
    ["SNIP",  s.snip?.trades ?? 0],
  ].map(([lbl, n]) => `<tr><td>${lbl}</td><td class="num">${n}</td></tr>`).join("");
  $("by-type").innerHTML = `
    <thead><tr><th></th><th>N</th></tr></thead>
    <tbody>${rows}</tbody>`;
}

function renderRuns(runs) {
  if (!runs || runs.length === 0) {
    $("runs-body").textContent = "No ended runs yet.";
    return;
  }
  const items = runs.slice(0, 10).map(r => `
    <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">
      <div style="display:flex;justify-content:space-between">
        <span style="font-weight:600">${r.reason || "ended"} — ${r.last_coin || ""} ${r.last_side || ""}</span>
        <span class="muted">${fmtTime(r.ended_at)}</span>
      </div>
      <div class="muted">
        ${r.wins ?? 0}W / ${r.losses ?? 0}L  ·  pot ended ${fmtMoney(r.pot_at_end)}  ·  ${r.total_trades ?? 0} trades
      </div>
    </div>`).join("");
  $("runs-body").innerHTML = items;
}

function renderRecent(trades) {
  const max = 50;
  const rows = trades.slice(0, max).map(t => {
    const sideCls = t.side === "Up" ? "side-up" : "side-dn";
    const sideArrow = t.side === "Up" ? "▲" : "▼";
    const resCls = t.result === "WIN" ? "res-win" : "res-loss";
    const link = t.slug
      ? `<a href="${POLYMARKET_BASE}${encodeURIComponent(t.slug)}" target="_blank" rel="noopener">verify ↗</a>`
      : "—";
    return `<tr>
      <td>${fmtTime(t.time)}</td>
      <td>${t.coin}</td>
      <td class="${sideCls}">${sideArrow} ${t.side}</td>
      <td>${chipForType(t)}</td>
      <td>${(t.ask ?? 0).toFixed(4)}</td>
      <td>${fmtMoney(t.bet)}</td>
      <td class="${pnlClass(t.pnl)}">${fmtMoney(t.pnl, true)}</td>
      <td class="${resCls}">${t.result}</td>
      <td>${link}</td>
    </tr>`;
  }).join("");
  $("recent-body").innerHTML = rows;
  if (trades.length > max) {
    $("recent-more").textContent = `… ${trades.length - max} earlier trades in trades.json`;
  }
}

let chartInstance = null;
function renderChart(trades) {
  const ctx = $("pnl-chart").getContext("2d");
  // Need oldest-first
  const sorted = [...trades].sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  let cum = 0;
  const pts = sorted.map(t => {
    cum += (t.pnl ?? 0);
    return { x: (t.time ?? 0) * 1000, y: cum };
  });

  if (pts.length === 0) return;
  const first = new Date(pts[0].x).toISOString().slice(0, 10);
  const last  = new Date(pts[pts.length - 1].x).toISOString().slice(0, 10);
  $("chart-range").textContent = `${first} → ${last}`;

  const grad = ctx.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, "rgba(63,185,80,0.30)");
  grad.addColorStop(1, "rgba(63,185,80,0.00)");

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [{
        label: "Cumulative PnL ($)",
        data: pts,
        borderColor: "#3fb950",
        backgroundColor: grad,
        borderWidth: 1.5,
        fill: true,
        pointRadius: 0,
        tension: 0.25,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { type: "time", time: { unit: "day" }, ticks: { color: "#8b949e", maxTicksLimit: 6 }, grid: { color: "#1f2630" } },
        y: { position: "right", ticks: { color: "#8b949e", callback: v => `$${v.toFixed(2)}` }, grid: { color: "#1f2630" } },
      }
    }
  });
}

function renderProvenance(manifest, summary) {
  $("prov-when").textContent = manifest?.snapshot_at || "—";
  $("prov-this").textContent = manifest?.this_hash || "—";
  $("prov-prev").textContent = manifest?.prev_hash || "(genesis)";
  $("redaction-note").textContent = summary?.redaction_note || "—";
}

(async () => {
  try {
    const [summary, trades, runs, manifest] = await Promise.all([
      fetchJSON("data/summary.json"),
      fetchJSON("data/trades.json"),
      fetchJSON("data/runs.json").catch(() => []),
      fetchJSON("data/manifest.json").catch(() => null),
    ]);
    renderKPIs(summary);
    renderByCoin(summary.by_coin);
    renderByDay(summary.by_day);
    renderByType(summary);
    renderRuns(runs);
    renderRecent(trades);
    // Chart needs Chart.js loaded; defer if necessary.
    const onReady = () => renderChart(trades);
    if (window.Chart) onReady(); else window.addEventListener("load", onReady);
    renderProvenance(manifest, summary);
  } catch (e) {
    $("subtitle").textContent = `Failed to load data: ${e.message}`;
  }
})();
