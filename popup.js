// popup.js
const socialRegex =
  /(https?:\/\/(?:www\.)?(facebook|twitter|instagram|youtube|linkedin|tiktok|threads|pinterest|snapchat|discord|telegram|reddit)\.com[^\s"'<>]*)/gi;

let results = {};      // { domain: [link, ...], ... } - current scan results
let savedLinks = {};   // persisted in chrome.storage.local

// ---------- Helpers ----------
function normalizeDomain(domain) {
  if (!/^https?:\/\//i.test(domain)) return "https://" + domain;
  return domain;
}

function extractSocialLinks(html) {
  const matches = html.match(socialRegex);
  return matches ? [...new Set(matches)] : [];
}

async function scanDomain(domain) {
  const target = normalizeDomain(domain);
  try {
    const res = await fetch(target, { method: "GET" });
    const html = await res.text();

    // also parse meta tags to catch hidden links
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const metas = Array.from(doc.querySelectorAll("meta"))
      .map(m => m.content || "")
      .join(" ");

    const combined = html + " " + metas;
    return extractSocialLinks(combined);
  } catch (err) {
    console.warn("scanDomain failed for", domain, err);
    return [];
  }
}

function updateSaveAllState() {
  const btn = document.getElementById("saveAllBtn");
  const hasLinks = Object.values(results).some(arr => Array.isArray(arr) && arr.length > 0);
  btn.disabled = !hasLinks;
}

// ---------- Storage ----------
function persistSavedLinks() {
  chrome.storage.local.set({ savedLinks });
}

function loadSavedLinks(callback) {
  chrome.storage.local.get("savedLinks", (data) => {
    savedLinks = data.savedLinks || {};
    if (callback) callback();
  });
}

// ---------- UI Rendering ----------
function renderResults() {
  const container = document.getElementById("results");
  container.innerHTML = "";

  let total = 0;
  for (const domain in results) {
    const links = results[domain] || [];
    total += links.length;

    const domainWrap = document.createElement("div");
    domainWrap.className = "result-domain";

    const header = document.createElement("div");
    header.innerHTML = `<strong style="color:yellow">${domain}</strong> — ${links.length} link(s)`;
    domainWrap.appendChild(header);

    if (links.length > 0) {
      const ul = document.createElement("ul");
      links.forEach(link => {
        const li = document.createElement("li");

        const a = document.createElement("a");
        a.href = link;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = link;

        li.appendChild(a);
        ul.appendChild(li);
      });
      domainWrap.appendChild(ul);
    } else {
      const p = document.createElement("p");
      p.textContent = "No social links found.";
      p.style.color = "gray";
      domainWrap.appendChild(p);
    }

    container.appendChild(domainWrap);
  }

  document.getElementById("count").innerText = total;
  updateSaveAllState();
}

function renderSavedLinks() {
  const container = document.getElementById("savedLinksContainer");
  container.innerHTML = "";

  const domains = Object.keys(savedLinks).sort();
  if (domains.length === 0) {
    container.innerHTML = '<div style="color:gray">No saved links yet.</div>';
    return;
  }

  for (const domain of domains) {
    const block = document.createElement("div");
    block.style.marginBottom = "8px";
    block.innerHTML = `<strong style="color:yellow">${domain}</strong>`;

    savedLinks[domain].forEach((link, idx) => {
      const item = document.createElement("div");
      item.className = "saved-link";
      const a = document.createElement("a");
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = link;
      const del = document.createElement("button");
      del.className = "deleteBtn";
      del.textContent = "❌";
      del.title = "Delete";
      del.addEventListener("click", () => {
        deleteSavedLink(domain, idx);
      });
      item.appendChild(a);
      item.appendChild(del);
      block.appendChild(item);
    });

    container.appendChild(block);
  }
}

// ---------- Save/Delete logic ----------
function saveLink(domain, link) {
  if (!savedLinks[domain]) savedLinks[domain] = [];
  if (!savedLinks[domain].includes(link)) {
    savedLinks[domain].push(link);
    persistSavedLinks();
    renderSavedLinks();
  }
}

function deleteSavedLink(domain, idx) {
  if (!savedLinks[domain]) return;
  savedLinks[domain].splice(idx, 1);
  if (savedLinks[domain].length === 0) delete savedLinks[domain];
  persistSavedLinks();
  renderSavedLinks();
}

// Save All from current results
function saveAllFromResults() {
  let any = false;
  for (const domain in results) {
    const links = results[domain] || [];
    if (!links.length) continue;
    if (!savedLinks[domain]) savedLinks[domain] = [];
    for (const l of links) {
      if (!savedLinks[domain].includes(l)) {
        savedLinks[domain].push(l);
        any = true;
      }
    }
  }
  if (any) {
    persistSavedLinks();
    renderSavedLinks();
    const scanMsg = document.getElementById("scanMsg");
    if (scanMsg) {
      scanMsg.textContent = "Saved all links.";
      setTimeout(() => { if (scanMsg) scanMsg.textContent = ""; }, 2500);
    }
  }
}

// ---------- Event Listeners ----------
document.getElementById("scanCurrent").addEventListener("click", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab) return;
    const url = tab.url;
    results = {};
    results[url] = await scanDomain(url);
    renderResults();
  });
});

document.getElementById("bulkScan").addEventListener("click", async () => {
  const input = document.getElementById("urls").value
    .split("\n")
    .map(d => d.trim())
    .filter(d => d);
  if (input.length === 0) return;
  results = {};
  for (const domain of input) {
    results[domain] = await scanDomain(domain);
  }
  renderResults();
});

document.getElementById("saveAllBtn").addEventListener("click", () => {
  saveAllFromResults();
});

document.getElementById("exportJson").addEventListener("click", async () => {
  const payload = JSON.stringify(results, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "social_media_recon_results.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("clearResults").addEventListener("click", () => {
  results = {};
  renderResults();
});

document.getElementById("clearSavedAll").addEventListener("click", () => {
  savedLinks = {};
  persistSavedLinks();
  renderSavedLinks();
});

document.getElementById("scanTabBtn").addEventListener("click", () => {
  document.getElementById("scanTab").classList.add("active");
  document.getElementById("savedTab").classList.remove("active");
  document.getElementById("scanTabBtn").classList.add("active");
  document.getElementById("savedTabBtn").classList.remove("active");
});

document.getElementById("savedTabBtn").addEventListener("click", () => {
  document.getElementById("savedTab").classList.add("active");
  document.getElementById("scanTab").classList.remove("active");
  document.getElementById("savedTabBtn").classList.add("active");
  document.getElementById("scanTabBtn").classList.remove("active");
});

// ---------- Init ----------
loadSavedLinks(() => {
  renderSavedLinks();
});

window.deleteSavedLink = deleteSavedLink;
