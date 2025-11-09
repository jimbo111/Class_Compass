const els = {
  scanBtn: document.getElementById("scanBtn"),
  pageTitle: document.getElementById("pageTitle"),
  pageHost: document.getElementById("pageHost"),
  favicon: document.getElementById("favicon"),
  restrictedBanner: document.getElementById("restrictedBanner"),
  statusText: document.getElementById("statusText"),
  aboutToggle: document.getElementById("aboutToggle"),
  aboutText: document.getElementById("aboutText"),
};

let pageInfo = { title: "", url: "", host: "", faviconUrl: "" };
let scanning = false;
let hasOpenedStatusPage = false;
const STATUS_PAGE_URL = chrome.runtime.getURL("src/dashboard/index.html");

document.addEventListener("DOMContentLoaded", init);

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "STATUS_UPDATE") {
    const payload = message.payload || {};
    if (scanning && !hasOpenedStatusPage) {
      openStatusPage();
      hasOpenedStatusPage = true;
    }
    showCompletion(payload.status || "Scan complete");
  }
});

async function init() {
  const info = await send("GET_PAGE_INFO");
  if (info.ok) {
    pageInfo = info.info;
    renderPageInfo(pageInfo);
  }

  els.scanBtn.addEventListener("click", onScan);
  els.aboutToggle?.addEventListener("click", toggleAbout);
}

async function onScan() {
  if (scanning) return;

  setScanningState("Scanning page...");

  const res = await send("SCAN_PAGE");
  if (res.ok) {
    els.statusText.textContent = "Parsing Degree Works...";
  } else {
    showError(res.error?.message || "Failed to scan");
  }
}

function renderPageInfo(info) {
  els.pageTitle.textContent = (info.title || "").slice(0, 40);
  els.pageTitle.title = info.title || "";
  els.pageHost.textContent = info.host || "";
  if (info.faviconUrl) {
    els.favicon.src = info.faviconUrl;
    els.favicon.alt = `${info.host} favicon`;
  } else {
    els.favicon.classList.add("hidden");
  }
}

async function send(type, extra = {}) {
  return await chrome.runtime.sendMessage({ type, ...extra });
}

function setScanningState(statusMessage) {
  scanning = true;
  hasOpenedStatusPage = false;
  els.scanBtn.disabled = true;
  els.scanBtn.textContent = "Scanning...";
  els.scanBtn.style.background = "";
  els.statusText.textContent = statusMessage;
}

function showCompletion(statusMessage) {
  els.scanBtn.textContent = "Scanned!";
  els.scanBtn.style.background = "#34a853";
  els.statusText.textContent = statusMessage;
  setTimeout(() => resetScanState("Ready"), 1500);
}

function showError(message) {
  els.statusText.textContent = `Error: ${message}`;
  resetScanState("Ready");
}

function resetScanState(statusMessage) {
  scanning = false;
  hasOpenedStatusPage = false;
  els.scanBtn.disabled = false;
  els.scanBtn.textContent = "Scan Degree Works";
  els.scanBtn.style.background = "";
  els.statusText.textContent = statusMessage;
}

async function openStatusPage() {
  try {
    await chrome.tabs.create({ url: STATUS_PAGE_URL, active: true });
  } catch (error) {
    console.error("Failed to open status page:", error);
  }
}

function toggleAbout() {
  if (!els.aboutToggle || !els.aboutText) return;
  const expanded = els.aboutToggle.getAttribute("aria-expanded") === "true";
  const nextState = !expanded;
  els.aboutToggle.setAttribute("aria-expanded", String(nextState));
  els.aboutText.classList.toggle("hidden", !nextState);
  els.aboutToggle.textContent = nextState ? "Hide info" : "What is this?";
}
