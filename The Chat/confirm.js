(() => {
  let resolveConfirmation = null;

  const backdrop = document.createElement("div");
  backdrop.className = "app-confirm-backdrop";
  backdrop.hidden = true;
  backdrop.setAttribute("role", "presentation");
  backdrop.innerHTML = `
    <section class="app-confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="app-confirm-title" aria-describedby="app-confirm-copy">
      <h2 id="app-confirm-title"></h2>
      <p id="app-confirm-copy"></p>
      <div class="app-confirm-actions">
        <button class="app-confirm-cancel" type="button">Cancel</button>
        <button class="app-confirm-accept" type="button">Delete</button>
      </div>
    </section>
  `;
  document.body.appendChild(backdrop);

  const title = backdrop.querySelector("#app-confirm-title");
  const copy = backdrop.querySelector("#app-confirm-copy");
  const cancelButton = backdrop.querySelector(".app-confirm-cancel");
  const acceptButton = backdrop.querySelector(".app-confirm-accept");

  function closeConfirmation(accepted) {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    const resolve = resolveConfirmation;
    resolveConfirmation = null;
    if (resolve) resolve(accepted);
  }

  window.confirmInApp = ({
    title: heading,
    message,
    confirmLabel = "Delete"
  }) => {
    if (resolveConfirmation) closeConfirmation(false);

    title.textContent = heading;
    copy.textContent = message;
    acceptButton.textContent = confirmLabel;
    backdrop.hidden = false;
    cancelButton.focus();

    return new Promise(resolve => {
      resolveConfirmation = resolve;
    });
  };

  cancelButton.addEventListener("click", () => closeConfirmation(false));
  acceptButton.addEventListener("click", () => closeConfirmation(true));
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) closeConfirmation(false);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !backdrop.hidden) {
      closeConfirmation(false);
    }
  });
})();
