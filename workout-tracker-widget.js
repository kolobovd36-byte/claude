// Виджет «Трекер тренировок» для Scriptable  (назови скрипт «Трекер»)
// Экран блокировки: круглый / прямоугольный / строка над часами.
// Домашний экран: маленький, средний, большой.
//
// Как обновлять данные: в трекере нажми «Обновить виджет» —
// данные скопируются и откроется этот скрипт, он их сохранит и вернёт тебя в трекер.

// ⬇️ ссылка, по которой открываешь трекер
const URL = "https://kolobovd36-byte.github.io/claude/workout-tracker.html";

// Расписание: день недели → название дня в трекере (0 = воскресенье). null = отдых
const PLAN = { 1: "Anterior", 2: "Posterior", 3: "Bench Press", 4: "Anterior", 5: "Posterior", 6: "Bench Press", 0: null };

const GREEN = new Color("#30d158"), RED = new Color("#ff6b6b"), GRAY = new Color("#8e8e93");
const BG = new Color("#1c1c1e"), WHITE = Color.white();
const fm = FileManager.local();
const FILE = fm.joinPath(fm.documentsDirectory(), "workout-tracker-data.json");

// ---------- данные ----------
function loadData() {
  try { if (fm.fileExists(FILE)) return JSON.parse(fm.readString(FILE)); } catch (e) {}
  return null;
}
function tryImportFromClipboard() {
  try {
    const raw = Pasteboard.paste();
    if (!raw || raw.length > 5e6) return false;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.days) || !Array.isArray(d.history)) return false;
    d.syncedAt = Date.now();
    fm.writeString(FILE, JSON.stringify(d));
    return true;
  } catch (e) { return false; }
}

const e1rm = it => {
  const r = it.uni ? (Number(it.reps) + Number(it.repsL)) / 2 : Number(it.reps);
  return it.weight > 0 ? it.weight * (1 + r / 30) : r;
};
const fmt = n => String(Math.round(n * 10) / 10).replace(".", ",");
const DAY = 864e5;
function ago(ts) {
  const d = Math.floor((startOfDay(Date.now()) - startOfDay(ts)) / DAY);
  if (d <= 0) return "сегодня";
  if (d === 1) return "вчера";
  const m10 = d % 10, m100 = d % 100;
  const w = (m10 === 1 && m100 !== 11) ? "день" : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) ? "дня" : "дней";
  return d + " " + w + " назад";
}
function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }

function stats(data) {
  const todayName = PLAN[new Date().getDay()];
  const s = { todayName, today: null, sets: 0, last: null, week: 0, up: 0, flat: 0, down: 0, total: 0, benchNext: null, benchBest: 0, benchDone: 0, benchAll: 0, synced: null };
  if (!data) return s;
  s.synced = data.syncedAt || null;
  const days = data.days || [], hist = (data.history || []).slice().sort((a, b) => a.date - b.date);
  const day = days.find(d => d.name === todayName);
  if (day && day.items) { s.today = day; s.sets = day.items.reduce((a, e) => a + (parseInt(e.sets) || 0), 0); }
  s.last = hist[hist.length - 1] || null;
  s.week = hist.filter(h => h.date > Date.now() - 7 * DAY).length;
  // прогресс: последняя vs предыдущая по каждому упражнению
  const m = {};
  hist.forEach(h => (h.items || []).forEach(it => { (m[it.sci] = m[it.sci] || []).push(e1rm(it)); }));
  Object.values(m).forEach(p => {
    if (p.length < 2) return;
    const a = p[p.length - 2], b = p[p.length - 1], d = a ? (b - a) / a : 0;
    s.total++; if (d > 0.005) s.up++; else if (d < -0.005) s.down++; else s.flat++;
  });
  // жим
  const bench = days.find(d => d.kind === "bench");
  if (bench) {
    const all = (bench.weeks || []).flatMap(w => w.items || []);
    s.benchAll = all.length; s.benchDone = all.filter(x => x.done).length;
    s.benchNext = all.find(x => !x.done) || null;
    s.benchBest = Math.max(0, ...all.filter(x => x.t === "test" && x.done).map(x => x.w));
  }
  return s;
}
const LBL = { light: "Лёгкая", heavy: "Тяжёлая", test: "Проходка" };
const benchTxt = n => n ? `${LBL[n.t] || ""} ${fmt(n.w)} кг${n.sc ? " · " + n.sc : ""}${n.t === "test" && n.note ? " · " + n.note : ""}` : "программа пройдена";

// ---------- отрисовка ----------
function sym(name, size, color) {
  const s = SFSymbol.named(name); s.applyFont(Font.systemFont(size));
  return { img: s.image, color };
}
function addSym(stack, name, size, color = WHITE) {
  const i = stack.addImage(sym(name, size).img); i.imageSize = new Size(size, size); i.tintColor = color; return i;
}
function text(stack, t, size, color = WHITE, bold = false) {
  const x = stack.addText(t); x.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size); x.textColor = color; x.lineLimit = 1; x.minimumScaleFactor = 0.7; return x;
}
function ring(up, total, size = 58) {
  const c = new DrawContext(); c.size = new Size(size, size); c.opaque = false; c.respectScreenScale = true;
  const r = size / 2 - 5, cx = size / 2, lw = 7;
  const arc = (from, to, color) => {
    const p = new Path(), pts = [];
    for (let a = from; a <= to; a += 0.03) pts.push(new Point(cx + r * Math.cos(a), cx + r * Math.sin(a)));
    pts.push(new Point(cx + r * Math.cos(to), cx + r * Math.sin(to)));
    p.addLines(pts); c.addPath(p); c.setStrokeColor(color); c.setLineWidth(lw); c.strokePath();
  };
  const start = -Math.PI / 2;
  arc(start, start + 2 * Math.PI, new Color("#333338"));
  if (total) arc(start, start + 2 * Math.PI * up / total, GREEN);
  c.setFont(Font.boldSystemFont(17)); c.setTextColor(up ? GREEN : WHITE); c.setTextAlignedCenter();
  c.drawTextInRect(String(up), new Rect(0, size / 2 - 12, size, 22));
  return c.getImage();
}

