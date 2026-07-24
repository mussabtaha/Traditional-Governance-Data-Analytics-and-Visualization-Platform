/* ================================================================
   Traditional Governments Database & Explorer
   Shared behavior and live API presentation layer
   ================================================================ */

(function () {
  "use strict";

  const PRODUCTION_API_BASE_URL =
    "https://traditional-governance-data-analytics.onrender.com/api";
  const API_BASE_URL = resolveApiBaseUrl();
  const PAGE_SIZE = 100;
  const BINARY_FIELDS = [
    "Any_TPI", "King", "Chief", "Headman", "KingInher", "KingElect",
    "KingApp", "Func_Land", "Func_DR", "Func_Sec", "Func_Heal",
    "CouncilD", "Assembly", "FormAckn"
  ];

  const FIELD_LABELS = {
    Country: "Country",
    Continent: "Continent",
    Region: "Region",
    GroupName: "Group name",
    Population: "Population",
    Any_TPI: "Has traditional government",
    King: "King",
    Chief: "Chief",
    Headman: "Headman",
    KingInher: "King selected by inheritance",
    KingElect: "King selected by election",
    KingApp: "King selected by appointment",
    Func_Land: "Land management",
    Func_DR: "Dispute resolution",
    Func_Sec: "Security",
    Func_Heal: "Healthcare / traditional healing",
    CouncilD: "Advisory / decision-making council",
    Assembly: "Public / community assembly",
    FormAckn: "Formal state recognition"
  };

  const state = {
    groups: [],
    filtered: [],
    stats: null,
    continents: [],
    leadership: null,
    largestGroups: [],
    topCountries: [],
    page: 1,
    sortKey: "GroupName",
    sortDirection: "asc",
    anyTpiFilter: "",
    pagination: {
      page: 1,
      limit: PAGE_SIZE,
      totalItems: 0,
      totalPages: 1
    },
    filterOptions: {
      countries: [],
      continents: [],
      regions: []
    },
    explorerRequestController: null,
    groupDetailCache: new Map()
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const tr = (value, variables) => window.SiteI18n?.t(value, variables) ?? String(value ?? "");
  const isArabic = () => (window.SitePreferences?.getLanguage() || document.documentElement.lang) === "ar";

  function resolveApiBaseUrl() {
    const configuredUrl =
      window.TRADGOV_CONFIG?.apiBaseUrl ||
      window.TRADGOV_API_BASE_URL ||
      PRODUCTION_API_BASE_URL;

    return String(configuredUrl).replace(/\/+$/, "");
  }

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    initLoader();
    initNavigation();
    initRevealAnimations();
    initBackToTop();
    initContactForm();
    initHomeSubscribe();
    initMapMarkerNavigation();

    const page = document.body.dataset.page;
    try {
      if (page === "groups") {
        const initialQuery = explorerQueryFromUrl();
        const [countries, continents, regions, initialPage] = await Promise.all([
          loadApiData("countries"),
          loadApiData("continents"),
          loadApiData("regions"),
          loadGroupsPage(initialQuery)
        ]);
        state.filterOptions = {
          countries: summaryValues(countries, "country"),
          continents: summaryValues(continents, "continent"),
          regions: summaryValues(regions, "region")
        };
        state.page = initialPage.pagination.page;
        state.sortKey = initialQuery.sort;
        state.sortDirection = initialQuery.direction;
        state.anyTpiFilter = initialQuery.any_tpi;
        initExplorer(initialPage);
        initDetailActions();
        return;
      }

      if (page === "home") {
        const [groupsPage, stats, continents] = await Promise.all([
          loadGroupsPage({ page: 1, limit: 8, sort: "id", direction: "desc" }),
          loadApiData("stats"),
          loadApiData("continents")
        ]);
        state.groups = groupsPage.groups;
        state.filtered = [...groupsPage.groups];
        state.stats = normalizeStats(stats);
        state.continents = Array.isArray(continents) ? continents.map(normalizeContinentSummary) : [];
        updateGlobalDataViews();
        animateCounters();
        return;
      }

      if (page === "comparison") {
        const options = await loadApiData("group-options");
        state.groups = Array.isArray(options) ? options.map(normalizeGroup) : [];
        initComparison();
        return;
      }

      if (page === "statistics") {
        const [stats, continents, leadership, largestGroups, topCountries] = await Promise.all([
          loadApiData("stats"),
          loadApiData("continents"),
          loadApiData("leadership"),
          loadApiData("largest-groups"),
          loadApiData("top-countries")
        ]);
        state.stats = normalizeStats(stats);
        state.continents = Array.isArray(continents) ? continents.map(normalizeContinentSummary) : [];
        state.leadership = normalizeLeadershipSummary(leadership);
        state.largestGroups = Array.isArray(largestGroups) ? largestGroups.map(normalizeLargestGroup) : [];
        state.topCountries = Array.isArray(topCountries) ? topCountries.map(normalizeTopCountry) : [];
        updateGlobalDataViews();
        initStatisticsPage();
        animateCounters();
      }
    } catch (error) {
      console.error("Could not load data from the backend API:", error);
      showDataError(error);
    }
  }

  async function loadApiData(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: options.signal
    });
    let result = null;

    try {
      result = await response.json();
    } catch (error) {
      throw new Error(`${endpoint}: the API returned invalid JSON`, { cause: error });
    }

    if (!response.ok || result?.success !== true) {
      throw new Error(result?.message || `${endpoint}: API request failed with status ${response.status}`);
    }

    return result.data;
  }

  async function loadGroupsPage(query = {}, options = {}) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (key === "sort" && value === "GroupName") return;
      if (key === "direction" && value === "asc") return;
      if (value !== null && value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    });

    const data = await loadApiData(`groups?${params.toString()}`, options);
    const pagination = data?.pagination || {};
    return {
      groups: extractGroupRecords(data).map(normalizeGroup),
      pagination: {
        page: toNumber(pagination.page) ?? 1,
        limit: toNumber(pagination.limit) ?? PAGE_SIZE,
        totalItems: toNumber(
          pagination.total_items ?? pagination.total ?? pagination.total_records
        ) ?? 0,
        totalPages: toNumber(pagination.total_pages ?? pagination.totalPages) ?? 0
      }
    };
  }

  function extractGroupRecords(data) {
    const records = Array.isArray(data)
      ? data
      : data?.groups || data?.items || data?.records;
    if (!Array.isArray(records)) throw new Error("groups: unexpected API response format");
    return records;
  }

  function summaryValues(rows, field) {
    if (!Array.isArray(rows)) return [];
    return [...new Set(rows.map((row) => cleanValue(row[field])).filter(Boolean))]
      .sort((left, right) => String(left).localeCompare(String(right)));
  }

  function explorerQueryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const requestedPage = Number(params.get("page"));
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

    const supportedSorts = new Set(["GroupName", "Country", "Continent", "Population", "FormAckn"]);
    const requestedSort = params.get("sort");
    const sort = supportedSorts.has(requestedSort) ? requestedSort : "GroupName";
    const direction = params.get("direction") === "desc" ? "desc" : "asc";

    const leadership = ["King", "Chief", "Headman"].includes(params.get("leadership"))
      ? params.get("leadership")
      : "";
    const recognition = ["0", "1", "missing"].includes(params.get("recognition"))
      ? params.get("recognition")
      : "";

    return {
      page,
      limit: PAGE_SIZE,
      search: params.get("search") || "",
      country: params.get("country") || "",
      continent: params.get("continent") || "",
      region: params.get("region") || "",
      leadership,
      recognition,
      any_tpi: normalizeBinaryQueryParameter(params.get("any_tpi")),
      sort,
      direction
    };
  }

  function normalizeGroup(group) {
    return {
      id: toNumber(group.id),
      GroupId: toNumber(group.groupid),
      Country: cleanValue(group.country),
      Continent: cleanValue(group.continent),
      Region: cleanValue(group.region),
      GroupName: cleanValue(group.group_name),
      GroupNameAr: cleanValue(group.group_name_ar),
      Population: toNumber(group.groupsize),
      Any_TPI: normalizeBinary(group.any_tpi),
      King: normalizeBinary(group.king),
      Chief: normalizeBinary(group.chief),
      Headman: normalizeBinary(group.headman),
      KingInher: normalizeBinary(group.kinginher),
      KingElect: normalizeBinary(group.kingelect),
      KingApp: normalizeBinary(group.kingapp),
      Func_Land: normalizeBinary(group.func_land),
      Func_DR: null,
      Func_Sec: normalizeBinary(group.func_sec),
      Func_Heal: normalizeBinary(group.kingheal),
      CouncilD: normalizeBinary(group.counceld),
      Assembly: normalizeBinary(group.assembly),
      FormAckn: normalizeBinary(group.formackn)
    };
  }

  function normalizeStats(data) {
    return {
      totalGroups: toNumber(data.total_groups) ?? 0,
      totalCountries: toNumber(data.total_countries) ?? 0,
      totalContinents: toNumber(data.total_continents) ?? 0,
      totalRegions: toNumber(data.total_regions) ?? 0,
      totalTraditional: toNumber(data.groups_with_tpi) ?? 0,
      totalRecognized: toNumber(data.total_recognized) ?? 0,
      totalNotRecognized: toNumber(data.total_not_recognized) ?? 0,
      totalRecognitionMissing: toNumber(data.total_recognition_missing) ?? 0,
      totalFuncLand: toNumber(data.total_func_land) ?? 0,
      totalFuncSec: toNumber(data.total_func_sec) ?? 0,
      totalFuncHeal: toNumber(data.total_func_heal) ?? 0
    };
  }

  function normalizeContinentSummary(row) {
    return {
      continent: cleanValue(row.continent),
      totalGroups: toNumber(row.total_groups) ?? 0
    };
  }

  function normalizeLeadershipSummary(data) {
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      King: toNumber(row.kings) ?? 0,
      Chief: toNumber(row.chiefs) ?? 0,
      Headman: toNumber(row.headmen) ?? 0
    };
  }

  function normalizeLargestGroup(row) {
    return {
      GroupName: cleanValue(row.group_name),
      GroupNameAr: cleanValue(row.group_name_ar),
      Country: cleanValue(row.country),
      Population: toNumber(row.groupsize)
    };
  }

  function getGroupDisplayName(group) {
    const isArabicLanguage =
      (window.SitePreferences?.getLanguage() ||
       document.documentElement.lang) === "ar";

    if (isArabicLanguage && group.GroupNameAr) {
      return group.GroupNameAr;
    }

    return group.GroupName;
  }

  function usesArabicGroupName(group) {
    return isArabic() && Boolean(group.GroupNameAr);
  }

  function groupNameMarkup(group) {
    const direction = usesArabicGroupName(group) ? "rtl" : "ltr";
    const name = escapeHtml(displayValue(getGroupDisplayName(group)));
    return `<bdi class="group-name-bidi" dir="${direction}">${name}</bdi>`;
  }

  function isolatedGroupNameText(group) {
    const isolateStart = usesArabicGroupName(group) ? "\u2067" : "\u2066";
    return `${isolateStart}${displayValue(getGroupDisplayName(group))}\u2069`;
  }

  function normalizeTopCountry(row) {
    return {
      Country: cleanValue(row.country),
      TotalGroups: toNumber(row.total_groups) ?? 0
    };
  }

  function cleanValue(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    return String(value).trim();
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeBinary(value) {
    const number = toNumber(value);
    if (number === 1) return 1;
    if (number === 0) return 0;
    return null;
  }

  function initLoader() {
    const loader = $("#siteLoader");
    const hide = () => {
      document.body.classList.remove("is-loading");
      if (loader) loader.classList.add("is-hidden");
    };
    window.addEventListener("load", hide, { once: true });
    window.setTimeout(hide, 850);
  }

  function initNavigation() {
    const toggle = $("#navToggle");
    const menu = $("#navMenu");
    const currentFile = window.location.pathname.split("/").pop() || "index.html";

    $$(".nav-link").forEach((link) => {
      const href = link.getAttribute("href");
      link.classList.toggle("active", href === currentFile);
      if (href === currentFile) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    if (toggle && menu) {
      toggle.addEventListener("click", () => {
        const isOpen = menu.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
      });

      menu.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
          menu.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });

      document.addEventListener("click", (event) => {
        if (!event.target.closest(".nav-shell") && menu.classList.contains("is-open")) {
          menu.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    }

    $$('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const target = $(link.getAttribute("href"));
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  function initRevealAnimations() {
    const elements = $$('[data-reveal]');
    if (!elements.length) return;

    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    elements.forEach((element, index) => {
      element.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
      observer.observe(element);
    });

    // Browser scroll restoration can initially place every observed element
    // outside the viewport. Never leave content permanently hidden in that case.
    window.setTimeout(() => elements.forEach((element) => element.classList.add("is-visible")), 1000);
  }

  function initBackToTop() {
    const button = $("#backToTop");
    if (!button) return;
    const update = () => button.classList.toggle("is-visible", window.scrollY > 520);
    window.addEventListener("scroll", update, { passive: true });
    button.addEventListener("click", () => {
      // The numeric overload is more reliable across embedded browsers;
      // smooth motion still comes from html { scroll-behavior: smooth }.
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    update();
  }

  function updateGlobalDataViews() {
    const metrics = state.stats
      ? state.stats
      : {
          totalGroups: state.groups.length,
          totalCountries: uniqueValues("Country").length,
          totalContinents: uniqueValues("Continent").length,
          totalRegions: uniqueValues("Region").length,
          totalTraditional: 0,
          totalRecognized: 0
        };

    Object.entries(metrics).forEach(([key, value]) => {
      $$(`[data-metric="${key}"]`).forEach((element) => {
        element.dataset.target = String(value);
      });
    });

    renderMapCounts();
    renderLatestGroups();
  }

  function renderMapCounts() {
    if (!state.continents.length) return;
    const counts = new Map(state.continents.map((item) => [item.continent, item.totalGroups]));

    $$(".home-map-marker[data-continent]").forEach((marker) => {
      const continent = marker.dataset.continent;
      const total = counts.get(continent) ?? 0;
      marker.textContent = total.toLocaleString(isArabic() ? "ar" : "en");
      updateMapMarkerLabel(marker);
    });
  }

  function initMapMarkerNavigation() {
    $$(".home-map-marker[data-continent]").forEach((marker) => {
      updateMapMarkerLabel(marker);
      marker.addEventListener("click", () => {
        const continent = marker.dataset.continent;
        if (!continent) return;
        window.location.href = `groups.html?continent=${encodeURIComponent(continent)}`;
      });
      marker.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        marker.click();
      });
    });
  }

  function updateMapMarkerLabel(marker) {
    const continent = marker.dataset.continent;
    if (!continent) return;
    marker.setAttribute(
      "aria-label",
      tr("View groups in {continent}", { continent: tr(continent) })
    );
  }

  function animateCounters() {
    const counters = $$('[data-counter]');
    if (!counters.length) return;

    const run = (counter) => {
      if (counter.dataset.animated === "true") return;
      counter.dataset.animated = "true";
      const target = Number(counter.dataset.target || 0);
      const suffix = counter.dataset.suffix || "";
      const duration = 900;
      const start = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        counter.textContent = `${Math.round(target * eased).toLocaleString()}${suffix}`;
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!("IntersectionObserver" in window)) {
      counters.forEach(run);
      return;
    }

    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          run(entry.target);
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach((counter) => observer.observe(counter));
    window.setTimeout(() => counters.forEach(run), 1200);
  }

  function initExplorer(initialPage = null) {
    const tableBody = $("#groupsTableBody");
    if (!tableBody) return;

    populateFilter("countryFilter", state.filterOptions.countries);
    populateFilter("continentFilter", state.filterOptions.continents);
    populateFilter("regionFilter", state.filterOptions.regions);
    applyExplorerQueryParameters();

    const search = $("#groupSearch");
    let searchTimer = null;

    search?.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      state.page = 1;
      updateExplorerQueryString();
      searchTimer = window.setTimeout(() => {
        loadExplorerPage();
      }, 300);
    });

    [$("#countryFilter"), $("#continentFilter"), $("#regionFilter"), $("#leadershipFilter"), $("#recognitionFilter")]
      .filter(Boolean)
      .forEach((control) => {
        control.addEventListener("change", () => {
          window.clearTimeout(searchTimer);
          state.page = 1;
          loadExplorerPage();
        });
      });

    $("#resetFilters")?.addEventListener("click", () => {
      window.clearTimeout(searchTimer);
      ["groupSearch", "countryFilter", "continentFilter", "regionFilter", "leadershipFilter", "recognitionFilter"]
        .forEach((id) => {
          const control = $(`#${id}`);
          if (control) control.value = "";
        });
      state.page = 1;
      state.sortKey = "GroupName";
      state.sortDirection = "asc";
      state.anyTpiFilter = "";
      loadExplorerPage();
    });

    $$('[data-sort]').forEach((header) => {
      header.addEventListener("click", () => {
        const key = header.dataset.sort;
        if (state.sortKey === key) state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
        else {
          state.sortKey = key;
          state.sortDirection = "asc";
        }
        state.page = 1;
        loadExplorerPage();
      });
    });

    if (initialPage) {
      state.groups = initialPage.groups;
      state.filtered = [...initialPage.groups];
      state.pagination = initialPage.pagination;
      state.page = initialPage.pagination.page;
      updateExplorerQueryString();
      renderGroupsTable();
      renderPagination(initialPage.pagination.totalPages);
      updateSortIndicators();
    } else {
      loadExplorerPage();
    }
  }

  function applyExplorerQueryParameters() {
    const params = new URLSearchParams(window.location.search);
    const search = params.get("search");
    if (search != null && $("#groupSearch")) $("#groupSearch").value = search;

    setSelectFromQuery("countryFilter", "country", params.get("country"));
    setSelectFromQuery("continentFilter", "continent", params.get("continent"));
    setSelectFromQuery("regionFilter", "region", params.get("region"));
    setSelectFromQuery("leadershipFilter", "leadership", params.get("leadership"));
    setSelectFromQuery("recognitionFilter", "recognition", params.get("recognition"));
    state.anyTpiFilter = normalizeBinaryQueryParameter(params.get("any_tpi"));

    const requestedPage = Number(params.get("page"));
    if (Number.isInteger(requestedPage) && requestedPage > 0) state.page = requestedPage;

    const requestedSort = params.get("sort");
    const supportedSorts = new Set(["GroupName", "Country", "Continent", "Population", "FormAckn"]);
    if (supportedSorts.has(requestedSort)) state.sortKey = requestedSort;

    const requestedDirection = params.get("direction");
    if (requestedDirection === "asc" || requestedDirection === "desc") {
      state.sortDirection = requestedDirection;
    }
  }

  function setSelectFromQuery(id, parameterName, requestedValue) {
    if (!requestedValue) return;
    const select = $(`#${id}`);
    if (!select) return;
    const option = Array.from(select.options).find(
      (item) => item.value.toLocaleLowerCase() === requestedValue.toLocaleLowerCase()
    );
    if (option) {
      select.value = option.value;
      return;
    }
    console.warn(`Ignored invalid "${parameterName}" filter value from URL: "${requestedValue}".`);
  }

  function normalizeBinaryQueryParameter(value) {
    const normalized = String(value ?? "").trim().toLocaleLowerCase();
    if (!normalized) return "";
    if (["1", "yes", "true"].includes(normalized)) return "1";
    if (["0", "no", "false"].includes(normalized)) return "0";
    if (["missing", "null", "na"].includes(normalized)) return "missing";
    console.warn(`Ignored invalid "any_tpi" filter value from URL: "${value}".`);
    return "";
  }

  function updateExplorerQueryString() {
    if (!$("#groupsTableBody")) return;
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const values = {
      search: ($("#groupSearch")?.value || "").trim(),
      country: $("#countryFilter")?.value || "",
      continent: $("#continentFilter")?.value || "",
      region: $("#regionFilter")?.value || "",
      leadership: $("#leadershipFilter")?.value || "",
      recognition: $("#recognitionFilter")?.value || "",
      any_tpi: state.anyTpiFilter,
      page: state.page > 1 ? String(state.page) : "",
      sort: state.sortKey !== "GroupName" ? state.sortKey : "",
      direction: state.sortDirection !== "asc" ? state.sortDirection : ""
    };

    Object.entries(values).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }

  function populateFilter(id, values) {
    const select = $(`#${id}`);
    if (!select) return;
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = tr(value);
      select.appendChild(option);
    });
  }

  function explorerRequestQuery() {
    return {
      page: state.page,
      limit: PAGE_SIZE,
      search: ($("#groupSearch")?.value || "").trim(),
      country: $("#countryFilter")?.value || "",
      continent: $("#continentFilter")?.value || "",
      region: $("#regionFilter")?.value || "",
      leadership: $("#leadershipFilter")?.value || "",
      recognition: $("#recognitionFilter")?.value || "",
      any_tpi: state.anyTpiFilter,
      sort: state.sortKey,
      direction: state.sortDirection
    };
  }

  async function loadExplorerPage(options = {}) {
    state.explorerRequestController?.abort();
    const controller = new AbortController();
    state.explorerRequestController = controller;

    updateExplorerQueryString();
    renderExplorerLoading();

    try {
      const result = await loadGroupsPage(
        explorerRequestQuery(),
        { signal: controller.signal }
      );
      if (state.explorerRequestController !== controller) return;

      state.groups = result.groups;
      state.filtered = [...result.groups];
      state.pagination = result.pagination;
      state.page = result.pagination.page;

      updateExplorerQueryString();
      renderGroupsTable();
      renderPagination(result.pagination.totalPages);
      updateSortIndicators();

      if (options.scroll) {
        $("#groupsTable")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("Could not load the requested groups page:", error);
      renderExplorerError(error);
    } finally {
      if (state.explorerRequestController === controller) {
        state.explorerRequestController = null;
      }
    }
  }

  function renderExplorerLoading() {
    const body = $("#groupsTableBody");
    const count = $("#resultsCount");
    const pagination = $("#groupsPagination");
    $("#groupsTable")?.setAttribute("aria-busy", "true");
    if (count) count.textContent = tr("Loading records…");
    if (body) {
      body.innerHTML = `<tr><td colspan="8" class="empty-state">${tr("Loading records…")}</td></tr>`;
    }
    if (pagination) pagination.innerHTML = "";
  }

  function renderExplorerError(error) {
    const body = $("#groupsTableBody");
    const count = $("#resultsCount");
    $("#groupsTable")?.setAttribute("aria-busy", "false");
    if (count) count.textContent = tr("Unable to load records.");
    if (body) {
      body.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="bi bi-exclamation-triangle d-block fs-2 mb-2"></i>${escapeHtml(error?.message || tr("Unable to load records."))}</td></tr>`;
    }
  }

  function updateSortIndicators() {
    $$("[data-sort]").forEach((header) => {
      if (header.dataset.sort === state.sortKey) {
        header.setAttribute("aria-sort", state.sortDirection === "asc" ? "ascending" : "descending");
      } else {
        header.removeAttribute("aria-sort");
      }
    });
  }

  function renderGroupsTable() {
    const body = $("#groupsTableBody");
    const count = $("#resultsCount");
    if (!body) return;
    $("#groupsTable")?.setAttribute("aria-busy", "false");

    if (count) {
      const totalItems = state.pagination.totalItems;
      count.innerHTML = isArabic()
        ? `عرض <strong>${totalItems.toLocaleString("ar")}</strong> من سجلات قاعدة البيانات`
        : `Showing <strong>${totalItems.toLocaleString()}</strong> database record${totalItems === 1 ? "" : "s"}`;
    }

    if (!state.groups.length) {
      body.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="bi bi-search d-block fs-2 mb-2"></i>${tr("No groups match the selected criteria.")}</td></tr>`;
      return;
    }

    body.innerHTML = state.groups.map(groupTableRow).join("");
  }

  function groupTableRow(group) {
    return `
      <tr>
        <td class="group-name-cell"><strong>${groupNameMarkup(group)}</strong><small>${escapeHtml(displayValue(group.Region))}</small></td>
        <td>${escapeHtml(displayValue(group.Country))}</td>
        <td>${escapeHtml(displayValue(group.Continent))}</td>
        <td>${formatPopulation(group.Population)}</td>
        <td>${leadershipBadges(group)}</td>
        <td>${binaryBadge(group.Any_TPI)}</td>
        <td>${binaryBadge(group.FormAckn)}</td>
        <td><button class="table-action view-group" type="button" data-group-id="${group.id}" aria-label="${escapeHtml(tr("View details for {group}", { group: isolatedGroupNameText(group) }))}"><i class="bi bi-arrow-up-right"></i></button></td>
      </tr>`;
  }

  function renderPagination(totalPages) {
    const container = $("#groupsPagination");
    if (!container) return;
    const visibleTotalPages = Math.max(1, totalPages);
    const buttons = [];
    buttons.push(`<button class="page-btn" data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""} aria-label="${tr("Previous page")}"><i class="bi bi-chevron-left"></i></button>`);
    paginationRange(visibleTotalPages, state.page).forEach((page) => {
      if (page === "ellipsis") {
        buttons.push('<span class="page-ellipsis" aria-hidden="true">…</span>');
        return;
      }
      buttons.push(`<button class="page-btn ${page === state.page ? "active" : ""}" data-page="${page}" aria-label="${tr("Page {page}", { page })}" ${page === state.page ? 'aria-current="page"' : ""}>${page}</button>`);
    });
    buttons.push(`<button class="page-btn" data-page="${state.page + 1}" ${state.page >= visibleTotalPages ? "disabled" : ""} aria-label="${tr("Next page")}"><i class="bi bi-chevron-right"></i></button>`);
    container.innerHTML = buttons.join("");
    $$('.page-btn:not([disabled])', container).forEach((button) => {
      button.addEventListener("click", () => {
        state.page = Number(button.dataset.page);
        loadExplorerPage({ scroll: true });
      });
    });
  }

  function paginationRange(totalPages, currentPage) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const pages = new Set([1, totalPages]);
    for (let page = Math.max(2, currentPage - 2); page <= Math.min(totalPages - 1, currentPage + 2); page += 1) {
      pages.add(page);
    }
    const ordered = [...pages].sort((a, b) => a - b);
    const range = [];
    ordered.forEach((page, index) => {
      if (index > 0 && page - ordered[index - 1] > 1) range.push("ellipsis");
      range.push(page);
    });
    return range;
  }

  function renderLatestGroups() {
    const body = $("#latestGroupsBody");
    if (!body) return;
    const latest = [...state.groups]
      .sort((left, right) => (right.id ?? 0) - (left.id ?? 0))
      .slice(0, 8);
    body.innerHTML = latest.map((group) => `
      <tr>
        <td class="group-name-cell"><strong>${groupNameMarkup(group)}</strong><small>${escapeHtml(displayValue(group.Country))}</small></td>
        <td>${escapeHtml(displayValue(group.Region))}</td>
        <td>${leadershipBadges(group)}</td>
        <td>${binaryBadge(group.FormAckn)}</td>
      </tr>`).join("");
  }

  function initDetailActions() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest(".view-group");
      if (!button) return;
      const group = state.groups.find((item) => item.id === Number(button.dataset.groupId));
      if (group) openGroupDialog(group);
    });

    const dialog = $("#groupDetailDialog");
    $("#closeGroupDialog")?.addEventListener("click", () => dialog?.close());
    dialog?.addEventListener("click", (event) => {
      const bounds = dialog.getBoundingClientRect();
      const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
      if (outside) dialog.close();
    });
  }

  function openGroupDialog(group) {
    const dialog = $("#groupDetailDialog");
    const title = $("#detailGroupName");
    const subtitle = $("#detailGroupLocation");
    const content = $("#detailContent");
    if (!dialog || !content) return;

    if (title) title.innerHTML = groupNameMarkup(group);
    if (subtitle) subtitle.textContent = `${displayValue(group.Country)} · ${displayValue(group.Region)}`;
    content.innerHTML = [
      detailSection(tr("Geographic information"), group, ["Country", "Continent", "Region"]),
      detailSection(tr("Group information"), group, ["Population", "Any_TPI"]),
      detailSection(tr("Leadership type"), group, ["King", "Chief", "Headman"]),
      detailSection(tr("Leadership selection"), group, ["KingInher", "KingElect", "KingApp"]),
      detailSection(tr("Traditional government functions"), group, ["Func_Land", "Func_DR", "Func_Sec", "Func_Heal"]),
      detailSection(tr("Administrative structure"), group, ["CouncilD", "Assembly", "FormAckn"])
    ].join("");

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function detailSection(title, group, fields) {
    const items = fields.map((field) => {
      const value = field === "Population" ? formatPopulation(group[field]) : BINARY_FIELDS.includes(field) ? displayBinary(group[field]) : displayValue(group[field]);
      return `<div class="detail-item"><span>${escapeHtml(tr(FIELD_LABELS[field]))}</span><strong>${escapeHtml(value)}</strong></div>`;
    }).join("");
    return `<section class="detail-section"><h3>${escapeHtml(title)}</h3><div class="detail-grid">${items}</div></section>`;
  }

  function initComparison() {
    const leftSelect = $("#compareLeft");
    const rightSelect = $("#compareRight");
    if (!leftSelect || !rightSelect) return;

    const options = [...state.groups]
      .sort((left, right) => String(getGroupDisplayName(left) || "").localeCompare(String(getGroupDisplayName(right) || "")))
      .map((group) => `<option value="${group.id}">${escapeHtml(isolatedGroupNameText(group))} · ${escapeHtml(displayValue(group.Country))}</option>`)
      .join("");
    leftSelect.innerHTML = options;
    rightSelect.innerHTML = options;
    leftSelect.value = String(state.groups[0]?.id || "");
    rightSelect.value = String(state.groups[1]?.id || "");

    let renderVersion = 0;
    const render = async () => {
      const currentVersion = ++renderVersion;
      const profiles = $("#compareProfiles");
      const body = $("#comparisonBody");
      if (profiles) profiles.innerHTML = "";
      if (body) {
        body.innerHTML = `<tr><td colspan="3" class="empty-state">${tr("Loading comparison…")}</td></tr>`;
      }

      try {
        const [left, right] = await Promise.all([
          loadGroupDetail(Number(leftSelect.value)),
          loadGroupDetail(Number(rightSelect.value))
        ]);
        if (currentVersion !== renderVersion) return;
        renderComparison(left, right);
      } catch (error) {
        if (currentVersion !== renderVersion) return;
        console.error("Could not load comparison details:", error);
        if (body) {
          body.innerHTML = `<tr><td colspan="3" class="empty-state">${escapeHtml(error?.message || tr("Unable to load records."))}</td></tr>`;
        }
      }
    };
    leftSelect.addEventListener("change", render);
    rightSelect.addEventListener("change", render);
    $("#swapGroups")?.addEventListener("click", () => {
      const current = leftSelect.value;
      leftSelect.value = rightSelect.value;
      rightSelect.value = current;
      render();
    });
    render();
  }

  function loadGroupDetail(id) {
    if (!Number.isInteger(id) || id < 1) {
      return Promise.reject(new Error("A valid group must be selected."));
    }
    if (state.groupDetailCache.has(id)) return state.groupDetailCache.get(id);

    const request = loadApiData(`groups/${id}`)
      .then(normalizeGroup)
      .catch((error) => {
        state.groupDetailCache.delete(id);
        throw error;
      });
    state.groupDetailCache.set(id, request);
    return request;
  }

  function renderComparison(left, right) {
    const profiles = $("#compareProfiles");
    const body = $("#comparisonBody");
    if (!left || !right || !profiles || !body) return;

    profiles.innerHTML = [left, right].map((group, index) => `
      <article class="surface compare-profile">
        <small>${tr(index === 0 ? "Group A" : "Group B")}</small>
        <h2>${groupNameMarkup(group)}</h2>
        <p><i class="bi bi-geo-alt me-1"></i>${escapeHtml(displayValue(group.Country))} · ${escapeHtml(displayValue(group.Region))}</p>
      </article>`).join("");

    const categories = [
      ["Geography & group", ["Country", "Continent", "Region", "Population", "Any_TPI"]],
      ["Leadership", ["King", "Chief", "Headman", "KingInher", "KingElect", "KingApp"]],
      ["Functions", ["Func_Land", "Func_DR", "Func_Sec", "Func_Heal"]],
      ["Administrative structure", ["CouncilD", "Assembly", "FormAckn"]]
    ];

    body.innerHTML = categories.map(([category, fields]) => {
      const rows = fields.map((field) => {
        const leftValue = comparisonValue(field, left[field]);
        const rightValue = comparisonValue(field, right[field]);
        const differentClass = leftValue !== rightValue ? "is-different" : "";
        return `<tr><td>${escapeHtml(tr(FIELD_LABELS[field]))}</td><td class="${differentClass}">${comparisonBadge(field, left[field])}</td><td class="${differentClass}">${comparisonBadge(field, right[field])}</td></tr>`;
      }).join("");
      return `<tr class="category-row"><td colspan="3">${escapeHtml(tr(category))}</td></tr>${rows}`;
    }).join("");
  }

  function comparisonValue(field, value) {
    if (field === "Population") return formatPopulation(value);
    if (BINARY_FIELDS.includes(field)) return displayBinary(value);
    return displayValue(value);
  }

  function comparisonBadge(field, value) {
    if (BINARY_FIELDS.includes(field)) return binaryBadge(value);
    return escapeHtml(comparisonValue(field, value));
  }

  function initStatisticsPage() {
    if (!$("#leadershipChart")) return;
    const leadershipData = {
      [tr("King")]: state.leadership?.King ?? 0,
      [tr("Chief")]: state.leadership?.Chief ?? 0,
      [tr("Headman")]: state.leadership?.Headman ?? 0
    };
    const functionData = {
      [tr("Land management")]: state.stats?.totalFuncLand ?? 0,
      [tr("Security")]: state.stats?.totalFuncSec ?? 0,
      [tr("Healing / healthcare")]: state.stats?.totalFuncHeal ?? 0
    };
    const recognitionData = {
      [tr("Recognized")]: state.stats?.totalRecognized ?? 0,
      [tr("Not recognized")]: state.stats?.totalNotRecognized ?? 0,
      [tr("Not available")]: state.stats?.totalRecognitionMissing ?? 0
    };
    const continentData = Object.fromEntries(
      state.continents.map((item) => [tr(item.continent), item.totalGroups])
    );
    const largestGroupsData = Object.fromEntries(
      state.largestGroups.map((group) => [
        `${isolatedGroupNameText(group)} · ${displayValue(group.Country)}`,
        group.Population ?? 0
      ])
    );
    const topCountriesData = Object.fromEntries(
      state.topCountries.map((country) => [displayValue(country.Country), country.TotalGroups])
    );

    if (window.Chart) {
      window.Chart.defaults.font.family = '"Inter", "Segoe UI", sans-serif';
      window.Chart.defaults.color = window.SitePreferences?.getTheme() === "dark" ? "#c5cec8" : "#66736b";
      renderChart("leadershipChart", "doughnut", leadershipData, ["#123524", "#c8a96a", "#6d8b78"]);
      renderChart("functionsChart", "bar", functionData, ["#123524", "#2f6b4d", "#c8a96a", "#d7c69f"]);
      renderChart("recognitionChart", "doughnut", recognitionData, ["#287a50", "#b74c45", "#b5bbb7"]);
      renderChart("continentsChart", "doughnut", continentData, ["#123524", "#2f6b4d", "#6d8b78", "#c8a96a", "#d7c69f"]);
      renderChart("largestGroupsChart", "bar", largestGroupsData, "#2f6b4d", { horizontal: true });
      renderChart("topCountriesChart", "bar", topCountriesData, "#123524", {
        horizontal: true,
        datasetLabel: tr("Number of traditional groups"),
        tooltipLabel: tr("Number of traditional groups")
      });
    } else {
      renderChartFallback("leadershipChart", leadershipData);
      renderChartFallback("functionsChart", functionData);
      renderChartFallback("recognitionChart", recognitionData);
      renderChartFallback("continentsChart", continentData);
      renderChartFallback("largestGroupsChart", largestGroupsData);
      renderChartFallback("topCountriesChart", topCountriesData);
    }
  }

  function renderChart(id, type, values, colors, settings = {}) {
    const canvas = $(`#${id}`);
    if (!canvas) return;
    new window.Chart(canvas, {
      type,
      data: {
        labels: Object.keys(values),
        datasets: [{
          label: settings.datasetLabel || "",
          data: Object.values(values),
          backgroundColor: colors,
          borderColor: window.SitePreferences?.getTheme() === "dark" ? "#17231d" : "#ffffff",
          borderWidth: 3,
          borderRadius: type === "bar" ? 8 : 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: settings.horizontal ? "y" : "x",
        cutout: type === "doughnut" ? "66%" : undefined,
        plugins: {
          legend: { display: type !== "bar", position: "bottom", labels: { usePointStyle: true, padding: 18, boxWidth: 8 } },
          tooltip: {
            backgroundColor: "#081c13",
            padding: 11,
            cornerRadius: 8,
            callbacks: settings.tooltipLabel
              ? {
                  label(context) {
                    const value = settings.horizontal ? context.parsed.x : context.parsed.y;
                    return `${settings.tooltipLabel}: ${Number(value).toLocaleString(isArabic() ? "ar" : "en")}`;
                  }
                }
              : undefined
          }
        },
        scales: type === "bar"
          ? settings.horizontal
            ? {
                x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: window.SitePreferences?.getTheme() === "dark" ? "#334139" : "#edf0ec" } },
                y: { grid: { display: false }, ticks: { autoSkip: false } }
              }
            : {
                x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false } },
                y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: window.SitePreferences?.getTheme() === "dark" ? "#334139" : "#edf0ec" } }
              }
          : undefined
      }
    });
  }

  function renderChartFallback(id, values) {
    const canvas = $(`#${id}`);
    if (!canvas) return;
    const max = Math.max(...Object.values(values), 1);
    const fallback = document.createElement("div");
    fallback.className = "chart-fallback";
    fallback.innerHTML = Object.entries(values).map(([label, value]) => `
      <div class="fallback-bar"><span>${escapeHtml(label)}</span><div class="fallback-track"><span style="width:${(value / max) * 100}%"></span></div><strong>${value}</strong></div>`).join("");
    canvas.replaceWith(fallback);
  }

  function initContactForm() {
    const form = $("#contactForm");
    const status = $("#formStatus");
    const submitButton = $("#contactSubmit");
    const submitLabel = $("#contactSubmitLabel");
    if (!form) return;

    let isSubmitting = false;
    const successMessage = "Your message has been sent successfully.";
    const failureMessage = "We could not send your message. Please try again later.";

    const hideStatus = () => {
      if (!status) return;
      status.textContent = "";
      status.classList.remove("is-visible", "is-error");
      status.setAttribute("role", "status");
    };

    const showStatus = (message, isError = false) => {
      if (!status) return;
      status.textContent = tr(message);
      status.classList.toggle("is-error", isError);
      status.classList.add("is-visible");
      status.setAttribute("role", isError ? "alert" : "status");
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (isSubmitting) return;

      hideStatus();
      form.classList.add("was-validated");
      if (!form.checkValidity()) return;

      isSubmitting = true;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
      }
      if (submitLabel) submitLabel.textContent = tr("Sending...");

      const formData = new FormData(form);
      const payload = {
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        subject: String(formData.get("subject") || "").trim(),
        message: String(formData.get("message") || "").trim()
      };

      try {
        const response = await fetch(`${API_BASE_URL}/contact`, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        let result = null;
        try {
          result = await response.json();
        } catch {
          result = null;
        }

        if (!response.ok || result?.success !== true) {
          showStatus(result?.message || failureMessage, true);
          return;
        }

        showStatus(result.message || successMessage);
        form.reset();
        form.classList.remove("was-validated");
      } catch (error) {
        console.error("Contact form request failed.", error);
        showStatus(failureMessage, true);
      } finally {
        isSubmitting = false;
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.removeAttribute("aria-busy");
        }
        if (submitLabel) submitLabel.textContent = tr("Send Message");
      }
    });
  }

  function initHomeSubscribe() {
    const form = $("#homeSubscribeForm");
    const status = $("#homeSubscribeStatus");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (status) {
        status.textContent = tr("Thank you. Your email was captured in this demonstration.");
      }
      form.reset();
    });
  }

  function uniqueValues(field) {
    return [...new Set(state.groups.map((group) => group[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  }

  function leadershipBadges(group) {
    const types = ["King", "Chief", "Headman"].filter((field) => group[field] === 1);
    if (!types.length) return `<span class="badge-neutral">${tr("Not Available")}</span>`;
    return types.map((type) => `<span class="leadership-badge">${tr(type)}</span>`).join(" ");
  }

  function binaryBadge(value) {
    if (value === 1) return `<span class="badge-yes"><i class="bi bi-check-circle-fill"></i>${tr("Yes")}</span>`;
    if (value === 0) return `<span class="badge-no"><i class="bi bi-x-circle-fill"></i>${tr("No")}</span>`;
    return `<span class="badge-neutral">${tr("Not Available")}</span>`;
  }

  function displayBinary(value) {
    if (value === 1) return tr("Yes");
    if (value === 0) return tr("No");
    return tr("Not Available");
  }

  function displayValue(value) {
    return value === null || value === undefined || value === "" ? tr("Not Available") : tr(String(value));
  }

  function formatPopulation(value) {
    return value === null || value === undefined ? tr("Not Available") : Number(value).toLocaleString(isArabic() ? "ar" : "en");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showDataError() {
    const message = tr("Could not load data. Please try again later.");
    const tableTargets = [$("#groupsTableBody"), $("#latestGroupsBody")].filter(Boolean);

    tableTargets.forEach((target) => {
      target.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="bi bi-exclamation-triangle-fill d-block fs-2 mb-2"></i>${escapeHtml(message)}</td></tr>`;
    });

    if ($("#resultsCount")) $("#resultsCount").textContent = message;
    if ($("#comparisonBody")) $("#comparisonBody").innerHTML = `<tr><td colspan="3" class="empty-state">${escapeHtml(message)}</td></tr>`;
    [$("#compareLeft"), $("#compareRight")].filter(Boolean).forEach((select) => {
      select.innerHTML = `<option>${escapeHtml(tr("Data unavailable"))}</option>`;
      select.disabled = true;
    });

    $$("[data-counter]").forEach((counter) => {
      counter.textContent = "—";
      counter.removeAttribute("data-target");
    });
    $$(".home-map-marker[data-continent]").forEach((marker) => {
      marker.textContent = "—";
      updateMapMarkerLabel(marker);
    });
    $$(".chart-wrap canvas").forEach((canvas) => {
      const fallback = document.createElement("div");
      fallback.className = "empty-state h-100 d-grid align-content-center";
      fallback.textContent = message;
      canvas.replaceWith(fallback);
    });
  }
})();
