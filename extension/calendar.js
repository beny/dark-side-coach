"use strict";

(() => {
  const calendarTitle = /\b(?:kalendar|calendar)\b/;
  const monthTitle = /^([a-z]+)\.?(?:\s*[-–—/]\s*([a-z]+)\.?)? (\d{4})$/;
  const monthShort = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const dayMarker = /^(?:[1-9]|[12]\d|3[01])$/;
  const dayLength = 86_400_000;
  const weekdays = ["sun sunday ne nedele", "mon monday po pondeli", "tue tues tuesday ut utery",
    "wed wednesday st streda", "thu thur thurs thursday ct ctvrtek", "fri friday pa patek", "sat saturday so sobota"];
  const notionCard = ".notion-collection-item";
  const notionDay = ".notion-calendar-view-day";
  const cardSelector = ".notion-calendar-item, [data-calendar-card], a[href]";
  const titleSelector = ".notion-page-title, .notion-property-title, [data-calendar-topic]";
  const coachSelector = ".notion-property-person, [data-calendar-coach]";
  const clockPattern = /^([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)(?:\s*([ap])\.?m\.?)?$/i;

  function calendarTime(text) {
    const match = clean(text).match(clockPattern);
    if (!match) return "";
    let hour = +match[1];
    if (match[3]) hour = hour % 12 + (match[3].toLowerCase() === "p" ? 12 : 0);
    return String(hour).padStart(2, "0") + ":" + match[2];
  }

  function ownText(element) {
    return clean([...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent).join(""));
  }
  let navigation;
  let lastStable;

  function calendarMonth(element) {
    const match = normalized(element.textContent).match(monthTitle);
    if (!match) return "";
    const name = match[2] || match[1];
    const month = monthNumber(name) || monthShort.indexOf(name === "sept" ? "sep" : name) + 1;
    return month ? `${match[3]}-${String(month).padStart(2, "0")}` : "";
  }

  function calendarFor(header, elements) {
    const view = header.closest(".notion-calendar-view, [data-calendar-view]");
    for (let root = view ?? header.parentElement; root; root = root.parentElement) {
      const entries = elements.filter(element => root.contains(element));
      const markers = root.querySelectorAll(notionDay);
      if (markers.length < 7 && entries.filter(element => dayMarker.test(clean(element.textContent))).length < 7 &&
          !root.querySelector("[data-date], time[datetime]")) continue;

      const nearby = elements.filter(element =>
        (element.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        calendarTitle.test(normalized(element.textContent)) &&
        branchName(element.textContent) &&
        clean(element.textContent).length < 65);
      const days = (markers.length ? [...markers] : entries.filter(element => dayMarker.test(clean(element.textContent))))
        .filter(element => dayNumber(element) && visible(element) && !element.closest(cardSelector));
      return { root, entries, days, branch: branchName(nearby.at(-1)?.textContent) };
    }
    return null;
  }

  function dayNumber(element) {
    const number = clean(element.textContent).match(/\b(?:[1-9]|[12]\d|3[01])\b/);
    return number ? +number[0] : 0;
  }

  function calendarDates(calendar, month) {
    const dates = new Map();
    if (calendar.days.length < 7) return dates;
    const startOfMonth = new Date(month + "-01T00:00:00Z");
    const end = new Date(startOfMonth);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const weekdayLabel = normalized(calendar.root.querySelector(".notion-calendar-header-days")?.firstElementChild?.textContent)
      .replace(/\.$/, "");
    const firstWeekday = weekdays.findIndex(labels => labels.split(" ").includes(weekdayLabel));
    const numbers = calendar.days.map(dayNumber);
    const possible = [];
    for (let start = +startOfMonth - 6 * dayLength; start < +end; start += dayLength) {
      if (firstWeekday >= 0 && new Date(start).getUTCDay() !== firstWeekday) continue;
      if (numbers.every((number, column) => new Date(start + column * dayLength).getUTCDate() === number)) {
        possible.push(start);
      }
    }
    if (possible.length === 1) {
      calendar.days.forEach((day, column) => dates.set(day,
        new Date(possible[0] + column * dayLength).toISOString().slice(0, 10)));
    }
    return dates;
  }

  function cardFields(card, clock) {
    const anchor = clock.closest("a[href]");
    const notionTitle = card.matches(notionCard) && anchor?.querySelector(":scope > div > .notranslate");
    const title = notionTitle || card.querySelector(titleSelector);
    const person = (notionTitle && notionTitle.parentElement.nextElementSibling) || card.querySelector(coachSelector);
    const content = textElements(card)
      .filter(element => visible(element) && !clock.contains(element))
      .map(element => ({ element, text: ownText(element) }));
    const lines = content.filter(({ text }) => /\p{L}/u.test(text) && !calendarTime(text));
    const topic = clean(title?.textContent) || clean(lines[0]?.element.textContent);
    const coach = clean(person?.textContent) ||
      lines.filter(({ element }) => !title?.contains(element)).at(-1)?.text;
    if ((!title && lines.length < 2) || !topic || !coach || topic === coach) return null;
    return {
      topic,
      coach: coach.replace(/^(?:Coach|Trenér)\s*:?\s+/i, "")
    };
  }

  function cardFor(clock, calendar) {
    const known = clock.closest(notionCard) ?? clock.closest(cardSelector);
    if (known && calendar.root.contains(known)) {
      const fields = cardFields(known, clock);
      if (fields) return { card: known, ...fields };
    }
    for (let card = clock.parentElement; card !== calendar.root; card = card.parentElement) {
      if (textElements(card).filter(element => calendarTime(ownText(element))).length !== 1 ||
          calendar.days.some(day => card.contains(day))) break;
      const fields = cardFields(card, clock);
      if (fields) return { card, ...fields };
    }
    return null;
  }

  function notionColumnDay(card, calendar) {
    if (!card.matches(notionCard)) return null;
    const inset = card.style.getPropertyValue("inset-inline-start");
    const match = inset.match(/^(?:calc\()?([\d.]+)%\)?$/);
    if (!match) return null;

    for (let row = card.parentElement; row && row !== calendar.root; row = row.parentElement) {
      const days = [...row.children].map(child => child.querySelector(":scope > " + notionDay)).filter(Boolean);
      if (days.length === 7) {
        const column = Math.round(+match[1] * days.length / 100);
        return days[column] ?? null;
      }
    }
    return null;
  }

  function dateFor(card, calendar, dates, month) {
    function dateAt(day) {
      return dates.get(day) ?? (day.matches(notionDay) ? "" : month + "-" + String(dayNumber(day)).padStart(2, "0"));
    }

    const columnDay = notionColumnDay(card, calendar);
    if (columnDay) return dateAt(columnDay);

    for (let cell = card.parentElement; cell && cell !== calendar.root; cell = cell.parentElement) {
      if (cell.matches('[data-outside-month="true"], [data-outside-month="1"]')) return "";
      const explicit = cell.getAttribute("data-date") ?? cell.querySelector(":scope > time[datetime], :scope > header time[datetime]")?.dateTime;
      if (explicit && /^\d{4}-\d{2}-\d{2}/.test(explicit)) return explicit.slice(0, 10);
      const days = calendar.days.filter(element => cell.contains(element) && !card.contains(element));
      if (days.length > 1) break;
      if (days.length === 1) return dateAt(days[0]);
    }

    // Some calendar views put day numbers and cards in separate layers.
    const bounds = card.getBoundingClientRect();
    const day = calendar.days.map(element => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.top <= bounds.top && rect.right > bounds.left && rect.left < bounds.right)
      .sort((a, b) => b.rect.top - a.rect.top)[0];
    return day ? dateAt(day.element) : "";
  }

  function navigate(calendar, forward, signature, lookup) {
    if (navigation?.lookup !== lookup) navigation = { lookup, visited: new Set() };
    if (navigation.visited.has(signature)) return;
    const direction = forward ? /next|dalsi|nasledujici/ : /previous|prev|predchozi/;
    const control = [...calendar.root.querySelectorAll('button, [role="button"]')].find(element =>
      direction.test(normalized([
        element.getAttribute("aria-label"), element.title, element.getAttribute("data-testid"), element.textContent
      ].join(" "))) && visible(element));
    if (control) {
      navigation.visited.add(signature);
      control.click();
    }
  }

  function read({ date, time, branch, preview }) {
    if (/\b(login|sign in)\b/i.test(document.title) ||
        document.querySelector('input[type="password"], input[autocomplete="one-time-code"]')) return { state: "access" };

    if (!document.body) return { state: "loading", reason: "calendar" };
    const elements = textElements(document.body);
    const targetMonth = date.slice(0, 7);
    const targetDay = +date.slice(-2);
    let reason = "calendar";
    let progress;
    const matches = new Map();
    let settledCalendar = false;
    const calendarSignature = [];
    let seenDate = false;
    let unreadable = false;
    for (const header of elements) {
      const month = calendarMonth(header);
      if (!month || !visible(header)) continue;
      const calendar = calendarFor(header, elements);
      if (!calendar) continue;
      if (calendar.branch !== branch) {
        if (reason === "calendar") reason = "branch";
        continue;
      }
      reason = "date";
      const dates = calendarDates(calendar, month);
      const ordered = [...dates.values()];
      const first = ordered[0];
      const last = ordered.at(-1);
      progress = first && last ? first + "/" + last : month;
      if (first && last && (date < first || date > last)) {
        if (!preview) navigate(calendar, date > last, progress, branch + date);
        continue;
      }
      if (!first && month !== targetMonth) {
        if (!preview) navigate(calendar, month < targetMonth, progress, branch + date);
        continue;
      }

      const times = calendar.entries.filter(element => calendarTime(element.textContent) && visible(element) &&
        ![...element.children].some(child => calendarTime(child.textContent)));
      settledCalendar = true;
      seenDate ||= ordered.includes(date) || (!first && !calendar.root.querySelector(notionDay) &&
        month === targetMonth && calendar.days.some(day => dayNumber(day) === targetDay));
      calendarSignature.push(times.map(element => calendarTime(element.textContent)).join(","));
      for (const element of times) {
        if (calendarTime(element.textContent) !== time) continue;
        const entry = cardFor(element, calendar);
        const entryDate = entry && dateFor(entry.card, calendar, dates, month);
        if (entryDate === date) seenDate = true;
        if (!entryDate) unreadable = true;
        if (entryDate === date) {
          matches.set(entry.card, { coach: entry.coach, topic: entry.topic });
        }
      }
    }

    if (settledCalendar) {
      if (preview && matches.size) {
        if (matches.size === 1) return { state: "found", ...matches.values().next().value };
        return { state: "ambiguous" };
      }
      const key = JSON.stringify([date, time, branch, calendarSignature, [...matches.values()]]);
      if (lastStable?.key !== key) lastStable = { key, since: Date.now() };
      if (matches.size && Date.now() - lastStable.since >= 550) {
        if (matches.size === 1) return { state: "found", ...matches.values().next().value };
        return { state: "ambiguous" };
      }
      if (seenDate && !unreadable && Date.now() - lastStable.since >= 2600) return { state: "missing" };
    } else {
      lastStable = undefined;
    }
    if (settledCalendar && seenDate) reason = unreadable ? "cards" : "calendar";
    return { state: "loading", reason, progress };
  }

  api.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== "dark-side-calendar") return false;
    respond(read(message));
    return false;
  });
})();
