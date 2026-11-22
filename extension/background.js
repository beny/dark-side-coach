"use strict";

importScripts("shared.js");

api.runtime.onMessage.addListener((request, sender, respond) => {
  if (request?.type !== "dark-side-lesson" || !sender.url) return false;

  if (new URL(sender.url).origin !== bookingOrigin) return false;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  if (url.username || url.password ||
      url.origin !== notionOrigin ||
      !/^\d{4}-\d{2}-\d{2}$/.test(request.date) || !/^\d{2}:\d{2}$/.test(request.time) ||
      !["centrum", "reckovice"].includes(request.branch)) return false;

  readCalendar(url, request).then(respond, () => respond({ state: "unavailable" }));
  return true;
});

function notionRecord(records, id) {
  const entry = records?.[id]?.value;
  return entry?.value ?? entry;
}

function notionCalendarViews(records, pageId, branch) {
  const pending = [pageId];
  const visited = new Set();
  const views = new Map();
  while (pending.length) {
    const id = pending.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    const block = notionRecord(records.block, id);
    if (!block) continue;
    // The response can also contain records for unrelated pages.
    if (id === pageId || block.type !== "page") pending.push(...(block.content ?? []));
    for (const viewId of block.view_ids ?? []) {
      const view = notionRecord(records.collection_view, viewId);
      if (view?.type === "calendar" && branchName(view.name) === branch) views.set(viewId, view);
    }
  }
  return [...views.values()];
}

async function notionPost(endpoint, payload, signal) {
  const response = await fetch(notionOrigin + "/api/v3/" + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "omit",
    redirect: "error",
    signal
  });
  if (!response.ok) throw new Error("Notion HTTP " + response.status);
  return response.json();
}

async function readPublicCalendar(url, { date, time, branch }) {
  const pageId = url.pathname.replace(/\/$/, "")
    .match(/(?:^|[/-])([\da-f]{8}-?[\da-f]{4}-?[\da-f]{4}-?[\da-f]{4}-?[\da-f]{12})$/i)?.[1]
    .replace(/-/g, "").toLowerCase()
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  if (!pageId) throw new Error("Missing Notion page ID");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const { recordMap } = await notionPost("loadCachedPageChunkV2", {
      page: { id: pageId }, cursor: { stack: [] }, verticalColumns: false
    }, controller.signal);
    const views = notionCalendarViews(recordMap, pageId, branch);
    if (!views.length) throw new Error("Missing Notion calendar");
    const results = await Promise.all(views.map(view =>
      readNotionView(recordMap, view, date, time, controller.signal)));
    const matches = new Map(results.flat());
    if (matches.size > 1) return { state: "ambiguous" };
    if (!matches.size) return { state: "missing" };
    return { state: "found", ...matches.values().next().value };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

async function readNotionView(records, view, date, time, signal) {
  const pointer = view.format?.collection_pointer;
  const dateKey = view.query2?.calendar_by;
  const schema = notionRecord(records.collection, pointer?.id)?.schema;
  const coachKey = Object.keys(schema ?? {}).find(id => /^(trener|coach)$/.test(normalized(schema[id]?.name)));
  const filters = view.format?.property_filters?.map(entry => entry.filter);
  if (!pointer?.id || !pointer.spaceId || !dateKey || !coachKey || !filters?.length ||
      filters.some(filter => !filter?.property || !filter.filter)) throw new Error("Unsupported Notion view");

  const dateValue = { type: "exact", value: { type: "date", start_date: date } };
  const result = await notionPost("queryCollection?src=change_group", {
    clientType: "notion_app",
    supportsResultPagination: true,
    source: { type: "collection", id: pointer.id, spaceId: pointer.spaceId },
    collectionView: { id: view.id, spaceId: pointer.spaceId },
    loader: {
      reducers: {
        calendar_results: {
          type: "results", limit: 100,
          filter: { operator: "and", filters: [
            { property: dateKey, filter: { operator: "date_is_on_or_after", use_end: true, value: dateValue } },
            { property: dateKey, filter: { operator: "date_is_on_or_before", value: dateValue } }
          ] }
        }
      },
      filter: { operator: "and", filters },
      sort: [], searchQuery: "", archiveStatus: "NON_ARCHIVED", userTimeZone: "Europe/Prague"
    }
  }, signal);

  const ids = result.result?.reducerResults?.calendar_results?.blockIds;
  if (!Array.isArray(ids) || ids.length >= 100) throw new Error("Incomplete Notion results");
  const matches = [];
  for (const id of ids) {
    const row = notionRecord(result.recordMap?.block, id);
    const properties = row?.properties;
    const when = properties?.[dateKey]?.flatMap(([, annotations]) => annotations ?? [])
      .find(([type]) => type === "d")?.[1];
    if (!when?.start_date) throw new Error("Missing Notion lesson date");
    if (when.start_date !== date || startTime(when.start_time) !== time) continue;
    const coach = notionText(properties[coachKey]);
    const topic = notionText(properties.title);
    if (!coach || !topic) throw new Error("Incomplete Notion lesson");
    const icon = row.format?.page_icon;
    const emoji = typeof icon === "string" && /^\p{Extended_Pictographic}/u.test(icon) ? icon : "";
    matches.push([id, { coach, topic: emoji && !topic.startsWith(emoji) ? emoji + " " + topic : topic }]);
  }
  return matches;
}

function notionText(segments) {
  return clean(segments?.map(([text]) => text).join(""));
}

async function readCalendar(url, request) {
  const allowed = await api.permissions.contains({ origins: [url.origin + "/*"] });
  return allowed ? readPublicCalendar(url, request) : { state: "access" };
}
