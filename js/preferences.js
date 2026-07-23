/* Global language and theme preferences. Loaded synchronously in every <head>. */
(function () {
  "use strict";

  const LANGUAGE_KEY = "siteLanguage";
  const THEME_KEY = "siteTheme";
  const VALID_LANGUAGES = new Set(["en", "ar"]);
  const VALID_THEMES = new Set(["light", "dark"]);

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Preferences still apply for the current page when storage is unavailable.
    }
  }

  function savedLanguage() {
    const current = readStorage(LANGUAGE_KEY);
    return VALID_LANGUAGES.has(current) ? current : "en";
  }

  function savedTheme() {
    const current = readStorage(THEME_KEY);
    return VALID_THEMES.has(current) ? current : "light";
  }

  function applyLanguage(language, persist = false) {
    const nextLanguage = VALID_LANGUAGES.has(language) ? language : "en";
    document.documentElement.lang = nextLanguage;
    document.documentElement.dir = nextLanguage === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.language = nextLanguage;
    if (persist) writeStorage(LANGUAGE_KEY, nextLanguage);
    return nextLanguage;
  }

  function applyTheme(theme, persist = false) {
    const nextTheme = VALID_THEMES.has(theme) ? theme : "light";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    if (document.body) {
      document.body.classList.toggle("theme-dark", nextTheme === "dark");
      document.body.classList.toggle("home-dark", nextTheme === "dark" && document.body.classList.contains("dashboard-home"));
    }
    if (persist) writeStorage(THEME_KEY, nextTheme);
    return nextTheme;
  }

  const language = applyLanguage(savedLanguage());
  const theme = applyTheme(savedTheme());

  window.SitePreferences = {
    LANGUAGE_KEY,
    THEME_KEY,
    getLanguage: () => document.documentElement.dataset.language || language,
    getTheme: () => document.documentElement.dataset.theme || theme,
    setLanguage: (nextLanguage) => applyLanguage(nextLanguage, true),
    setTheme: (nextTheme) => applyTheme(nextTheme, true),
    applyLanguage,
    applyTheme
  };

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(window.SitePreferences.getTheme());
  });

  window.setTimeout(() => {
    document.documentElement.classList.remove("preferences-pending");
  }, 1800);
})();
