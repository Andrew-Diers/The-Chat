(() => {
  let wakeLock = null;
  let requesting = false;

  async function keepScreenAwake() {
    if (!isSignedIn() || document.hidden || wakeLock || requesting) return;
    if (!("wakeLock" in navigator)) return;

    requesting = true;
    try {
      const lock = await navigator.wakeLock.request("screen");
      wakeLock = lock;
      lock.addEventListener("release", () => {
        if (wakeLock === lock) wakeLock = null;
        if (isSignedIn() && !document.hidden) keepScreenAwake();
      });
    } catch (error) {
      // Screen Wake Lock is optional and may be blocked by device or browser settings.
    } finally {
      requesting = false;
    }
  }

  function isSignedIn() {
    return typeof currentUser !== "undefined" && Boolean(currentUser);
  }

  async function releaseWakeLock() {
    const lock = wakeLock;
    wakeLock = null;
    if (!lock) return;
    try {
      await lock.release();
    } catch (error) {
      // The browser may have already released the lock.
    }
  }

  window.syncSignedInWakeLock = () => {
    if (isSignedIn()) {
      keepScreenAwake();
    } else {
      releaseWakeLock();
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      releaseWakeLock();
    } else {
      window.syncSignedInWakeLock();
    }
  });

  window.syncSignedInWakeLock();
})();
