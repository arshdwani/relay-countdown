// Relay: a team-project countdown drawn as a 4×100 m relay.
// One lap = the whole project. Each leg is one teammate. The baton moves 400/N metres a day.
// Takeover zones follow the World Athletics rule for 4×100: 30 m, from 20 m before the
// scratch line to 10 m after it, so the next runner starts a day early and the last one
// stays on for half a day (with 20 days, 20 m = 1 day).
// renderRelay() returns one lock screen as a self-contained SVG string (fonts and art inlined
// when given), so the same code makes the page preview, the PNG download and the CLI renders.

const RELAY_COLORS = ["#4CB8FF", "#3FE08F", "#FFB627", "#FF5C93"];
const DAY = 864e5;
const pd = s => new Date(s + "T12:00:00");
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const fmtD = (d, o) => d.toLocaleDateString("en-US", Object.assign({ timeZone: "UTC" }, o));
const utc = d => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12));
const short = d => fmtD(utc(d), { month: "short", day: "numeric" });
const range = (a, b) => a.getMonth() === b.getMonth() ? `${short(a)}–${b.getDate()}` : `${short(a)}–${short(b)}`;
const wkShort = d => fmtD(utc(d), { weekday: "short", month: "short", day: "numeric" });
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function relayState(plan, dateStr, leg) {
  const start = pd(plan.start), due = pd(plan.due), today = pd(dateStr);
  const N = Math.round((due - start) / DAY) + 1;            // race days
  const per = N / 4, mPerDay = 400 / N;
  const i = Math.round((today - start) / DAY);               // 0-based race day (negative = before the gun)
  const T = Math.round((due - today) / DAY);
  const legOf = d => Math.min(4, Math.floor((d + 0.5) / per) + 1);
  const holder = i >= 0 && i < N ? legOf(i) : 0;
  const legs = plan.legs.map((l, k) => {
    const a = Math.round(k * per), b = Math.round((k + 1) * per) - 1;  // first and last day index
    return { ...l, k: k + 1, a, b, from: addDays(start, a), to: addDays(start, b), color: RELAY_COLORS[k] };
  });
  const warmDay = L => Math.floor((L - 1) * per - per / 5 + 1e-9);   // 20 m before the line
  const standDay = L => Math.floor(L * per + per / 10 - 1e-9);       // 10 m after it
  const zones = [1, 2, 3].map(z => ({ z, s0: 100 * z - 20, s1: 100 * z + 10,
    d0: addDays(start, warmDay(z + 1)), d1: addDays(start, standDay(z)) }));
  const task = i >= 0 && i < N ? (() => { const L = legs[holder - 1]; return (L.tasks || [])[i - L.a] || L.title; })() : null;
  return { start, due, today, N, per, mPerDay, i, T, holder, legs, zones, task, leg, warmDay, standDay };
}

// Gemini's painting (1408 x 3040): placed so its baton lands just above the header.
const ART = { x: -3, y: -760, w: 1296 };

// ---------- track geometry (logical 1290-wide canvas) ----------
const TRK = { cx: 645, cy: 1432, R: 205, lane: 24, lanes: 6, relayLane: 4 };
TRK.Ls = Math.PI * TRK.R;                                   // each leg = one bend or one straight
TRK.xl = TRK.cx - TRK.Ls / 2; TRK.xr = TRK.cx + TRK.Ls / 2;
TRK.rIn = TRK.R - (TRK.relayLane - 0.5) * TRK.lane;
// Runners go counter-clockwise; the finish is at the end of the home straight (bottom right).
function trackPt(s, r = TRK.R) {
  s = ((s % 400) + 400) % 400;
  const { cy, Ls, xl, xr } = TRK;
  if (s < 100) { const t = Math.PI / 2 - Math.PI * s / 100; return [xr + r * Math.cos(t), cy + r * Math.sin(t), t - Math.PI / 2]; }
  if (s < 200) return [xr - Ls * (s - 100) / 100, cy - r, Math.PI];
  if (s < 300) { const t = -Math.PI / 2 - Math.PI * (s - 200) / 100; return [xl + r * Math.cos(t), cy + r * Math.sin(t), t - Math.PI / 2]; }
  return [xl + Ls * (s - 300) / 100, cy + r, 0];
}
function lanePath(a, b, r = TRK.R) {
  const n = Math.max(2, Math.ceil((b - a) * 1.5));
  let d = "";
  for (let j = 0; j <= n; j++) { const [x, y] = trackPt(a + (b - a) * j / n, r); d += (j ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1); }
  return d;
}
function ovalPath(r) {
  const { cy, xl, xr } = TRK;
  return `M${xl},${cy - r}L${xr},${cy - r}A${r},${r} 0 0 1 ${xr},${cy + r}L${xl},${cy + r}A${r},${r} 0 0 1 ${xl},${cy - r}Z`;
}

