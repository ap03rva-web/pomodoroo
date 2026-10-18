const TOTAL_MS = 25 * 60 * 1000;

const timeEl = document.getElementById("time");
const primaryBtn = document.getElementById("primary");
const resetBtn = document.getElementById("reset");
const artEl = document.getElementById("art");
const dockEl = document.querySelector(".dock");
const timerBoxEl = document.querySelector(".timer");

// Made-up painting details for now. They only exist on the page once the timer finishes.
const PAINTING = { title: "Harbour at Dawn", artist: "Marguerite Lenoir", year: "1887" };

let state = "ready"; // ready, running, paused, finished
let detailsEl = null;
let remainingMs = TOTAL_MS;
let endTime = 0;
let intervalId = null;

function show(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  timeEl.textContent = minutes + ":" + seconds;
}

function showDetails() {
  detailsEl = document.createElement("div");
  detailsEl.className = "glass details";

  const name = document.createElement("p");
  name.className = "name";
  name.textContent = PAINTING.title;

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = PAINTING.artist + ", " + PAINTING.year;

  detailsEl.append(name, meta);
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
  else if (state === "finished") reset();
});

resetBtn.addEventListener("click", reset);

// Catch up straight away when the tab comes back into view.
document.addEventListener("visibilitychange", function () {
  if (state === "running") tick();
});
