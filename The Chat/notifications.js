(() => {
  const READ_STORAGE_KEY = "chatNowReadNotifications";
  const REFRESH_INTERVAL = 60_000;
  let notificationChannel = null;
  let refreshTimer = null;

  const apiBase = () => {
    if (typeof API_BASE !== "undefined") return API_BASE;
    return "";
  };

  const getAdminPassword = () => {
    const input = document.getElementById("admin-password");
    return input ? input.value : "";
  };

  const getReadNotificationIds = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || "[]");
      return new Set(Array.isArray(saved) ? saved.map(String) : []);
    } catch (error) {
      return new Set();
    }
  };

  const saveReadNotificationIds = ids => {
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]));
    } catch (error) {
      // The current page can still update even when browser storage is unavailable.
    }
  };

  const getNotifications = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("chatNowNotifications") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  };

  const saveNotifications = notifications => {
    try {
      localStorage.setItem("chatNowNotifications", JSON.stringify(notifications));
    } catch (error) {
      // The notices remain available in memory only until the page is closed.
    }
  };

  const updateNotificationShortcut = () => {
    const button = document.getElementById("notification-shortcut");
    const badge = document.getElementById("notification-count");
    if (!button || !badge) return;

    const signedIn = typeof currentUser !== "undefined" && Boolean(currentUser);
    const notices = getNotifications();
    const readIds = getReadNotificationIds();
    const unreadCount = notices.filter(notice => !readIds.has(String(notice.id))).length;

    button.hidden = !signedIn || unreadCount === 0;
    badge.hidden = unreadCount === 0;
    badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    button.setAttribute(
      "aria-label",
      unreadCount ? `Open notifications, ${unreadCount} unread` : "Open notifications"
    );
  };

  window.updateNotificationShortcut = updateNotificationShortcut;

  const markNotificationsRead = () => {
    const readIds = getReadNotificationIds();
    getNotifications().forEach(notice => readIds.add(String(notice.id)));
    saveReadNotificationIds(readIds);
    updateNotificationShortcut();
  };

  const removeNotification = id => {
    const remaining = getNotifications().filter(notice => String(notice.id) !== String(id));
    saveNotifications(remaining);
    renderNotifications();
    renderAdminNotificationList();
    updateNotificationShortcut();
  };

  const addNotification = notification => {
    if (!notification || notification.id === undefined || notification.id === null) return;
    const notices = getNotifications();
    if (notices.some(item => String(item.id) === String(notification.id))) return;
    notices.unshift(notification);
    notices.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    saveNotifications(notices);
    renderNotifications();
    renderAdminNotificationList();
    updateNotificationShortcut();
  };

  const mergeNotifications = incoming => {
    if (!Array.isArray(incoming)) return;
    const notices = incoming
      .filter(notice => notice && notice.id !== undefined && notice.id !== null)
      .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
    saveNotifications(notices);
    renderNotifications();
    renderAdminNotificationList();
    updateNotificationShortcut();
  };

  async function loadNotifications() {
    try {
      const response = await fetch(`${apiBase()}/notifications`, {
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Notifications request failed (${response.status}).`);
      const result = await response.json();
      mergeNotifications(Array.isArray(result) ? result : result.notifications);
    } catch (error) {
      console.warn("Could not load saved notifications.", error);
    }
  }

  function makeNotificationCard(notification, includeDelete = false) {
    const card = document.createElement("article");
    card.className = "notification-card";

    const title = document.createElement("h3");
    title.textContent = notification.title || "Announcement";

    const message = document.createElement("p");
    message.textContent = notification.message || "";

    const time = document.createElement("time");
    const date = new Date(notification.createdAt || notification.created_at);
    time.textContent = Number.isNaN(date.getTime()) ? "Just now" : date.toLocaleString();
    if (!Number.isNaN(date.getTime())) time.dateTime = date.toISOString();

    card.append(title, message, time);

    if (includeDelete) {
      const remove = document.createElement("button");
      remove.className = "notification-delete";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Delete notification: ${notification.title || "Announcement"}`);
      remove.addEventListener("click", () => openDeleteConfirmation(notification.id));
      card.appendChild(remove);
    }

    return card;
  }

  function renderNotifications() {
    const list = document.getElementById("notifications-list");
    const empty = document.getElementById("notifications-empty");
    if (!list || !empty) return;

    list.replaceChildren();
    const notices = getNotifications();
    empty.hidden = notices.length > 0;
    notices.forEach(notice => list.appendChild(makeNotificationCard(notice)));
  }

  function renderAdminNotificationList() {
    const list = document.getElementById("edit-notifications-list");
    const empty = document.getElementById("edit-notifications-empty");
    if (!list || !empty) return;

    list.replaceChildren();
    const notices = getNotifications();
    empty.hidden = notices.length > 0;
    notices.forEach(notice => list.appendChild(makeNotificationCard(notice, true)));
  }

  const isAdminSignedIn = () => typeof isAdmin !== "undefined" && isAdmin;

  window.openAdminNotifications = () => {
    if (!isAdminSignedIn()) {
      window.showAppToast("Admin sign-in is required to manage notifications.");
      return;
    }
    renderAdminNotificationList();
    document.getElementById("admin-notifications-modal").hidden = false;
  };

  window.closeAdminNotifications = () => {
    document.getElementById("admin-notifications-modal").hidden = true;
  };

  window.openEditNotifications = () => {
    if (!isAdminSignedIn()) return;
    renderAdminNotificationList();
    document.getElementById("admin-notifications-modal").hidden = true;
    document.getElementById("edit-notifications-modal").hidden = false;
  };

  window.closeEditNotifications = () => {
    document.getElementById("edit-notifications-modal").hidden = true;
  };

  window.openNotifications = () => {
    renderNotifications();
    document.getElementById("notifications-modal").hidden = false;
    markNotificationsRead();
  };

  window.closeNotifications = () => {
    document.getElementById("notifications-modal").hidden = true;
  };

  window.publishAdminNotice = async () => {
    const titleInput = document.getElementById("admin-notice-title");
    const messageInput = document.getElementById("admin-notice-message");
    const status = document.getElementById("admin-notice-status");
    const title = titleInput.value.trim();
    const message = messageInput.value.trim();

    if (!isAdminSignedIn()) {
      status.textContent = "Admin sign-in is required to publish a notice.";
      return;
    }
    if (!title || !message) {
      status.textContent = "Add a title and message first.";
      return;
    }

    status.textContent = "Saving and sending notice…";
    try {
      const response = await fetch(`${apiBase()}/admin-notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": getAdminPassword()
        },
        body: JSON.stringify({
          title,
          message
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.notification) {
        throw new Error(result.error || "Could not save the notice.");
      }

      addNotification(result.notification);
      titleInput.value = "";
      messageInput.value = "";
      status.textContent = "Notice saved. Users will receive it when they reconnect.";
    } catch (error) {
      status.textContent = error.message || "Could not save the notice. Please try again.";
    }
  };

  let pendingDeleteId = null;

  function openDeleteConfirmation(id) {
    if (!isAdminSignedIn()) return;
    pendingDeleteId = id;
    const dialog = document.getElementById("notification-delete-confirm");
    if (dialog) dialog.hidden = false;
  }

  function closeDeleteConfirmation() {
    const dialog = document.getElementById("notification-delete-confirm");
    if (dialog) dialog.hidden = true;
    pendingDeleteId = null;
  }

  window.closeNotificationDeleteConfirmation = closeDeleteConfirmation;
  window.confirmNotificationDelete = confirmDeleteNotification;

  async function confirmDeleteNotification() {
    if (pendingDeleteId === null || pendingDeleteId === undefined) return;
    const id = pendingDeleteId;
    closeDeleteConfirmation();
    await deleteNotification(id);
  }

  async function deleteNotification(id) {
    if (!isAdminSignedIn()) return;

    try {
      const response = await fetch(`${apiBase()}/admin-delete-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": getAdminPassword()
        },
        body: JSON.stringify({
          id
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Could not delete the notification.");
      }
      removeNotification(id);
    } catch (error) {
      window.showAppToast(error.message || "Could not delete the notification. Please try again.");
    }
  }

  function showReloadNotice() {
    let notice = document.getElementById("reload-update-notice");
    if (notice) {
      notice.hidden = false;
      return;
    }

    notice = document.createElement("aside");
    notice.id = "reload-update-notice";
    notice.className = "reload-update-notice";
    notice.setAttribute("role", "status");
    notice.innerHTML = `
      <div class="reload-update-copy">
        <strong>New update available</strong>
        <span>Reload The Chat to get the latest version.</span>
      </div>
      <button type="button" class="reload-update-action">Reload now</button>
      <button type="button" class="reload-update-close" aria-label="Dismiss update notice">×</button>
    `;

    notice.querySelector(".reload-update-action").addEventListener("click", () => {
      window.location.reload();
    });
    notice.querySelector(".reload-update-close").addEventListener("click", () => {
      notice.remove();
    });
    document.body.appendChild(notice);
  }

  window.announcePageUpdate = async () => {
    const status = document.getElementById("page-update-status");
    if (!isAdminSignedIn()) {
      if (status) status.textContent = "Admin sign-in is required to announce an update.";
      return;
    }
    if (!notificationChannel) {
      if (status) status.textContent = "Live notifications are not connected. Please try again shortly.";
      return;
    }

    if (status) status.textContent = "Sending update prompt…";
    try {
      await notificationChannel.publish("reload-notice", { sentAt: new Date().toISOString() });
      if (status) status.textContent = "Update prompt sent to currently connected pages.";
    } catch (error) {
      if (status) status.textContent = "Could not send the update prompt. Check the live chat connection and try again.";
      console.warn("Could not announce page update.", error);
    }
  };

  window.forceLogoutAllUsers = async () => {
    const status = document.getElementById("force-logout-status");
    if (!isAdminSignedIn()) {
      if (status) status.textContent = "Admin sign-in is required to sign out users.";
      return;
    }

    const confirmed = await window.confirmInApp({
      title: "Log out all users?",
      message: "This will sign out users from currently open, connected pages. Admin sessions will stay signed in. Pages that are closed or disconnected will not receive this signal.",
      confirmLabel: "Log out users"
    });
    if (!confirmed) return;

    if (!notificationChannel) {
      if (status) status.textContent = "Live notifications are not connected. No users were signed out.";
      return;
    }

    if (status) status.textContent = "Sending sign-out signal…";
    try {
      await notificationChannel.publish("force-logout", { sentAt: new Date().toISOString() });
      if (status) status.textContent = "Sign-out signal sent to currently connected pages. Admin sessions were not affected.";
    } catch (error) {
      if (status) status.textContent = "Could not send the sign-out signal. Check the live connection and try again.";
      console.warn("Could not sign out connected users.", error);
    }
  };

  const connectNotifications = () => {
    try {
      if (!ably && typeof Ably !== "undefined" && typeof ABLY_KEY !== "undefined") {
        ably = new Ably.Realtime(ABLY_KEY);
      }
      if (!ably) return;
      notificationChannel = ably.channels.get("ckc-chat-notifications");
      notificationChannel.subscribe("notice", message => addNotification(message.data));
      notificationChannel.subscribe("reload-notice", () => showReloadNotice());
      notificationChannel.subscribe("notice-delete", message => {
        if (message.data && message.data.id !== undefined) removeNotification(message.data.id);
      });
      notificationChannel.subscribe("force-logout", async () => {
        if (typeof currentUser === "undefined" || !currentUser || currentUser === "ADMIN") return;
        if (typeof logoutUser === "function") {
          await logoutUser();
          if (typeof window.showAppToast === "function") {
            window.showAppToast("You have been signed out by an administrator.");
          }
        }
      });
    } catch (error) {
      console.warn("Could not connect live notifications.", error);
    }
  };

  window.addEventListener("storage", event => {
    if (event.key === "chatNowNotifications" || event.key === READ_STORAGE_KEY) {
      renderNotifications();
      renderAdminNotificationList();
      updateNotificationShortcut();
    }
  });

  window.addEventListener("focus", loadNotifications);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadNotifications();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      window.closeNotifications();
      window.closeAdminNotifications();
      window.closeEditNotifications();
      closeDeleteConfirmation();
    }
  });

  ["notifications-modal", "admin-notifications-modal", "edit-notifications-modal"].forEach(id => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.addEventListener("click", event => {
      if (event.target === modal) modal.hidden = true;
    });
  });

  renderNotifications();
  renderAdminNotificationList();
  updateNotificationShortcut();
  loadNotifications();
  refreshTimer = window.setInterval(loadNotifications, REFRESH_INTERVAL);
  connectNotifications();
})();
