const ALGOLIA_URL = "https://hn.algolia.com/api/v1/search_by_date?tags=story";

function buildAlgoliaQuery(q) {
  const match = q.match(/^((\w+):)?(.*)$/);
  const type = match[2];
  const topic = match[3];
  let query = "";

  if (type === "domain") {
    query += "&restrictSearchableAttributes=url&query=";
  } else if (type === "points") {
    query += "&numericFilters=" + type;
  } else {
    query += "&query=";
  }

  return `${ALGOLIA_URL}${query}${topic}&hitsPerPage=30`;
}

function getDefaultLayout() {
  return [
    { title: "Show HN", query: '"Show HN"' },
    { title: "GitHub", query: "domain:github.com" },
    { title: "AWS", query: '"aws"' },
    { title: "Elixir", query: '"elixir"' },
    { title: "50+ points", query: "points:>50" },
    { title: "100+ points", query: "points:>100" },
    { title: "Devops", query: '"devops"' },
    { title: "Docker", query: '"docker"' },
    { title: "Mac OSX", query: '"macos"' },
    { title: "Sublime Text", query: '"Sublime Text"' },
    { title: "Python", query: "python" },
    { title: "Reddit", query: "domain:reddit.com" },
    { title: "Kubernetes", query: "kubernetes" },
    { title: "Ansible", query: "ansible" },
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
    const url = buildAlgoliaQuery(query);
    const promise = fetch(url)
      .then((res) => res.json())
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
          meta.textContent = `${hit.points}/${hit.num_comments} `;
          li.appendChild(meta);

          const titleLink = createElement("a", {
            className: "title",
            href: link,
            title: hit.title,
            target: "_blank",
          });
          titleLink.textContent = hit.title;
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
