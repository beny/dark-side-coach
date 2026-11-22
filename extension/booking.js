"use strict";

(() => {
  const fieldLabels = {
    "datum": "date", "cas": "time", "pobocka": "branch", "pocet uchazecu": "attendees",
    "rozpis temat": "schedule", "rozpis tema": "schedule"
  };
  function isScheduleLink(anchor) {
    if (!anchor?.matches("a[href]")) return false;
    if (location.origin === fixtureOrigin || location.protocol === "file:") {
      const fixture = new URL("./calendar.html", location.href);
      const target = new URL(anchor.href);
      return target.protocol === fixture.protocol && target.host === fixture.host && target.pathname === fixture.pathname;
    }
    return anchor.href.startsWith(notionOrigin + "/");
  }
  let opened;
  let scheduled = false;

  function fieldValue(label, panel) {
    for (let element = label; element && element !== panel; element = element.parentElement) {
      const sibling = element.nextElementSibling;
      if (sibling && visible(sibling)) return sibling;
    }
    return null;
  }

  function findLesson() {
    const labels = textElements(document.body)
      .filter(element => fieldLabels[normalized(element.textContent)] && visible(element));
    for (const heading of labels.filter(element => fieldLabels[normalized(element.textContent)] === "schedule")) {
      for (let panel = heading.parentElement; panel && panel !== document.body; panel = panel.parentElement) {
        const fields = Object.fromEntries(labels.filter(label => panel.contains(label))
          .map(label => [fieldLabels[normalized(label.textContent)], label]));
        if (!fields.date || !fields.time || !fields.branch) continue;
        const schedule = fieldValue(heading, panel);
        const link = [schedule, ...Array.from(schedule?.querySelectorAll("a[href]") ?? [])].find(anchor => {
          return isScheduleLink(anchor) && visible(anchor);
        });
        if (!link) continue;
        const values = Object.fromEntries(["date", "time", "branch", "attendees"]
          .map(key => [key, fields[key] ? fieldValue(fields[key], panel) : null]));
        const date = bookingDate(values.date?.textContent);
        const time = startTime(values.time?.textContent);
        const branch = branchName(values.branch?.textContent);
        if (date && time && branch) return { heading, link, date, time, branch, fields, values };
      }
    }
    return null;
  }

  function styledElement(source, text = "") {
    const element = document.createElement(source.localName);
    for (const attribute of ["class", "style"]) {
      if (source.hasAttribute(attribute)) element.setAttribute(attribute, source.getAttribute(attribute));
    }
    element.textContent = text;
    return element;
  }

  function fieldGroup(label, value) {
    let group = label.parentElement;
    while (group && !group.contains(value)) group = group.parentElement;
    return group;
  }

  function childUnder(element, parent) {
    while (element.parentElement !== parent) element = element.parentElement;
    return element;
  }

  function addFields({ heading, link, fields, values }) {
    const groups = Object.fromEntries(Object.keys(values).filter(key => values[key])
      .map(key => [key, fieldGroup(fields[key], values[key])]));
    const { date, time, branch, attendees } = groups;
    const row = fieldGroup(date, time);
    const dateSlot = childUnder(date, row);
    const timeSlot = childUnder(time, row);
    const schedule = fieldGroup(heading, link);
    const outputs = [];
    const elements = [];

    function copyField(key, label, slot) {
      const container = styledElement(slot);
      const value = styledElement(values[key], "Načítám…");
      value.setAttribute("aria-live", "polite");
      elements.push(value);
      const copies = new Map([[slot, container]]);
      function copyParent(source) {
        if (copies.has(source)) return copies.get(source);
        const copy = styledElement(source);
        copyParent(source.parentElement).append(copy);
        copies.set(source, copy);
        return copy;
      }
      copyParent(fields[key].parentElement).append(styledElement(fields[key], label));
      copyParent(values[key].parentElement).append(value);
      return container;
    }

    function track(element) {
      element.dataset.darkSideCoach = "";
      outputs.push(element);
      return element;
    }

    if (attendees && dateSlot.contains(attendees) && timeSlot.contains(branch)) {
      attendees.after(track(copyField("date", "Coach", date)));
      branch.after(track(copyField("time", "Téma", time)));
    } else if (row.contains(branch) && /grid|flex/.test(getComputedStyle(row).display)) {
      const output = track(document.createElement("div"));
      output.style.display = "contents";
      output.append(copyField("date", "Coach", dateSlot), copyField("time", "Téma", timeSlot));
      childUnder(branch, row).after(output);
    } else if (!row.contains(branch) && row.parentElement.contains(branch)) {
      const output = track(styledElement(row));
      output.append(copyField("date", "Coach", dateSlot), copyField("time", "Téma", timeSlot));
      childUnder(branch, row.parentElement).after(output);
    } else {
      const parent = row.contains(schedule) ? row : fieldGroup(row, schedule);
      const output = track(document.createElement("div"));
      const offset = time.getBoundingClientRect().left - parent.getBoundingClientRect().left;
      const ratio = offset / parent.getBoundingClientRect().width;
      output.style.cssText = "display:grid;grid-column:1/-1;min-width:0";
      output.style.gridTemplateColumns = `${(ratio > 0 && ratio < 1 ? ratio : .5) * 100}% minmax(0, 1fr)`;
      output.append(copyField("date", "Coach", date), copyField("time", "Téma", time));
      childUnder(schedule, parent).before(output);
    }
    return { outputs, elements };
  }

  function showCoach(field, name) {
    field.textContent = name;
    const asset = coachPortraits.get(normalized(name));
    if (!asset) return;

    const portrait = document.createElement("img");
    portrait.alt = "";
    portrait.width = 112;
    portrait.height = 112;
    portrait.decoding = "async";
    portrait.referrerPolicy = "no-referrer";
    portrait.style.cssText = "display:none;inline-size:112px;max-inline-size:100%;block-size:auto;aspect-ratio:1;border-radius:50%;object-fit:cover;object-position:50% 35%;margin-block-start:.5em";
    field.append(portrait);
    portrait.addEventListener("load", () => { portrait.style.display = "block"; }, { once: true });
    portrait.addEventListener("error", () => portrait.remove(), { once: true });
    portrait.src = portraitBase + asset;
  }

  function showResult([coach, topic], result, retry) {
    if (result.state === "found") {
      showCoach(coach, result.coach);
      topic.textContent = result.topic;
      return;
    }
    coach.textContent = "—";
    topic.textContent = {
      missing: "Termín jsem v rozpisu nenašel.",
      ambiguous: "V rozpisu je více lekcí ve stejný čas.",
      access: "Povol přístup k Notion a znovu otevři detail."
    }[result.state] ?? {
      tab: "Rozšíření se s kartou Notion nespojilo.",
      calendar: "Na stránce Notion se nenačetl kalendář.",
      branch: "V Notion se nenašel kalendář pro tuto pobočku.",
      date: "Ve zobrazeném kalendáři se nenašlo datum lekce.",
      cards: "Z karet v kalendáři se nepodařilo přečíst lekci."
    }[result.reason] ?? "Rozpis se nepodařilo načíst.";

    if (result.state === "retry-visible") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Načíst v Notion";
      button.style.cssText = "display:block;margin-block-start:.25em;font:inherit;text-decoration:underline;cursor:pointer";
      button.addEventListener("click", retry, { once: true });
      topic.append(button);
    }
  }

  async function update() {
    const lesson = findLesson();
    if (!lesson) {
      opened?.outputs.forEach(output => output.remove());
      opened = undefined;
      return;
    }

    const { heading, link, date, time, branch } = lesson;
    const key = JSON.stringify([link.href, date, time, branch]);
    if (opened?.key === key && opened.heading === heading && opened.outputs.every(output => output.isConnected)) return;

    opened?.outputs.forEach(output => output.remove());
    const { outputs, elements } = addFields(lesson);
    opened = { heading, key, outputs };
    async function load(foreground = false) {
      elements.forEach(element => { element.textContent = "Načítám…"; });
      let result;
      try {
        result = await api.runtime.sendMessage({
          type: "dark-side-lesson", url: link.href, date, time, branch, foreground
        });
      } catch {
        result = { state: foreground ? "unavailable" : "retry-visible", reason: "tab" };
      }
      if (opened?.outputs === outputs && outputs.every(output => output.isConnected)) {
        showResult(elements, result ?? {}, () => load(true));
      }
    }
    await load();
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      update();
    });
  }

  new MutationObserver(scheduleUpdate).observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["class", "style", "hidden", "open", "href", "aria-hidden"]
  });
  scheduleUpdate();
})();
