/* ================================================================
   Traditional Governments Database & Explorer
   Shared behavior and live API presentation layer
   ================================================================ */

(function () {
  "use strict";

  const API_BASE_URL = "http://localhost:3000/api";
  const PAGE_SIZE = 6;
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
    anyTpiFilter: ""
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const tr = (value, variables) => window.SiteI18n?.t(value, variables) ?? String(value ?? "");
  const isArabic = () => (window.SitePreferences?.getLanguage() || document.documentElement.lang) === "ar";

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
    const requiresGroups = ["home", "groups", "comparison", "statistics"].includes(page);
    if (!requiresGroups) return;

    try {
      const needsSummaries = ["home", "statistics"].includes(page);
      const needsStatistics = page === "statistics";
      const [groups, stats, continents, leadership, largestGroups, topCountries] = await Promise.all([
        loadGroups(),
        needsSummaries ? loadApiData("stats") : Promise.resolve(null),
        needsSummaries ? loadApiData("continents") : Promise.resolve([]),
        needsStatistics ? loadApiData("leadership") : Promise.resolve(null),
        needsStatistics ? loadApiData("largest-groups") : Promise.resolve([]),
        needsStatistics ? loadApiData("top-countries") : Promise.resolve([])
      ]);

      state.groups = groups;
      state.filtered = [...groups];
      state.stats = stats ? normalizeStats(stats) : null;
      state.continents = Array.isArray(continents) ? continents.map(normalizeContinentSummary) : [];
      state.leadership = normalizeLeadershipSummary(leadership);
      state.largestGroups = Array.isArray(largestGroups) ? largestGroups.map(normalizeLargestGroup) : [];
      state.topCountries = Array.isArray(topCountries) ? topCountries.map(normalizeTopCountry) : [];

      updateGlobalDataViews();
      initExplorer();
      initComparison();
      initStatisticsPage();
      initDetailActions();
      animateCounters();
    } catch (error) {
      console.error("Could not load data from the backend API:", error);
      showDataError(error);
    }
  }

  async function loadApiData(endpoint) {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      cache: "no-store",
      headers: { Accept: "application/json" }
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

  async function loadGroups() {
    const limit = 100;
    const firstPage = await loadApiData(`groups?page=1&limit=${limit}`);
    const firstRecords = extractGroupRecords(firstPage);
    const pagination = firstPage?.pagination || {};
    const total = toNumber(pagination.total_items ?? pagination.total ?? pagination.total_records);
    const totalPages = toNumber(pagination.total_pages ?? pagination.totalPages)
      ?? (total == null ? null : Math.ceil(total / limit));

    if (totalPages != null && totalPages > 1) {
      const remainingPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) => index + 2)
          .map((page) => loadApiData(`groups?page=${page}&limit=${limit}`))
      );
      return [firstRecords, ...remainingPages.map(extractGroupRecords)]
        .flat()
        .map(normalizeGroup);
    }

    const allRecords = [...firstRecords];
    let page = 2;
    let records = firstRecords;
    while (totalPages == null && records.length === limit) {
      const data = await loadApiData(`groups?page=${page}&limit=${limit}`);
      records = extractGroupRecords(data);
      allRecords.push(...records);
      page += 1;
    }
    return allRecords.map(normalizeGroup);
  }

  function extractGroupRecords(data) {
    const records = Array.isArray(data)
      ? data
      : data?.groups || data?.items || data?.records;
    if (!Array.isArray(records)) throw new Error("groups: unexpected API response format");
    return records;
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
      totalTraditional: toNumber(data.groups_with_tpi) ?? 0
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
    const recognized = state.groups.filter((group) => group.FormAckn === 1).length;
    const traditional = state.groups.filter((group) => group.Any_TPI === 1).length;
    const metrics = state.stats
      ? { ...state.stats, totalRecognized: recognized }
      : {
          totalGroups: state.groups.length,
          totalCountries: uniqueValues("Country").length,
          totalContinents: uniqueValues("Continent").length,
          totalRegions: uniqueValues("Region").length,
          totalTraditional: traditional,
          totalRecognized: recognized
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

  function initExplorer() {
    const tableBody = $("#groupsTableBody");
    if (!tableBody) return;

    populateFilter("countryFilter", uniqueValues("Country"));
    populateFilter("continentFilter", uniqueValues("Continent"));
    populateFilter("regionFilter", uniqueValues("Region"));
    applyExplorerQueryParameters();

    const search = $("#groupSearch");
    [search, $("#countryFilter"), $("#continentFilter"), $("#regionFilter"), $("#leadershipFilter"), $("#recognitionFilter")]
      .filter(Boolean)
      .forEach((control) => {
        control.addEventListener(control === search ? "input" : "change", () => {
          state.page = 1;
          applyExplorerFilters();
        });
      });

    $("#resetFilters")?.addEventListener("click", () => {
      ["groupSearch", "countryFilter", "continentFilter", "regionFilter", "leadershipFilter", "recognitionFilter"]
        .forEach((id) => {
          const control = $(`#${id}`);
          if (control) control.value = "";
        });
      state.page = 1;
      state.sortKey = "GroupName";
      state.sortDirection = "asc";
      state.anyTpiFilter = "";
      applyExplorerFilters();
    });

    $$('[data-sort]').forEach((header) => {
      header.addEventListener("click", () => {
        const key = header.dataset.sort;
        if (state.sortKey === key) state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
        else {
          state.sortKey = key;
          state.sortDirection = "asc";
        }
        applyExplorerFilters();
      });
    });

    applyExplorerFilters();
  }

  function applyExplorerQueryParameters() {
    const params = new URLSearchParams(window.location.search);
    const search = params.get("search");
    if (search != null && $("#groupSearch")) $("#groupSearch").value = search;

    setSelectFromQuery("countryFilter", "country", params.get("country"));
    setSelectFromQuery("continentFilter", "continent", params.get("continent"));
    setSelectFromQuery("regionFilter", "region", params.get("region"));
    state.anyTpiFilter = normalizeBinaryQueryParameter(params.get("any_tpi"));
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
      any_tpi: state.anyTpiFilter
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

  function applyExplorerFilters() {
    const term = ($("#groupSearch")?.value || "").trim().toLocaleLowerCase();
    const country = $("#countryFilter")?.value || "";
    const continent = $("#continentFilter")?.value || "";
    const region = $("#regionFilter")?.value || "";
    const leadership = $("#leadershipFilter")?.value || "";
    const recognition = $("#recognitionFilter")?.value || "";
    const anyTpi = state.anyTpiFilter;

    state.filtered = state.groups.filter((group) => {
      const matchesTerm = !term || [group.GroupName, group.GroupNameAr]
        .some((name) => String(name || "").toLocaleLowerCase().includes(term));
      const matchesCountry = !country || group.Country === country;
      const matchesContinent = !continent || group.Continent === continent;
      const matchesRegion = !region || group.Region === region;
      const matchesLeadership = !leadership || group[leadership] === 1;
      const matchesRecognition = !recognition || (recognition === "missing" ? group.FormAckn == null : String(group.FormAckn) === recognition);
      const matchesAnyTpi = !anyTpi || (anyTpi === "missing" ? group.Any_TPI == null : String(group.Any_TPI) === anyTpi);
      return matchesTerm && matchesCountry && matchesContinent && matchesRegion && matchesLeadership && matchesRecognition && matchesAnyTpi;
    });

    state.filtered.sort((a, b) => {
      let left = state.sortKey === "GroupName" ? getGroupDisplayName(a) : a[state.sortKey];
      let right = state.sortKey === "GroupName" ? getGroupDisplayName(b) : b[state.sortKey];
      if (left == null) left = state.sortDirection === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      if (right == null) right = state.sortDirection === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      const result = typeof left === "number"
        ? left - right
        : String(left).localeCompare(String(right), undefined, { sensitivity: "base" });
      return state.sortDirection === "asc" ? result : -result;
    });

    const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    updateExplorerQueryString();
    renderGroupsTable();
    renderPagination(totalPages);
  }

  function renderGroupsTable() {
    const body = $("#groupsTableBody");
    const count = $("#resultsCount");
    if (!body) return;

    if (count) {
      count.innerHTML = isArabic()
        ? `عرض <strong>${state.filtered.length.toLocaleString("ar")}</strong> من سجلات قاعدة البيانات`
        : `Showing <strong>${state.filtered.length.toLocaleString()}</strong> database record${state.filtered.length === 1 ? "" : "s"}`;
    }

    if (!state.filtered.length) {
      body.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="bi bi-search d-block fs-2 mb-2"></i>${tr("No groups match the selected criteria.")}</td></tr>`;
      return;
    }

    const start = (state.page - 1) * PAGE_SIZE;
    const records = state.filtered.slice(start, start + PAGE_SIZE);
    body.innerHTML = records.map(groupTableRow).join("");
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
    const buttons = [];
    buttons.push(`<button class="page-btn" data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""} aria-label="${tr("Previous page")}"><i class="bi bi-chevron-left"></i></button>`);
    paginationRange(totalPages, state.page).forEach((page) => {
      if (page === "ellipsis") {
        buttons.push('<span class="page-ellipsis" aria-hidden="true">…</span>');
        return;
      }
      buttons.push(`<button class="page-btn ${page === state.page ? "active" : ""}" data-page="${page}" aria-label="${tr("Page {page}", { page })}" ${page === state.page ? 'aria-current="page"' : ""}>${page}</button>`);
    });
    buttons.push(`<button class="page-btn" data-page="${state.page + 1}" ${state.page === totalPages ? "disabled" : ""} aria-label="${tr("Next page")}"><i class="bi bi-chevron-right"></i></button>`);
    container.innerHTML = buttons.join("");
    $$('.page-btn:not([disabled])', container).forEach((button) => {
      button.addEventListener("click", () => {
        state.page = Number(button.dataset.page);
        renderGroupsTable();
        renderPagination(totalPages);
        $("#groupsTable")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

    const render = () => renderComparison(Number(leftSelect.value), Number(rightSelect.value));
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

  function renderComparison(leftId, rightId) {
    const left = state.groups.find((group) => group.id === leftId);
    const right = state.groups.find((group) => group.id === rightId);
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
      [tr("Land management")]: countYes("Func_Land"),
      [tr("Security")]: countYes("Func_Sec"),
      [tr("Healing / healthcare")]: countYes("Func_Heal")
    };
    const recognitionData = {
      [tr("Recognized")]: countYes("FormAckn"),
      [tr("Not recognized")]: state.groups.filter((group) => group.FormAckn === 0).length,
      [tr("Not available")]: state.groups.filter((group) => group.FormAckn == null).length
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
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopPropagation();
      form.classList.add("was-validated");
      if (!form.checkValidity()) return;
      if (status) {
        status.textContent = tr("Thank you. Your message has been captured in this frontend demonstration (nothing was sent).");
        status.classList.add("is-visible");
      }
      form.reset();
      form.classList.remove("was-validated");
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

  function countYes(field) {
    return state.groups.filter((group) => group[field] === 1).length;
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
