(() => {
  const MAX_ENTRIES = 150;
  const entries = [];
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);

  function formatValue(value) {
    if (value instanceof Error) {
      return value.stack || `${value.name}: ${value.message}`;
    }

    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  function record(level, message, source = "") {
    entries.push({
      level,
      message: String(message || "Unknown issue"),
      source,
      time: new Date()
    });

    if (entries.length > MAX_ENTRIES) {
      entries.splice(0, entries.length - MAX_ENTRIES);
    }

    renderEntries();
  }

  window.addEventListener("chat-diagnostic", event => {
    const detail = event.detail || {};
    record(detail.level || "error", detail.message || "Chat issue", detail.source || "Chat service");
  });

  function renderEntries() {
    const list = document.getElementById("diagnostics-entries");
    const status = document.getElementById("diagnostics-status");
    if (!list || !status) return;

    list.replaceChildren();
    status.textContent = entries.length ?
      `${entries.length} recent console entr${entries.length === 1 ? "y" : "ies"} captured.` :
      "No chat diagnostics captured.";

    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "diagnostics-empty";
      empty.textContent = "No chat diagnostics captured yet.";
      list.appendChild(empty);
      return;
    }

    entries.slice().reverse().forEach(entry => {
      const card = document.createElement("article");
      card.className = "diagnostics-entry";
      card.dataset.level = entry.level;

      const meta = document.createElement("div");
      meta.className = "diagnostics-entry-meta";

      const label = document.createElement("strong");
      label.textContent = entry.level.toUpperCase();

      const time = document.createElement("time");
      time.dateTime = entry.time.toISOString();
      time.textContent = entry.time.toLocaleTimeString();
      meta.append(label, time);

      const message = document.createElement("p");
      message.className = "diagnostics-entry-message";
      message.textContent = entry.source ?
        `${entry.message}\n${entry.source}` :
        entry.message;

      card.append(meta, message);
      list.appendChild(card);
    });
  }

  console.warn = (...values) => {
    originalWarn(...values);
    record("warning", values.map(formatValue).join(" "));
  };

  console.error = (...values) => {
    originalError(...values);
    record("error", values.map(formatValue).join(" "));
  };

  window.addEventListener("error", event => {
    const source = event.filename ?
      `${event.filename}:${event.lineno || 0}:${event.colno || 0}` :
      "";
    record("error", event.message || formatValue(event.error), source);
  });

  window.addEventListener("unhandledrejection", event => {
    record("error", `Unhandled promise rejection: ${formatValue(event.reason)}`);
  });

  window.openDiagnosticsConsole = () => {
    if (typeof isAdmin === "undefined" || !isAdmin) {
      window.showAppToast("Admin sign-in is required to view diagnostics.");
      return;
    }
    const modal = document.getElementById("diagnostics-modal");
    if (modal) modal.hidden = false;
    renderEntries();
  };

  window.closeDiagnosticsConsole = () => {
    const modal = document.getElementById("diagnostics-modal");
    if (modal) modal.hidden = true;
  };

  window.clearDiagnosticsConsole = () => {
    entries.length = 0;
    renderEntries();
  };

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") window.closeDiagnosticsConsole();
  });

  const modal = document.getElementById("diagnostics-modal");
  if (modal) {
    modal.addEventListener("click", event => {
      if (event.target === modal) window.closeDiagnosticsConsole();
    });
  }

  renderEntries();
})();
