/**
 * Holiday detection — US federal holidays + American Jewish (Diaspora) holidays.
 * Pure JS, no external dependencies. Uses hebrewDate.js for conversions.
 *
 * American Jewish calendar (Diaspora / outside Israel):
 *  - 2 days Yom Tov for Sukkot, Passover, Shavuot (where applicable)
 *  - Shemini Atzeret (22 Tishrei) and Simchat Torah (23 Tishrei) are separate days
 *  - Passover has 8 days (last day = 22 Nisan)
 *  - Israeli national holidays (Yom HaZikaron, Yom HaAtzmaut, Yom Yerushalayim)
 *    are NOT included — this calendar is for American Jewish communities
 *  - Yom HaShoah (Holocaust Remembrance) is included as it is widely observed in the US
 */

import { gregorianToHebrewFromYMD } from "./hebrewDate.js";

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function p(n) { return String(n).padStart(2, "0"); }
export function dateKey(d) {
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** nth occurrence of a weekday in a month. n=-1 = last. */
function nthWeekday(year, month1, weekday, n) {
  if (n === -1) {
    const last = new Date(year, month1, 0);
    const diff = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month1 - 1, last.getDate() - diff);
  }
  const first = new Date(year, month1 - 1, 1);
  const diff  = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month1 - 1, 1 + diff + (n - 1) * 7);
}

/* ─── US Federal Holidays ───────────────────────────────────────────────────── */

const _usCache = {};

function buildUSHolidays(year) {
  if (_usCache[year]) return _usCache[year];
  const h = {};
  const add = (d, name) => {
    const k = dateKey(d);
    (h[k] = h[k] ?? []).push({ name, type: "us" });
  };

  add(new Date(year, 0, 1),              "New Year's Day");
  add(nthWeekday(year, 1, 1, 3),         "MLK Day");
  add(nthWeekday(year, 2, 1, 3),         "Presidents' Day");
  add(nthWeekday(year, 5, 1, -1),        "Memorial Day");
  add(new Date(year, 6, 4),              "Independence Day");
  add(nthWeekday(year, 9, 1, 1),         "Labor Day");
  add(nthWeekday(year, 10, 1, 2),        "Columbus Day");
  add(new Date(year, 10, 11),            "Veterans Day");
  add(nthWeekday(year, 11, 4, 4),        "Thanksgiving");
  add(new Date(year, 11, 25),            "Christmas");

  return (_usCache[year] = h);
}

/** Return US holiday names for a given JS Date. */
export function getUSHolidays(jsDate) {
  const map = buildUSHolidays(jsDate.getFullYear());
  return (map[dateKey(jsDate)] ?? []).map((h) => h.name);
}

/* ─── American Jewish Holidays (Diaspora) ───────────────────────────────────── */
// Holidays keyed by [hebrewMonth, hebrewDay, name].
// Hebrew months: 1=Nisan, 2=Iyar, 3=Sivan, 4=Tammuz, 5=Av, 6=Elul,
//                7=Tishrei, 8=Cheshvan, 9=Kislev, 10=Tevet, 11=Shevat,
//                12=Adar (13=Adar II in leap years)
//
// Diaspora differences from Israeli calendar:
//   • Sukkot: 2 days Yom Tov (15–16), then Chol HaMoed, then Shemini Atzeret + Simchat Torah separate
//   • Passover: 2 days Yom Tov at start (15–16) and 2 days at end (21–22) = 8 days total
//   • Shavuot: 2 days (6–7 Sivan)
//   • Israeli national holidays omitted (Yom HaZikaron, Yom HaAtzmaut, Yom Yerushalayim)

