"use strict";

importScripts("shared.js");

api.runtime.onMessage.addListener((request, sender, respond) => {
  if (request?.type !== "dark-side-lesson" || !sender.url) return false;

  const source = new URL(sender.url);
  const offline = source.origin === fixtureOrigin && source.pathname === "/offline/booking.html";
  if (!(offline || source.origin === bookingOrigin)) return false;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  if (url.username || url.password ||
      !(offline ? url.origin === fixtureOrigin && url.pathname === "/offline/calendar.html" : url.origin === notionOrigin) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(request.date) || !/^\d{2}:\d{2}$/.test(request.time) ||
      !["centrum", "reckovice"].includes(request.branch)) return false;

  readCalendar(url, request, sender.tab).then(respond, () => respond({
    state: request.foreground === true ? "unavailable" : "retry-visible", reason: "tab"
  }));
  return true;
});

function pageKey(href) {
  const url = new URL(href);
  url.searchParams.delete("pvs");
  url.searchParams.sort();
  return url.origin + url.pathname.replace(/\/$/, "") + url.search + url.hash;
}

async function queryCalendar(tabId, message) {
  let timer;
  try {
    return await Promise.race([
      api.tabs.sendMessage(tabId, message),
      new Promise(resolve => { timer = setTimeout(resolve, 700); })
    ]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function readCalendar(url, { date, time, branch, foreground }, sourceTab) {
  const allowed = await api.permissions.contains({ origins: [url.origin + "/*"] });
  if (!allowed) return { state: "access" };

  const message = { type: "dark-side-calendar", date, time, branch };
  const visible = foreground === true;
  if (!visible) {
    const tabs = await api.tabs.query({ url: url.origin + "/*" }).catch(() => []);
    const existing = tabs.find(tab => tab.url && pageKey(tab.url) === pageKey(url.href));
    if (existing) {
      const result = await queryCalendar(existing.id, { ...message, preview: true });
      if (result?.state === "found" || result?.state === "ambiguous") return result;
    }
  }

  const tab = await api.tabs.create({ url: url.href, active: visible, windowId: sourceTab?.windowId });
  const started = Date.now();
  const hardDeadline = started + (visible ? 24_000 : 10_000);
  let deadline = started + (visible ? 15_000 : 5_000);
  let reason = "tab";
  const visited = new Set();
  try {
    while (Date.now() < deadline) {
      const result = await queryCalendar(tab.id, message);
      if (result?.state && result.state !== "loading") return result;
      if (result?.reason) reason = result.reason;
      if (result?.progress && !visited.has(result.progress)) {
        visited.add(result.progress);
        deadline = Math.min(hardDeadline, Math.max(deadline, Date.now() + 3000));
      }
      await pause(200);
    }
    return { state: visible ? "unavailable" : "retry-visible", reason };
  } finally {
    if (visible && sourceTab) {
      const current = await api.tabs.get(tab.id).catch(() => null);
      if (current?.active) await api.tabs.update(sourceTab.id, { active: true }).catch(() => {});
    }
    await api.tabs.remove(tab.id).catch(() => {});
  }
}
