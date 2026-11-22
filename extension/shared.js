"use strict";

const api = globalThis.browser ?? globalThis.chrome;
const bookingOrigin = "https://rezervace.darksidemovement.cz";
const notionOrigin = "https://darksidemovement.notion.site";
const fixtureOrigin = "http://127.0.0.1:8765";

function clean(text) {
  return text?.replace(/[\s\u200b]+/g, " ").trim() ?? "";
}

function normalized(text) {
  return clean(text).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function branchName(text) {
  const name = normalized(text);
  if (/\b(centrum|stred)\b/.test(name)) return "centrum";
  if (/\breckovice\b/.test(name)) return "reckovice";
  return "";
}

function isoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return "";
  return date.toISOString().slice(0, 10);
}

const months = [
  "january leden ledna", "february unor unora", "march brezen brezna", "april duben dubna",
  "may kveten kvetna", "june cerven cervna", "july cervenec cervence", "august srpen srpna",
  "september zari", "october rijen rijna", "november listopad listopadu", "december prosinec prosince"
];

function monthNumber(name) {
  return months.findIndex(names => names.split(" ").includes(name)) + 1;
}

function bookingDate(text, now = new Date()) {
  const parts = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const { year: currentYear, month: currentMonth, day } =
    Object.fromEntries(parts.map(part => [part.type, part.value]));
  const today = `${currentYear}-${currentMonth}-${day}`;
  const value = normalized(text);
  const relative = value.match(/^(dnes|zitra|pozitri|vcera)(?:$|[ ,])/);
  if (relative) {
    const shift = { dnes: 0, zitra: 1, pozitri: 2, vcera: -1 };
    const date = new Date(today + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + shift[relative[1]]);
    return date.toISOString().slice(0, 10);
  }

  const iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return isoDate(+iso[1], +iso[2], +iso[3]);

  const numeric = value.match(/\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?(?!\d)/);
  const written = value.match(/\b(\d{1,2})\.\s+([a-z]+)(?:\s+(\d{4}))?\b/);
  const match = numeric ?? written;
  if (!match) return "";
  const month = numeric ? +match[2] : monthNumber(match[2]);
  const year = +match[3] || +currentYear;
  return isoDate(year, month, +match[1]);
}

function startTime(text) {
  const match = clean(text).match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return match ? match[1].padStart(2, "0") + ":" + match[2] : "";
}

function visible(element) {
  return Boolean(element.getClientRects().length) && getComputedStyle(element).visibility === "visible";
}

function textElements(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const elements = new Set();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement;
    if (clean(node.data) && element && !element.closest("script, style, noscript, [data-dark-side-coach]")) {
      elements.add(element);
    }
  }
  return [...elements];
}

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
