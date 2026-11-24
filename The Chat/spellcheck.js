(() => {
  const editableFields = document.querySelectorAll(
    'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], [contenteditable="true"]'
  );

  editableFields.forEach(field => {
    field.setAttribute("spellcheck", "true");
    field.setAttribute("autocorrect", "on");
  });

  document.querySelectorAll('textarea, [contenteditable="true"]').forEach(field => {
    field.setAttribute("autocapitalize", "sentences");
  });
})();