// ---------- text helpers ----------
let _ctx;
function measure(text, size, weight, family) {
  _ctx = _ctx || document.createElement("canvas").getContext("2d");
  _ctx.font = `${weight} ${size}px "${family}"`;
  return _ctx.measureText(text).width;
}
function wrap(text, max, size, weight, family, lines = 2) {
  const words = String(text).split(" "), out = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (measure(t, size, weight, family) <= max || !cur) cur = t; else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  if (out.length > lines) { const keep = out.slice(0, lines); keep[lines - 1] += "…"; return keep; }
  return out;
}
const T_ = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-family="${o.f || "Barlow"}" font-weight="${o.w || 500}" font-size="${o.size || 32}" fill="${o.fill || "#fff"}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.ls ? ` letter-spacing="${o.ls}"` : ""}${o.op ? ` opacity="${o.op}"` : ""}>${esc(s)}</text>`;
const COND = "Barlow Condensed";

function youCard(st) {
  const L = st.leg, me = st.legs[L - 1], i = st.i, N = st.N;
  const span = `${wkShort(me.from)} – ${wkShort(me.to)}`;
  if (i < 0) return { big: "ON YOUR MARKS", tag: i === -1 ? "STARTS TOMORROW" : `STARTS IN ${-i} DAYS`, detail: `Your leg runs ${span}.` };
  if (i >= N) return { big: "FINISHED", tag: "SUBMITTED", detail: `Four legs, ${N} days, one baton. Your leg: ${me.title}.` };
  const w = L > 1 ? st.warmDay(L) : -1, sb = L < 4 ? st.standDay(L) : -1;
  if (i < w) return { big: `BATON IN ${me.a - i} DAYS`, tag: `WARM UP ${wkShort(addDays(st.start, w)).toUpperCase()}`, detail: `Your leg runs ${span}.` };
  if (i === w) return { big: "WARM-UP DAY", tag: "BATON ARRIVES TOMORROW", detail: `Today: ${me.warmup}. You get ${st.legs[L - 2].baton}.` };
  if (i >= me.a && i <= me.b) {
    const n = i - me.a + 1, left = me.b - i;
    const detail = i === me.b && L < 4 ? `Hand off tomorrow morning: ${me.baton}.`
      : i === me.b ? `Final straight. Submit by ${st.dueTime || "11:59 PM"} tonight.`
      : n === 1 && L > 1 ? `Leg ${L - 1} stays on this morning to ${st.legs[L - 2].standby}. ${left} more days after today.`
      : `${left} more ${left === 1 ? "day" : "days"} in your leg after today.`;
    return { big: "YOU HAVE THE BATON", tag: `DAY ${n} OF ${me.b - me.a + 1}`, detail };
  }
  if (i === sb) return { big: "HANDOFF MORNING", tag: "STAY ON TILL NOON", detail: `Leg ${L + 1} now has ${me.baton}. Stay on until noon to ${me.standby}.` };
  return { big: "LEG DONE", tag: `LEG ${st.holder} HAS THE BATON`, detail: i === N - 1 ? `Final day. Leg 4 submits by ${st.dueTime || "11:59 PM"} tonight. Be on call.` : `${st.T} ${st.T === 1 ? "day" : "days"} to the line. Back them up.` };
}

