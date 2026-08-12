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
    statistics: {
      data: null,
      scopeType: "all",
      scopeValue: "",
      requestController: null,
      charts: new Map()
    },
    statisticalAnalysis: {
      data: null,
      currentVariable: "king",
      chart: null
    },
    leadershipFunctionsAnalysis: {
      data: null,
      chart: null
    },
    groupSizeRecognitionAnalysis: {
      data: null,
      boxPlot: null,
      histogram: null
    },
    groupSizeFunctionsAnalysis: {
      data: null,
      charts: new Map()
    },
    continentLeadershipAnalysis: {
      data: null,
      groupedChart: null,
      stackedChart: null
    },
    continentRecognitionAnalysis: {
      data: null,
      stackedChart: null
    },
    regionRecognitionAnalysis: {
      data: null,
      stackedChart: null
    },
    dynamicAnalysisEngine: {
      data: null,
      primaryChart: null,
      secondaryChart: null,
      requestController: null
    },
    comparison: {
      type: "country",
      options: [],
      data: null,
      requestController: null,
      charts: new Map()
    },
    explorerRequestController: null
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const tr = (value, variables) => window.SiteI18n?.t(value, variables) ?? String(value ?? "");
  const isArabic = () => (window.SitePreferences?.getLanguage() || document.documentElement.lang) === "ar";

  function resolveApiBaseUrl() {
    const localApiUrl = ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? `http://${window.location.hostname}:3000/api`
      : null;
    const configuredUrl =
      window.TRADGOV_CONFIG?.apiBaseUrl ||
      window.TRADGOV_API_BASE_URL ||
      localApiUrl ||
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
        await initComparison();
        return;
      }

      if (page === "statistics") {
        const [countries, continents, regions] = await Promise.all([
          loadApiData("countries"),
          loadApiData("continents"),
          loadApiData("regions")
        ]);
        state.filterOptions = {
          countries: summaryValues(countries, "country"),
          continents: summaryValues(continents, "continent"),
          regions: summaryValues(regions, "region")
        };
        await initStatisticsPage();
        return;
      }

      if (page === "statistics-analysis") {
        await initStatisticalAnalysisPage();
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

  function normalizeStatisticsResponse(data) {
    const summary = data?.summary || {};
    const recognition = data?.recognition || {};
    const leadership = data?.leadership || {};
    const functions = data?.functions || {};
    const leadershipSelection = data?.leadership_selection || {};
    const geographic = data?.geographic_distribution || {};
    return {
      scope: {
        type: cleanValue(data?.scope?.type) || "all",
        value: cleanValue(data?.scope?.value),
        label: cleanValue(data?.scope?.label) || "All Data"
      },
      summary: {
        totalGroups: toNumber(summary.total_groups) ?? 0,
        totalCountries: toNumber(summary.total_countries) ?? 0,
        totalContinents: toNumber(summary.total_continents) ?? 0,
        totalRegions: toNumber(summary.total_regions) ?? 0,
        groupsWithTpi: toNumber(summary.groups_with_tpi) ?? 0
      },
      recognition: {
        recognized: toNumber(recognition.recognized) ?? 0,
        notRecognized: toNumber(recognition.not_recognized) ?? 0,
        missing: toNumber(recognition.missing) ?? 0
      },
      leadership: {
        King: toNumber(leadership.king) ?? 0,
        Chief: toNumber(leadership.chief) ?? 0,
        Headman: toNumber(leadership.headman) ?? 0
      },
      leadershipSelection: {
       hereditary: toNumber(leadershipSelection.hereditary) ?? 0,
       elected: toNumber(leadershipSelection.elected) ?? 0,
        appointed: toNumber(leadershipSelection.appointed) ?? 0,
        missing: toNumber(leadershipSelection.missing) ?? 0
      },
      functions: {
        land: toNumber(functions.land) ?? 0,
        security: toNumber(functions.security) ?? 0,
        healing: toNumber(functions.healing) ?? 0
      },
      geographic: {
        type: cleanValue(geographic.type),
        items: Array.isArray(geographic.items)
          ? geographic.items.map((item) => ({
              label: cleanValue(item.label),
              totalGroups: toNumber(item.total_groups) ?? 0
            })).filter((item) => item.label)
          : []
      },
      largestGroups: Array.isArray(data?.largest_groups)
        ? data.largest_groups.map(normalizeLargestGroup)
        : [],
      topCountries: Array.isArray(data?.top_countries)
        ? data.top_countries.map(normalizeTopCountry)
        : []
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

  async function initComparison() {
    const form = $("#comparisonForm");
    const typeSelect = $("#comparisonType");
    const leftSelect = $("#compareLeft");
    const rightSelect = $("#compareRight");
    if (!form || !typeSelect || !leftSelect || !rightSelect) return;

    if (window.Chart) {
      window.Chart.defaults.font.family = '"Inter", "Segoe UI", sans-serif';
      window.Chart.defaults.color =
        window.SitePreferences?.getTheme() === "dark" ? "#c5cec8" : "#66736b";
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      requestGeographicComparison();
    });
    typeSelect.addEventListener("change", () => {
      state.comparison.type = typeSelect.value;
      loadComparisonOptions();
    });
    $("#swapEntities")?.addEventListener("click", () => {
      const current = leftSelect.value;
      leftSelect.value = rightSelect.value;
      rightSelect.value = current;
      requestGeographicComparison();
    });

    state.comparison.type = typeSelect.value;
    await loadComparisonOptions();
  }

  async function loadComparisonOptions() {
    const typeSelect = $("#comparisonType");
    const leftSelect = $("#compareLeft");
    const rightSelect = $("#compareRight");
    if (!typeSelect || !leftSelect || !rightSelect) return;

    state.comparison.requestController?.abort();
    const controller = new AbortController();
    state.comparison.requestController = controller;
    state.comparison.type = typeSelect.value;
    const loadingOption = `<option value="">${escapeHtml(tr("Loading options…"))}</option>`;
    leftSelect.innerHTML = loadingOption;
    rightSelect.innerHTML = loadingOption;
    leftSelect.disabled = true;
    rightSelect.disabled = true;
    setComparisonStatus(tr("Loading geographic options…"));
    setComparisonBusy(true);

    try {
      const params = new URLSearchParams({ type: state.comparison.type });
      const data = await loadApiData(`comparison/options?${params}`, {
        signal: controller.signal
      });
      if (controller.signal.aborted) return;
      const options = Array.isArray(data?.options)
        ? data.options.filter((value) => value !== null && String(value).trim() !== "")
        : [];
      if (options.length < 2) {
        throw new Error(tr("At least two geographic entities are required for comparison."));
      }

      state.comparison.options = options.map(String);
      populateComparisonSelect(leftSelect, state.comparison.options);
      populateComparisonSelect(rightSelect, state.comparison.options);
      leftSelect.value = state.comparison.options[0];
      rightSelect.value = state.comparison.options[1];
      leftSelect.disabled = false;
      rightSelect.disabled = false;
      await requestGeographicComparison();
    } catch (error) {
      if (error?.name === "AbortError") return;
      showComparisonError(error);
    } finally {
      if (state.comparison.requestController === controller) {
        setComparisonBusy(false);
      }
    }
  }

 function populateComparisonSelect(select, options) {
  select.innerHTML = options.map((value) => (
    `<option value="${escapeHtml(value)}">${escapeHtml(tr(value))}</option>`
  )).join("");
}

  async function requestGeographicComparison() {
    const leftSelect = $("#compareLeft");
    const rightSelect = $("#compareRight");
    if (!leftSelect || !rightSelect) return;

    const entityA = leftSelect.value;
    const entityB = rightSelect.value;
    if (!entityA || !entityB) {
      showComparisonError(new Error(tr("Select both geographic entities.")));
      return;
    }
    if (entityA === entityB) {
      showComparisonError(new Error(tr("Select two different entities.")));
      return;
    }

    state.comparison.requestController?.abort();
    const controller = new AbortController();
    state.comparison.requestController = controller;
    setComparisonBusy(true);
    setComparisonStatus(tr("Loading comparison…"));
    const body = $("#comparisonBody");
    if (body) {
      body.innerHTML = `<tr><td colspan="3" class="empty-state">${escapeHtml(tr("Loading comparison…"))}</td></tr>`;
    }

    try {
      const params = new URLSearchParams({
        type: state.comparison.type,
        entity_a: entityA,
        entity_b: entityB
      });
      const data = await loadApiData(`comparison?${params}`, {
        signal: controller.signal
      });
      if (controller.signal.aborted) return;
      if (!Array.isArray(data?.profiles) || data.profiles.length !== 2 || !data?.charts) {
        throw new Error(tr("The comparison service returned an unexpected response."));
      }
      state.comparison.data = data;
      renderGeographicComparison(data);
      setComparisonStatus(tr("Comparison updated."));
    } catch (error) {
      if (error?.name === "AbortError") return;
      showComparisonError(error);
    } finally {
      if (state.comparison.requestController === controller) {
        setComparisonBusy(false);
      }
    }
  }

  function setComparisonBusy(isBusy) {
    const button = $("#compareButton");
    if (!button) return;
    button.disabled = isBusy;
    button.setAttribute("aria-busy", String(isBusy));
    const label = $("span", button);
    if (label) label.textContent = tr(isBusy ? "Comparing…" : "Compare");
  }

  function setComparisonStatus(message, isError = false) {
    const status = $("#compareStatus");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", isError);
  }

  function showComparisonError(error) {
    const message = error?.message || tr("Unable to load comparison data.");
    setComparisonStatus(message, true);
    const body = $("#comparisonBody");
    if (body) {
      body.innerHTML = `<tr><td colspan="3" class="empty-state">${escapeHtml(message)}</td></tr>`;
    }
  }

  function renderGeographicComparison(data) {
    renderComparisonHighlights(data.profiles);
    renderComparisonProfiles(data.profiles);
    renderComparisonTable(data.profiles, data.comparison_type);
    renderComparisonCharts(data.charts);
  }

  function comparisonNumber(value, maximumFractionDigits = 0) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return tr("Not Available");
    }
    return Number(value).toLocaleString(isArabic() ? "ar" : "en", {
      maximumFractionDigits
    });
  }

  function comparisonPercent(value) {
    return value === null || value === undefined
      ? tr("Not Available")
      : `${comparisonNumber(value, 1)}%`;
  }

  function comparisonTypeLabel(type) {
    return tr(type === "continent" ? "Continent" : type === "region" ? "Region" : "Country");
  }

  function largestGroupMarkup(group) {
    if (!group) return escapeHtml(tr("Not Available"));
    const usesArabicName = isArabic() && group.group_name_ar;
    const name = usesArabicName ? group.group_name_ar : group.group_name;
    if (!name) return escapeHtml(tr("Not Available"));
    return `<bdi dir="${usesArabicName ? "rtl" : "ltr"}" class="group-name-bidi">${escapeHtml(name)}</bdi>`;
  }

  function renderComparisonHighlights(profiles) {
    const container = $("#comparisonHighlights");
    if (!container) return;
    const cards = [
      ["bi-people-fill", "Total traditional groups", "general", "total_groups", false],
      ["bi-bank2", "Groups with TPI", "general", "groups_with_tpi", false],
      ["bi-patch-check-fill", "Recognition rate", "recognition", "rate", true],
      ["bi-bar-chart-fill", "Average group size", "population", "average_group_size", false]
    ];
    container.innerHTML = cards.map(([icon, label, section, key, isPercent]) => `
      <article class="surface comparison-highlight-card">
        <div class="comparison-highlight-heading"><i class="bi ${icon}" aria-hidden="true"></i><span>${escapeHtml(tr(label))}</span></div>
        <div class="comparison-highlight-values">
          ${profiles.map((profile) => `<div><small>${escapeHtml(profile.name)}</small><strong>${escapeHtml(isPercent ? comparisonPercent(profile[section][key]) : comparisonNumber(profile[section][key], key === "average_group_size" ? 1 : 0))}</strong></div>`).join("")}
        </div>
      </article>`).join("");
  }

  function comparisonDistribution(items, total) {
    return items.map(([label, value]) => {
      const percentage = total > 0 ? Math.min(100, (Number(value) / total) * 100) : 0;
      return `<li><span>${escapeHtml(tr(label))}</span><strong>${escapeHtml(comparisonNumber(value))}</strong><div class="comparison-mini-track" aria-hidden="true"><span style="width:${percentage.toFixed(2)}%"></span></div></li>`;
    }).join("");
  }

  function renderComparisonProfiles(profiles) {
    const container = $("#compareProfiles");
    if (!container) return;
    container.innerHTML = profiles.map((profile, index) => {
      const total = Number(profile.general?.total_groups) || 0;
      const largest = profile.population?.largest_group;
      return `
        <article class="surface compare-profile">
          <small>${escapeHtml(tr(index === 0 ? "Entity A" : "Entity B"))} · ${escapeHtml(comparisonTypeLabel(profile.type))}</small>
          <h2><bdi>${escapeHtml(profile.name)}</bdi></h2>
          <div class="comparison-profile-summary">
            <div><span>${escapeHtml(tr("Traditional groups"))}</span><strong>${escapeHtml(comparisonNumber(total))}</strong></div>
            <div><span>${escapeHtml(tr("Recognition rate"))}</span><strong>${escapeHtml(comparisonPercent(profile.recognition?.rate))}</strong></div>
            ${profile.general?.total_countries === null ? "" : `<div><span>${escapeHtml(tr("Countries represented"))}</span><strong>${escapeHtml(comparisonNumber(profile.general.total_countries))}</strong></div>`}
            <div><span>${escapeHtml(tr("Largest traditional group"))}</span><strong>${largestGroupMarkup(largest)}</strong></div>
            <div><span>${escapeHtml(tr("Average group size"))}</span><strong>${escapeHtml(comparisonNumber(profile.population?.average_group_size, 1))}</strong></div>
            <div><span>${escapeHtml(tr("Median group size"))}</span><strong>${escapeHtml(comparisonNumber(profile.population?.median_group_size, 1))}</strong></div>
          </div>
          <div class="comparison-distribution-grid">
            <section><h3>${escapeHtml(tr("Leadership distribution"))}</h3><ul>${comparisonDistribution([["Kings", profile.leadership?.king], ["Chiefs", profile.leadership?.chief], ["Headmen", profile.leadership?.headman]], total)}</ul></section>
            <section><h3>${escapeHtml(tr("Function distribution"))}</h3><ul>${comparisonDistribution([["Land Administration", profile.functions?.land], ["Security", profile.functions?.security], ["Healing", profile.functions?.healing]], total)}</ul></section>
          </div>
        </article>`;
    }).join("");
  }

  function comparisonPath(profile, path) {
    return path.split(".").reduce((value, key) => value?.[key], profile);
  }

  function renderComparisonTable(profiles, comparisonType) {
    const body = $("#comparisonBody");
    const leftHeader = $("#comparisonEntityAHeader");
    const rightHeader = $("#comparisonEntityBHeader");
    if (!body || profiles.length !== 2) return;
    if (leftHeader) leftHeader.textContent = profiles[0].name;
    if (rightHeader) rightHeader.textContent = profiles[1].name;

    const categories = [
      ["General", [
        ["Total traditional groups", "general.total_groups", "number"],
        ...(comparisonType === "country" ? [] : [["Countries represented", "general.total_countries", "number"]]),
        ["Groups with TPI", "general.groups_with_tpi", "number"]
      ]],
      ["Leadership", [
        ["Kings", "leadership.king", "number"],
        ["Chiefs", "leadership.chief", "number"],
        ["Headmen", "leadership.headman", "number"]
      ]],
      ["Leadership Selection", [
        ["Hereditary", "leadership_selection.hereditary", "number"],
        ["Elected", "leadership_selection.elected", "number"],
        ["Appointed", "leadership_selection.appointed", "number"],
        ["Missing", "leadership_selection.missing", "number"]
      ]],
      ["Formal Recognition", [
        ["Recognized", "recognition.recognized", "number"],
        ["Not Recognized", "recognition.not_recognized", "number"],
        ["Missing", "recognition.missing", "number"],
        ["Recognition rate", "recognition.rate", "percent"]
      ]],
      ["Traditional Governance Functions", [
        ["Land Administration", "functions.land", "number"],
        ["Security", "functions.security", "number"],
        ["Healing", "functions.healing", "number"]
      ]],
      ["Population", [
        ["Average group size", "population.average_group_size", "decimal"],
        ["Median group size", "population.median_group_size", "decimal"],
        ["Largest traditional group", "population.largest_group", "group"],
        ["Largest population", "population.largest_population", "number"]
      ]]
    ];

    body.innerHTML = categories.map(([category, fields]) => {
      const rows = fields.map(([label, path, format]) => {
        const rawLeft = comparisonPath(profiles[0], path);
        const rawRight = comparisonPath(profiles[1], path);
        const formatValue = (value) => {
          if (format === "percent") return escapeHtml(comparisonPercent(value));
          if (format === "decimal") return escapeHtml(comparisonNumber(value, 1));
          if (format === "group") return largestGroupMarkup(value);
          return escapeHtml(comparisonNumber(value));
        };
        const leftValue = formatValue(rawLeft);
        const rightValue = formatValue(rawRight);
        const differentClass = JSON.stringify(rawLeft) !== JSON.stringify(rawRight) ? "is-different" : "";
        return `<tr><td>${escapeHtml(tr(label))}</td><td class="${differentClass}">${leftValue}</td><td class="${differentClass}">${rightValue}</td></tr>`;
      }).join("");
      return `<tr class="category-row"><td colspan="3">${escapeHtml(tr(category))}</td></tr>${rows}`;
    }).join("");
  }

  function comparisonChartColors() {
    const dark = window.SitePreferences?.getTheme() === "dark";
    return {
      green: "#0b5137",
      greenSoft: "rgba(11, 81, 55, 0.22)",
      gold: "#c8a96a",
      goldSoft: "rgba(200, 169, 106, 0.24)",
      sage: "#70947c",
      red: "#b85c52",
      gray: dark ? "#758078" : "#a7aea9",
      grid: dark ? "#334139" : "#edf0ec",
      text: dark ? "#c5cec8" : "#66736b"
    };
  }

  function upsertComparisonChart(id, type, data, options) {
    const canvas = $(`#${id}`);
    if (!canvas || !window.Chart) return;
    const existing = state.comparison.charts.get(id);
    if (existing && existing.config.type === type) {
      existing.data = data;
      existing.options = options;
      existing.update();
      return;
    }
    existing?.destroy();
    state.comparison.charts.set(id, new window.Chart(canvas, { type, data, options }));
  }

  function comparisonChartOptions(colors, extra = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 450 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          rtl: isArabic(),
          labels: { color: colors.text, usePointStyle: true, padding: 18 }
        },
        tooltip: {
          rtl: isArabic(),
          backgroundColor: "#081c13",
          padding: 11,
          cornerRadius: 8
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: colors.text } },
        y: { beginAtZero: true, grid: { color: colors.grid }, ticks: { color: colors.text } }
      },
      ...extra
    };
  }

  function renderComparisonCharts(charts) {
    const colors = comparisonChartColors();
    const leadership = charts.leadership || {};
    upsertComparisonChart("comparisonLeadershipChart", "bar", {
      labels: leadership.labels || [],
      datasets: [
        { label: tr("Kings"), data: leadership.king || [], backgroundColor: colors.gold, borderRadius: 6 },
        { label: tr("Chiefs"), data: leadership.chief || [], backgroundColor: colors.green, borderRadius: 6 },
        { label: tr("Headmen"), data: leadership.headman || [], backgroundColor: colors.sage, borderRadius: 6 }
      ]
    }, comparisonChartOptions(colors));

    const recognition = charts.recognition || {};
    const stackedOptions = comparisonChartOptions(colors);
    stackedOptions.scales.x.stacked = true;
    stackedOptions.scales.y.stacked = true;
    upsertComparisonChart("comparisonRecognitionChart", "bar", {
      labels: recognition.labels || [],
      datasets: [
        { label: tr("Recognized"), data: recognition.recognized || [], backgroundColor: colors.green, borderRadius: 5 },
        { label: tr("Not Recognized"), data: recognition.not_recognized || [], backgroundColor: colors.gold, borderRadius: 5 },
        { label: tr("Missing"), data: recognition.missing || [], backgroundColor: colors.gray, borderRadius: 5 }
      ]
    }, stackedOptions);

    const functions = charts.functions || {};
    upsertComparisonChart("comparisonFunctionsChart", "bar", {
      labels: functions.labels || [],
      datasets: [
        { label: tr("Land Administration"), data: functions.land || [], backgroundColor: colors.green, borderRadius: 6 },
        { label: tr("Security"), data: functions.security || [], backgroundColor: colors.gold, borderRadius: 6 },
        { label: tr("Healing"), data: functions.healing || [], backgroundColor: colors.sage, borderRadius: 6 }
      ]
    }, comparisonChartOptions(colors));

    const radar = charts.radar || {};
    const radarDatasets = (radar.datasets || []).map((dataset, index) => ({
      label: dataset.entity,
      data: dataset.values,
      borderColor: index === 0 ? colors.green : colors.gold,
      backgroundColor: index === 0 ? colors.greenSoft : colors.goldSoft,
      pointBackgroundColor: index === 0 ? colors.green : colors.gold,
      borderWidth: 2
    }));
    upsertComparisonChart("comparisonRadarChart", "radar", {
      labels: (radar.labels || []).map((label) => tr(label)),
      datasets: radarDatasets
    }, {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 450 },
      plugins: {
        legend: { position: "bottom", rtl: isArabic(), labels: { color: colors.text, usePointStyle: true, padding: 18 } },
        tooltip: { rtl: isArabic(), backgroundColor: "#081c13", padding: 11, cornerRadius: 8, callbacks: { label: (context) => `${context.dataset.label}: ${comparisonNumber(context.raw, 1)}%` } }
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          grid: { color: colors.grid },
          angleLines: { color: colors.grid },
          pointLabels: { color: colors.text, font: { size: 11 } },
          ticks: { display: false }
        }
      }
    });
  }
  async function initStatisticsPage() {
    if (!$("#leadershipChart")) return;

    if (window.Chart) {
      window.Chart.defaults.font.family = '"Inter", "Segoe UI", sans-serif';
      window.Chart.defaults.color =
        window.SitePreferences?.getTheme() === "dark" ? "#c5cec8" : "#66736b";
    }

    const scopeSelect = $("#statisticsScope");
    const valueSelect = $("#statisticsValue");
    const resetButton = $("#resetStatisticsFilters");
    if (!scopeSelect || !valueSelect || !resetButton) return;

    const initialSelection = statisticsSelectionFromUrl();
    state.statistics.scopeType = initialSelection.scopeType;
    state.statistics.scopeValue = initialSelection.scopeValue;
    scopeSelect.value = initialSelection.scopeType;
    updateStatisticsValueControl(initialSelection.scopeType, initialSelection.scopeValue);

    scopeSelect.addEventListener("change", () => {
      const scopeType = scopeSelect.value;
      state.statistics.scopeType = scopeType;
      state.statistics.scopeValue = "";
      updateStatisticsValueControl(scopeType, "");
      updateStatisticsUrl(scopeType, "");
      if (scopeType === "all") {
        loadStatisticsScope("all", "");
      } else {
        setStatisticsStatus(tr(`Select ${scopeType}`));
        valueSelect.focus();
      }
    });

    valueSelect.addEventListener("change", () => {
      const scopeValue = valueSelect.value;
      if (!scopeValue) return;
      state.statistics.scopeValue = scopeValue;
      updateStatisticsUrl(state.statistics.scopeType, scopeValue);
      loadStatisticsScope(state.statistics.scopeType, scopeValue);
    });

    resetButton.addEventListener("click", () => {
      scopeSelect.value = "all";
      state.statistics.scopeType = "all";
      state.statistics.scopeValue = "";
      updateStatisticsValueControl("all", "");
      updateStatisticsUrl("all", "");
      loadStatisticsScope("all", "");
    });

    window.addEventListener("popstate", () => {
      const selection = statisticsSelectionFromUrl();
      scopeSelect.value = selection.scopeType;
      state.statistics.scopeType = selection.scopeType;
      state.statistics.scopeValue = selection.scopeValue;
      updateStatisticsValueControl(selection.scopeType, selection.scopeValue);
      loadStatisticsScope(selection.scopeType, selection.scopeValue);
    });

    await loadStatisticsScope(initialSelection.scopeType, initialSelection.scopeValue);
  }

  function statisticsOptionsFor(scopeType) {
    if (scopeType === "country") return state.filterOptions.countries;
    if (scopeType === "continent") return state.filterOptions.continents;
    if (scopeType === "region") return state.filterOptions.regions;
    return [];
  }

  function statisticsSelectionFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const scopeType = ["country", "continent", "region"].includes(params.get("scope"))
      ? params.get("scope")
      : "all";
    if (scopeType === "all") return { scopeType: "all", scopeValue: "" };

    const scopeValue = params.get("value") || "";
    if (!statisticsOptionsFor(scopeType).includes(scopeValue)) {
      updateStatisticsUrl("all", "");
      return { scopeType: "all", scopeValue: "" };
    }
    return { scopeType, scopeValue };
  }

  function updateStatisticsValueControl(scopeType, selectedValue) {
    const group = $("#statisticsValueGroup");
    const select = $("#statisticsValue");
    const label = $("#statisticsValueLabel");
    if (!group || !select || !label) return;

    if (scopeType === "all") {
      group.hidden = true;
      select.disabled = true;
      select.innerHTML = "";
      return;
    }

    const placeholder = tr(`Select ${scopeType}`);
    label.textContent = placeholder;
    select.setAttribute("aria-label", placeholder);
    select.innerHTML = "";
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = placeholder;
    select.appendChild(emptyOption);
    statisticsOptionsFor(scopeType).forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = tr(value);
      select.appendChild(option);
    });
    select.value = selectedValue;
    select.disabled = false;
    group.hidden = false;
  }

  function updateStatisticsUrl(scopeType, scopeValue) {
    const url = new URL(window.location.href);
    url.searchParams.delete("scope");
    url.searchParams.delete("value");
    if (scopeType !== "all" && scopeValue) {
      url.searchParams.set("scope", scopeType);
      url.searchParams.set("value", scopeValue);
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function loadStatisticsScope(scopeType, scopeValue) {
    if (scopeType !== "all" && !scopeValue) return;

    state.statistics.requestController?.abort();
    const requestController = new AbortController();
    state.statistics.requestController = requestController;
    setStatisticsLoading(true);

    const parameters = new URLSearchParams();
    if (scopeType !== "all") parameters.set(scopeType, scopeValue);
    const endpoint = `statistics${parameters.size ? `?${parameters.toString()}` : ""}`;

    try {
      const response = await loadApiData(endpoint, { signal: requestController.signal });
      if (state.statistics.requestController !== requestController) return;
      state.statistics.data = normalizeStatisticsResponse(response);
      state.statistics.scopeType = scopeType;
      state.statistics.scopeValue = scopeValue;
      renderStatisticsData();
      setStatisticsStatus("");
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Could not update statistics:", error);
      setStatisticsStatus(tr("Statistics could not be loaded. Please try again."), true);
    } finally {
      if (state.statistics.requestController === requestController) {
        setStatisticsLoading(false);
      }
    }
  }

  function setStatisticsLoading(isLoading) {
    const panel = $("#statisticsFilters");
    if (panel) panel.setAttribute("aria-busy", String(isLoading));
    if (isLoading) setStatisticsStatus(tr("Loading statistics..."));
  }

  function setStatisticsStatus(message, isError = false) {
    const status = $("#statisticsStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function statisticsScopeLabel(data) {
    if (data.scope.type === "all") return tr("All Data");
    const typeLabel = tr(
      data.scope.type.charAt(0).toUpperCase() + data.scope.type.slice(1)
    );
    return `${typeLabel}: ${tr(data.scope.value)}`;
  }

  function updateStatisticsCounter(metric, value) {
    $$(`[data-metric="${metric}"]`).forEach((element) => {
      element.dataset.target = String(value);
      element.dataset.animated = "true";
      element.textContent = Number(value).toLocaleString(isArabic() ? "ar" : "en");
    });
  }

  function updateStatisticsTitle(id, title, scopeLabel) {
    const element = $(`#${id}`);
    if (element) element.textContent = `${tr(title)} — ${scopeLabel}`;
  }

  function renderStatisticsData() {
    const data = state.statistics.data;
    if (!data) return;
    const scopeLabel = statisticsScopeLabel(data);

    const currentScope = $("#currentStatisticsScope");
    if (currentScope) currentScope.textContent = scopeLabel;

    updateStatisticsCounter("totalGroups", data.summary.totalGroups);
    updateStatisticsCounter("totalCountries", data.summary.totalCountries);
    updateStatisticsCounter("totalContinents", data.summary.totalContinents);
    updateStatisticsCounter("totalRegions", data.summary.totalRegions);
    updateStatisticsCounter("totalTraditional", data.summary.groupsWithTpi);
    updateStatisticsCounter("totalRecognized", data.recognition.recognized);

    updateStatisticsTitle("leadershipChartTitle", "Leadership Types", scopeLabel);
    updateStatisticsTitle(
    "leadershipSelectionChartTitle",
    "Leadership Selection Methods",
    scopeLabel
    );
    updateStatisticsTitle("functionsChartTitle", "Governance Functions", scopeLabel);
    updateStatisticsTitle("recognitionChartTitle", "Recognition", scopeLabel);
    updateStatisticsTitle("largestGroupsChartTitle", "Largest Groups", scopeLabel);
    updateStatisticsTitle("topCountriesChartTitle", "Top Countries", scopeLabel);

    const distributionTitle = {
      continent: "Continent Distribution",
      region: "Region Distribution",
      country: "Country Distribution"
    }[data.geographic.type] || "Geographic Distribution";
    updateStatisticsTitle("geographicChartTitle", distributionTitle, scopeLabel);

    const leadershipData = {
      [tr("King")]: data.leadership.King,
      [tr("Chief")]: data.leadership.Chief,
      [tr("Headman")]: data.leadership.Headman
    };
    const leadershipSelectionData = {
     [tr("Hereditary")]: data.leadershipSelection.hereditary,
     [tr("Election")]: data.leadershipSelection.elected,
      [tr("Appointment")]: data.leadershipSelection.appointed,
     [tr("Missing")]: data.leadershipSelection.missing
    };
    const functionData = {
      [tr("Land management")]: data.functions.land,
      [tr("Security")]: data.functions.security,
      [tr("Healing / healthcare")]: data.functions.healing
    };
    const recognitionData = {
      [tr("Recognized")]: data.recognition.recognized,
      [tr("Not Recognized")]: data.recognition.notRecognized,
      [tr("Missing")]: data.recognition.missing
    };
    const geographicData = Object.fromEntries(
      data.geographic.items.map((item) => [tr(item.label), item.totalGroups])
    );
    const largestGroupsData = Object.fromEntries(
      data.largestGroups.map((group) => [
        `${isolatedGroupNameText(group)} · ${displayValue(group.Country)}`,
        group.Population ?? 0
      ])
    );
    const topCountriesData = Object.fromEntries(
      data.topCountries.map((country) => [
        tr(displayValue(country.Country)),
        country.TotalGroups
      ])
    );

    renderStatisticsChart("leadershipChart", "doughnut", leadershipData, ["#123524", "#c8a96a", "#6d8b78"]);
    renderStatisticsChart("functionsChart", "bar", functionData, ["#123524", "#2f6b4d", "#c8a96a"]);
    renderStatisticsChart("recognitionChart", "doughnut", recognitionData, ["#287a50", "#b74c45", "#b5bbb7"]);
    renderStatisticsChart(
      "continentsChart",
      "doughnut",
      geographicData,
      ["#123524", "#2f6b4d", "#6d8b78", "#c8a96a", "#d7c69f"],
      {},
      data.geographic.type ? tr("No data available") : tr("Not applicable for this scope")
    );
    renderStatisticsChart(
      "largestGroupsChart",
      "bar",
      largestGroupsData,
      "#2f6b4d",
      { horizontal: true }
    );
    renderStatisticsChart(
     "leadershipSelectionChart",
     "bar",
     leadershipSelectionData,
     ["#123524", "#2f6b4d", "#c8a96a", "#b5bbb7"]
    );
    renderStatisticsChart(
      "topCountriesChart",
      "bar",
      topCountriesData,
      "#123524",
      {
        horizontal: true,
        datasetLabel: tr("Number of traditional groups"),
        tooltipLabel: tr("Number of traditional groups")
      },
      data.scope.type === "country"
        ? tr("Not applicable for this scope")
        : tr("No data available")
    );
  }

  function renderStatisticsChart(
    id,
    type,
    values,
    colors,
    settings = {},
    emptyMessage = tr("No data available")
  ) {
    const hasData =
      Object.keys(values).length > 0 &&
      Object.values(values).some((value) => Number(value) > 0);
    setChartEmptyState(id, hasData ? "" : emptyMessage);
    if (!hasData) return;

    if (window.Chart) {
      renderChart(id, type, values, colors, settings);
    } else if (!state.statistics.charts.has(id)) {
      renderChartFallback(id, values);
      state.statistics.charts.set(id, null);
    }
  }

  function setChartEmptyState(id, message) {
    const canvas = $(`#${id}`);
    const wrapper = canvas?.closest(".chart-wrap");
    if (!wrapper) return;
    wrapper.querySelector(".chart-empty-state")?.remove();
    wrapper.classList.toggle("has-empty-state", Boolean(message));
    if (!message) return;
    const emptyState = document.createElement("div");
    emptyState.className = "chart-empty-state";
    emptyState.textContent = message;
    wrapper.appendChild(emptyState);
  }

  function renderChart(id, type, values, colors, settings = {}) {
    const canvas = $(`#${id}`);
    if (!canvas) return;
    const chartData = {
      labels: Object.keys(values),
      datasets: [{
        label: settings.datasetLabel || "",
        data: Object.values(values),
        backgroundColor: colors,
        borderColor: window.SitePreferences?.getTheme() === "dark" ? "#17231d" : "#ffffff",
        borderWidth: 3,
        borderRadius: type === "bar" ? 8 : 0
      }]
    };
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: settings.horizontal ? "y" : "x",
      cutout: type === "doughnut" ? "66%" : undefined,
      plugins: {
        legend: {
          display: type !== "bar",
          position: "bottom",
          labels: { usePointStyle: true, padding: 18, boxWidth: 8 }
        },
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
    };
    const existingChart = state.statistics.charts.get(id);
    if (existingChart) {
      existingChart.data = chartData;
      existingChart.options = chartOptions;
      existingChart.update();
      return;
    }
    state.statistics.charts.set(
      id,
      new window.Chart(canvas, { type, data: chartData, options: chartOptions })
    );
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

  async function initStatisticalAnalysisPage() {
    const detail = $("#analysisDetail");
    if (!detail) return;

    setStatisticalAnalysisStatus(tr("Loading statistical analysis..."));
    detail.setAttribute("aria-busy", "true");
    const data = await loadApiData("statistical-analysis/leadership-recognition");
    if (!Array.isArray(data?.analyses) || data.analyses.length !== 3) {
      throw new Error("statistical-analysis: unexpected API response format");
    }

    state.statisticalAnalysis.data = data;
    renderStatisticalAnalysisSummary();
    renderStatisticalAnalysisResult(state.statisticalAnalysis.currentVariable);
    renderLeadershipRecognitionChart();
    renderRecognitionHeatmap();

    $$(".analysis-selector[data-analysis-variable]").forEach((button) => {
      button.addEventListener("click", () => {
        renderStatisticalAnalysisResult(button.dataset.analysisVariable);
      });
    });

    detail.setAttribute("aria-busy", "false");
    setStatisticalAnalysisStatus("");

    try {
      await initLeadershipFunctionsAnalysis();
    } catch (error) {
      console.error("Could not load leadership and governance-function analysis:", error);
      setLeadershipFunctionsStatus(tr("Could not load data. Please try again later."), true);
    }

    try {
      await initGroupSizeRecognitionAnalysis();
    } catch (error) {
      console.error("Could not load group-size and recognition analysis:", error);
      setPopulationAnalysisStatus(tr("Could not load data. Please try again later."), true);
    }

    try {
      await initGroupSizeFunctionsAnalysis();
    } catch (error) {
      console.error("Could not load group-size and governance-function analysis:", error);
      setGroupSizeFunctionsStatus(tr("Could not load data. Please try again later."), true);
    }

    try {
      await initContinentLeadershipAnalysis();
    } catch (error) {
      console.error("Could not load continent and leadership analysis:", error);
      setContinentLeadershipStatus(tr("Could not load data. Please try again later."), true);
    }

    try {
      await initContinentRecognitionAnalysis();
    } catch (error) {
      console.error("Could not load continent and recognition analysis:", error);
      setContinentRecognitionStatus(tr("Could not load data. Please try again later."), true);
    }

    try {
      await initRegionRecognitionAnalysis();
    } catch (error) {
      console.error("Could not load region and recognition analysis:", error);
      setRegionRecognitionStatus(tr("Could not load data. Please try again later."), true);
    }

    initDynamicAnalysisEngine();
  }

  function setStatisticalAnalysisStatus(message, isError = false) {
    const status = $("#analysisStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function analysisNumber(value, maximumFractionDigits = 3) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return tr("Not Available");
    }
    return Number(value).toLocaleString(isArabic() ? "ar" : "en", {
      minimumFractionDigits: 0,
      maximumFractionDigits
    });
  }

  function analysisPValue(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return tr("Not Available");
    }
    const numeric = Number(value);
    if (numeric < 0.001) return tr("< 0.001");
    return numeric.toLocaleString(isArabic() ? "ar" : "en", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    });
  }

  function renderStatisticalAnalysisSummary() {
    const data = state.statisticalAnalysis.data;
    if (!data) return;
    const quality = data.data_quality || {};
    const values = {
      analysisTotalRows: quality.total_rows,
      analysisRecognitionRows: quality.rows_with_recognition,
      analysisRecognitionMissing: quality.formal_recognition_missing
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $(`#${id}`);
      if (element) element.textContent = analysisNumber(value, 0);
    });
  }

  function currentStatisticalAnalysis(variable) {
    return state.statisticalAnalysis.data?.analyses.find(
      (analysis) => analysis.variable === variable
    );
  }

  function renderStatisticalAnalysisResult(variable) {
    const analysis = currentStatisticalAnalysis(variable);
    if (!analysis) return;
    state.statisticalAnalysis.currentVariable = variable;

    $$(".analysis-selector[data-analysis-variable]").forEach((button) => {
      const active = button.dataset.analysisVariable === variable;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    const title = $("#selectedAnalysisTitle");
    if (title) title.textContent = tr("{leadership} vs Formal Recognition", {
      leadership: tr(analysis.label)
    });

    const metricValues = {
      analysisChiSquare: analysisNumber(analysis.chi_square),
      analysisPValue: analysisPValue(analysis.p_value),
      analysisDegreesFreedom: analysisNumber(analysis.degrees_of_freedom, 0),
      analysisCramersV: analysisNumber(analysis.cramers_v),
      analysisSampleSize: analysisNumber(analysis.sample_size, 0)
    };
    Object.entries(metricValues).forEach(([id, value]) => {
      const element = $(`#${id}`);
      if (element) element.textContent = value;
    });

    const strength = analysis.effect_strength
      ? tr(analysis.effect_strength.charAt(0).toUpperCase() + analysis.effect_strength.slice(1))
      : tr("Not Available");
    const effectBadge = $("#analysisEffectBadge");
    if (effectBadge) {
      effectBadge.textContent = tr("{strength} effect", { strength });
      effectBadge.dataset.strength = analysis.effect_strength || "unavailable";
    }

    const interpretation = $("#analysisInterpretation");
    if (interpretation) interpretation.textContent = localizedAnalysisInterpretation(analysis);

    const missing = analysis.missing_values_excluded || {};
    const missingDetails = $("#analysisMissingDetails");
    if (missingDetails) {
      missingDetails.textContent = tr(
        "Formal recognition missing: {recognition}. Leadership variable missing: {leadership}. Total excluded from this test: {total}.",
        {
          recognition: analysisNumber(missing.formal_recognition, 0),
          leadership: analysisNumber(missing.leadership_variable, 0),
          total: analysisNumber(missing.total_excluded, 0)
        }
      );
    }

    renderFrequencyTable(
      "#observedFrequencyBody",
      analysis.contingency_table?.row_labels,
      analysis.contingency_table?.observed,
      false
    );
    renderFrequencyTable(
      "#expectedFrequencyBody",
      analysis.contingency_table?.row_labels,
      analysis.contingency_table?.expected,
      true
    );
  }

  function localizedAnalysisInterpretation(analysis) {
    if (analysis.p_value === null || analysis.cramers_v === null) {
      return tr(
        "The association could not be calculated because the valid observations do not contain enough variation."
      );
    }
    const leadership = tr(`${analysis.label} leadership`).toLowerCase();
    const significance = analysis.significant
      ? tr("There is a statistically significant association between {leadership} and formal state recognition (p < 0.05).", { leadership })
      : tr("There is no statistically significant association between {leadership} and formal state recognition (p ≥ 0.05).", { leadership });
    const strength = tr(
      analysis.effect_strength.charAt(0).toUpperCase() + analysis.effect_strength.slice(1)
    ).toLowerCase();
    return `${significance} ${tr("The effect size is {strength} (Cramer's V = {value}).", {
      strength,
      value: analysisNumber(analysis.cramers_v)
    })}`;
  }

  function renderFrequencyTable(selector, rowLabels, values, expected) {
    const body = $(selector);
    if (!body) return;
    body.innerHTML = "";
    if (!Array.isArray(rowLabels) || !Array.isArray(values) || values.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 3;
      cell.className = "empty-state";
      cell.textContent = tr("Not Available");
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }

    values.forEach((rowValues, index) => {
      const row = document.createElement("tr");
      const labelCell = document.createElement("th");
      labelCell.scope = "row";
      labelCell.textContent = tr(rowLabels[index]);
      row.appendChild(labelCell);
      rowValues.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = analysisNumber(value, expected ? 2 : 0);
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
  }

  function renderLeadershipRecognitionChart() {
    const canvas = $("#leadershipRecognitionChart");
    const items = state.statisticalAnalysis.data?.charts?.stacked_bar?.items;
    if (!canvas || !Array.isArray(items) || !window.Chart) return;
    const chartData = {
      labels: items.map((item) => tr(item.label)),
      datasets: [
        { label: tr("Recognized"), data: items.map((item) => item.recognized), backgroundColor: "#287a50" },
        { label: tr("Not Recognized"), data: items.map((item) => item.not_recognized), backgroundColor: "#b74c45" },
        { label: tr("Missing"), data: items.map((item) => item.missing), backgroundColor: "#c8a96a" }
      ]
    };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, padding: 18, boxWidth: 8 } },
        tooltip: { backgroundColor: "#081c13", padding: 11, cornerRadius: 8 }
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: window.SitePreferences?.getTheme() === "dark" ? "#334139" : "#edf0ec" } }
      }
    };
    if (state.statisticalAnalysis.chart) {
      state.statisticalAnalysis.chart.data = chartData;
      state.statisticalAnalysis.chart.options = options;
      state.statisticalAnalysis.chart.update();
      return;
    }
    state.statisticalAnalysis.chart = new window.Chart(canvas, {
      type: "bar",
      data: chartData,
      options
    });
  }

  function renderRecognitionHeatmap() {
    const container = $("#recognitionHeatmap");
    const heatmap = state.statisticalAnalysis.data?.charts?.heatmap;
    if (!container || !Array.isArray(heatmap?.rows)) return;
    container.innerHTML = "";
    const cells = [
      { text: "", className: "heatmap-heading" },
      { text: tr("Recognized"), className: "heatmap-heading" },
      { text: tr("Not Recognized"), className: "heatmap-heading" }
    ];
    cells.forEach((item) => {
      const cell = document.createElement("div");
      cell.className = item.className;
      cell.textContent = item.text;
      cell.setAttribute("role", "columnheader");
      container.appendChild(cell);
    });

    heatmap.rows.forEach((row) => {
      const label = document.createElement("div");
      label.className = "heatmap-row-label";
      label.setAttribute("role", "rowheader");
      label.textContent = tr(row.label);
      container.appendChild(label);
      [
        [row.recognized_percentage, "recognized"],
        [row.not_recognized_percentage, "not-recognized"]
      ].forEach(([rawValue, type]) => {
        const value = Number(rawValue) || 0;
        const cell = document.createElement("div");
        cell.className = `heatmap-value ${value >= 50 ? "is-strong" : ""}`;
        cell.setAttribute("role", "cell");
        cell.style.backgroundColor = type === "recognized"
          ? `rgba(40, 122, 80, ${0.12 + value / 125})`
          : `rgba(183, 76, 69, ${0.12 + value / 125})`;
        cell.textContent = `${analysisNumber(value, 1)}%`;
        cell.setAttribute("aria-label", `${tr(row.label)}: ${type === "recognized" ? tr("Recognized") : tr("Not Recognized")} ${analysisNumber(value, 1)}%`);
        container.appendChild(cell);
      });
    });
  }

  async function initLeadershipFunctionsAnalysis() {
    const cards = $("#functionAnalysisCards");
    if (!cards) return;

    setLeadershipFunctionsStatus(tr("Loading leadership and function analysis..."));
    const data = await loadApiData("statistical-analysis/leadership-functions");
    if (!Array.isArray(data?.analyses) || data.analyses.length !== 9) {
      throw new Error("leadership-functions: unexpected API response format");
    }

    state.leadershipFunctionsAnalysis.data = data;
    const totalRows = $("#functionAnalysisTotalRows");
    if (totalRows) totalRows.textContent = analysisNumber(data.data_quality?.total_rows, 0);
    renderLeadershipFunctionsSummary();
    renderFunctionEffectHeatmap();
    renderSignificantFunctionChart();
    renderLeadershipFunctionCards();
    setLeadershipFunctionsStatus("");
  }

  function setLeadershipFunctionsStatus(message, isError = false) {
    const status = $("#functionAnalysisStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function analysisStrengthLabel(strength) {
    if (!strength) return tr("Not Available");
    const key = strength.replace(/\b\w/g, (character) => character.toUpperCase());
    return tr(key);
  }

  function renderLeadershipFunctionsSummary() {
    const body = $("#functionAnalysisSummaryBody");
    const summary = state.leadershipFunctionsAnalysis.data?.summary;
    if (!body || !Array.isArray(summary)) return;

    body.innerHTML = summary.map((result) => `
      <tr>
        <td><strong>${escapeHtml(tr(result.leadership_label))}</strong></td>
        <td>${escapeHtml(tr(result.function_label))}</td>
        <td><bdi dir="ltr">${escapeHtml(analysisNumber(result.chi_square))}</bdi></td>
        <td><bdi dir="ltr">${escapeHtml(analysisPValue(result.p_value))}</bdi></td>
        <td><bdi dir="ltr">${escapeHtml(analysisNumber(result.cramers_v))}</bdi></td>
        <td>${binaryBadge(result.significant ? 1 : 0)}</td>
        <td><span class="analysis-strength-text" data-strength="${escapeHtml((result.effect_strength || "unavailable").replaceAll(" ", "-"))}">${escapeHtml(analysisStrengthLabel(result.effect_strength))}</span></td>
      </tr>`).join("");
  }

  function renderFunctionEffectHeatmap() {
    const container = $("#functionEffectHeatmap");
    const heatmap = state.leadershipFunctionsAnalysis.data?.charts?.cramers_v_heatmap;
    if (!container || !Array.isArray(heatmap?.values)) return;
    container.innerHTML = "";

    const corner = document.createElement("div");
    corner.className = "function-heatmap-heading";
    corner.setAttribute("role", "columnheader");
    container.appendChild(corner);
    heatmap.columns.forEach((column) => {
      const heading = document.createElement("div");
      heading.className = "function-heatmap-heading";
      heading.setAttribute("role", "columnheader");
      heading.textContent = tr(column);
      container.appendChild(heading);
    });

    heatmap.rows.forEach((leadership) => {
      const rowHeading = document.createElement("div");
      rowHeading.className = "function-heatmap-row";
      rowHeading.setAttribute("role", "rowheader");
      rowHeading.textContent = tr(leadership);
      container.appendChild(rowHeading);

      heatmap.columns.forEach((functionLabel) => {
        const valueItem = heatmap.values.find(
          (item) => item.leadership === leadership && item.function === functionLabel
        );
        const rawValue = valueItem?.cramers_v;
        const value = Number(rawValue);
        const validValue = rawValue !== null
          && rawValue !== undefined
          && Number.isFinite(value);
        const cell = document.createElement("div");
        cell.className = `function-heatmap-value ${valueItem?.significant ? "is-significant" : ""}`;
        cell.setAttribute("role", "cell");
        cell.style.backgroundColor = validValue
          ? `rgba(18, 53, 36, ${Math.min(0.92, 0.12 + value)})`
          : "transparent";
        cell.classList.toggle("is-strong", validValue && value >= 0.42);
        cell.textContent = validValue ? analysisNumber(value) : tr("Not Available");
        cell.title = valueItem?.significant
          ? tr("Statistically significant")
          : tr("Not statistically significant");
        cell.setAttribute(
          "aria-label",
          `${tr(leadership)}, ${tr(functionLabel)}: ${tr("Cramer's V")} ${validValue ? analysisNumber(value) : tr("Not Available")}. ${cell.title}`
        );
        container.appendChild(cell);
      });
    });
  }

  function renderSignificantFunctionChart() {
    const canvas = $("#significantFunctionChart");
    const empty = $("#significantFunctionChartEmpty");
    const items = state.leadershipFunctionsAnalysis.data?.charts?.significant_relationships?.items;
    if (!canvas || !empty || !Array.isArray(items)) return;

    const hasItems = items.length > 0;
    canvas.parentElement.hidden = !hasItems;
    empty.hidden = hasItems;
    if (!hasItems || !window.Chart) return;

    const chartData = {
      labels: items.map((item) => tr("{leadership} — {function}", {
        leadership: tr(item.leadership_label),
        function: tr(item.function_label)
      })),
      datasets: [
        {
          label: tr("Leadership present"),
          data: items.map((item) => item.leadership_present_percentage),
          backgroundColor: "#287a50",
          borderRadius: 7
        },
        {
          label: tr("Leadership absent"),
          data: items.map((item) => item.leadership_absent_percentage),
          backgroundColor: "#c8a96a",
          borderRadius: 7
        }
      ]
    };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, padding: 18, boxWidth: 8 } },
        tooltip: {
          backgroundColor: "#081c13",
          padding: 11,
          cornerRadius: 8,
          callbacks: { label: (context) => `${context.dataset.label}: ${analysisNumber(context.raw, 1)}%` }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 35, minRotation: 0 } },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (value) => `${value}%` },
          grid: { color: window.SitePreferences?.getTheme() === "dark" ? "#334139" : "#edf0ec" }
        }
      }
    };

    if (state.leadershipFunctionsAnalysis.chart) {
      state.leadershipFunctionsAnalysis.chart.data = chartData;
      state.leadershipFunctionsAnalysis.chart.options = options;
      state.leadershipFunctionsAnalysis.chart.update();
      return;
    }
    state.leadershipFunctionsAnalysis.chart = new window.Chart(canvas, {
      type: "bar",
      data: chartData,
      options
    });
  }

  function localizedLeadershipFunctionInterpretation(analysis) {
    const leadership = tr(`${analysis.leadership_label} leadership`).toLowerCase();
    const functionLabel = tr(analysis.function_label).toLowerCase();
    if (analysis.p_value === null || analysis.cramers_v === null) {
      return tr(
        "The relationship between {leadership} and {function} could not be calculated because the valid observations do not contain enough variation.",
        { leadership, function: functionLabel }
      );
    }
    const significance = analysis.significant
      ? tr("There is a statistically significant relationship between {leadership} and {function} (p < 0.05).", { leadership, function: functionLabel })
      : tr("No statistically significant association was detected between {leadership} and {function} (p ≥ 0.05).", { leadership, function: functionLabel });
    return `${significance} ${tr("The association strength is {strength} (Cramer's V = {value}).", {
      strength: analysisStrengthLabel(analysis.effect_strength).toLowerCase(),
      value: analysisNumber(analysis.cramers_v)
    })}`;
  }

  function functionFrequencyTable(title, analysis, values, expected) {
    const tableRows = Array.isArray(values) && values.length
      ? values.map((rowValues, index) => `
          <tr><th scope="row">${escapeHtml(tr(analysis.contingency_table.row_labels[index]))}</th>${rowValues.map((value) => `<td>${escapeHtml(analysisNumber(value, expected ? 2 : 0))}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="3" class="empty-state">${escapeHtml(tr("Not Available"))}</td></tr>`;
    return `
      <article>
        <h4>${escapeHtml(tr(title))}</h4>
        <div class="table-responsive"><table class="analysis-table"><thead><tr><th scope="col">${escapeHtml(tr("Leadership Status"))}</th><th scope="col">${escapeHtml(tr("Function present"))}</th><th scope="col">${escapeHtml(tr("Function absent"))}</th></tr></thead><tbody>${tableRows}</tbody></table></div>
      </article>`;
  }

  function renderLeadershipFunctionCards() {
    const container = $("#functionAnalysisCards");
    const analyses = state.leadershipFunctionsAnalysis.data?.analyses;
    if (!container || !Array.isArray(analyses)) return;

    container.innerHTML = analyses.map((analysis) => {
      const strength = analysisStrengthLabel(analysis.effect_strength);
      const missing = analysis.missing_values_excluded || {};
      return `
        <details class="surface analysis-test-card" data-analysis-id="${escapeHtml(analysis.analysis_id)}">
          <summary>
            <span><small>${escapeHtml(tr(analysis.leadership_label))}</small><strong>${escapeHtml(tr(analysis.function_label))}</strong></span>
            <span class="analysis-test-summary-metrics"><span>${escapeHtml(tr("p-value"))}: <bdi dir="ltr">${escapeHtml(analysisPValue(analysis.p_value))}</bdi></span><span>${escapeHtml(tr("Cramer's V"))}: <bdi dir="ltr">${escapeHtml(analysisNumber(analysis.cramers_v))}</bdi></span>${binaryBadge(analysis.significant ? 1 : 0)}<i class="bi bi-chevron-down" aria-hidden="true"></i></span>
          </summary>
          <div class="analysis-test-body">
            <div class="analysis-metric-grid">
              <article class="analysis-metric"><span>${escapeHtml(tr("Chi-Square"))}</span><strong><bdi dir="ltr">${escapeHtml(analysisNumber(analysis.chi_square))}</bdi></strong></article>
              <article class="analysis-metric"><span>${escapeHtml(tr("p-value"))}</span><strong><bdi dir="ltr">${escapeHtml(analysisPValue(analysis.p_value))}</bdi></strong></article>
              <article class="analysis-metric"><span>${escapeHtml(tr("Degrees of Freedom"))}</span><strong><bdi dir="ltr">${escapeHtml(analysisNumber(analysis.degrees_of_freedom, 0))}</bdi></strong></article>
              <article class="analysis-metric"><span>${escapeHtml(tr("Cramer's V"))}</span><strong><bdi dir="ltr">${escapeHtml(analysisNumber(analysis.cramers_v))}</bdi></strong></article>
              <article class="analysis-metric"><span>${escapeHtml(tr("Sample Size"))}</span><strong><bdi dir="ltr">${escapeHtml(analysisNumber(analysis.sample_size, 0))}</bdi></strong></article>
            </div>
            <div class="analysis-interpretation">${escapeHtml(localizedLeadershipFunctionInterpretation(analysis))}</div>
            <p class="analysis-missing-note">${escapeHtml(tr("Leadership variable missing: {leadership}. Governance function missing: {function}. Total excluded from this test: {total}.", {
              leadership: analysisNumber(missing.leadership_variable, 0),
              function: analysisNumber(missing.governance_function, 0),
              total: analysisNumber(missing.total_excluded, 0)
            }))} <strong>${escapeHtml(tr("Strength"))}: ${escapeHtml(strength)}.</strong></p>
            <div class="analysis-table-grid">${functionFrequencyTable("Observed Frequencies", analysis, analysis.contingency_table?.observed, false)}${functionFrequencyTable("Expected Frequencies", analysis, analysis.contingency_table?.expected, true)}</div>
          </div>
        </details>`;
    }).join("");
  }

  async function initGroupSizeRecognitionAnalysis() {
    const section = $("#groupsize-recognition-analysis");
    if (!section) return;

    setPopulationAnalysisStatus(tr("Loading population-size analysis..."));
    const data = await loadApiData("statistical-analysis/groupsize-recognition");
    if (!data?.descriptive_statistics || !data?.statistical_test || !data?.charts) {
      throw new Error("groupsize-recognition: unexpected API response format");
    }

    state.groupSizeRecognitionAnalysis.data = data;
    renderPopulationDataPreparation();
    renderPopulationDescriptiveStatistics();
    renderPopulationNormalityAndTest();
    renderPopulationBoxPlot();
    renderPopulationHistogram();
    setPopulationAnalysisStatus("");
  }

  function setPopulationAnalysisStatus(message, isError = false) {
    const status = $("#populationAnalysisStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function populationValue(value, maximumFractionDigits = 1) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return tr("Not Available");
    }
    return Number(value).toLocaleString(isArabic() ? "ar" : "en", {
      maximumFractionDigits
    });
  }

  function renderPopulationDataPreparation() {
    const data = state.groupSizeRecognitionAnalysis.data;
    if (!data) return;
    const preparation = data.data_preparation || {};
    const values = {
      populationTotalObservations: preparation.total_observations,
      populationExcludedObservations: preparation.excluded_observations,
      populationFinalSample: preparation.final_sample_size
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $(`#${id}`);
      if (element) element.textContent = analysisNumber(value, 0);
    });

    const method = $("#populationSelectedMethod");
    if (method) method.textContent = tr(data.statistical_test?.name || "Not Available");
  }

  function renderPopulationDescriptiveStatistics() {
    const statistics = state.groupSizeRecognitionAnalysis.data?.descriptive_statistics;
    const body = $("#populationDescriptionBody");
    if (!statistics || !body) return;

    const groups = [
      { key: "recognized", label: "Recognized" },
      { key: "not_recognized", label: "Not Recognized" }
    ];
    body.innerHTML = groups.map(({ key, label }) => {
      const group = statistics[key] || {};
      return `<tr>
        <td><strong>${escapeHtml(tr(label))}</strong></td>
        <td>${escapeHtml(analysisNumber(group.count, 0))}</td>
        <td>${escapeHtml(populationValue(group.mean))}</td>
        <td>${escapeHtml(populationValue(group.median))}</td>
        <td>${escapeHtml(populationValue(group.minimum, 0))}</td>
        <td>${escapeHtml(populationValue(group.maximum, 0))}</td>
        <td>${escapeHtml(populationValue(group.standard_deviation))}</td>
        <td>${escapeHtml(populationValue(group.interquartile_range))}</td>
      </tr>`;
    }).join("");

    const cardValues = {
      populationMeanRecognized: statistics.recognized?.mean,
      populationMeanNotRecognized: statistics.not_recognized?.mean,
      populationMedianRecognized: statistics.recognized?.median,
      populationMedianNotRecognized: statistics.not_recognized?.median,
      populationMaximumRecognized: statistics.recognized?.maximum,
      populationMaximumNotRecognized: statistics.not_recognized?.maximum,
      populationMinimumRecognized: statistics.recognized?.minimum,
      populationMinimumNotRecognized: statistics.not_recognized?.minimum
    };
    Object.entries(cardValues).forEach(([id, value]) => {
      const element = $(`#${id}`);
      if (element) element.textContent = populationValue(value);
    });
  }

  function populationEffectStrengthLabel(strength) {
    if (!strength) return tr("Not Available");
    return tr(strength.charAt(0).toUpperCase() + strength.slice(1));
  }

  function localizedPopulationInterpretation(test) {
    const significance = test.significant
      ? tr("There is a statistically significant difference in group population size between formally recognized and non-recognized traditional institutions.")
      : tr("No statistically significant difference in group population size was detected between formally recognized and non-recognized traditional institutions.");
    const effect = test.effect_size || {};
    const direction = effect.value > 0
      ? tr("recognized groups tend to have larger populations")
      : effect.value < 0
        ? tr("not recognized groups tend to have larger populations")
        : tr("neither recognition group tends to have larger populations");
    return `${significance} ${tr("The {effect} indicates a {strength} effect; {direction}.", {
      effect: tr(effect.name || "Effect Size").toLowerCase(),
      strength: populationEffectStrengthLabel(effect.strength).toLowerCase(),
      direction
    })}`;
  }

  function renderPopulationNormalityAndTest() {
    const data = state.groupSizeRecognitionAnalysis.data;
    if (!data) return;
    const test = data.statistical_test || {};
    const normality = data.normality_assessment || {};
    const effect = test.effect_size || {};
    const values = {
      populationTestUsed: tr(test.name || "Not Available"),
      populationTestStatistic: analysisNumber(test.statistic),
      populationPValue: analysisPValue(test.p_value),
      populationEffectSize: analysisNumber(effect.value),
      populationSampleSize: analysisNumber(test.sample_size, 0)
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $(`#${id}`);
      if (element) element.textContent = value;
    });

    const badge = $("#populationSignificanceBadge");
    if (badge) {
      badge.textContent = test.significant
        ? tr("Statistically significant")
        : tr("Not statistically significant");
      badge.dataset.strength = test.significant ? "strong" : "unavailable";
    }
    const interpretation = $("#populationInterpretation");
    if (interpretation) interpretation.textContent = localizedPopulationInterpretation(test);
    const reason = $("#populationTestReason");
    if (reason) {
      reason.textContent = normality.distributions_normal
        ? tr("Both recognition groups satisfied the Shapiro-Wilk normality assessment at alpha = 0.05, so Welch's independent samples t-test was selected.")
        : tr("At least one recognition group did not satisfy the Shapiro-Wilk normality assessment at alpha = 0.05, so the Mann-Whitney U test was selected.");
    }
    const explanation = $("#populationEffectExplanation");
    if (explanation) {
      explanation.textContent = tr("{effect} = {value}. This is a {strength} effect and {direction}.", {
        effect: tr(effect.name || "Effect Size"),
        value: analysisNumber(effect.value),
        strength: populationEffectStrengthLabel(effect.strength).toLowerCase(),
        direction: effect.value > 0
          ? tr("recognized groups tend to have larger populations")
          : effect.value < 0
            ? tr("not recognized groups tend to have larger populations")
            : tr("neither recognition group tends to have larger populations")
      });
    }

    const body = $("#populationNormalityBody");
    if (!body) return;
    const groups = normality.groups || {};
    body.innerHTML = [
      ["recognized", "Recognized"],
      ["not_recognized", "Not Recognized"]
    ].map(([key, label]) => {
      const result = groups[key] || {};
      const normalLabel = result.assessable
        ? binaryBadge(result.normal ? 1 : 0)
        : escapeHtml(tr("Not Available"));
      return `<tr><th scope="row">${escapeHtml(tr(label))}</th><td><bdi dir="ltr">${escapeHtml(analysisNumber(result.statistic))}</bdi></td><td><bdi dir="ltr">${escapeHtml(analysisPValue(result.p_value))}</bdi></td><td>${normalLabel}</td></tr>`;
    }).join("");
  }

  function populationCompact(value) {
    if (!Number.isFinite(Number(value))) return tr("Not Available");
    return new Intl.NumberFormat(isArabic() ? "ar" : "en", {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(Number(value));
  }

  function renderPopulationBoxPlot() {
    const canvas = $("#populationBoxPlot");
    const items = state.groupSizeRecognitionAnalysis.data?.charts?.box_plot?.items;
    if (!canvas || !Array.isArray(items) || !window.Chart) return;

    const boxWhiskerPlugin = {
      id: "populationBoxWhiskers",
      afterDatasetsDraw(chart) {
        const { ctx, scales } = chart;
        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.strokeStyle = window.SitePreferences?.getTheme() === "dark" ? "#f3ead5" : "#123524";
        ctx.lineWidth = 2;
        items.forEach((item, index) => {
          const element = meta.data[index];
          if (!element) return;
          const y = element.y;
          const halfCap = Math.min(12, (element.height || 24) * 0.42);
          const minimum = scales.x.getPixelForValue(item.minimum);
          const maximum = scales.x.getPixelForValue(item.maximum);
          const median = scales.x.getPixelForValue(item.median);
          ctx.beginPath();
          ctx.moveTo(minimum, y);
          ctx.lineTo(maximum, y);
          ctx.moveTo(minimum, y - halfCap);
          ctx.lineTo(minimum, y + halfCap);
          ctx.moveTo(maximum, y - halfCap);
          ctx.lineTo(maximum, y + halfCap);
          ctx.moveTo(median, y - halfCap);
          ctx.lineTo(median, y + halfCap);
          ctx.stroke();
        });
        ctx.restore();
      }
    };
    const chartData = {
      labels: items.map((item) => tr(item.label)),
      datasets: [{
        label: tr("Interquartile Range"),
        data: items.map((item) => [item.first_quartile, item.third_quartile]),
        backgroundColor: ["rgba(40, 122, 80, .72)", "rgba(200, 169, 106, .76)"],
        borderColor: ["#123524", "#9a6b1f"],
        borderWidth: 1,
        borderRadius: 7,
        barPercentage: 0.48
      }]
    };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#081c13",
          padding: 11,
          cornerRadius: 8,
          callbacks: {
            label(context) {
              const item = items[context.dataIndex];
              return [
                `${tr("Minimum")}: ${populationValue(item.minimum)}`,
                `${tr("Q1")}: ${populationValue(item.first_quartile)}`,
                `${tr("Median")}: ${populationValue(item.median)}`,
                `${tr("Q3")}: ${populationValue(item.third_quartile)}`,
                `${tr("Maximum")}: ${populationValue(item.maximum)}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          type: "logarithmic",
          min: Math.min(...items.map((item) => Number(item.minimum))),
          max: Math.max(...items.map((item) => Number(item.maximum))),
          grid: { color: window.SitePreferences?.getTheme() === "dark" ? "#334139" : "#edf0ec" },
          ticks: { callback: (value) => populationCompact(value) },
          title: { display: true, text: tr("Population (logarithmic scale)") }
        },
        y: { grid: { display: false } }
      }
    };

    if (state.groupSizeRecognitionAnalysis.boxPlot) {
      state.groupSizeRecognitionAnalysis.boxPlot.destroy();
    }
    state.groupSizeRecognitionAnalysis.boxPlot = new window.Chart(canvas, {
      type: "bar",
      data: chartData,
      options,
      plugins: [boxWhiskerPlugin]
    });
  }

  function renderPopulationHistogram() {
    const canvas = $("#populationHistogram");
    const histogram = state.groupSizeRecognitionAnalysis.data?.charts?.histogram;
    if (!canvas || !Array.isArray(histogram?.bin_edges) || !window.Chart) return;
    const labels = histogram.bin_edges.slice(0, -1).map((edge, index) =>
      `${populationCompact(edge)}–${populationCompact(histogram.bin_edges[index + 1])}`
    );
    const colors = ["rgba(40, 122, 80, .72)", "rgba(200, 169, 106, .7)"];
    const chartData = {
      labels,
      datasets: (histogram.datasets || []).map((dataset, index) => ({
        label: tr(dataset.label),
        data: dataset.counts,
        backgroundColor: colors[index] || colors[0],
        borderRadius: 4,
        borderSkipped: false
      }))
    };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, padding: 18, boxWidth: 8 } },
        tooltip: { backgroundColor: "#081c13", padding: 11, cornerRadius: 8 }
      },
      scales: {
        x: {
          grid: { display: false },
          stacked: false,
          ticks: { maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          title: { display: true, text: tr("Population interval") }
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: window.SitePreferences?.getTheme() === "dark" ? "#334139" : "#edf0ec" },
          title: { display: true, text: tr("Number of groups") }
        }
      }
    };
    if (state.groupSizeRecognitionAnalysis.histogram) {
      state.groupSizeRecognitionAnalysis.histogram.data = chartData;
      state.groupSizeRecognitionAnalysis.histogram.options = options;
      state.groupSizeRecognitionAnalysis.histogram.update();
      return;
    }
    state.groupSizeRecognitionAnalysis.histogram = new window.Chart(canvas, {
      type: "bar",
      data: chartData,
      options
    });
  }

  async function initGroupSizeFunctionsAnalysis() {
    const container = $("#groupSizeFunctionCards");
    if (!container) return;

    setGroupSizeFunctionsStatus(tr("Loading group-size and function analysis..."));
    const data = await loadApiData("statistical-analysis/groupsize-functions");
    if (!Array.isArray(data?.analyses) || data.analyses.length !== 3) {
      throw new Error("groupsize-functions: unexpected API response format");
    }
    state.groupSizeFunctionsAnalysis.data = data;
    renderGroupSizeFunctionsSummary();
    renderGroupSizeFunctionCards();
    data.analyses.forEach((analysis) => {
      renderGroupSizeFunctionBoxPlot(analysis);
      renderGroupSizeFunctionHistogram(analysis);
    });
    setGroupSizeFunctionsStatus("");
  }

  function setGroupSizeFunctionsStatus(message, isError = false) {
    const status = $("#groupSizeFunctionsStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function renderGroupSizeFunctionsSummary() {
    const data = state.groupSizeFunctionsAnalysis.data;
    if (!data) return;
    const analyses = data.analyses || [];
    const finalSamples = analyses.map((item) => Number(item.data_preparation?.final_sample_size) || 0);
    const values = {
      groupSizeFunctionsTotalRows: data.data_quality?.total_rows,
      groupSizeFunctionsTests: analyses.length,
      groupSizeFunctionsSignificant: analyses.filter((item) => item.statistical_test?.significant).length,
      groupSizeFunctionsSampleRange: finalSamples.length
        ? Math.min(...finalSamples).toLocaleString(isArabic() ? "ar" : "en") + "-" + Math.max(...finalSamples).toLocaleString(isArabic() ? "ar" : "en")
        : tr("Not Available")
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $("#" + id);
      if (element) element.textContent = value;
    });

    const body = $("#groupSizeFunctionsSummaryBody");
    if (!body) return;
    body.innerHTML = (data.summary || []).map((result) =>
      "<tr>" +
        "<td><strong>" + escapeHtml(tr(result.function_label)) + "</strong></td>" +
        "<td>" + escapeHtml(tr(result.test_used)) + "</td>" +
        "<td><bdi dir=\"ltr\">" + escapeHtml(analysisNumber(result.test_statistic)) + "</bdi></td>" +
        "<td><bdi dir=\"ltr\">" + escapeHtml(analysisPValue(result.p_value)) + "</bdi></td>" +
        "<td><bdi dir=\"ltr\">" + escapeHtml(analysisNumber(result.effect_size)) + "</bdi></td>" +
        "<td>" + escapeHtml(analysisNumber(result.sample_size, 0)) + "</td>" +
        "<td>" + binaryBadge(result.significant ? 1 : 0) + "</td>" +
      "</tr>"
    ).join("");
  }

  function localizedGroupSizeFunctionInterpretation(analysis) {
    const test = analysis.statistical_test || {};
    const effect = test.effect_size || {};
    const functionLabel = tr(analysis.function_label).toLowerCase();
    if (test.p_value === null || test.p_value === undefined) {
      return tr(
        "The population-size difference for {function} could not be calculated because both comparison groups were not available.",
        { function: functionLabel }
      );
    }
    const effectText = tr("The {effect} indicates a {strength} effect.", {
      effect: tr(effect.name || "Effect Size").toLowerCase(),
      strength: populationEffectStrengthLabel(effect.strength).toLowerCase()
    });
    if (test.significant && Number(effect.value) > 0) {
      return tr("Larger traditional groups are significantly more likely to perform {function}.", {
        function: functionLabel
      }) + " " + effectText;
    }
    if (test.significant) {
      return tr("Groups performing {function} have significantly smaller population sizes.", {
        function: functionLabel
      }) + " " + effectText;
    }
    return tr("No statistically significant difference in population size was found for {function}.", {
      function: functionLabel
    }) + " " + effectText;
  }

  function groupSizeFunctionReason(analysis) {
    if (analysis.statistical_test?.name === "Not computable") {
      return tr("Both function-present and function-absent records require valid population values before a two-group test can be calculated.");
    }
    return analysis.normality_assessment?.distributions_normal
      ? tr("Both function groups satisfied the Shapiro-Wilk normality assessment at alpha = 0.05, so Welch's independent samples t-test was selected.")
      : tr("At least one function group did not satisfy the Shapiro-Wilk normality assessment at alpha = 0.05, so the Mann-Whitney U test was selected.");
  }

  function groupSizeFunctionDescriptionRows(analysis) {
    const descriptions = analysis.descriptive_statistics || {};
    return [
      ["function_present", "Function Present"],
      ["function_absent", "Function Absent"]
    ].map(([key, label]) => {
      const item = descriptions[key] || {};
      return "<tr>" +
        "<th scope=\"row\">" + escapeHtml(tr(label)) + "</th>" +
        "<td>" + escapeHtml(analysisNumber(item.count, 0)) + "</td>" +
        "<td>" + escapeHtml(populationValue(item.mean)) + "</td>" +
        "<td>" + escapeHtml(populationValue(item.median)) + "</td>" +
        "<td>" + escapeHtml(populationValue(item.minimum, 0)) + "</td>" +
        "<td>" + escapeHtml(populationValue(item.maximum, 0)) + "</td>" +
        "<td>" + escapeHtml(populationValue(item.standard_deviation)) + "</td>" +
        "<td>" + escapeHtml(populationValue(item.interquartile_range)) + "</td>" +
      "</tr>";
    }).join("");
  }

  function renderGroupSizeFunctionCards() {
    const container = $("#groupSizeFunctionCards");
    const analyses = state.groupSizeFunctionsAnalysis.data?.analyses;
    if (!container || !Array.isArray(analyses)) return;

    container.innerHTML = analyses.map((analysis) => {
      const test = analysis.statistical_test || {};
      const effect = test.effect_size || {};
      const preparation = analysis.data_preparation || {};
      const id = escapeHtml(analysis.analysis_id);
      const badge = test.significant
        ? tr("Statistically significant")
        : test.p_value === null
          ? tr("Not Available")
          : tr("Not statistically significant");
      return "<article class=\"surface analysis-detail-card groupsize-function-result\" data-function-analysis=\"" + id + "\">" +
        "<div class=\"analysis-detail-heading\"><div><span class=\"section-kicker\">" + escapeHtml(tr("Governance Function")) + "</span><h3>" + escapeHtml(tr(analysis.function_label)) + "</h3></div><span class=\"analysis-effect-badge\" data-strength=\"" + (test.significant ? "strong" : "unavailable") + "\">" + escapeHtml(badge) + "</span></div>" +
        "<div class=\"analysis-quality-grid compact-quality-grid\">" +
          "<article class=\"analysis-quality-card\"><span>" + escapeHtml(tr("Total observations")) + "</span><strong>" + escapeHtml(analysisNumber(preparation.total_observations, 0)) + "</strong></article>" +
          "<article class=\"analysis-quality-card\"><span>" + escapeHtml(tr("Missing observations removed")) + "</span><strong>" + escapeHtml(analysisNumber(preparation.missing_observations_removed, 0)) + "</strong></article>" +
          "<article class=\"analysis-quality-card\"><span>" + escapeHtml(tr("Final sample size")) + "</span><strong>" + escapeHtml(analysisNumber(preparation.final_sample_size, 0)) + "</strong></article>" +
        "</div>" +
        "<div class=\"analysis-metric-grid\">" +
          "<article class=\"analysis-metric\"><span>" + escapeHtml(tr("Test Used")) + "</span><strong>" + escapeHtml(tr(test.name || "Not Available")) + "</strong></article>" +
          "<article class=\"analysis-metric\"><span>" + escapeHtml(tr("Test Statistic")) + "</span><strong><bdi dir=\"ltr\">" + escapeHtml(analysisNumber(test.statistic)) + "</bdi></strong></article>" +
          "<article class=\"analysis-metric\"><span>" + escapeHtml(tr("p-value")) + "</span><strong><bdi dir=\"ltr\">" + escapeHtml(analysisPValue(test.p_value)) + "</bdi></strong></article>" +
          "<article class=\"analysis-metric\"><span>" + escapeHtml(tr("Effect Size")) + "</span><strong><bdi dir=\"ltr\">" + escapeHtml(analysisNumber(effect.value)) + "</bdi></strong></article>" +
          "<article class=\"analysis-metric\"><span>" + escapeHtml(tr("Strength")) + "</span><strong>" + escapeHtml(populationEffectStrengthLabel(effect.strength)) + "</strong></article>" +
        "</div>" +
        "<div class=\"analysis-interpretation\">" + escapeHtml(localizedGroupSizeFunctionInterpretation(analysis)) + "</div>" +
        "<p class=\"analysis-missing-note\">" + escapeHtml(groupSizeFunctionReason(analysis)) + "</p>" +
        "<div class=\"table-responsive\"><table class=\"analysis-table population-function-description\"><thead><tr><th scope=\"col\">" + escapeHtml(tr("Function Status")) + "</th><th scope=\"col\">" + escapeHtml(tr("Count")) + "</th><th scope=\"col\">" + escapeHtml(tr("Mean")) + "</th><th scope=\"col\">" + escapeHtml(tr("Median")) + "</th><th scope=\"col\">" + escapeHtml(tr("Minimum")) + "</th><th scope=\"col\">" + escapeHtml(tr("Maximum")) + "</th><th scope=\"col\">" + escapeHtml(tr("Standard Deviation")) + "</th><th scope=\"col\">" + escapeHtml(tr("IQR")) + "</th></tr></thead><tbody>" + groupSizeFunctionDescriptionRows(analysis) + "</tbody></table></div>" +
        "<div class=\"analysis-chart-grid groupsize-function-chart-grid\">" +
          "<article class=\"function-chart-panel\"><h4>" + escapeHtml(tr("{function} Box Plot", { function: tr(analysis.function_label) })) + "</h4><div class=\"chart-wrap chart-wrap-population\"><canvas id=\"" + id + "PopulationBoxPlot\" role=\"img\" aria-label=\"" + escapeHtml(tr("{function} population box plot", { function: tr(analysis.function_label) })) + "\"></canvas></div></article>" +
          "<article class=\"function-chart-panel\"><h4>" + escapeHtml(tr("{function} Histogram", { function: tr(analysis.function_label) })) + "</h4><div class=\"chart-wrap chart-wrap-population\"><canvas id=\"" + id + "PopulationHistogram\" role=\"img\" aria-label=\"" + escapeHtml(tr("{function} population histogram", { function: tr(analysis.function_label) })) + "\"></canvas></div></article>" +
        "</div>" +
      "</article>";
    }).join("");
  }

  function renderGroupSizeFunctionBoxPlot(analysis) {
    const canvas = $("#" + analysis.analysis_id + "PopulationBoxPlot");
    const items = analysis.charts?.box_plot?.items;
    if (!canvas || !Array.isArray(items) || !window.Chart || items.some((item) => item.minimum === null)) return;
    const plugin = {
      id: "functionBoxWhiskers" + analysis.analysis_id,
      afterDatasetsDraw(chart) {
        const { ctx, scales } = chart;
        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.strokeStyle = window.SitePreferences?.getTheme() === "dark" ? "#f3ead5" : "#123524";
        ctx.lineWidth = 2;
        items.forEach((item, index) => {
          const element = meta.data[index];
          if (!element) return;
          const y = element.y;
          const cap = Math.min(12, (element.height || 24) * 0.42);
          const minimum = scales.x.getPixelForValue(item.minimum);
          const maximum = scales.x.getPixelForValue(item.maximum);
          const median = scales.x.getPixelForValue(item.median);
          ctx.beginPath();
          ctx.moveTo(minimum, y); ctx.lineTo(maximum, y);
          ctx.moveTo(minimum, y - cap); ctx.lineTo(minimum, y + cap);
          ctx.moveTo(maximum, y - cap); ctx.lineTo(maximum, y + cap);
          ctx.moveTo(median, y - cap); ctx.lineTo(median, y + cap);
          ctx.stroke();
        });
        ctx.restore();
      }
    };
    const chart = new window.Chart(canvas, {
      type: "bar",
      data: {
        labels: items.map((item) => tr(item.label)),
        datasets: [{
          data: items.map((item) => [item.first_quartile, item.third_quartile]),
          backgroundColor: ["rgba(40, 122, 80, .72)", "rgba(200, 169, 106, .76)"],
          borderColor: ["#123524", "#9a6b1f"],
          borderWidth: 1,
          borderRadius: 7,
          barPercentage: 0.48
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: { legend: { display: false }, tooltip: { backgroundColor: "#081c13", padding: 11, cornerRadius: 8 } },
        scales: {
          x: {
            type: "logarithmic",
            min: Math.min(...items.map((item) => Number(item.minimum))),
            max: Math.max(...items.map((item) => Number(item.maximum))),
            grid: { color: window.SitePreferences?.getTheme() === "dark" ? "#334139" : "#edf0ec" },
            ticks: { callback: (value) => populationCompact(value) },
            title: { display: true, text: tr("Population (logarithmic scale)") }
          },
          y: { grid: { display: false } }
        }
      },
      plugins: [plugin]
    });
    state.groupSizeFunctionsAnalysis.charts.set("box-" + analysis.analysis_id, chart);
  }

  function renderGroupSizeFunctionHistogram(analysis) {
    const canvas = $("#" + analysis.analysis_id + "PopulationHistogram");
    const histogram = analysis.charts?.histogram;
    if (!canvas || !Array.isArray(histogram?.bin_edges) || histogram.bin_edges.length < 2 || !window.Chart) return;
    const labels = histogram.bin_edges.slice(0, -1).map((edge, index) =>
      populationCompact(edge) + "-" + populationCompact(histogram.bin_edges[index + 1])
    );
    const chart = new window.Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: (histogram.datasets || []).map((dataset, index) => ({
          label: tr(dataset.label),
          data: dataset.counts,
          backgroundColor: index === 0 ? "rgba(40, 122, 80, .72)" : "rgba(200, 169, 106, .7)",
          borderRadius: 4,
          borderSkipped: false
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 18, boxWidth: 8 } }, tooltip: { backgroundColor: "#081c13", padding: 11, cornerRadius: 8 } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 8 }, title: { display: true, text: tr("Population interval") } },
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: window.SitePreferences?.getTheme() === "dark" ? "#334139" : "#edf0ec" }, title: { display: true, text: tr("Number of groups") } }
        }
      }
    });
    state.groupSizeFunctionsAnalysis.charts.set("histogram-" + analysis.analysis_id, chart);
  }

  async function initContinentLeadershipAnalysis() {
    const section = $("#continent-leadership-analysis");
    if (!section) return;

    setContinentLeadershipStatus(tr("Loading continent and leadership analysis..."));
    const data = await loadApiData("statistical-analysis/continent-leadership");
    if (!Array.isArray(data?.descriptive_statistics) || !data?.statistical_test || !data?.charts) {
      throw new Error("continent-leadership: unexpected API response format");
    }
    state.continentLeadershipAnalysis.data = data;
    renderContinentLeadershipSummary();
    renderContinentLeadershipDescription();
    renderContinentLeadershipResult();
    renderContinentLeadershipGroupedChart();
    renderContinentLeadershipStackedChart();
    setContinentLeadershipStatus("");
  }

  function setContinentLeadershipStatus(message, isError = false) {
    const status = $("#continentLeadershipStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function analysisPercent(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return tr("Not Available");
    }
    return Number(value).toLocaleString(isArabic() ? "ar" : "en", {
      maximumFractionDigits: 1
    }) + "%";
  }

  function renderContinentLeadershipSummary() {
    const data = state.continentLeadershipAnalysis.data;
    if (!data) return;
    const summary = data.summary || {};
    const preparation = data.data_preparation || {};
    const values = {
      continentLeadershipTotalGroups: analysisNumber(summary.total_groups, 0),
      continentLeadershipDominant: tr(summary.dominant_leadership_type || "Not Available"),
      continentLeadershipContinents: analysisNumber(summary.number_of_continents, 0),
      continentLeadershipMissing: analysisNumber(preparation.missing_observations_removed, 0)
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $("#" + id);
      if (element) element.textContent = value;
    });
  }

  function renderContinentLeadershipDescription() {
    const body = $("#continentLeadershipDescriptionBody");
    const rows = state.continentLeadershipAnalysis.data?.descriptive_statistics;
    if (!body || !Array.isArray(rows)) return;
    body.innerHTML = rows.map((item) => {
      const counts = item.counts || {};
      const percentages = item.percentages || {};
      return "<tr>" +
        "<th scope=\"row\">" + escapeHtml(tr(item.continent)) + "</th>" +
        "<td>" + escapeHtml(analysisNumber(item.total_groups, 0)) + "</td>" +
        "<td>" + escapeHtml(analysisNumber(counts.king, 0)) + "</td>" +
        "<td>" + escapeHtml(analysisPercent(percentages.king)) + "</td>" +
        "<td>" + escapeHtml(analysisNumber(counts.chief, 0)) + "</td>" +
        "<td>" + escapeHtml(analysisPercent(percentages.chief)) + "</td>" +
        "<td>" + escapeHtml(analysisNumber(counts.headman, 0)) + "</td>" +
        "<td>" + escapeHtml(analysisPercent(percentages.headman)) + "</td>" +
      "</tr>";
    }).join("");
  }

  function localizedContinentLeadershipInterpretation() {
    const test = state.continentLeadershipAnalysis.data?.statistical_test || {};
    const strength = tr(test.effect_strength || "Not Available").toLowerCase();
    if (test.p_value === null || test.p_value === undefined) {
      return tr("The association between continent and leadership structure could not be calculated because the contingency table lacked sufficient variation.");
    }
    if (test.significant) {
      return tr("There is a statistically significant association between continent and leadership structure (p < 0.05). Cramer's V indicates a {strength} association.", { strength });
    }
    return tr("No statistically significant association was detected between continent and leadership structure (p >= 0.05). Cramer's V indicates a {strength} association.", { strength });
  }

  function renderContinentLeadershipFrequencyTable(bodyId, values, labels, decimals) {
    const body = $("#" + bodyId);
    if (!body) return;
    body.innerHTML = labels.map((label, index) => {
      const row = Array.isArray(values?.[index]) ? values[index] : [];
      return "<tr><th scope=\"row\">" + escapeHtml(tr(label)) + "</th>" +
        [0, 1, 2].map((column) =>
          "<td><bdi dir=\"ltr\">" + escapeHtml(analysisNumber(row[column], decimals)) + "</bdi></td>"
        ).join("") + "</tr>";
    }).join("");
  }

  function renderContinentLeadershipResult() {
    const data = state.continentLeadershipAnalysis.data;
    if (!data) return;
    const test = data.statistical_test || {};
    const values = {
      continentLeadershipChiSquare: analysisNumber(test.chi_square),
      continentLeadershipDf: analysisNumber(test.degrees_of_freedom, 0),
      continentLeadershipPValue: analysisPValue(test.p_value),
      continentLeadershipCramersV: analysisNumber(test.cramers_v),
      continentLeadershipSample: analysisNumber(test.sample_size, 0)
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $("#" + id);
      if (element) element.textContent = value;
    });

    const badge = $("#continentLeadershipSignificance");
    if (badge) {
      badge.textContent = test.p_value === null
        ? tr("Not Available")
        : test.significant
          ? tr("Statistically significant")
          : tr("Not statistically significant");
      badge.dataset.strength = test.significant ? "strong" : "unavailable";
    }
    const interpretation = $("#continentLeadershipInterpretation");
    if (interpretation) interpretation.textContent = localizedContinentLeadershipInterpretation();
    const note = $("#continentLeadershipMethodNote");
    if (note) note.textContent = tr(data.method_note || test.reason || "");

    const table = test.contingency_table || {};
    renderContinentLeadershipFrequencyTable(
      "continentLeadershipObservedBody",
      table.observed,
      table.row_labels || [],
      0
    );
    renderContinentLeadershipFrequencyTable(
      "continentLeadershipExpectedBody",
      table.expected,
      table.row_labels || [],
      2
    );
  }

  function continentLeadershipDatasets(source, percentages = false) {
    const colors = [
      ["rgba(18, 53, 36, .84)", "#123524"],
      ["rgba(200, 169, 106, .82)", "#9a6b1f"],
      ["rgba(40, 122, 80, .72)", "#287a50"]
    ];
    return (source.datasets || []).map((dataset, index) => ({
      label: tr(dataset.label),
      data: dataset.values,
      backgroundColor: colors[index][0],
      borderColor: colors[index][1],
      borderWidth: percentages ? 1 : 0,
      borderRadius: percentages ? 0 : 5,
      borderSkipped: false
    }));
  }

  function renderContinentLeadershipGroupedChart() {
    const canvas = $("#continentLeadershipGroupedChart");
    const source = state.continentLeadershipAnalysis.data?.charts?.grouped_bar;
    if (!canvas || !source || !window.Chart) return;
    state.continentLeadershipAnalysis.groupedChart = new window.Chart(canvas, {
      type: "bar",
      data: {
        labels: source.labels.map((label) => tr(label)),
        datasets: continentLeadershipDatasets(source)
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, padding: 18, boxWidth: 8 } },
          tooltip: { backgroundColor: "#081c13", padding: 11, cornerRadius: 8 }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
            grid: { color: window.SitePreferences?.getTheme() === "dark" ? "#334139" : "#edf0ec" },
            title: { display: true, text: tr("Number of leadership occurrences") }
          }
        }
      }
    });
  }

  function renderContinentLeadershipStackedChart() {
    const canvas = $("#continentLeadershipStackedChart");
    const source = state.continentLeadershipAnalysis.data?.charts?.percentage_stacked;
    if (!canvas || !source || !window.Chart) return;
    state.continentLeadershipAnalysis.stackedChart = new window.Chart(canvas, {
      type: "bar",
      data: {
        labels: source.labels.map((label) => tr(label)),
        datasets: continentLeadershipDatasets(source, true)
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, padding: 18, boxWidth: 8 } },
          tooltip: {
            backgroundColor: "#081c13",
            padding: 11,
            cornerRadius: 8,
            callbacks: { label: (context) => context.dataset.label + ": " + analysisPercent(context.raw) }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
            beginAtZero: true,
            max: 100,
            ticks: { callback: (value) => value + "%" },
            grid: { color: window.SitePreferences?.getTheme() === "dark" ? "#334139" : "#edf0ec" },
            title: { display: true, text: tr("Leadership distribution") }
          }
        }
      }
    });
  }

  async function initContinentRecognitionAnalysis() {
    const section = $("#continent-recognition-analysis");
    if (!section) return;
    setContinentRecognitionStatus(tr("Loading continent and recognition analysis..."));
    const data = await loadApiData("statistical-analysis/continent-recognition");
    if (!Array.isArray(data?.descriptive_statistics) || !data?.statistical_test || !data?.charts) {
      throw new Error("continent-recognition: unexpected API response format");
    }
    state.continentRecognitionAnalysis.data = data;
    renderContinentRecognitionSummary();
    renderContinentRecognitionDescription();
    renderContinentRecognitionHeatmap();
    renderContinentRecognitionResult();
    renderContinentRecognitionStackedChart();
    setContinentRecognitionStatus("");
  }

  function setContinentRecognitionStatus(message, isError = false) {
    const status = $("#continentRecognitionStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function recognitionRateSummary(item) {
    if (!item) return tr("Not Available");
    return tr(item.continent) + " - " + analysisPercent(item.recognition_percentage);
  }

  function renderContinentRecognitionSummary() {
    const data = state.continentRecognitionAnalysis.data;
    if (!data) return;
    const summary = data.summary || {};
    const preparation = data.data_preparation || {};
    const values = {
      continentRecognitionContinents: analysisNumber(summary.total_continents, 0),
      continentRecognitionHighest: recognitionRateSummary(summary.highest_recognition_rate),
      continentRecognitionLowest: recognitionRateSummary(summary.lowest_recognition_rate),
      continentRecognitionSample: analysisNumber(preparation.final_sample_size, 0)
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $("#" + id);
      if (element) element.textContent = value;
    });
  }

  function renderContinentRecognitionDescription() {
    const body = $("#continentRecognitionDescriptionBody");
    const rows = state.continentRecognitionAnalysis.data?.descriptive_statistics;
    if (!body || !Array.isArray(rows)) return;
    body.innerHTML = rows.map((item) => "<tr>" +
      "<th scope=\"row\">" + escapeHtml(tr(item.continent)) + "</th>" +
      "<td>" + escapeHtml(analysisNumber(item.total_groups, 0)) + "</td>" +
      "<td>" + escapeHtml(analysisNumber(item.recognized, 0)) + "</td>" +
      "<td>" + escapeHtml(analysisNumber(item.not_recognized, 0)) + "</td>" +
      "<td>" + escapeHtml(analysisPercent(item.recognition_percentage)) + "</td>" +
    "</tr>").join("");
  }

  function renderContinentRecognitionHeatmap() {
    const container = $("#continentRecognitionHeatmap");
    const items = state.continentRecognitionAnalysis.data?.charts?.recognition_heatmap?.items;
    if (!container || !Array.isArray(items)) return;
    container.innerHTML = items.map((item) => {
      const rate = Math.max(0, Math.min(100, Number(item.recognition_percentage) || 0));
      return "<div class=\"continent-recognition-heatmap-row\" role=\"row\">" +
        "<strong role=\"rowheader\">" + escapeHtml(tr(item.continent)) + "</strong>" +
        "<span class=\"continent-recognition-heatmap-track\" style=\"--recognition-rate:" + rate + "%\" aria-hidden=\"true\"><span></span></span>" +
        "<bdi dir=\"ltr\" role=\"cell\">" + escapeHtml(analysisPercent(rate)) + "</bdi>" +
      "</div>";
    }).join("");
  }

  function localizedContinentRecognitionInterpretation() {
    const test = state.continentRecognitionAnalysis.data?.statistical_test || {};
    const strength = tr(test.effect_strength || "Not Available").toLowerCase();
    if (test.p_value === null || test.p_value === undefined) {
      return tr("The association between continent and formal recognition could not be calculated because the contingency table lacked sufficient variation.");
    }
    if (test.significant) {
      return tr("There is a statistically significant association between continent and formal recognition (p < 0.05). Cramer's V indicates a {strength} association.", { strength });
    }
    return tr("No statistically significant association was detected between continent and formal recognition (p >= 0.05). Cramer's V indicates a {strength} association.", { strength });
  }

  function renderContinentRecognitionFrequencyTable(bodyId, rows, labels, decimals) {
    const body = $("#" + bodyId);
    if (!body) return;
    body.innerHTML = labels.map((label, index) => {
      const row = Array.isArray(rows?.[index]) ? rows[index] : [];
      return "<tr><th scope=\"row\">" + escapeHtml(tr(label)) + "</th>" +
        [0, 1].map((column) =>
          "<td><bdi dir=\"ltr\">" + escapeHtml(analysisNumber(row[column], decimals)) + "</bdi></td>"
        ).join("") + "</tr>";
    }).join("");
  }

  function renderContinentRecognitionResult() {
    const data = state.continentRecognitionAnalysis.data;
    if (!data) return;
    const test = data.statistical_test || {};
    const values = {
      continentRecognitionChiSquare: analysisNumber(test.chi_square),
      continentRecognitionDf: analysisNumber(test.degrees_of_freedom, 0),
      continentRecognitionPValue: analysisPValue(test.p_value),
      continentRecognitionCramersV: analysisNumber(test.cramers_v),
      continentRecognitionTestSample: analysisNumber(test.sample_size, 0)
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $("#" + id);
      if (element) element.textContent = value;
    });
    const badge = $("#continentRecognitionSignificance");
    if (badge) {
      badge.textContent = test.p_value === null
        ? tr("Not Available")
        : test.significant ? tr("Statistically significant") : tr("Not statistically significant");
      badge.dataset.strength = test.significant ? "strong" : "unavailable";
    }
    const interpretation = $("#continentRecognitionInterpretation");
    if (interpretation) interpretation.textContent = localizedContinentRecognitionInterpretation();
    const table = test.contingency_table || {};
    renderContinentRecognitionFrequencyTable("continentRecognitionObservedBody", table.observed, table.row_labels || [], 0);
    renderContinentRecognitionFrequencyTable("continentRecognitionExpectedBody", table.expected, table.row_labels || [], 2);
  }

  function renderContinentRecognitionStackedChart() {
    const canvas = $("#continentRecognitionStackedChart");
    const source = state.continentRecognitionAnalysis.data?.charts?.percentage_stacked;
    if (!canvas || !source || !window.Chart) return;
    const colors = [
      ["rgba(40, 122, 80, .84)", "#287a50"],
      ["rgba(200, 169, 106, .82)", "#9a6b1f"]
    ];
    state.continentRecognitionAnalysis.stackedChart = new window.Chart(canvas, {
      type: "bar",
      data: {
        labels: source.labels.map((label) => tr(label)),
        datasets: source.datasets.map((dataset, index) => ({
          label: tr(dataset.label),
          data: dataset.values,
          backgroundColor: colors[index][0],
          borderColor: colors[index][1],
          borderWidth: 1,
          borderSkipped: false
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, padding: 18, boxWidth: 8 } },
          tooltip: {
            backgroundColor: "#081c13",
            padding: 11,
            cornerRadius: 8,
            callbacks: { label: (context) => context.dataset.label + ": " + analysisPercent(context.raw) }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
            beginAtZero: true,
            max: 100,
            ticks: { callback: (value) => value + "%" },
            grid: { color: window.SitePreferences?.getTheme() === "dark" ? "#334139" : "#edf0ec" },
            title: { display: true, text: tr("Recognition percentage") }
          }
        }
      }
    });
  }

  async function initRegionRecognitionAnalysis() {
    const section = $("#region-recognition-analysis");
    if (!section) return;
    setRegionRecognitionStatus(tr("Loading region and recognition analysis..."));
    const data = await loadApiData("statistical-analysis/region-recognition");
    if (!Array.isArray(data?.descriptive_statistics) || !data?.statistical_test || !data?.charts) {
      throw new Error("region-recognition: unexpected API response format");
    }
    state.regionRecognitionAnalysis.data = data;
    renderRegionRecognitionSummary();
    renderRegionRecognitionDescription();
    renderRegionRecognitionHeatmap();
    renderRegionRecognitionResult();
    renderRegionRecognitionStackedChart();
    setRegionRecognitionStatus("");
  }

  function setRegionRecognitionStatus(message, isError = false) {
    const status = $("#regionRecognitionStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function regionRecognitionRateSummary(item) {
    if (!item) return tr("Not Available");
    return tr(item.region) + " - " + analysisPercent(item.recognition_percentage);
  }

  function renderRegionRecognitionSummary() {
    const data = state.regionRecognitionAnalysis.data;
    if (!data) return;
    const summary = data.summary || {};
    const values = {
      regionRecognitionRegions: analysisNumber(summary.total_regions, 0),
      regionRecognitionHighest: regionRecognitionRateSummary(summary.highest_recognition_rate),
      regionRecognitionLowest: regionRecognitionRateSummary(summary.lowest_recognition_rate),
      regionRecognitionAverage: analysisPercent(summary.average_recognition_rate)
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $("#" + id);
      if (element) element.textContent = value;
    });
  }

  function renderRegionRecognitionDescription() {
    const body = $("#regionRecognitionDescriptionBody");
    const rows = state.regionRecognitionAnalysis.data?.descriptive_statistics;
    if (!body || !Array.isArray(rows)) return;
    body.innerHTML = rows.map((item) => "<tr>" +
      '<th scope="row">' + escapeHtml(tr(item.region)) + "</th>" +
      "<td>" + escapeHtml(analysisNumber(item.total_groups, 0)) + "</td>" +
      "<td>" + escapeHtml(analysisNumber(item.recognized, 0)) + "</td>" +
      "<td>" + escapeHtml(analysisNumber(item.not_recognized, 0)) + "</td>" +
      "<td>" + escapeHtml(analysisNumber(item.missing_recognition, 0)) + "</td>" +
      "<td>" + escapeHtml(analysisPercent(item.recognition_percentage)) + "</td>" +
    "</tr>").join("");
  }

  function renderRegionRecognitionHeatmap() {
    const container = $("#regionRecognitionHeatmap");
    const items = state.regionRecognitionAnalysis.data?.charts?.recognition_heatmap?.items;
    if (!container || !Array.isArray(items)) return;
    container.innerHTML = items.map((item) => {
      const rate = Math.max(0, Math.min(100, Number(item.recognition_percentage) || 0));
      return '<div class="continent-recognition-heatmap-row" role="row">' +
        '<strong role="rowheader">' + escapeHtml(tr(item.region)) + "</strong>" +
        '<span class="continent-recognition-heatmap-track" style="--recognition-rate:' + rate + '%" aria-hidden="true"><span></span></span>' +
        '<bdi dir="ltr" role="cell">' + escapeHtml(analysisPercent(rate)) + "</bdi>" +
      "</div>";
    }).join("");
  }

  function localizedRegionRecognitionInterpretation() {
    const test = state.regionRecognitionAnalysis.data?.statistical_test || {};
    const strength = tr(test.effect_strength || "Not Available").toLowerCase();
    if (test.p_value === null || test.p_value === undefined) {
      return tr("The association between region and formal recognition could not be calculated because the contingency table lacked sufficient variation.");
    }
    if (test.significant) {
      return tr("There is a statistically significant association between region and formal recognition (p < 0.05). Cramer's V indicates a {strength} association.", { strength });
    }
    return tr("No statistically significant association was detected between region and formal recognition (p >= 0.05). Cramer's V indicates a {strength} association.", { strength });
  }

  function renderRegionRecognitionFrequencyTable(bodyId, rows, labels, decimals) {
    const body = $("#" + bodyId);
    if (!body) return;
    body.innerHTML = labels.map((label, index) => {
      const row = Array.isArray(rows?.[index]) ? rows[index] : [];
      return '<tr><th scope="row">' + escapeHtml(tr(label)) + "</th>" +
        [0, 1].map((column) =>
          '<td><bdi dir="ltr">' + escapeHtml(analysisNumber(row[column], decimals)) + "</bdi></td>"
        ).join("") + "</tr>";
    }).join("");
  }

  function renderRegionRecognitionResult() {
    const data = state.regionRecognitionAnalysis.data;
    if (!data) return;
    const test = data.statistical_test || {};
    const values = {
      regionRecognitionChiSquare: analysisNumber(test.chi_square),
      regionRecognitionDf: analysisNumber(test.degrees_of_freedom, 0),
      regionRecognitionPValue: analysisPValue(test.p_value),
      regionRecognitionCramersV: analysisNumber(test.cramers_v),
      regionRecognitionTestSample: analysisNumber(test.sample_size, 0)
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $("#" + id);
      if (element) element.textContent = value;
    });
    const badge = $("#regionRecognitionSignificance");
    if (badge) {
      badge.textContent = test.p_value === null
        ? tr("Not Available")
        : test.significant ? tr("Statistically significant") : tr("Not statistically significant");
      badge.dataset.strength = test.significant ? "strong" : "unavailable";
    }
    const interpretation = $("#regionRecognitionInterpretation");
    if (interpretation) interpretation.textContent = localizedRegionRecognitionInterpretation();
    const table = test.contingency_table || {};
    renderRegionRecognitionFrequencyTable("regionRecognitionObservedBody", table.observed, table.row_labels || [], 0);
    renderRegionRecognitionFrequencyTable("regionRecognitionExpectedBody", table.expected, table.row_labels || [], 2);
  }

  function renderRegionRecognitionStackedChart() {
    const canvas = $("#regionRecognitionStackedChart");
    const source = state.regionRecognitionAnalysis.data?.charts?.percentage_stacked;
    if (!canvas || !source || !window.Chart) return;
    const colors = [
      ["rgba(40, 122, 80, .84)", "#287a50"],
      ["rgba(200, 169, 106, .82)", "#9a6b1f"],
      ["rgba(137, 145, 141, .72)", "#65716b"]
    ];
    state.regionRecognitionAnalysis.stackedChart = new window.Chart(canvas, {
      type: "bar",
      data: {
        labels: source.labels.map((label) => tr(label)),
        datasets: source.datasets.map((dataset, index) => ({
          label: tr(dataset.label),
          data: dataset.values,
          backgroundColor: colors[index][0],
          borderColor: colors[index][1],
          borderWidth: 1,
          borderSkipped: false
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, padding: 18, boxWidth: 8 } },
          tooltip: {
            backgroundColor: "#081c13",
            padding: 11,
            cornerRadius: 8,
            callbacks: { label: (context) => context.dataset.label + ": " + analysisPercent(context.raw) }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
            beginAtZero: true,
            max: 100,
            ticks: { callback: (value) => value + "%" },
            grid: { color: window.SitePreferences?.getTheme() === "dark" ? "#334139" : "#edf0ec" },
            title: { display: true, text: tr("Recognition percentage") }
          }
        }
      }
    });
  }



  function initDynamicAnalysisEngine() {
    const form = $("#dynamicAnalysisForm");
    if (!form) return;
    const variableX = $("#dynamicVariableX");
    const variableY = $("#dynamicVariableY");
    const exportCsv = $("#dynamicExportCsv");
    const exportPdf = $("#dynamicExportPdf");

    const keepVariablesDistinct = (changedSelect) => {
      if (!variableX || !variableY || variableX.value !== variableY.value) return;
      const target = changedSelect === variableX ? variableY : variableX;
      const alternative = Array.from(target.options).find(
        (option) => option.value && option.value !== changedSelect.value
      );
      if (alternative) target.value = alternative.value;
    };

    variableX?.addEventListener("change", () => keepVariablesDistinct(variableX));
    variableY?.addEventListener("change", () => keepVariablesDistinct(variableY));
    form.addEventListener("submit", runDynamicAnalysis);
    exportCsv?.addEventListener("click", exportDynamicAnalysisCsv);
    exportPdf?.addEventListener("click", exportDynamicAnalysisPdf);
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("dynamic-analysis-print");
    });
  }

  function setDynamicAnalysisStatus(message, isError = false) {
    const status = $("#dynamicAnalysisStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function setDynamicAnalysisLoading(isLoading) {
    const button = $("#dynamicAnalyzeButton");
    const spinner = $("#dynamicAnalyzeSpinner");
    const label = $("#dynamicAnalyzeLabel");
    if (button) button.disabled = isLoading;
    spinner?.classList.toggle("d-none", !isLoading);
    if (label) label.textContent = tr(isLoading ? "Analyzing..." : "Analyze Variables");
  }

  async function runDynamicAnalysis(event) {
    event.preventDefault();
    const variableX = $("#dynamicVariableX")?.value;
    const variableY = $("#dynamicVariableY")?.value;
    if (!variableX || !variableY || variableX === variableY) {
      setDynamicAnalysisStatus(tr("Select two different variables."), true);
      return;
    }

    state.dynamicAnalysisEngine.requestController?.abort();
    const controller = new AbortController();
    state.dynamicAnalysisEngine.requestController = controller;
    setDynamicAnalysisLoading(true);
    setDynamicAnalysisStatus(tr("Analyzing the selected variables..."));

    try {
      const parameters = new URLSearchParams({
        variable_x: variableX,
        variable_y: variableY
      });
      const data = await loadApiData(
        "statistical-analysis/run?" + parameters.toString(),
        { signal: controller.signal }
      );
      if (!data?.variables || !data?.statistical_test || !data?.charts) {
        throw new Error("dynamic analysis: unexpected API response format");
      }
      state.dynamicAnalysisEngine.data = data;
      renderDynamicAnalysisResult();
      setDynamicAnalysisStatus("");
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Could not run dynamic statistical analysis:", error);
      setDynamicAnalysisStatus(
        tr(error.message || "Could not load data. Please try again later."),
        true
      );
    } finally {
      if (state.dynamicAnalysisEngine.requestController === controller) {
        state.dynamicAnalysisEngine.requestController = null;
        setDynamicAnalysisLoading(false);
      }
    }
  }

  function dynamicVariableLabel(variable) {
    return tr(variable?.label || variable?.key || "Not Available");
  }

  function localizedDynamicInterpretation(data) {
    const test = data.statistical_test || {};
    if (test.p_value === null || test.p_value === undefined) {
      return tr("The selected relationship could not be calculated because the data lacked sufficient variation. No causal conclusion can be made.");
    }
    if (data.analysis_type === "categorical_categorical") {
      return test.significant
        ? tr("There is a statistically significant association between the selected variables. The result describes association, not causation.")
        : tr("No statistically significant association was detected between the selected variables. The result describes association, not causation.");
    }
    if (data.analysis_type === "numeric_numeric") {
      return test.significant
        ? tr("There is a statistically significant relationship between the selected numeric variables. The result describes association, not causation.")
        : tr("No statistically significant relationship was detected between the selected numeric variables. The result describes association, not causation.");
    }
    return test.significant
      ? tr("There is a statistically significant difference in the numeric variable across the selected categories. The result does not establish causation.")
      : tr("No statistically significant difference was detected in the numeric variable across the selected categories. The result does not establish causation.");
  }

  function renderDynamicAnalysisResult() {
    const data = state.dynamicAnalysisEngine.data;
    const result = $("#dynamicAnalysisResult");
    if (!data || !result) return;
    const test = data.statistical_test || {};
    const preparation = data.data_preparation || {};
    const effect = test.effect_size || {};
    const variableX = dynamicVariableLabel(data.variables.variable_x);
    const variableY = dynamicVariableLabel(data.variables.variable_y);
    const values = {
      dynamicSelectedVariables: variableX + " × " + variableY,
      dynamicSelectedTest: tr(test.name || "Not Available"),
      dynamicSampleSize: analysisNumber(preparation.final_sample_size, 0),
      dynamicMissingExcluded: analysisNumber(preparation.missing_values_excluded, 0),
      dynamicTestStatistic: analysisNumber(test.statistic),
      dynamicDegreesFreedom: analysisNumber(test.degrees_of_freedom),
      dynamicPValue: analysisPValue(test.p_value),
      dynamicEffectSize: effect.value === null || effect.value === undefined
        ? tr("Not Available")
        : tr(effect.name || "Effect Size") + ": " + analysisNumber(effect.value),
      dynamicEffectStrength: tr(effect.strength || "Not Available")
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $("#" + id);
      if (element) element.textContent = value;
    });

    const badge = $("#dynamicSignificanceBadge");
    if (badge) {
      badge.textContent = test.p_value === null || test.p_value === undefined
        ? tr("Not Available")
        : test.significant
          ? tr("Statistically significant")
          : tr("Not statistically significant");
      badge.dataset.strength = test.significant ? "strong" : "unavailable";
    }
    const interpretation = $("#dynamicInterpretation");
    if (interpretation) interpretation.textContent = localizedDynamicInterpretation(data);
    const reason = $("#dynamicTestReason");
    if (reason) reason.textContent = tr(test.reason || "");

    renderDynamicAnalysisDetails();
    renderDynamicAnalysisCharts();
    result.hidden = false;
    $("#dynamicExportCsv")?.removeAttribute("disabled");
    $("#dynamicExportPdf")?.removeAttribute("disabled");
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function dynamicTable(headers, rows) {
    return '<table class="data-table analysis-summary-table dynamic-details-table"><thead><tr>' +
      headers.map((header) => "<th scope=\"col\">" + escapeHtml(tr(header)) + "</th>").join("") +
      "</tr></thead><tbody>" +
      rows.map((row) => "<tr>" + row.map((value, index) =>
        (index === 0 ? "<th scope=\"row\">" : "<td>") +
        escapeHtml(value) + (index === 0 ? "</th>" : "</td>")
      ).join("") + "</tr>").join("") +
      "</tbody></table>";
  }

  function renderDynamicAnalysisDetails() {
    const container = $("#dynamicAnalysisDetails");
    const data = state.dynamicAnalysisEngine.data;
    if (!container || !data) return;
    const descriptive = data.descriptive_statistics || {};
    if (data.analysis_type === "categorical_categorical") {
      const table = descriptive.contingency_table || {};
      const rows = (table.row_labels || []).map((label, rowIndex) => [
        tr(label),
        ...(table.observed?.[rowIndex] || []).map((value) => analysisNumber(value, 0))
      ]);
      container.innerHTML = dynamicTable(
        [dynamicVariableLabel(data.variables.variable_x), ...(table.column_labels || [])],
        rows
      );
      return;
    }

    const rows = Object.entries(descriptive).map(([label, summary]) => [
      tr(label === "variable_x"
        ? dynamicVariableLabel(data.variables.variable_x)
        : label === "variable_y"
          ? dynamicVariableLabel(data.variables.variable_y)
          : label),
      analysisNumber(summary?.count, 0),
      populationValue(summary?.mean),
      populationValue(summary?.median),
      populationValue(summary?.minimum),
      populationValue(summary?.maximum),
      populationValue(summary?.standard_deviation)
    ]);
    container.innerHTML = dynamicTable(
      ["Group / Variable", "Count", "Mean", "Median", "Minimum", "Maximum", "Standard Deviation"],
      rows
    );
  }

  function destroyDynamicCharts() {
    state.dynamicAnalysisEngine.primaryChart?.destroy();
    state.dynamicAnalysisEngine.secondaryChart?.destroy();
    state.dynamicAnalysisEngine.primaryChart = null;
    state.dynamicAnalysisEngine.secondaryChart = null;
  }

  function prepareDynamicChartSurfaces() {
    destroyDynamicCharts();
    $("#dynamicSecondaryCanvasWrap")?.removeAttribute("hidden");
    const heatmap = $("#dynamicAnalysisHeatmap");
    ["dynamicPrimaryChart", "dynamicSecondaryChart"].forEach((id) => {
      const wrap = $("#" + id)?.closest(".chart-wrap");
      if (wrap) wrap.style.removeProperty("height");
    });
    if (heatmap) {
      heatmap.hidden = true;
      heatmap.innerHTML = "";
    }
  }

  function renderDynamicAnalysisCharts() {
    const data = state.dynamicAnalysisEngine.data;
    if (!data || !window.Chart) return;
    prepareDynamicChartSurfaces();
    const recommended = data.charts?.recommended;
    if (recommended === "categorical") {
      renderDynamicCategoricalCharts(data);
    } else if (recommended === "correlation") {
      renderDynamicCorrelationCharts(data);
    } else {
      renderDynamicNumericCategoryCharts(data);
    }
  }

  function renderDynamicCategoricalCharts(data) {
    const source = data.charts.stacked_bar || {};
    const primary = $("#dynamicPrimaryChart");
    if (!primary) return;
    $("#dynamicPrimaryChartTitle").textContent = tr("Stacked Bar Chart");
    $("#dynamicSecondaryChartTitle").textContent = tr("Frequency Heatmap");
    $("#dynamicChartDescription").textContent = tr("Counts and contingency-table intensity are generated from complete observations.");
    const palette = [
      "rgba(40, 122, 80, .82)",
      "rgba(200, 169, 106, .82)",
      "rgba(70, 106, 88, .72)",
      "rgba(171, 118, 67, .72)",
      "rgba(102, 126, 115, .72)"
    ];
    state.dynamicAnalysisEngine.primaryChart = new window.Chart(primary, {
      type: "bar",
      data: {
        labels: (source.labels || []).map((label) => tr(label)),
        datasets: (source.datasets || []).map((dataset, index) => ({
          label: tr(dataset.label),
          data: dataset.values,
          backgroundColor: palette[index % palette.length],
          borderRadius: 4,
          borderSkipped: false
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } },
          tooltip: { backgroundColor: "#081c13", padding: 11, cornerRadius: 8 }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
    $("#dynamicSecondaryCanvasWrap")?.setAttribute("hidden", "");
    renderDynamicHeatmap(data.charts.heatmap);
  }

  function renderDynamicHeatmap(source) {
    const container = $("#dynamicAnalysisHeatmap");
    if (!container || !source) return;
    const flatValues = (source.values || []).flat().map(Number);
    const maximum = Math.max(1, ...flatValues);
    const header = "<tr><th></th>" + (source.columns || []).map(
      (label) => "<th scope=\"col\">" + escapeHtml(tr(label)) + "</th>"
    ).join("") + "</tr>";
    const rows = (source.rows || []).map((label, rowIndex) =>
      "<tr><th scope=\"row\">" + escapeHtml(tr(label)) + "</th>" +
      (source.values?.[rowIndex] || []).map((value) =>
        "<td style=\"--heat-strength:" + Math.round(Number(value) / maximum * 88) +
        "\" title=\"" + escapeHtml(tr("Frequency") + ": " + analysisNumber(value, 0)) +
        "\"><bdi dir=\"ltr\">" + escapeHtml(analysisNumber(value, 0)) + "</bdi></td>"
      ).join("") + "</tr>"
    ).join("");
    container.innerHTML = '<table class="dynamic-heatmap-table"><thead>' +
      header + "</thead><tbody>" + rows + "</tbody></table>";
    container.hidden = false;
  }

  function renderDynamicNumericCategoryCharts(data) {
    const items = data.charts?.box_plot?.items || [];
    const primary = $("#dynamicPrimaryChart");
    const secondary = $("#dynamicSecondaryChart");
    if (!primary || !secondary) return;
    $("#dynamicPrimaryChartTitle").textContent = tr("Box Plot");
    const primaryWrap = primary?.closest(".chart-wrap");
    if (primaryWrap && items.length > 10) {
      primaryWrap.style.height = Math.min(1500, items.length * 27) + "px";
    }
    $("#dynamicChartDescription").textContent = tr("Population distributions are summarized automatically for each observed category.");
    state.dynamicAnalysisEngine.primaryChart = new window.Chart(primary, {
      type: "bar",
      data: {
        labels: items.map((item) => tr(item.label)),
        datasets: [{
          label: tr("Interquartile Range"),
          data: items.map((item) => [item.first_quartile, item.third_quartile]),
          backgroundColor: "rgba(40, 122, 80, .72)",
          borderColor: "#123524",
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: .55
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#081c13",
            callbacks: {
              label(context) {
                const item = items[context.dataIndex];
                return [
                  tr("Minimum") + ": " + populationValue(item.minimum),
                  tr("Median") + ": " + populationValue(item.median),
                  tr("Maximum") + ": " + populationValue(item.maximum)
                ];
              }
            }
          }
        },
        scales: {
          x: {
            type: "logarithmic",
            grid: { color: window.SitePreferences?.getTheme() === "dark" ? "#334139" : "#edf0ec" },
            ticks: { callback: (value) => populationCompact(value) }
          },
          y: { grid: { display: false } }
        }
      }
    });

    const histogram = data.charts?.histogram;
    if (histogram?.bin_edges?.length > 1) {
      $("#dynamicSecondaryChartTitle").textContent = tr("Histogram");
      const labels = histogram.bin_edges.slice(0, -1).map((edge, index) =>
        populationCompact(edge) + "–" + populationCompact(histogram.bin_edges[index + 1])
      );
      state.dynamicAnalysisEngine.secondaryChart = new window.Chart(secondary, {
        type: "bar",
        data: {
          labels,
          datasets: (histogram.datasets || []).map((dataset, index) => ({
            label: tr(dataset.label),
            data: dataset.counts,
            backgroundColor: index % 2
              ? "rgba(200, 169, 106, .72)"
              : "rgba(40, 122, 80, .72)",
            borderRadius: 4,
            borderSkipped: false
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
          scales: {
            x: { grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 8 } },
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
      return;
    }

    $("#dynamicSecondaryChartTitle").textContent = tr("Median by Category");
    state.dynamicAnalysisEngine.secondaryChart = new window.Chart(secondary, {
      type: "bar",
      data: {
        labels: items.map((item) => tr(item.label)),
        datasets: [{
          label: tr("Median"),
          data: items.map((item) => item.median),
          backgroundColor: "rgba(200, 169, 106, .78)",
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
      }
    });
  }

  function renderDynamicCorrelationCharts(data) {
    const source = data.charts?.scatter || {};
    const primary = $("#dynamicPrimaryChart");
    const secondary = $("#dynamicSecondaryChart");
    if (!primary || !secondary) return;
    $("#dynamicPrimaryChartTitle").textContent = tr("Scatter Plot");
    $("#dynamicSecondaryChartTitle").textContent = tr("Numeric Summary");
    $("#dynamicChartDescription").textContent = tr("The scatter plot displays paired observations and an optional fitted trend line.");
    const datasets = [{
      label: tr("Observed pairs"),
      data: source.points || [],
      backgroundColor: "rgba(40, 122, 80, .65)",
      pointRadius: 4
    }];
    if (source.regression_line) {
      datasets.push({
        label: tr("Regression line"),
        data: source.regression_line,
        type: "line",
        borderColor: "#c8a96a",
        backgroundColor: "#c8a96a",
        pointRadius: 0,
        borderWidth: 2
      });
    }
    state.dynamicAnalysisEngine.primaryChart = new window.Chart(primary, {
      type: "scatter",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { type: "linear", position: "bottom" },
          y: { type: "linear" }
        }
      }
    });
    const descriptive = data.descriptive_statistics || {};
    const variables = [data.variables.variable_x, data.variables.variable_y];
    const summaries = [descriptive.variable_x || {}, descriptive.variable_y || {}];
    state.dynamicAnalysisEngine.secondaryChart = new window.Chart(secondary, {
      type: "bar",
      data: {
        labels: variables.map(dynamicVariableLabel),
        datasets: [
          { label: tr("Mean"), data: summaries.map((item) => item.mean), backgroundColor: "rgba(40, 122, 80, .75)" },
          { label: tr("Median"), data: summaries.map((item) => item.median), backgroundColor: "rgba(200, 169, 106, .75)" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
      }
    });
  }

  function dynamicExportRows(data) {
    const test = data.statistical_test || {};
    const effect = test.effect_size || {};
    const preparation = data.data_preparation || {};
    return [
      ["Variable X", dynamicVariableLabel(data.variables.variable_x)],
      ["Variable Y", dynamicVariableLabel(data.variables.variable_y)],
      ["Selected Statistical Test", tr(test.name || "Not Available")],
      ["Sample Size", preparation.final_sample_size],
      ["Missing Values Excluded", preparation.missing_values_excluded],
      ["Test Statistic", test.statistic],
      ["Degrees of Freedom", test.degrees_of_freedom],
      ["p-value", test.p_value],
      ["Effect Size", effect.name],
      ["Effect Size Value", effect.value],
      ["Strength", effect.strength],
      ["Interpretation", localizedDynamicInterpretation(data)],
      ["Descriptive Statistics", JSON.stringify(data.descriptive_statistics || {})]
    ];
  }

  function csvCell(value) {
    const textValue = value === null || value === undefined ? "" : String(value);
    return '"' + textValue.replaceAll('"', '""') + '"';
  }

  function exportDynamicAnalysisCsv() {
    const data = state.dynamicAnalysisEngine.data;
    if (!data) return;
    const csv = "﻿" + dynamicExportRows(data)
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dynamic-analysis-" +
      data.variables.variable_x.key + "-vs-" + data.variables.variable_y.key + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportDynamicAnalysisPdf() {
    if (!state.dynamicAnalysisEngine.data) return;
    document.body.classList.add("dynamic-analysis-print");
    window.print();
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
    if ($("#analysisStatus")) setStatisticalAnalysisStatus(message, true);
    if ($("#analysisDetail")) $("#analysisDetail").setAttribute("aria-busy", "false");
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
