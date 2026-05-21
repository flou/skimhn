const ALGOLIA_BASE = "https://hn.algolia.com/api/v1/search_by_date";

function buildAlgoliaQuery(q) {
  if (q.startsWith("any:")) {
    const terms = q
      .slice(4)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return terms.map((t) => `${ALGOLIA_BASE}?tags=story&query=${t}&hitsPerPage=30`);
  }

  const segments = q
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const knownTypes = ["tag", "author", "domain", "points"];
  const allTyped = segments.every((s) => knownTypes.some((t) => s.startsWith(t + ":")));

  if (allTyped) {
    const tags = ["story"];
    const numericFilters = [];
    let domain = null;

    for (const seg of segments) {
      const [, type, value] = seg.match(/^(\w+):(.*)$/) || [];
      switch (type) {
        case "tag":
          tags.push(value);
          break;
        case "author":
          tags.push("author_" + value);
          break;
        case "domain":
          domain = value;
          break;
        case "points":
          numericFilters.push("points" + value);
          break;
      }
    }

    let url = ALGOLIA_BASE + "?tags=" + tags.join(",");
    if (numericFilters.length) url += "&numericFilters=" + numericFilters.join(",");
    if (domain) url += "&restrictSearchableAttributes=url&query=" + domain;
    url += "&hitsPerPage=30";
    return url;
  }

  return `${ALGOLIA_BASE}?tags=story&query=${q}&hitsPerPage=30`;
}

function mergeResults(results) {
  const seen = new Set();
  const hits = [];
  for (const r of results) {
    for (const h of r.hits || []) {
      if (!seen.has(h.objectID)) {
        seen.add(h.objectID);
        hits.push(h);
      }
    }
  }
  hits.sort((a, b) => b.created_at_i - a.created_at_i);
  return { hits: hits.slice(0, 30) };
}

function getDefaultLayout() {
  return [
    { title: "Show HN", query: "tag:show_hn" },
    { title: "GitHub", query: "domain:github.com" },
    { title: "50+ points", query: "points:>50,points:<100" },
    { title: "100+ points", query: "points:>100" },
    { title: "Front Page", query: "tag:front_page" },
    { title: "macOS", query: '"macos"' },
    { title: "AWS", query: '"aws"' },
    { title: "GCP", query: '"gcp"' },
    { title: "Devops", query: '"devops"' },
    { title: "SRE", query: '"sre"' },
    { title: "Kubernetes", query: "kubernetes" },
    { title: "Terraform", query: "any:terraform,terragrunt" },
    { title: "Rust", query: '"rust"' },
    { title: "Go", query: '"go"' },
    { title: "Zig", query: '"zig"' },
    { title: "Python", query: "python" },
    { title: "Elixir", query: '"elixir"' },
    { title: "Docker", query: '"docker"' },
    { title: "TUI", query: '"tui"' },
    { title: "Reddit", query: "domain:reddit.com" },
    { title: "Ansible", query: '"ansible"' },
    { title: "Crowd funding", query: "domain:kickstarter.com" },
    { title: "Stack Overflow", query: "domain:stackoverflow.com" },
  ];
}

function loadJSON(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "className") {
      el.className = value;
    } else if (key === "textContent") {
      el.textContent = value;
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (typeof child === "string") {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }
  return el;
}

const state = {
  layout: loadJSON("layout", getDefaultLayout()),
  seen: loadJSON("seen", {}),
  newWindow: loadJSON("newWindow", false),
  darkTheme: loadJSON("darkTheme", false),
};

let editingIndex = -1;

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.darkTheme ? "dark" : "light");
}

applyTheme();

function setupThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  toggle.checked = state.darkTheme;
  toggle.addEventListener("change", () => {
    state.darkTheme = toggle.checked;
    saveJSON("darkTheme", state.darkTheme);
    applyTheme();
  });
}

function renderGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  for (let i = 0; i < state.layout.length; i++) {
    const card = state.layout[i];
    const col = createElement("div", { className: "card" });

    const title = createElement("h2");
    title.appendChild(document.createTextNode(card.title));
    const editLink = createElement("a", {
      className: "edit-link",
      href: "#edit",
      "data-index": String(i),
    });
    editLink.textContent = "/edit";
    title.appendChild(editLink);
    col.appendChild(title);
    col.appendChild(createElement("ul", { className: "card-list", "data-query": card.query }));

    grid.appendChild(col);
  }

  document.querySelectorAll(".edit-link").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openEditModal(Number(el.dataset.index));
    });
  });
}

async function fetchNews() {
  const lists = document.querySelectorAll(".card-list");
  const fetches = [];

  lists.forEach((ul) => {
    const query = ul.getAttribute("data-query");
    const urls = buildAlgoliaQuery(query);
    const dataPromise = Array.isArray(urls)
      ? Promise.all(urls.map((u) => fetch(u).then((r) => r.json()))).then(mergeResults)
      : fetch(urls).then((r) => r.json());
    const promise = dataPromise
      .then((data) => {
        if (!data.hits || !data.hits.length) return;

        const currentSeen = state.seen[query];
        if (currentSeen === undefined) {
          state.seen[query] = data.hits[0].objectID;
        }

        for (const hit of data.hits) {
          const link = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
          const li = document.createElement("li");

          if (Number(hit.objectID) > Number(state.seen[query])) {
            const newSpan = document.createElement("span");
            newSpan.className = "new";
            newSpan.textContent = "+ ";
            li.appendChild(newSpan);
          }

          const meta = createElement("a", {
            className: "meta",
            href: `https://news.ycombinator.com/item?id=${hit.objectID}`,
            target: "_blank",
          });
          meta.textContent = `${hit.points}/${hit.num_comments}`;
          li.appendChild(meta);

          const title = hit.title.replace(/^(Show HN|Ask HN|Launch HN|Tell HN):\s*/, "");
          const titleLink = createElement("a", {
            className: "title",
            href: link,
            title: hit.title,
            target: "_blank",
          });
          titleLink.textContent = title;
          li.appendChild(titleLink);

          ul.appendChild(li);
        }

        state.seen[query] = data.hits[0].objectID;
        saveJSON("seen", state.seen);
      })
      .catch(() => {
        // silently fail for individual queries
      });

    fetches.push(promise);
  });

  await Promise.allSettled(fetches);
}

function openEditModal(index) {
  editingIndex = index;
  const card = state.layout[index];
  document.getElementById("edit-title").value = card.title;
  document.getElementById("edit-query").value = card.query;
  document.getElementById("edit-delete").style.display = "";
  document.getElementById("edit-modal").classList.add("open");
}

function openAddModal() {
  editingIndex = -1;
  document.getElementById("edit-title").value = "";
  document.getElementById("edit-query").value = "";
  document.getElementById("edit-delete").style.display = "none";
  document.getElementById("edit-modal").classList.add("open");
}

function closeModal() {
  document.querySelectorAll(".modal-overlay").forEach((m) => m.classList.remove("open"));
}

function setupEditModal() {
  document.getElementById("edit-save").addEventListener("click", () => {
    const title = document.getElementById("edit-title").value;
    const query = document.getElementById("edit-query").value;

    if (editingIndex >= 0) {
      state.layout[editingIndex] = { title, query };
    } else {
      state.layout.push({ title, query });
    }

    saveJSON("layout", state.layout);
    closeModal();
    window.location.reload();
  });

  document.getElementById("edit-delete").addEventListener("click", () => {
    if (editingIndex >= 0) {
      state.layout.splice(editingIndex, 1);
      saveJSON("layout", state.layout);
      closeModal();
      window.location.reload();
    }
  });

  document.querySelectorAll(".modal-close, .modal-cancel").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.querySelectorAll(".modal-overlay").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target === el) closeModal();
    });
  });
}

function init() {
  renderGrid();
  setupEditModal();
  setupThemeToggle();

  document.getElementById("add-btn").addEventListener("click", openAddModal);

  fetchNews();
}

init();