// ---------- the lock screen ----------
function renderRelay({ plan, date, leg = 1, W = 1290, H = 2796, art = null, fontCSS = "" }) {
  const st = relayState(plan, date, leg); st.dueTime = plan.dueTime;
  const LH = H * 1290 / W, me = st.legs[leg - 1];
  const sNow = Math.max(0, Math.min(400, st.i * st.mPerDay)), sEnd = Math.max(0, Math.min(400, (st.i + 1) * st.mPerDay));
  const racing = st.i >= 0 && st.i < st.N;
  let g = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 1290 ${LH.toFixed(1)}">`;
  g += `<defs>${fontCSS ? `<style>${fontCSS}</style>` : ""}
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050913" stop-opacity="0"/><stop offset=".335" stop-color="#050913" stop-opacity="0"/><stop offset=".372" stop-color="#050913" stop-opacity=".84"/><stop offset=".43" stop-color="#050913" stop-opacity=".95"/><stop offset="1" stop-color="#050913" stop-opacity=".97"/></linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="baton" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c9d2e0"/><stop offset="1" stop-color="#7d8799"/></linearGradient>
    <pattern id="chk" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#fff"/><rect width="6" height="6" fill="#111"/><rect x="6" y="6" width="6" height="6" fill="#111"/></pattern>
  </defs>`;
  g += `<rect width="1290" height="${LH}" fill="#070b16"/>`;
  if (art) g += `<image href="${art}" xlink:href="${art}" x="${ART.x}" y="${ART.y}" width="${ART.w}" height="${(ART.w * 3040 / 1408).toFixed(0)}"/>`;
  g += `<rect width="1290" height="${LH}" fill="url(#shade)"/>`;

  // header
  g += T_(78, 1018, `${(plan.team || "4×100 TEAM RELAY").toUpperCase()}`, { f: COND, w: 600, size: 32, fill: "#9fb4dc", ls: 5 });
  g += T_(78, 1066, `${plan.project} · due ${wkShort(st.due)}, ${plan.dueTime || "11:59 PM"}`, { w: 500, size: 34, fill: "#e9eef8" });

  // track: tartan lanes, infield, lane lines
  const { rIn, lane, lanes } = TRK, rOut = rIn + lanes * lane;
  g += `<path d="${ovalPath(rOut)}" fill="#8a3420"/><path d="${ovalPath(rIn)}" fill="#0d2a20"/>`;
  g += `<path d="${ovalPath(rIn - 26)}" fill="none" stroke="#14382b" stroke-width="2"/>`;
  for (let j = 0; j <= lanes; j++) g += `<path d="${ovalPath(rIn + j * lane)}" fill="none" stroke="#f3e9e2" stroke-opacity="${j === 0 || j === lanes ? .75 : .38}" stroke-width="${j === 0 || j === lanes ? 2.4 : 1.6}"/>`;
  // relay lane, leg by leg: run part bright, the rest dim; your leg outlined
  st.legs.forEach((l, k) => {
    const a = k * 100, b = a + 100;
    if (k + 1 === leg) g += `<path d="${lanePath(a, b)}" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="${lane + 8}" stroke-linecap="butt"/>`;
    g += `<path d="${lanePath(a, b)}" fill="none" stroke="${l.color}" stroke-opacity="${k + 1 === leg ? .55 : .3}" stroke-width="${lane - 2}"/>`;
    const ra = Math.max(a, 0), rb = Math.min(b, sNow);
    if (rb > ra) g += `<path d="${lanePath(ra, rb)}" fill="none" stroke="${l.color}" stroke-width="${lane - 2}"/>`;
  });
  // takeover zones: 20 m before the scratch line, 10 m after
  st.zones.forEach(z => {
    g += `<path d="${lanePath(z.s0, z.s1)}" fill="none" stroke="#ffe066" stroke-opacity=".26" stroke-width="${lane + 6}"/>`;
    for (const s of [z.s0, z.s1]) { const [x1, y1] = trackPt(s, TRK.R - lane / 2 - 9), [x2, y2] = trackPt(s, TRK.R + lane / 2 + 9);
      g += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#ffe066" stroke-width="4"/>`; }
    const [x1, y1] = trackPt(z.s0 + 20, TRK.R - lane / 2 - 4), [x2, y2] = trackPt(z.s0 + 20, TRK.R + lane / 2 + 4);
    g += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#fff" stroke-width="3" stroke-dasharray="5 4"/>`;
  });
  // finish line across all lanes
  { const [x1, y1] = trackPt(0, rIn), [x2, y2] = trackPt(0, rOut);
    g += `<rect x="${(x1 - 7).toFixed(1)}" y="${y1.toFixed(1)}" width="14" height="${(y2 - y1).toFixed(1)}" fill="url(#chk)"/>`; }
  // today's stretch and the baton
  if (racing) {
    g += `<path d="${lanePath(sNow, sEnd)}" fill="none" stroke="#fff" stroke-width="${lane - 4}" stroke-linecap="round" filter="url(#glow)"/>`;
    const [bx, by, ang] = trackPt(sNow + 0.001);
    g += `<g transform="translate(${bx.toFixed(1)} ${by.toFixed(1)}) rotate(${(ang * 180 / Math.PI).toFixed(1)})" filter="url(#glow)">
      <rect x="-26" y="-9" width="52" height="18" rx="9" fill="url(#baton)" stroke="#fff" stroke-width="2"/></g>`;
  }
  // runners: waiting ones on their scratch lines, the holder with the baton. In a takeover zone
  // both runners are drawn side by side: the incoming one starts early, the outgoing one stays on.
  const bib = (L, s, r, alpha = 1) => {
    const l = st.legs[L - 1], [x, y] = trackPt(s + 0.001, r), big = L === leg;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" opacity="${alpha}"><circle r="${big ? 25 : 19}" fill="${l.color}" stroke="${big ? "#fff" : "#0b1020"}" stroke-width="${big ? 5 : 3}"/>`
      + T_(0, big ? 10 : 8, String(L), { f: COND, w: 700, size: big ? 30 : 24, fill: "#0b1020", anchor: "middle" }) + `</g>`;
  };
  const OUT = TRK.R + 48, IN = TRK.R - 52;
  if (racing) {
    st.legs.forEach((l, k) => {
      const L = k + 1;
      if (L === st.holder) g += bib(L, sNow, OUT);
      else if (L > st.holder) g += L === st.holder + 1 && st.i === st.warmDay(L) ? bib(L, sNow + st.mPerDay * 0.6, IN) : bib(L, k * 100, TRK.R);
      else if (L === st.holder - 1 && st.i === st.standDay(L)) g += bib(L, sNow - st.mPerDay * 0.3, IN, .85);
    });
  } else g += st.i < 0 ? [1, 2, 3, 4].map(L => bib(L, (L - 1) * 100, TRK.R)).join("") : bib(4, 0, OUT);
  // labels around the oval
  const lab = (x, y, a, b, anchor, col = "#ffe066") => T_(x, y, a, { f: COND, w: 700, size: 27, fill: col, anchor, ls: 2 }) + T_(x, y + 32, b, { f: COND, w: 600, size: 27, fill: "#c9d3e8", anchor, ls: 1 });
  const zl = st.zones;
  g += lab(1004, 1132, `HANDOFF 1`, range(zl[0].d0, zl[0].d1).toUpperCase(), "start");
  g += lab(286, 1132, `HANDOFF 2`, range(zl[1].d0, zl[1].d1).toUpperCase(), "end");
  g += lab(286, 1734, `HANDOFF 3`, range(zl[2].d0, zl[2].d1).toUpperCase(), "end");
  g += lab(1004, 1734, `FINISH`, `${wkShort(st.due)} · ${plan.dueTime || "11:59 PM"}`.toUpperCase(), "start", "#fff");
  // infield scoreboard
  const inf = st.i >= st.N ? ["DONE", "SUBMITTED"] : st.T === 0 ? ["TODAY", `SUBMIT BY ${plan.dueTime || "11:59 PM"}`] : [`T-${st.T}`, st.T === 1 ? "DAY TO SUBMIT" : "DAYS TO SUBMIT"];
  g += T_(TRK.cx, TRK.cy + 38, inf[0], { f: COND, w: 700, size: 150, anchor: "middle", fill: "#fff" });
  g += T_(TRK.cx, TRK.cy + 88, inf[1], { f: COND, w: 600, size: 30, anchor: "middle", fill: "#9fb4dc", ls: 5 });
  g += T_(TRK.cx, TRK.cy - 86, racing ? `${Math.round(sNow)} M OF 400` : st.i < 0 ? "0 M OF 400" : "400 M OF 400", { f: COND, w: 600, size: 28, anchor: "middle", fill: "#9fb4dc", ls: 4 });

  // you card
  const yc = youCard(st), Y = 1806;
  g += `<rect x="62" y="${Y}" width="1166" height="232" rx="26" fill="#0e1528" stroke="${me.color}" stroke-opacity=".7" stroke-width="3"/>`;
  g += `<rect x="62" y="${Y}" width="14" height="232" rx="7" fill="${me.color}"/>`;
  g += T_(104, Y + 52, `YOU · LEG ${leg} · ${me.title.toUpperCase()}`, { f: COND, w: 700, size: 32, fill: me.color, ls: 3 });
  g += T_(1196, Y + 52, yc.tag, { f: COND, w: 600, size: 28, fill: "#c9d3e8", ls: 3, anchor: "end" });
  g += T_(102, Y + 124, yc.big, { f: COND, w: 700, size: 80, fill: "#fff", ls: 1 });
  wrap(yc.detail, 1080, 31, 500, "Barlow", 2).forEach((ln, j) => { g += T_(104, Y + 168 + j * 38, ln, { size: 31, fill: "#d5dcec" }); });

  // today: what the baton holder does
  const ty = 2094;
  if (racing) {
    const h = st.legs[st.holder - 1];
    g += T_(78, ty, `TODAY · LEG ${st.holder} · ${h.title.toUpperCase()}`, { f: COND, w: 700, size: 30, fill: h.color, ls: 3 });
    wrap(st.task, 1130, 38, 600, "Barlow", 1).forEach(ln => { g += T_(78, ty + 50, ln, { w: 600, size: 38 }); });
  } else {
    g += T_(78, ty, st.i < 0 ? "KICKOFF · TODAY" : "FINISHED", { f: COND, w: 700, size: 30, fill: "#9fb4dc", ls: 3 });
    g += T_(78, ty + 50, st.i < 0 ? plan.kickoff : `Submitted ${wkShort(st.due)}. Every leg ran.`, { w: 600, size: 38 });
  }

  // the four legs
  st.legs.forEach((l, k) => {
    const y = 2240 + k * 66, L = k + 1, mine = L === leg;
    const done = st.i > l.b, run = racing && st.holder === L;
    if (mine) g += `<rect x="62" y="${y - 44}" width="1166" height="60" rx="14" fill="${l.color}" fill-opacity=".14"/>`;
    g += `<circle cx="98" cy="${y - 14}" r="17" fill="${l.color}" fill-opacity="${done ? .45 : 1}"/>` + T_(98, y - 5, String(L), { f: COND, w: 700, size: 24, fill: "#0b1020", anchor: "middle" });
    g += T_(134, y, l.title, { w: 600, size: 33, fill: done ? "#8792a8" : "#fff" });
    g += T_(134 + measure(l.title, 33, 600, "Barlow") + 18, y, range(l.from, l.to), { size: 27, fill: "#8f9bb5" });
    const right = done ? "DONE" : run ? `RUNNING · DAY ${st.i - l.a + 1}` : mine ? "YOU" : `FROM ${short(l.from).toUpperCase()}`;
    g += T_(1210, y, right, { f: COND, w: 700, size: 28, fill: done ? "#3FE08F" : run ? l.color : mine ? l.color : "#8f9bb5", anchor: "end", ls: 2 });
  });
  return g + `</svg>`;
}

if (typeof module !== "undefined") module.exports = { renderRelay, relayState, DEFAULT_PLAN: typeof DEFAULT_PLAN !== "undefined" ? DEFAULT_PLAN : null };
