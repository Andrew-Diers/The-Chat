(() => {
  const API_BASE = "https://ckcbackend.andrewpdiers-bef.workers.dev";
  const daysContainer = document.getElementById("schedule-days");
  const status = document.getElementById("schedule-status");
  const saveButton = document.getElementById("schedule-save");
  const clearButton = document.getElementById("schedule-clear");
  const messageInput = document.getElementById("chat-input");
  const sendButton = document.querySelector('#chat-ui > button[onclick="sendMessage()"]');
  const dayNames = [
    ["monday", "Monday"],
    ["tuesday", "Tuesday"],
    ["wednesday", "Wednesday"],
    ["thursday", "Thursday"],
    ["friday", "Friday"],
    ["saturday", "Saturday"],
    ["sunday", "Sunday"]
  ];

  if (!daysContainer || !status || !saveButton || !clearButton) return;

  let schedule = {
    enabled: false,
    days: {},
    timeZone: ""
  };
  let scheduleLoaded = false;
  let scheduleWasActive = false;
  let currentUserCanEdit = false;

  function buildApplyToAllControl() {
    const existing = document.getElementById("schedule-apply-to-all");
    if (existing) return existing;

    const controls = document.createElement("div");
    controls.id = "schedule-apply-to-all";
    controls.className = "schedule-apply-to-all";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Apply Monday to all days";
    button.addEventListener("click", () => {
      if (!currentUserCanEdit) return;

      const monday = daysContainer.querySelector('[data-day="monday"]');
      if (!monday) return;

      const mondayEnabled = monday.querySelector(".schedule-day-enabled").checked;
      const mondayStart = monday.querySelector(".schedule-day-start").value;
      const mondayEnd = monday.querySelector(".schedule-day-end").value;

      daysContainer.querySelectorAll(".schedule-day").forEach(row => {
        row.querySelector(".schedule-day-enabled").checked = mondayEnabled;
        row.querySelector(".schedule-day-start").value = mondayStart;
        row.querySelector(".schedule-day-end").value = mondayEnd;
        syncDayControls(row);
      });
    });

    controls.appendChild(button);
    return controls;
  }

  function buildDayControls() {
    daysContainer.replaceChildren();
    const applyToAllControl = buildApplyToAllControl();

    dayNames.forEach(([key, label]) => {
      const row = document.createElement("div");
      row.className = "schedule-day";
      row.dataset.day = key;

      const dayLabel = document.createElement("label");
      dayLabel.className = "schedule-day-name";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "schedule-day-enabled";
      checkbox.setAttribute("aria-label", `Set quiet hours for ${label}`);

      const dayText = document.createElement("span");
      dayText.textContent = label;
      dayLabel.append(checkbox, dayText);

      const startLabel = document.createElement("label");
      startLabel.className = "schedule-time-label";
      startLabel.textContent = "Inactive from";
      const startInput = document.createElement("input");
      startInput.type = "time";
      startInput.className = "schedule-day-start";
      startInput.setAttribute("aria-label", `${label}: inactive from`);
      startLabel.appendChild(startInput);

      const endLabel = document.createElement("label");
      endLabel.className = "schedule-time-label";
      endLabel.textContent = "Inactive until";
      const endInput = document.createElement("input");
      endInput.type = "time";
      endInput.className = "schedule-day-end";
      endInput.setAttribute("aria-label", `${label}: inactive until`);
      endLabel.appendChild(endInput);

      row.append(dayLabel, startLabel, endLabel);
      daysContainer.appendChild(row);

      if (key === "monday") {
        row.after(applyToAllControl);
      }

      checkbox.addEventListener("change", () => syncDayControls(row));
    });
  }

  function syncDayControls(row) {
    const enabled = row.querySelector(".schedule-day-enabled").checked;
    row.querySelectorAll('input[type="time"]').forEach(input => {
      input.disabled = !enabled || !currentUserCanEdit;
    });
  }

  function timeInMinutes(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function currentDayAndMinutes(timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone || undefined,
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).formatToParts(new Date());
      const weekday = parts.find(part => part.type === "weekday").value.toLowerCase();
      const hours = Number(parts.find(part => part.type === "hour").value);
      const minutes = Number(parts.find(part => part.type === "minute").value);
      return {
        day: weekday,
        minutes: hours * 60 + minutes
      };
    } catch (error) {
      return null;
    }
  }

  function isDayScheduleActive(day, minutes) {
    if (!day || day.enabled !== true) return false;
    const start = timeInMinutes(day.start);
    const end = timeInMinutes(day.end);
    if (start === null || end === null || start === end) return false;
        return start < end
      ? minutes >= start && minutes < end
      : minutes >= start;
  }

  function getActiveSchedulePeriod() {
    if (!scheduleLoaded || schedule.enabled !== true) return null;
    const now = currentDayAndMinutes(schedule.timeZone);
    if (!now) return null;

    const dayIndex = dayNames.findIndex(([key]) => key === now.day);
    if (dayIndex < 0) return null;
    const days = normalizedDays(schedule);
    const today = days[now.day];
    if (isDayScheduleActive(today, now.minutes)) {
      return { day: now.day, period: today };
    }

    // A quiet-hours range can run past midnight into the following day.
    const previousDay = dayNames[(dayIndex + dayNames.length - 1) % dayNames.length][0];
    const previous = days[previousDay];
    if (!previous || previous.enabled !== true) return null;
    const previousStart = timeInMinutes(previous.start);
    const previousEnd = timeInMinutes(previous.end);
    if (previousStart !== null && previousEnd !== null
      && previousStart > previousEnd && now.minutes < previousEnd) {
      return { day: previousDay, period: previous };
    }
    return null;
  }

  function isScheduleActive() {
    return Boolean(getActiveSchedulePeriod());
  }

  function normalizedDays(savedSchedule) {
    if (savedSchedule && savedSchedule.days && typeof savedSchedule.days === "object") {
      return savedSchedule.days;
    }

    // Convert an older single daily window into a window for every day.
    if (savedSchedule?.enabled && savedSchedule.start && savedSchedule.end) {
      return Object.fromEntries(dayNames.map(([key]) => [key, {
        enabled: true,
        start: savedSchedule.start,
        end: savedSchedule.end
      }]));
    }

    return {};
  }

  function renderSchedule(syncInputs = false) {
    const active = isScheduleActive();
    currentUserCanEdit = typeof isAdmin !== "undefined" && isAdmin;

    if (syncInputs) {
      const days = normalizedDays(schedule);
      dayNames.forEach(([key]) => {
        const row = daysContainer.querySelector(`[data-day="${key}"]`);
        if (!row) return;
        const day = days[key] || {};
        row.querySelector(".schedule-day-enabled").checked = day.enabled === true;
        row.querySelector(".schedule-day-start").value = day.start || "";
        row.querySelector(".schedule-day-end").value = day.end || "";
      });
    }

    document.querySelectorAll("#schedule-apply-to-all button").forEach(button => {
      button.disabled = !currentUserCanEdit;
    });

    daysContainer.querySelectorAll(".schedule-day").forEach(row => {
      const checkbox = row.querySelector(".schedule-day-enabled");
      checkbox.disabled = !currentUserCanEdit;
      syncDayControls(row);
    });
    saveButton.disabled = !currentUserCanEdit;
    clearButton.disabled = !currentUserCanEdit;

    if (!scheduleLoaded) {
      status.textContent = "Loading the server schedule…";
    } else {
      const activeDays = dayNames
        .filter(([key]) => normalizedDays(schedule)[key]?.enabled === true)
        .map(([, label]) => label);
      if (!activeDays.length) {
        status.textContent = "No quiet hours are scheduled. Chat is available every day.";
      } else {
        const descriptions = dayNames.flatMap(([key, label]) => {
          const day = normalizedDays(schedule)[key];
          return day?.enabled ? [`${label} ${day.start}–${day.end}`] : [];
        });
        const timeZone = schedule.timeZone ? ` (${schedule.timeZone})` : "";
        status.textContent = `${active ? "Chat is inactive now. " : "Chat is currently available. "}${descriptions.join(" · ")}${timeZone}`;
      }
    }

    if (messageInput) messageInput.disabled = active;
    if (sendButton) sendButton.disabled = active;

    const chatStatus = document.getElementById("chat-status-msg");
    if (chatStatus && active) {
      const activePeriod = getActiveSchedulePeriod();
      const dayName = dayNames.find(([key]) => key === activePeriod?.day)?.[1] || "today";
      const period = activePeriod?.period;
      chatStatus.textContent = `Chat is inactive on ${dayName} from ${period?.start} to ${period?.end}${schedule.timeZone ? ` (${schedule.timeZone})` : ""}.`;
    } else if (
      chatStatus && !active && scheduleWasActive &&
      chatStatus.textContent.startsWith("Chat is inactive on ")
    ) {
      chatStatus.textContent = typeof chatLocked !== "undefined" && chatLocked ?
        "Chat is locked by admin." :
        typeof userBlinded !== "undefined" && userBlinded ?
        "You are blinded by admin and cannot see chat." :
        "";
    }

    scheduleWasActive = active;
  }

  function readScheduleFromControls() {
    const days = {};
    daysContainer.querySelectorAll(".schedule-day").forEach(row => {
      const enabled = row.querySelector(".schedule-day-enabled").checked;
      if (!enabled) return;
      days[row.dataset.day] = {
        enabled: true,
        start: row.querySelector(".schedule-day-start").value,
        end: row.querySelector(".schedule-day-end").value
      };
    });
    return days;
  }

  async function loadSchedule() {
    try {
      const response = await fetch(`${API_BASE}/chat-schedule`, {
        cache: "no-store"
      });
      const result = await response.json();
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "Could not load the server schedule.");
      }
      schedule = result.schedule || {
        enabled: false,
        days: {},
        timeZone: ""
      };
      schedule.days = normalizedDays(schedule);
      scheduleLoaded = true;
      renderSchedule(true);
    } catch (error) {
      scheduleLoaded = false;
      schedule = {
        enabled: false,
        days: {},
        timeZone: ""
      };
      renderSchedule(true);
      status.textContent = "Could not load the server schedule. Message sending is still checked by the server.";
    }
  }

  async function saveSchedule(nextSchedule) {
    if (!currentUserCanEdit) return;

    const passwordInput = document.getElementById("admin-password");
    const adminPassword = passwordInput ? passwordInput.value : "";
    if (!adminPassword) {
      window.showAppToast?.("Please sign in as admin again before changing the schedule.", "error");
      return;
    }

    saveButton.disabled = true;
    clearButton.disabled = true;
    status.textContent = "Saving weekly schedule on the server…";

    try {
      const response = await fetch(`${API_BASE}/admin-chat-schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword
        },
        body: JSON.stringify(nextSchedule)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Could not save the server schedule.");
      }
      schedule = result.schedule;
      schedule.days = normalizedDays(schedule);
      scheduleLoaded = true;
      renderSchedule(true);
      window.showAppToast?.("The weekly chat schedule was saved on the server.", "success");
    } catch (error) {
      status.textContent = error.message || "Could not save the server schedule.";
      window.showAppToast?.(status.textContent, "error");
    } finally {
      renderSchedule();
    }
  }

  saveButton.addEventListener("click", () => {
    const days = readScheduleFromControls();
    for (const [key, day] of Object.entries(days)) {
      if (!day.start || !day.end || day.start === day.end) {
        const label = dayNames.find(([name]) => name === key)?.[1] || key;
        window.showAppToast?.(`Choose different start and end times for ${label}.`, "error");
        return;
      }
    }

    saveSchedule({
      enabled: Object.keys(days).length > 0,
      days,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    });
  });

  clearButton.addEventListener("click", () => {
    saveSchedule({
      enabled: false,
      days: {},
      timeZone: ""
    });
  });

  if (typeof window.sendMessage === "function") {
    const originalSendMessage = window.sendMessage;
    window.sendMessage = function(...args) {
      if (isScheduleActive()) {
        window.showAppToast?.("Chat is inactive during its scheduled quiet hours.");
        return;
      }
      return originalSendMessage.apply(this, args);
    };
  }

  window.refreshChatScheduleControls = () => renderSchedule();

  buildDayControls();
  renderSchedule();
  loadSchedule();
  window.setInterval(loadSchedule, 30_000);
  window.setInterval(renderSchedule, 15_000);
})();
