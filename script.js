const TOTAL_MS = 25 * 60 * 1000;

const timeEl = document.getElementById("time");
const primaryBtn = document.getElementById("primary");
const resetBtn = document.getElementById("reset");
const artEl = document.getElementById("art");

let state = "ready"; // ready, running, paused, finished
let remainingMs = TOTAL_MS;
let endTime = 0;
let intervalId = null;

function show(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  timeEl.textContent = minutes + ":" + seconds;
}

// Work out the time left from the real clock, so a sleeping tab can't make us drift.
function tick() {
  remainingMs = Math.max(0, endTime - Date.now());
  show(remainingMs);
  if (remainingMs === 0) {
    clearInterval(intervalId);
    state = "finished";
  }
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
  artEl.classList.remove("started");
}

primaryBtn.addEventListener("click", function () {
  if (state === "ready" || state === "paused") start();
  else if (state === "running") pause();
});

resetBtn.addEventListener("click", reset);

// Catch up straight away when the tab comes back into view.
document.addEventListener("visibilitychange", function () {
  if (state === "running") tick();
});
