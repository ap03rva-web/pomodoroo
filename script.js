const TOTAL_MS = 30 * 1000;

const MET_SEARCH_URL =
  "https://collectionapi.metmuseum.org/public/collection/v1.1/search" +
  "?hasImages=true&medium=Paintings&departmentId=11&isHighlight=true&limit=500&q=*";
const MET_OBJECT_URL = "https://collectionapi.metmuseum.org/public/collection/v1/objects/";

const timeEl = document.getElementById("time");
const primaryBtn = document.getElementById("primary");
const resetBtn = document.getElementById("reset");
const artEl = document.getElementById("art");
const dockEl = document.querySelector(".dock");
const timerBoxEl = document.querySelector(".timer");
const photoEl = document.getElementById("photo");
const loadingEl = document.getElementById("loading");

const MET_LINK_START = "https://www.metmuseum.org/";

let state = "ready"; // ready, running, paused, finished
let detailsEl = null;
// The real details of the painting on screen. Kept here, not on the page, until the timer finishes.
let currentDetails = null;
let paintingIds = null;
let lastPaintingId = null;
let remainingMs = TOTAL_MS;
let endTime = 0;
let intervalId = null;

function show(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  timeEl.textContent = minutes + ":" + seconds;
}

// Ask the museum once for a list of paintings that have photos, and keep the list.
async function getPaintingIds() {
  if (!paintingIds) {
    const response = await fetch(MET_SEARCH_URL);
    paintingIds = (await response.json()).objectIDs;
  }
  return paintingIds;
}

// Pick random paintings until one has a small photo, and return the museum's record for it.
async function findPainting() {
  const ids = await getPaintingIds();
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = ids[Math.floor(Math.random() * ids.length)];
    if (id === lastPaintingId) continue;
    const response = await fetch(MET_OBJECT_URL + id);
    const painting = await response.json();
    if (painting.primaryImageSmall) {
      lastPaintingId = id;
      return painting;
    }
  }
  return null;
}

function preload(url) {
  return new Promise(function (resolve, reject) {
    const image = new Image();
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });
}

// If anything goes wrong, the placeholder simply stays on screen.
async function loadPainting() {
  photoEl.classList.remove("loaded");
  currentDetails = null;
  loadingEl.hidden = false;
  try {
    const painting = await findPainting();
    if (painting) {
      await preload(painting.primaryImageSmall);
      photoEl.src = painting.primaryImageSmall;
      photoEl.classList.add("loaded");
      // Saved only now, so the details always belong to the image on screen.
      currentDetails = {
        title: painting.title,
        artist: painting.artistDisplayName,
        year: painting.objectDate,
        link: painting.objectURL,
      };
    }
  } catch (error) {
    // keep the placeholder
  } finally {
    loadingEl.hidden = true;
  }
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
  artEl.classList.remove("started");
  artEl.classList.add("finished");
  showDetails();
}

// Work out the time left from the real clock, so a sleeping tab can't make us drift.
function tick() {
  remainingMs = Math.max(0, endTime - Date.now());
  show(remainingMs);
  if (remainingMs === 0) finish();
}

function start() {
  endTime = Date.now() + remainingMs;
  intervalId = setInterval(tick, 250);
  state = "running";
  primaryBtn.textContent = "Pause";
  artEl.classList.add("started");
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
  artEl.classList.remove("started", "finished");
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

// Catch up straight away when the tab comes back into view.
document.addEventListener("visibilitychange", function () {
  if (state === "running") tick();
});

loadPainting();