const HEB_HOLIDAYS = [
  // ── Tishrei ──────────────────────────────────────────────────────────────────
  [7,  1,  "Rosh Hashanah"],
  [7,  2,  "Rosh Hashanah"],
  [7,  3,  "Tzom Gedaliah"],
  [7,  10, "Yom Kippur"],
  [7,  15, "Sukkot"],                    // Day 1 Yom Tov
  [7,  16, "Sukkot"],                    // Day 2 Yom Tov (Diaspora)
  [7,  17, "Chol HaMoed Sukkot"],
  [7,  18, "Chol HaMoed Sukkot"],
  [7,  19, "Chol HaMoed Sukkot"],
  [7,  20, "Chol HaMoed Sukkot"],
  [7,  21, "Hoshana Raba"],
  [7,  22, "Shemini Atzeret"],           // Diaspora: separate from Simchat Torah
  [7,  23, "Simchat Torah"],             // Diaspora: day after Shemini Atzeret

  // ── Kislev / Tevet — Hanukkah (8 days starting 25 Kislev) ──────────────────
  // Short Kislev (29 days): days 6–8 fall on 1–3 Tevet
  // Long  Kislev (30 days): day 6 = 30 Kislev, days 7–8 = 1–2 Tevet
  // Including 30 Kislev covers the long-Kislev case without breaking short-Kislev
  // (30 Kislev simply doesn't exist in a short year, so the entry is never matched).
  [9,  25, "Hanukkah"],
  [9,  26, "Hanukkah"],
  [9,  27, "Hanukkah"],
  [9,  28, "Hanukkah"],
  [9,  29, "Hanukkah"],
  [9,  30, "Hanukkah"],                  // Day 6 when Kislev has 30 days
  [10,  1, "Hanukkah"],
  [10,  2, "Hanukkah"],
  [10,  3, "Hanukkah"],                  // Day 8 when Kislev has 29 days (short year)
  [10, 10, "Asara B'Tevet"],

  // ── Shevat / Adar ────────────────────────────────────────────────────────────
  [11, 15, "Tu BiShvat"],
  [12, 13, "Ta'anit Esther"],
  [12, 14, "Purim"],
  [12, 15, "Shushan Purim"],
  [13, 14, "Purim"],                     // Adar II in leap year
  [13, 15, "Shushan Purim"],

  // ── Nisan — Passover (8 days in Diaspora) ────────────────────────────────────
  [1,  14, "Erev Pesach"],
  [1,  15, "Passover"],                  // Day 1 Yom Tov
  [1,  16, "Passover"],                  // Day 2 Yom Tov (Diaspora)
  [1,  17, "Chol HaMoed Pesach"],
  [1,  18, "Chol HaMoed Pesach"],
  [1,  19, "Chol HaMoed Pesach"],
  [1,  20, "Chol HaMoed Pesach"],
  [1,  21, "Passover"],                  // Day 7 Yom Tov
  [1,  22, "Passover (Last Day)"],       // Day 8 Yom Tov — Diaspora only
  [1,  27, "Yom HaShoah"],              // Holocaust Remembrance (widely observed in US)

  // ── Iyar ──────────────────────────────────────────────────────────────────────
  [2,  14, "Pesach Sheni"],
  [2,  18, "Lag B'Omer"],

  // ── Sivan — Shavuot (2 days in Diaspora) ─────────────────────────────────────
  [3,   6, "Shavuot"],                   // Day 1 Yom Tov
  [3,   7, "Shavuot"],                   // Day 2 Yom Tov (Diaspora)

  // ── Tammuz / Av ──────────────────────────────────────────────────────────────
  [4,  17, "Shiva Asar B'Tammuz"],
  [5,   9, "Tisha B'Av"],

  // ── Elul ──────────────────────────────────────────────────────────────────────
  [6,  29, "Erev Rosh Hashanah"],
];

/** Return Hebrew/Jewish holiday names for a given JS Date (uses local calendar day only). */
export function getHebrewHolidays(jsDate) {
  const { month, day } = gregorianToHebrewFromYMD(
    jsDate.getFullYear(),
    jsDate.getMonth() + 1,
    jsDate.getDate(),
  );
  return HEB_HOLIDAYS
    .filter(([m, d]) => m === month && d === day)
    .map(([, , name]) => name);
}

/**
 * Return all holidays for a date.
 * @returns {{ us: string[], hebrew: string[], all: string[] }}
 */
export function getAllHolidays(jsDate) {
  const us     = getUSHolidays(jsDate);
  const hebrew = getHebrewHolidays(jsDate);
  return { us, hebrew, all: [...us, ...hebrew] };
}
