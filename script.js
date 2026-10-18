const TOTAL_MS = 25 * 60 * 1000;

const MET_SEARCH_URL =
  "https://collectionapi.metmuseum.org/public/collection/v1.1/search" +
  "?hasImages=true&medium=Paintings&departmentId=11&isHighlight=true&limit=500&q=*";
const MET_OBJECT_URL = "https://collectionapi.metmuseum.org/public/collection/v1/objects/";

const REQUEST_TIMEOUT_MS = 10 * 1000;
const MAX_TRIES = 5;
const RETRY_PAUSE_MS = 1000;

const timeEl = document.getElementById("time");
const primaryBtn = document.getElementById("primary");
const resetBtn = document.getElementById("reset");
const viewEl = document.querySelector(".view");
const dockEl = document.querySelector(".dock");
const timerBoxEl = document.querySelector(".timer");
const stageEl = document.getElementById("stage");
const frameEl = document.getElementById("frame");
const photoEl = document.getElementById("photo");
const loadingEl = document.getElementById("loading");
const noticeEl = document.getElementById("notice");
const retryBtn = document.getElementById("retry");

const MET_LINK_START = "https://www.metmuseum.org/";

let state = "ready"; // ready, running, paused, finished
let detailsEl = null;
// The real details of the painting on screen. Kept here, not on the page, until the timer finishes.
let currentDetails = null;
let paintingIds = null;
let lastPaintingId = null;
let loadCount = 0;
let remainingMs = TOTAL_MS;
let endTime = 0;
let intervalId = null;

function show(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  timeEl.textContent = minutes + ":" + seconds;
}

// 1 = strongly blurred, 0 = fully sharp. "instant" skips the easing, so it can never flash sharp.
function setBlur(amount, instant) {
  if (instant) viewEl.classList.add("instant");
  viewEl.style.setProperty("--blur", amount);
  if (instant) {
    void viewEl.offsetWidth;
    viewEl.classList.remove("instant");
  }
}

// Fetch JSON from the museum, giving up after 10 seconds or on any reply that isn't a clean success.
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("bad reply");
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Ask the museum once for a list of paintings that have photos, and keep the list.
async function getPaintingIds() {
  if (!paintingIds) {
    const ids = (await fetchJson(MET_SEARCH_URL)).objectIDs;
    if (!Array.isArray(ids) || ids.length === 0) throw new Error("search found nothing");
    paintingIds = ids;
  }
  return paintingIds;
}

// Load the picture, giving up after 10 seconds or if the file is broken.
function preload(url) {
  return new Promise(function (resolve, reject) {
    const image = new Image();
    const timer = setTimeout(function () {
      image.src = "";
      reject(new Error("picture too slow"));
    }, REQUEST_TIMEOUT_MS);
    image.onload = function () {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = function () {
      clearTimeout(timer);
      reject(new Error("picture failed"));
    };
    image.src = url;
  });
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// One try: pick a painting we haven't tried yet and check it is a painting with a photo that loads.
async function tryOnePainting(triedIds) {
  const ids = await getPaintingIds();
  let candidates = ids.filter(function (id) {
    return id !== lastPaintingId && !triedIds.has(id);
  });
  if (candidates.length === 0) candidates = ids;
  const id = candidates[Math.floor(Math.random() * candidates.length)];
  triedIds.add(id);

  const painting = await fetchJson(MET_OBJECT_URL + id);
  if (!/painting/i.test(painting.classification || "") || !painting.primaryImageSmall) {
    throw new Error("not a painting with a photo");
  }
  const image = await preload(painting.primaryImageSmall);
  return { id: id, painting: painting, image: image };
}

// Try up to 5 paintings, pausing between tries. If all fail, the placeholder stays
// and a friendly message appears.
async function loadPainting() {
  const thisLoad = ++loadCount; // a newer load (Restart session, Try again) cancels this one
  const triedIds = new Set();
  stageEl.classList.remove("loaded");
  currentDetails = null;
  noticeEl.hidden = true;
  loadingEl.hidden = false;

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      const found = await tryOnePainting(triedIds);
      if (thisLoad !== loadCount) return;
      lastPaintingId = found.id;
      frameEl.style.setProperty("--ratio", found.image.naturalWidth / found.image.naturalHeight);
      photoEl.src = found.painting.primaryImageSmall;
      stageEl.classList.add("loaded");
      // Saved only now, so the details always belong to the image on screen.
      currentDetails = {
        title: found.painting.title,
        artist: found.painting.artistDisplayName,
        year: found.painting.objectDate,
        link: found.painting.objectURL,
      };
      loadingEl.hidden = true;
      if (state === "finished") showDetails(); // the painting arrived after 00:00
      return;
    } catch (error) {
      if (thisLoad !== loadCount) return;
      if (attempt < MAX_TRIES) await sleep(RETRY_PAUSE_MS);
      if (thisLoad !== loadCount) return;
    }
  }

  loadingEl.hidden = true;
  noticeEl.hidden = false;
}

function showDetails() {
  if (!currentDetails) return;

  detailsEl = document.createElement("div");
  detailsEl.className = "glass details";

  const name = document.createElement("p");
  name.className = "name";
  name.textContent = currentDetails.title || "Untitled";

  const meta = document.createElement("p");
  meta.className = "meta";
  const artist = currentDetails.artist || "Unknown artist";
  meta.textContent = currentDetails.year ? artist + ", " + currentDetails.year : artist;

  detailsEl.append(name, meta);

  if (currentDetails.link && currentDetails.link.startsWith(MET_LINK_START)) {
    const link = document.createElement("a");
    link.className = "link";
    link.href = currentDetails.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View on the Met website";
    detailsEl.append(link);
  }

  dockEl.insertBefore(detailsEl, timerBoxEl);
}

function hideDetails() {
  if (detailsEl) {
    detailsEl.remove();
    detailsEl = null;
  }
}

function finish() {
  clearInterval(intervalId);
  state = "finished";
  primaryBtn.textContent = "Restart session";
  resetBtn.hidden = true;
  showDetails();
}

// Work out the time left from the real clock, so a sleeping tab can't make us drift.
function tick() {
  remainingMs = Math.max(0, endTime - Date.now());
  show(remainingMs);
  setBlur(remainingMs / TOTAL_MS);
  if (remainingMs === 0) finish();
}

function start() {
  endTime = Date.now() + remainingMs;
  intervalId = setInterval(tick, 250);
  state = "running";
  primaryBtn.textContent = "Pause";
}

function pause() {
  clearInterval(intervalId);
  tick();
  if (state === "running") {
    state = "paused";
    primaryBtn.textContent = "Resume";
  }
}

function reset() {
  clearInterval(intervalId);
  state = "ready";
  remainingMs = TOTAL_MS;
  show(remainingMs);
  primaryBtn.textContent = "Start";
  resetBtn.hidden = false;
  setBlur(1, true);
  hideDetails();
}

primaryBtn.addEventListener("click", function () {
  if (state === "ready" || state === "paused") start();
  else if (state === "running") pause();
  else if (state === "finished") {
    reset();
    loadPainting();
  }
});

resetBtn.addEventListener("click", reset);

retryBtn.addEventListener("click", loadPainting);

// Catch up straight away when the tab comes back into view.
document.addEventListener("visibilitychange", function () {
  if (state === "running") tick();
});

loadPainting();
