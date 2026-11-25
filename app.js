/**
 * tumesh007 // Project Hub & Portfolio Controller
 * Zero-Build, Fast, Client-Side GitHub API Sync with Rate-Limit Defense
 */

(function () {
  "use strict";

  // Constants
  const STORAGE_KEY_REPOS = "tumesh_portfolio_repos_v1";
  const STORAGE_KEY_THEME = "tumesh_theme_v1";
  const GITHUB_API_URL = "https://api.github.com/users/tumesh007/repos?per_page=100&sort=updated";

  // Language Colors Map (GitHub style)
  const LANG_COLORS = {
    JavaScript: "#f1e05a",
    TypeScript: "#3178c6",
    HTML: "#e34c26",
    OpenSCAD: "#00a4a6",
    Kotlin: "#a97bff",
    "C++": "#f34b7d",
    C: "#555555",
    Python: "#3572a5",
    CSS: "#563d7c",
    Shell: "#89e051",
    Default: "#64748b"
  };

  // State
  const state = {
    config: null,
    rawRepos: [],
    processedRepos: [],
    activeCategory: "all",
    searchQuery: "",
    sortBy: "updated",
    currentTheme: "dark",
    lastSyncTime: null,
    isSyncing: false,
    rateLimitRemaining: null
  };

  // DOM Elements Cache
  const DOM = {};

  // ==========================================================================
  // Initialization
  // ==========================================================================
  async function init() {
    cacheDOMElements();
    initTheme();
    bindEvents();

    try {
      // 1. Load config.json first
      await loadConfig();

      // 2. Fetch or load cached repositories
      await loadRepositories(false);

      // 3. Render everything
      renderAll();
    } catch (err) {
      console.error("Initialization error:", err);
      showSyncStatus("Failed to initialize: " + err.message, "offline");
    }
  }

  function cacheDOMElements() {
    DOM.themeToggle = document.getElementById("theme-toggle");
    DOM.themeIcon = document.getElementById("theme-icon");
    DOM.searchInput = document.getElementById("search-input");
    DOM.searchClearBtn = document.getElementById("search-clear-btn");
    DOM.sortSelect = document.getElementById("sort-select");
    DOM.filterPillsWrap = document.getElementById("filter-pills-wrap");
    DOM.featuredSection = document.getElementById("featured-section");
    DOM.featuredGrid = document.getElementById("featured-grid");
    DOM.featuredCountBadge = document.getElementById("featured-count-badge");
    DOM.allProjectsSection = document.getElementById("all-projects-section");
    DOM.allProjectsGrid = document.getElementById("all-projects-grid");
    DOM.allProjectsCountBadge = document.getElementById("all-projects-count-badge");
    DOM.emptyState = document.getElementById("empty-state");
    DOM.btnResetFilters = document.getElementById("btn-reset-filters");
    DOM.btnRefreshData = document.getElementById("btn-refresh-data");
    DOM.syncDot = document.getElementById("sync-dot");
    DOM.syncStatusText = document.getElementById("sync-status-text");
    DOM.cacheTtlText = document.getElementById("cache-ttl-text");

    // Metrics elements
    DOM.metricTotal = document.getElementById("metric-total-repos");
    DOM.metricWebApps = document.getElementById("metric-web-apps");
    DOM.metricCad = document.getElementById("metric-cad-models");
    DOM.metricStars = document.getElementById("metric-total-stars");
  }

  // ==========================================================================
  // Theme Management
  // ==========================================================================
  function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
    if (savedTheme) {
      state.currentTheme = savedTheme;
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      state.currentTheme = prefersDark ? "dark" : "light";
    }
    applyTheme(state.currentTheme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    state.currentTheme = theme;
    localStorage.setItem(STORAGE_KEY_THEME, theme);

    if (DOM.themeIcon) {
      if (theme === "dark") {
        // Moon icon -> clicking switches to light
        DOM.themeIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
        DOM.themeToggle.setAttribute("title", "Switch to Light Theme");
      } else {
        // Sun icon -> clicking switches to dark
        DOM.themeIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
        DOM.themeToggle.setAttribute("title", "Switch to Dark Theme");
      }
    }
  }

  function toggleTheme() {
    const nextTheme = state.currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  }

  // ==========================================================================
  // Config & GitHub API Sync
  // ==========================================================================
  async function loadConfig() {
    try {
      const response = await fetch("config.json");
      if (!response.ok) throw new Error("Could not load config.json: " + response.statusText);
      state.config = await response.json();
    } catch (err) {
      console.warn("Using fallback configuration:", err);
      state.config = {
        hiddenRepos: ["tumesh007.github.io", "tumesh007"],
        featured: ["phone-wall-clock-enclosure-generator", "guava-home", "Shaving-Bowl"],
        categories: [
          { id: "all", label: "All Projects" },
          { id: "featured", label: "Featured" },
          { id: "web-apps", label: "Web Apps" },
          { id: "3d-printing", label: "3D Printing & CAD" },
          { id: "iot", "label": "ESP32 & IoT" },
          { id: "android-tools", label: "Android & Tools" }
        ],
        repoOverrides: {}
      };
    }
  }

  async function loadRepositories(forceRefresh = false) {
    state.isSyncing = true;
    updateRefreshButtonState(true);

    const cacheTtlMs = (state.config?.settings?.cacheTtlMinutes || 30) * 60 * 1000;
    const cached = getStoredCache();

    // Check if we can use existing cache
    if (!forceRefresh && cached && Date.now() - cached.timestamp < cacheTtlMs) {
      state.rawRepos = cached.data;
      state.lastSyncTime = new Date(cached.timestamp);
      processRepositories();
      showSyncStatus(`Synced from Cache (${state.rawRepos.length} repos)`, "cached");
      updateCacheExpiryText(cached.timestamp, cacheTtlMs);
      state.isSyncing = false;
      updateRefreshButtonState(false);
      return;
    }

    // Fetch fresh data from GitHub API
    showSyncStatus("Syncing with GitHub API...", "syncing");

    try {
      const res = await fetch(GITHUB_API_URL);

      // Check Rate Limit headers
      const remaining = res.headers.get("x-ratelimit-remaining");
      if (remaining !== null) {
        state.rateLimitRemaining = parseInt(remaining, 10);
      }

      if (res.status === 403 || res.status === 429) {
        throw new Error("GitHub API rate limit exceeded");
      }

      if (!res.ok) {
        throw new Error(`GitHub API error (${res.status}): ${res.statusText}`);
      }

      const repos = await res.json();
      state.rawRepos = repos;
      state.lastSyncTime = new Date();

      // Save to localStorage
      saveCache(repos);
      processRepositories();

      showSyncStatus(`Live GitHub Sync (${repos.length} repos)`, "idle");
      updateCacheExpiryText(Date.now(), cacheTtlMs);
    } catch (err) {
      console.warn("GitHub fetch failed, checking cached or fallback data:", err);

      if (cached && cached.data && cached.data.length > 0) {
        // Fallback to expired cache
        state.rawRepos = cached.data;
        state.lastSyncTime = new Date(cached.timestamp);
        processRepositories();
        showSyncStatus(`Using cached data (${err.message})`, "rate_limited");
        updateCacheExpiryText(cached.timestamp, cacheTtlMs);
      } else {
        // Ultimate fallback to synthetic entries from config overrides
        const fallbackList = buildFallbackRepos();
        state.rawRepos = fallbackList;
        state.lastSyncTime = new Date();
        processRepositories();
        showSyncStatus(`Loaded offline fallback (${fallbackList.length} repos)`, "offline");
      }
    } finally {
      state.isSyncing = false;
      updateRefreshButtonState(false);
    }
  }

  function getStoredCache() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_REPOS);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveCache(data) {
    try {
      const entry = {
        timestamp: Date.now(),
        data: data
      };
      localStorage.setItem(STORAGE_KEY_REPOS, JSON.stringify(entry));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }

  function buildFallbackRepos() {
    if (!state.config?.repoOverrides) return [];
    return Object.keys(state.config.repoOverrides).map((name) => {
      const ov = state.config.repoOverrides[name];
      return {
        name: name,
        description: ov.description || "",
        html_url: `https://github.com/tumesh007/${name}`,
        homepage: ov.homepage || null,
        has_pages: !!ov.homepage,
        stargazers_count: 0,
        forks_count: 0,
        language: (ov.tags && ov.tags[0]) || "OpenSCAD",
        topics: ov.tags || [],
        updated_at: new Date().toISOString(),
        pushed_at: new Date().toISOString(),
        default_branch: "main"
      };
    });
  }

  // ==========================================================================
  // Data Normalization & Processing
  // ==========================================================================
  function processRepositories() {
    const hiddenSet = new Set(state.config?.hiddenRepos || []);
    const featuredList = state.config?.featured || [];
    const overrides = state.config?.repoOverrides || {};

    state.processedRepos = state.rawRepos
      .filter((repo) => !hiddenSet.has(repo.name))
      .map((repo) => {
        const ov = overrides[repo.name] || {};

        // 1. Determine Title & Description
        const title = ov.title || formatRepoName(repo.name);
        const description = ov.description || repo.description || "Open source project on GitHub.";

        // 2. Determine Category
        let category = ov.category || inferCategory(repo);
        const isFeatured = featuredList.includes(repo.name);

        // 3. Category Label & Pill Class
        let categoryLabel = ov.categoryLabel;
        if (!categoryLabel) {
          const catObj = state.config?.categories?.find((c) => c.id === category);
          categoryLabel = catObj ? catObj.label : "General";
        }

        // 4. Determine Live Launch URL
        let liveUrl = null;
        if (ov.homepage) {
          liveUrl = ov.homepage;
        } else if (repo.homepage && repo.homepage.startsWith("http") && !repo.homepage.includes("/releases/")) {
          liveUrl = repo.homepage;
        } else if (repo.has_pages) {
          liveUrl = `https://tumesh007.github.io/${repo.name}/`;
        }

        // 5. Determine Direct Downloads
        let downloads = [];
        if (ov.downloads && Array.isArray(ov.downloads)) {
          downloads = ov.downloads;
        } else {
          downloads = [
            {
              label: "Download ZIP",
              url: `https://github.com/tumesh007/${repo.name}/archive/refs/heads/${repo.default_branch || "main"}.zip`,
              type: "zip"
            }
          ];
        }

        // 6. Tags
        const rawTags = [
          ...(ov.tags || []),
          ...(repo.topics || []),
          repo.language
        ].filter(Boolean);
        const tags = Array.from(new Set(rawTags));

        // 7. Dates
        const dateUpdated = new Date(repo.pushed_at || repo.updated_at || repo.created_at);

        return {
          id: repo.name,
          name: repo.name,
          title: title,
          description: description,
          category: category,
          categoryLabel: categoryLabel,
          isFeatured: isFeatured,
          liveUrl: liveUrl,
          downloads: downloads,
          sourceUrl: repo.html_url || `https://github.com/tumesh007/${repo.name}`,
          stars: repo.stargazers_count || 0,
          forks: repo.forks_count || 0,
          language: repo.language || "OpenSCAD",
          langColor: LANG_COLORS[repo.language] || LANG_COLORS.Default,
          tags: tags,
          updatedAt: dateUpdated,
          updatedAgo: formatRelativeTime(dateUpdated)
        };
      });
  }

  function inferCategory(repo) {
    const lang = (repo.language || "").toLowerCase();
    const name = repo.name.toLowerCase();
    const desc = (repo.description || "").toLowerCase();

    // 3D Printing / CAD
    if (
      lang === "openscad" ||
      name.includes("customizer") ||
      name.includes("3d") ||
      name.includes("enclosure") ||
      name.includes("bowl") ||
      name.includes("holder") ||
      name.includes("fastener") ||
      name.includes("dock") ||
      name.includes("plate") ||
      desc.includes("3d-print") ||
      desc.includes("openscad") ||
      desc.includes("parametric")
    ) {
      return "3d-printing";
    }

    // IoT / Embedded
    if (
      lang === "c++" ||
      lang === "c" ||
      name.includes("esp32") ||
      name.includes("iot") ||
      name.includes("arduino") ||
      name.includes("shield") ||
      name.includes("mic") ||
      desc.includes("esp32") ||
      desc.includes("home assistant")
    ) {
      return "iot";
    }

    // Android / Tools
    if (
      lang === "kotlin" ||
      lang === "java" ||
      lang === "python" ||
      name.includes("android") ||
      name.includes("banker") ||
      name.includes("idcard")
    ) {
      return "android-tools";
    }

    // Web Apps
    if (
      repo.has_pages ||
      lang === "javascript" ||
      lang === "typescript" ||
      lang === "html"
    ) {
      return "web-apps";
    }

    return "all";
  }

  function formatRepoName(raw) {
    return raw
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `on ${months[date.getMonth()]} ${date.getDate()}`;
  }

  // ==========================================================================
  // Filtering & Sorting
  // ==========================================================================
  function getFilteredAndSortedRepos() {
    let list = [...state.processedRepos];

    // Category Filter
    if (state.activeCategory === "featured") {
      list = list.filter((r) => r.isFeatured);
    } else if (state.activeCategory !== "all") {
      list = list.filter((r) => r.category === state.activeCategory);
    }

    // Search Query
    if (state.searchQuery.trim() !== "") {
      const q = state.searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        return (
          r.title.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.categoryLabel.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)) ||
          r.language.toLowerCase().includes(q)
        );
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (state.sortBy === "stars") {
        return b.stars - a.stars;
      }
      if (state.sortBy === "name") {
        return a.title.localeCompare(b.title);
      }
      // default: updated
      return b.updatedAt - a.updatedAt;
    });

    return list;
  }

  // ==========================================================================
  // Rendering
  // ==========================================================================
  function renderAll() {
    renderHeroMetrics();
    renderFilterPills();
    renderProjectGrids();
  }

  function renderHeroMetrics() {
    const total = state.processedRepos.length;
    const webApps = state.processedRepos.filter((r) => r.liveUrl).length;
    const cadModels = state.processedRepos.filter((r) => r.category === "3d-printing").length;
    let stars = 0;
    state.processedRepos.forEach((r) => (stars += r.stars));

    if (DOM.metricTotal) DOM.metricTotal.textContent = total;
    if (DOM.metricWebApps) DOM.metricWebApps.textContent = webApps;
    if (DOM.metricCad) DOM.metricCad.textContent = cadModels;
    if (DOM.metricStars) DOM.metricStars.textContent = stars;
  }

  function renderFilterPills() {
    if (!DOM.filterPillsWrap) return;

    const categories = state.config?.categories || [
      { id: "all", label: "All Projects" },
      { id: "featured", label: "Featured" },
      { id: "web-apps", label: "Web Apps" },
      { id: "3d-printing", label: "3D Printing & CAD" },
      { id: "iot", label: "ESP32 & IoT" },
      { id: "android-tools", label: "Android & Tools" }
    ];

    DOM.filterPillsWrap.innerHTML = "";

    categories.forEach((cat) => {
      // Calculate count for this category
      let count = 0;
      if (cat.id === "all") {
        count = state.processedRepos.length;
      } else if (cat.id === "featured") {
        count = state.processedRepos.filter((r) => r.isFeatured).length;
      } else {
        count = state.processedRepos.filter((r) => r.category === cat.id).length;
      }

      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = `filter-pill ${state.activeCategory === cat.id ? "active" : ""}`;
      pill.setAttribute("data-category", cat.id);
      pill.innerHTML = `
        <span>${escapeHTML(cat.label)}</span>
        <span class="pill-count">${count}</span>
      `;

      pill.addEventListener("click", () => {
        state.activeCategory = cat.id;
        renderFilterPills();
        renderProjectGrids();
      });

      DOM.filterPillsWrap.appendChild(pill);
    });
  }

  function renderProjectGrids() {
    const filtered = getFilteredAndSortedRepos();

    // Check if empty
    if (filtered.length === 0) {
      if (DOM.featuredSection) DOM.featuredSection.style.display = "none";
      if (DOM.allProjectsSection) DOM.allProjectsSection.style.display = "none";
      if (DOM.emptyState) DOM.emptyState.style.display = "flex";
      return;
    } else {
      if (DOM.emptyState) DOM.emptyState.style.display = "none";
    }

    // Featured section behavior:
    // If user is on "All Projects" and has no active search query, show pinned featured section at top.
    const showFeaturedSeparately =
      state.activeCategory === "all" && state.searchQuery.trim() === "";

    if (showFeaturedSeparately) {
      const featuredRepos = state.processedRepos.filter((r) => r.isFeatured);
      if (DOM.featuredSection) DOM.featuredSection.style.display = "block";
      if (DOM.featuredCountBadge) DOM.featuredCountBadge.textContent = `${featuredRepos.length} Pinned`;
      if (DOM.featuredGrid) {
        DOM.featuredGrid.innerHTML = featuredRepos
          .map((repo) => createProjectCardHTML(repo, true))
          .join("");
      }

      // All projects below (excluding featured to avoid duplicate display in overview)
      const remainingRepos = filtered.filter((r) => !r.isFeatured);
      if (DOM.allProjectsSection) DOM.allProjectsSection.style.display = "block";
      if (DOM.allProjectsCountBadge) DOM.allProjectsCountBadge.textContent = `${remainingRepos.length} Projects`;
      if (DOM.allProjectsGrid) {
        DOM.allProjectsGrid.innerHTML = remainingRepos
          .map((repo) => createProjectCardHTML(repo, false))
          .join("");
      }
    } else {
      // In search or category filter view, hide featured wrapper and display unified results in all projects
      if (DOM.featuredSection) DOM.featuredSection.style.display = "none";
      if (DOM.allProjectsSection) DOM.allProjectsSection.style.display = "block";
      if (DOM.allProjectsCountBadge) DOM.allProjectsCountBadge.textContent = `${filtered.length} Projects`;
      if (DOM.allProjectsGrid) {
        DOM.allProjectsGrid.innerHTML = filtered
          .map((repo) => createProjectCardHTML(repo, repo.isFeatured))
          .join("");
      }
    }

    // Bind card interactive events
    bindCardEvents();
  }

  function createProjectCardHTML(repo, isFeatured) {
    const catClass = getCategoryClass(repo.category);

    // Primary action: Live Web App or first download
    let actionButtonsHTML = "";

    if (repo.liveUrl) {
      actionButtonsHTML += `
        <a href="${escapeHTML(repo.liveUrl)}" target="_blank" rel="noopener noreferrer" class="btn-action btn-launch" title="Launch Web Application">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          <span>Launch App</span>
        </a>
      `;
    }

    // Direct Download button
    if (repo.downloads && repo.downloads.length > 0) {
      const primaryDl = repo.downloads[0];
      const isCustomAsset = primaryDl.type === "stl" || primaryDl.type === "apk";
      const dlIcon = isCustomAsset
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

      actionButtonsHTML += `
        <a href="${escapeHTML(primaryDl.url)}" target="_blank" rel="noopener noreferrer" class="btn-action btn-download" title="${escapeHTML(primaryDl.label)}">
          ${dlIcon}
          <span>${escapeHTML(primaryDl.label)}</span>
        </a>
      `;
    }

    // GitHub Source Code link
    actionButtonsHTML += `
      <a href="${escapeHTML(repo.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="btn-action btn-code" title="View Source on GitHub">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        <span>Code</span>
      </a>
    `;

    // Tags rendering
    const tagsHTML = repo.tags
      .slice(0, 4)
      .map((t) => `<span class="card-tag">${escapeHTML(t)}</span>`)
      .join("");

    return `
      <article class="project-card ${isFeatured ? "featured-card" : ""}" data-id="${escapeHTML(repo.id)}">
        <div class="card-top">
          <div class="card-meta-row">
            <span class="card-category-pill ${catClass}">
              ${isFeatured ? "⭐ " : ""}${escapeHTML(repo.categoryLabel)}
            </span>
            <div class="card-stats">
              ${
                repo.stars > 0
                  ? `
                <span class="stat-item" title="${repo.stars} Stars">
                  <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  ${repo.stars}
                </span>
              `
                  : ""
              }
              <span class="stat-item" title="Last updated ${escapeHTML(repo.updatedAgo)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${escapeHTML(repo.updatedAgo)}
              </span>
            </div>
          </div>

          <h3 class="card-title">
            <a href="${escapeHTML(repo.liveUrl || repo.sourceUrl)}" target="_blank" rel="noopener noreferrer">
              ${escapeHTML(repo.title)}
            </a>
          </h3>

          <p class="card-desc" title="${escapeHTML(repo.description)}">
            ${escapeHTML(repo.description)}
          </p>

          ${tagsHTML ? `<div class="card-tags">${tagsHTML}</div>` : ""}
        </div>

        <div class="card-bottom">
          <div class="card-actions-row">
            ${actionButtonsHTML}
          </div>

          <div class="card-footer-info">
            <span class="language-indicator">
              <span class="lang-dot" style="background-color: ${repo.langColor};"></span>
              <span>${escapeHTML(repo.language)}</span>
            </span>
            <span class="font-mono text-xs">${escapeHTML(repo.name)}</span>
          </div>
        </div>
      </article>
    `;
  }

  function getCategoryClass(catId) {
    switch (catId) {
      case "3d-printing":
        return "cat-3d";
      case "web-apps":
        return "cat-web";
      case "iot":
        return "cat-iot";
      case "android-tools":
        return "cat-android";
      default:
        return "cat-default";
    }
  }

  function bindCardEvents() {
    // Optional lazy release check on hover if needed
  }

  // ==========================================================================
  // Event Bindings
  // ==========================================================================
  function bindEvents() {
    // Theme toggle
    if (DOM.themeToggle) {
      DOM.themeToggle.addEventListener("click", toggleTheme);
    }

    // Search Input
    if (DOM.searchInput) {
      DOM.searchInput.addEventListener("input", (e) => {
        state.searchQuery = e.target.value;
        if (DOM.searchClearBtn) {
          DOM.searchClearBtn.classList.toggle("visible", state.searchQuery.length > 0);
        }
        renderProjectGrids();
      });

      // Clear search
      if (DOM.searchClearBtn) {
        DOM.searchClearBtn.addEventListener("click", () => {
          DOM.searchInput.value = "";
          state.searchQuery = "";
          DOM.searchClearBtn.classList.remove("visible");
          DOM.searchInput.focus();
          renderProjectGrids();
        });
      }
    }

    // Reset filters from empty state
    if (DOM.btnResetFilters) {
      DOM.btnResetFilters.addEventListener("click", () => {
        if (DOM.searchInput) DOM.searchInput.value = "";
        state.searchQuery = "";
        state.activeCategory = "all";
        if (DOM.searchClearBtn) DOM.searchClearBtn.classList.remove("visible");
        renderFilterPills();
        renderProjectGrids();
      });
    }

    // Sort Selector
    if (DOM.sortSelect) {
      DOM.sortSelect.addEventListener("change", (e) => {
        state.sortBy = e.target.value;
        renderProjectGrids();
      });
    }

    // Manual Refresh Button in Footer
    if (DOM.btnRefreshData) {
      DOM.btnRefreshData.addEventListener("click", () => {
        loadRepositories(true).then(() => {
          renderAll();
        });
      });
    }

    // Keyboard shortcut '/' to search
    window.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== DOM.searchInput) {
        e.preventDefault();
        if (DOM.searchInput) DOM.searchInput.focus();
      } else if (e.key === "Escape" && document.activeElement === DOM.searchInput) {
        DOM.searchInput.blur();
      }
    });
  }

  // ==========================================================================
  // UI Helpers
  // ==========================================================================
  function showSyncStatus(msg, statusType) {
    if (DOM.syncStatusText) DOM.syncStatusText.textContent = msg;
    if (DOM.syncDot) {
      DOM.syncDot.className = "sync-dot";
      if (statusType === "syncing") DOM.syncDot.classList.add("syncing");
      if (statusType === "rate_limited" || statusType === "offline") DOM.syncDot.classList.add("offline");
    }
  }

  function updateCacheExpiryText(timestamp, ttlMs) {
    if (!DOM.cacheTtlText) return;
    const elapsed = Date.now() - timestamp;
    const remainingMs = Math.max(0, ttlMs - elapsed);
    const remainingMins = Math.ceil(remainingMs / 60000);
    DOM.cacheTtlText.textContent = `• Cache valid for ~${remainingMins}m`;
  }

  function updateRefreshButtonState(isSpinning) {
    if (!DOM.btnRefreshData) return;
    DOM.btnRefreshData.classList.toggle("spinning", isSpinning);
    DOM.btnRefreshData.disabled = isSpinning;
  }

  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