function build(family, s) {
  const w = new ListWidget();
  w.url = URL;
  w.refreshAfterDate = new Date(Date.now() + 3600e3);
  const dayLine = s.todayName ? s.todayName : "День отдыха";
  const setsLine = s.today ? `${s.today.items.length} упр. · ${s.sets} подх.` : (s.todayName === "Bench Press" ? benchTxt(s.benchNext) : "восстановление");
  const lastLine = s.last ? `${s.last.day} · ${ago(s.last.date)}` : "ещё нет тренировок";

  // ----- экран блокировки -----
  if (family === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    if (s.total) {
      const st = w.addStack(); st.layoutVertically(); st.centerAlignContent();
      const a = st.addStack(); a.addSpacer(); addSym(a, "chart.line.uptrend.xyaxis", 14); a.addSpacer();
      const b = st.addStack(); b.addSpacer(); text(b, `${s.up}/${s.total}`, 14, WHITE, true); b.addSpacer();
    } else {
      const a = w.addStack(); a.addSpacer(); addSym(a, "dumbbell.fill", 24); a.addSpacer();
    }
    return w;
  }
  if (family === "accessoryRectangular") {
    const r = w.addStack(); r.centerAlignContent(); r.spacing = 5;
    addSym(r, "dumbbell.fill", 14); text(r, dayLine, 15, WHITE, true);
    text(w, setsLine, 13).textOpacity = 0.8;
    text(w, s.benchNext && s.todayName !== "Bench Press" ? "Жим: " + benchTxt(s.benchNext) : lastLine, 12).textOpacity = 0.6;
    return w;
  }
  if (family === "accessoryInline") {
    w.addText(`🏋️ ${dayLine}${s.today ? " · " + s.sets + " подх." : ""}`);
    return w;
  }

  // ----- домашний экран -----
  w.backgroundColor = BG;
  w.setPadding(14, 15, 14, 15);

  const head = w.addStack(); head.centerAlignContent(); head.spacing = 6;
  addSym(head, "dumbbell.fill", 15);
  text(head, "Трекер", 13, GRAY, true);
  head.addSpacer();
  if (family !== "small") text(head, `за неделю: ${s.week}`, 12, GRAY);
  w.addSpacer(family === "small" ? null : 8);

  if (family === "small") {
    text(w, dayLine, 20, WHITE, true);
    text(w, setsLine, 12, s.todayName ? GREEN : GRAY);
    w.addSpacer(6);
    text(w, "Последняя:", 10, GRAY);
    text(w, lastLine, 11, WHITE);
    return w;
  }

  // medium / large: слева сегодня, справа кольцо прогресса
  const row = w.addStack(); row.centerAlignContent();
  const left = row.addStack(); left.layoutVertically();
  text(left, "Сегодня", 11, GRAY);
  text(left, dayLine, 22, WHITE, true);
  text(left, setsLine, 13, s.todayName ? GREEN : GRAY);
  row.addSpacer();
  const right = row.addStack(); right.layoutVertically(); right.centerAlignContent();
  right.addImage(ring(s.up, s.total)).imageSize = new Size(58, 58);
  const cap = right.addStack(); cap.addSpacer(); text(cap, s.total ? `из ${s.total} растут` : "нет данных", 9, GRAY); cap.addSpacer();

  w.addSpacer(8);
  const bottom = w.addStack(); bottom.spacing = 8;
  const box = (title, value, color = WHITE) => {
    const b = bottom.addStack(); b.layoutVertically(); b.backgroundColor = new Color("#2a2a2e"); b.cornerRadius = 10; b.setPadding(6, 8, 6, 8);
    text(b, title, 9, GRAY); text(b, value, 12, color, true);
    return b;
  };
  box("Последняя", lastLine);
  box("Жим лёжа", benchTxt(s.benchNext), s.benchNext && s.benchNext.t === "test" ? GREEN : WHITE);

  if (family === "large" || family === "extraLarge") {
    w.addSpacer(10);
    text(w, s.today ? "План на сегодня" : "Жимовая программа", 11, GRAY);
    w.addSpacer(4);
    if (s.today) {
      s.today.items.slice(0, 8).forEach(e => {
        const r = w.addStack(); r.centerAlignContent();
        text(r, e.sci, 12, WHITE); r.addSpacer();
        text(r, `${fmt(e.weight)} × ${e.uni ? e.reps + "/" + e.repsL : e.reps}`, 12, GRAY);
        w.addSpacer(3);
      });
    } else {
      text(w, `Выполнено ${s.benchDone} из ${s.benchAll} · лучшая проходка ${s.benchBest ? fmt(s.benchBest) + " кг" : "—"}`, 12, WHITE);
    }
    w.addSpacer();
    text(w, s.synced ? `данные обновлены ${ago(s.synced)}` : "нажми «Обновить виджет» в трекере", 9, GRAY);
  }
  return w;
}

// ---------- запуск ----------
if (config.runsInWidget) {
  Script.setWidget(build(config.widgetFamily || "small", stats(loadData())));
} else if (tryImportFromClipboard()) {
  // пришли из трекера по кнопке «Обновить виджет»
  Safari.open(URL);
} else {
  // запуск вручную — показать превью
  await build("medium", stats(loadData())).presentMedium();
}
Script.complete();
