(function (root) {
  "use strict";

  function escapeHtml(value) {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) => entities[character],
    );
  }

  function safeWebUrl(value, base = root.document?.baseURI) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const url = new URL(value, base);
      return ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
        ? url.href
        : "";
    } catch {
      return "";
    }
  }

  function safeImageUrl(value, base = root.document?.baseURI) {
    const href = safeWebUrl(value, base);
    // Repository images must remain on the site; JSON cannot introduce tracking images.
    try {
      return href && new URL(href).origin === new URL(base).origin ? href : "";
    } catch {
      return "";
    }
  }

  function safeEmailUrl(value) {
    if (
      typeof value !== "string" ||
      !/^[^\s<>@"?&#]+@[^\s<>@"?&#]+$/.test(value)
    )
      return "";
    return "mailto:" + value.split("@").map(encodeURIComponent).join("@");
  }

  const api = { escapeHtml, safeWebUrl, safeImageUrl, safeEmailUrl };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SiteSecurity = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this);
