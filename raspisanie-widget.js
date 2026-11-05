// Виджет расписания 10Б для Scriptable (iPhone)
// Показывает текущий/следующие уроки, кабинет и учителя.
// Изменения из "changes" действуют только на указанную неделю.

// ===== НАСТРОЙКИ =====
// Твои группы: en — английский, project — индивидуальный проект ("1" или "2")
const GROUPS = { en: "2", project: "1" };
// Расписание берётся с GitHub — туда Claude вносит замены, которые ты присылаешь.
// Пусто = брать файл schedule.json из папки Scriptable в iCloud.
const DATA_URL = "https://raw.githubusercontent.com/kolobovd36-byte/claude/main/schedule.json";
const LOCAL_NAME = "schedule.json";
// =====================

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_RU = { mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб", sun: "Вс" };

async function loadData() {
  const lfm = FileManager.local();
  const cache = lfm.joinPath(lfm.documentsDirectory(), "schedule-cache.json");
  if (DATA_URL) {
    try {
      const req = new Request(DATA_URL + "?t=" + Date.now());
      req.timeoutInterval = 10;
      const txt = await req.loadString();
      const data = JSON.parse(txt);
      lfm.writeString(cache, txt);
      return data;
    } catch (e) {
      // нет интернета — берём последнюю сохранённую копию
      if (lfm.fileExists(cache)) return JSON.parse(lfm.readString(cache));
      throw e;
    }
  }
  const fm = FileManager.iCloud();
  const path = fm.joinPath(fm.documentsDirectory(), LOCAL_NAME);
  if (!fm.fileExists(path)) throw new Error("Положи " + LOCAL_NAME + " в папку Scriptable");
  await fm.downloadFileFromiCloud(path);
  return JSON.parse(fm.readString(path));
}

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
function parseYmd(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function mondayOf(d) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}
function atTime(day, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

// Уроки на конкретную дату с учётом группы и изменений этой недели
function lessonsFor(data, date) {
  const key = DAYS[date.getDay()];
  const base = data.days[key] || [];
  const week = ymd(mondayOf(date));
  const out = [];
  for (let i = 0; i < data.times.length; i++) {
    let slot = base[i] || null;
    const set = slot && slot.set;
    if (slot && slot.groups) slot = slot.groups[GROUPS[slot.set] || "1"] || null;
    for (const ch of data.changes || []) {
      if (ch.day !== key || Number(ch.lesson) !== i + 1) continue;
      if (!ch.week || ymd(mondayOf(parseYmd(ch.week))) !== week) continue;
      if (ch.group && String(ch.group) !== (GROUPS[ch.set || set] || "1")) continue;
      const { week: _w, day: _d, lesson: _l, group: _g, set: _s, cancel, ...fields } = ch;
      slot = cancel ? null : { ...(slot || {}), ...fields, changed: true };
    }
    if (slot && slot.subject) {
      const [s, e] = data.times[i];
      out.push({ n: i + 1, ...slot, start: atTime(date, s), end: atTime(date, e) });
    }
  }
  return out;
}

function upcoming(data, now, count) {
  const out = [];
  for (let k = 0; k < 14 && out.length < count; k++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
    for (const l of lessonsFor(data, d)) {
      if (l.end > now) { out.push(l); if (out.length >= count) break; }
    }
  }
  return out;
}

function dayLabel(d, now) {
  if (ymd(d) === ymd(now)) return "";
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (ymd(d) === ymd(tomorrow)) return "Завтра, ";
  return DAY_RU[DAYS[d.getDay()]] + ", ";
}

async function build() {
  const now = new Date();
  const family = config.widgetFamily || "medium";
  const w = new ListWidget();

  let data;
  try { data = await loadData(); }
  catch (e) { const t = w.addText("⚠️ " + e.message); t.font = Font.systemFont(12); return w; }

  const counts = { small: 2, medium: 3, large: 7, accessoryRectangular: 1, accessoryInline: 1 };
  const list = upcoming(data, now, counts[family] || 3);
  if (!list.length) { w.addText("Уроков нет"); return w; }

  const first = list[0];
  w.refreshAfterDate = first.start > now ? first.start : first.end;
  const when = (l) => (l.start <= now ? "Сейчас" : dayLabel(l.start, now) + fmt(l.start));

  // Экран блокировки — одна строка
  if (family === "accessoryInline") {
    w.addText(`${when(first)} ${first.subject}${first.room ? " · " + first.room : ""}`);
    return w;
  }
  // Экран блокировки — прямоугольный
  if (family === "accessoryRectangular") {
    const a = w.addText(when(first)); a.font = Font.semiboldSystemFont(12);
    const b = w.addText((first.changed ? "⚠︎ " : "") + first.subject); b.font = Font.boldSystemFont(15); b.lineLimit = 1;
    const c = w.addText(`${first.room ? "каб. " + first.room + " · " : ""}${first.teacher || ""}`);
    c.font = Font.systemFont(12); c.lineLimit = 1;
    return w;
  }

  // Главный экран
  w.backgroundColor = Color.dynamic(new Color("#ffffff"), new Color("#1c1c1e"));
  w.setPadding(12, 14, 12, 14);
  const head = w.addText(data.class || "Расписание");
  head.font = Font.semiboldSystemFont(11);
  head.textColor = Color.gray();
  w.addSpacer(4);

  const small = family === "small";
  for (const l of list) {
    const live = l.start <= now;
    const color = l.changed ? new Color("#ff9500")
      : live ? new Color("#34c759")
      : Color.dynamic(Color.black(), Color.white());
    const top = w.addText(`${live ? "● " : ""}${l.subject}${l.room ? " · " + l.room : ""}`);
    top.font = Font.boldSystemFont(small ? 13 : 15);
    top.textColor = color;
    top.lineLimit = 1;
    const sub = w.addText(
      `${dayLabel(l.start, now)}${fmt(l.start)}–${fmt(l.end)}${!small && l.teacher ? " · " + l.teacher : ""}`
    );
    sub.font = Font.systemFont(11);
    sub.textColor = Color.gray();
    sub.lineLimit = 1;
    if (small && l.teacher) {
      const t = w.addText(l.teacher); t.font = Font.systemFont(11); t.textColor = Color.gray(); t.lineLimit = 1;
    }
    w.addSpacer(6);
  }
  w.addSpacer();
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
