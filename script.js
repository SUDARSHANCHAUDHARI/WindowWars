import {
  EventDeck,
  MAX_ATTEMPTS,
  createInitialState,
  gameReducer,
} from "./game-state.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const elements = {
  scene: document.querySelector("#scene"),
  sceneFrame: document.querySelector(".scene-frame"),
  sash: document.querySelector("#window-sash"),
  rain: document.querySelector("#rain-layer"),
  insideRain: document.querySelector("#inside-rain"),
  wind: document.querySelector("#wind-particles"),
  lightning: document.querySelector("#lightning"),
  lightningFlash: document.querySelector("#lightning-flash"),
  attemptCount: document.querySelector("#attempt-count"),
  attemptTrack: document.querySelector("#attempt-track"),
  weatherLabel: document.querySelector("#weather-label"),
  weatherDot: document.querySelector(".weather-dot"),
  statusKicker: document.querySelector("#status-kicker"),
  statusMessage: document.querySelector("#status-message"),
  statusGlyph: document.querySelector("#status-glyph"),
  dragCue: document.querySelector("#drag-cue"),
  soundToggle: document.querySelector("#sound-toggle"),
  soundLabel: document.querySelector("#sound-label"),
  resetButton: document.querySelector("#reset-button"),
};

const stateCopy = {
  open: {
    kicker: "Your move",
    message: "Drag the brass handle right, or click the window, to close it.",
    glyph: "↗",
  },
  closing: {
    kicker: "Hold it...",
    message: "The latch is nearly there.",
    glyph: "→",
  },
  won: {
    kicker: "Ceasefire",
    message: "Ten attempts. The storm gives up, and the window finally stays closed.",
    glyph: "✓",
  },
};

let state = createInitialState();
let timelineId = 0;
let scheduledTimers = new Set();
let ambientTimer = null;
let pointerGesture = null;

const eventDeck = new EventDeck();
let audio;

createAttemptTrack();
createAtmosphere();
render();
scheduleAmbientLightning();

elements.sash.addEventListener("pointerdown", onPointerDown);
elements.sash.addEventListener("pointermove", onPointerMove);
elements.sash.addEventListener("pointerup", onPointerUp);
elements.sash.addEventListener("pointercancel", cancelPointerGesture);
elements.sash.addEventListener("keydown", onWindowKeyDown);
elements.soundToggle.addEventListener("click", toggleSound);
elements.resetButton.addEventListener("click", resetGame);
document.addEventListener("visibilitychange", () => audio.setPageVisible(!document.hidden));

function dispatch(action) {
  const nextState = gameReducer(state, action);
  if (nextState === state) return;
  state = nextState;
  render();
}

function requestClose() {
  if (state.phase !== "open") return;

  const currentTimeline = ++timelineId;
  elements.dragCue.classList.add("is-hidden");
  elements.sash.classList.remove("is-dragging");
  elements.sash.style.removeProperty("transform");
  audio.resume();
  audio.playLatch();
  dispatch({ type: "CLOSE_REQUEST" });

  schedule(() => {
    if (currentTimeline !== timelineId) return;

    if (state.attempts >= MAX_ATTEMPTS) {
      dispatch({ type: "RESOLVE_CLOSE" });
      audio.calmStorm();
      return;
    }

    const event = eventDeck.next(state.lastEventId);
    dispatch({ type: "RESOLVE_CLOSE", event });
    audio.playEvent(event.id);

    if (event.id === "lightning") triggerLightning(false);

    schedule(() => {
      if (currentTimeline !== timelineId) return;
      audio.restartStorm();
      dispatch({ type: "REOPEN" });
    }, motionDuration(event.duration));
  }, motionDuration(620));
}

function render() {
  const isOpen = state.phase === "open" || state.phase === "event";
  const isWon = state.phase === "won";
  const copy = state.currentEvent ?? stateCopy[state.phase] ?? stateCopy.open;

  elements.scene.dataset.phase = state.phase;
  elements.scene.dataset.effect = state.currentEvent?.id ?? "";
  elements.sceneFrame.classList.toggle("is-won", isWon);
  elements.sash.classList.toggle("is-open", isOpen);
  elements.sash.setAttribute("aria-disabled", String(state.phase !== "open"));
  elements.sash.setAttribute(
    "aria-label",
    isWon
      ? "The window is closed and the storm has ended."
      : state.phase === "open"
        ? "Close the open window. Drag right or press Enter."
        : "The window is currently moving.",
  );

  elements.attemptCount.textContent = String(state.attempts);
  elements.attemptTrack.setAttribute(
    "aria-label",
    `${state.attempts} of ${MAX_ATTEMPTS} attempts completed`,
  );
  [...elements.attemptTrack.children].forEach((marker, index) => {
    marker.classList.toggle("is-complete", index < state.attempts);
  });

  elements.weatherLabel.textContent = isWon ? "Storm: surrendered" : "Storm: unruly";
  elements.weatherDot.style.background = isWon ? "var(--success)" : "";
  elements.weatherDot.style.boxShadow = isWon
    ? "0 0 0 4px rgb(185 214 177 / 0.11), 0 0 13px rgb(185 214 177 / 0.65)"
    : "";

  elements.statusKicker.textContent = copy.title ?? copy.kicker;
  elements.statusGlyph.textContent = copy.glyph;
  updateStatusMessage(copy.message);

  const showCue = state.attempts === 0 && state.phase === "open";
  elements.dragCue.classList.toggle("is-hidden", !showCue);
  elements.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
  elements.soundLabel.textContent =
    audio && !audio.supported ? "Sound unavailable" : state.soundEnabled ? "Sound on" : "Sound off";
}

function updateStatusMessage(message) {
  if (elements.statusMessage.textContent.trim() === message) return;
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.remove("is-changing");
  void elements.statusMessage.offsetWidth;
  elements.statusMessage.classList.add("is-changing");
}

function onPointerDown(event) {
  if (state.phase !== "open" || event.button !== 0) return;

  pointerGesture = {
    pointerId: event.pointerId,
    startX: event.clientX,
    progress: 0,
  };
  elements.sash.setPointerCapture(event.pointerId);
  elements.sash.classList.add("is-dragging");
  audio.resume();
  event.preventDefault();
}

function onPointerMove(event) {
  if (!pointerGesture || pointerGesture.pointerId !== event.pointerId) return;

  const sceneWidth = elements.scene.getBoundingClientRect().width;
  const distance = Math.max(0, event.clientX - pointerGesture.startX);
  const progress = Math.min(1, distance / Math.max(sceneWidth * 0.18, 72));
  const openAmount = 1 - progress;
  const scale = 0.58 + progress * 0.42;

  pointerGesture.progress = progress;
  elements.sash.style.transform = `skewY(${-2.5 * openAmount}deg) scaleX(${scale})`;
}

function onPointerUp(event) {
  if (!pointerGesture || pointerGesture.pointerId !== event.pointerId) return;

  const movement = Math.abs(event.clientX - pointerGesture.startX);
  const shouldClose = pointerGesture.progress >= 0.38 || movement < 8;
  releasePointer(event.pointerId);

  if (shouldClose) requestClose();
}

function cancelPointerGesture(event) {
  if (!pointerGesture || pointerGesture.pointerId !== event.pointerId) return;
  releasePointer(event.pointerId);
}

function releasePointer(pointerId) {
  if (elements.sash.hasPointerCapture(pointerId)) elements.sash.releasePointerCapture(pointerId);
  pointerGesture = null;
  elements.sash.classList.remove("is-dragging");
  elements.sash.style.removeProperty("transform");
}

function onWindowKeyDown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  requestClose();
}

async function toggleSound() {
  if (!audio.supported) return;
  const enabled = !state.soundEnabled;
  dispatch({ type: "SET_SOUND", enabled });
  await audio.setEnabled(enabled);
}

function resetGame() {
  timelineId += 1;
  clearScheduledTimers();
  pointerGesture = null;
  eventDeck.reset();
  elements.sash.classList.remove("is-dragging");
  elements.sash.style.removeProperty("transform");
  dispatch({ type: "RESET" });
  audio.restartStorm();
  scheduleAmbientLightning();
  elements.sash.focus({ preventScroll: true });
}

function createAttemptTrack() {
  const fragment = document.createDocumentFragment();
  for (let index = 1; index <= MAX_ATTEMPTS; index += 1) {
    const marker = document.createElement("li");
    marker.setAttribute("aria-hidden", "true");
    fragment.append(marker);
  }
  elements.attemptTrack.append(fragment);
}

function createAtmosphere() {
  const rainFragment = document.createDocumentFragment();
  const indoorFragment = document.createDocumentFragment();
  const windFragment = document.createDocumentFragment();

  for (let index = 0; index < 64; index += 1) {
    const x = 365 + seeded(index, 19) * 500;
    const y = 60 + seeded(index, 47) * 520;
    const length = 14 + seeded(index, 83) * 28;
    const line = makeSvg("line", {
      x1: x,
      y1: y,
      x2: x - length * 0.34,
      y2: y + length,
    });
    line.style.setProperty("--rain-speed", `${480 + seeded(index, 131) * 520}ms`);
    line.style.setProperty("--rain-delay", `${-seeded(index, 167) * 1200}ms`);
    rainFragment.append(line);
  }

  for (let index = 0; index < 38; index += 1) {
    const x = 220 + seeded(index, 23) * 760;
    const y = 50 + seeded(index, 73) * 580;
    const line = makeSvg("line", { x1: x, y1: y, x2: x - 12, y2: y + 34 });
    line.style.setProperty("--rain-speed", `${520 + seeded(index, 97) * 460}ms`);
    line.style.setProperty("--rain-delay", `${-seeded(index, 109) * 900}ms`);
    indoorFragment.append(line);
  }

  for (let index = 0; index < 11; index += 1) {
    const y = 145 + index * 37;
    const bend = index % 2 === 0 ? -17 : 20;
    const path = makeSvg("path", {
      d: `M320 ${y} C470 ${y + bend}, 670 ${y - bend}, 874 ${y + 4}`,
    });
    path.style.setProperty("--wind-speed", `${1.2 + seeded(index, 41) * 1.2}s`);
    path.style.setProperty("--wind-delay", `${-seeded(index, 67) * 2}s`);
    windFragment.append(path);
  }

  elements.rain.append(rainFragment);
  elements.insideRain.append(indoorFragment);
  elements.wind.append(windFragment);
}

function makeSvg(tagName, attributes) {
  const element = document.createElementNS(SVG_NS, tagName);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

function seeded(index, salt) {
  const value = Math.sin(index * 9283.31 + salt * 77.17) * 43758.5453;
  return value - Math.floor(value);
}

function triggerLightning(withThunder = false) {
  if (state.phase === "won") return;
  elements.lightning.classList.remove("is-ambient");
  elements.lightningFlash.classList.remove("is-active");
  void elements.lightning.getBoundingClientRect();
  elements.lightning.classList.add("is-ambient");
  elements.lightningFlash.classList.add("is-active");
  if (withThunder) audio.playThunder();
}

function scheduleAmbientLightning() {
  if (ambientTimer) window.clearTimeout(ambientTimer);
  const delay = reducedMotionQuery.matches ? 22000 : 7500 + Math.random() * 7500;
  ambientTimer = window.setTimeout(() => {
    if (state.phase !== "won" && state.currentEvent?.id !== "lightning") {
      triggerLightning(state.soundEnabled && Math.random() > 0.58);
    }
    scheduleAmbientLightning();
  }, delay);
}

function schedule(callback, delay) {
  const timer = window.setTimeout(() => {
    scheduledTimers.delete(timer);
    callback();
  }, delay);
  scheduledTimers.add(timer);
  return timer;
}

function clearScheduledTimers() {
  scheduledTimers.forEach((timer) => window.clearTimeout(timer));
  scheduledTimers.clear();
}

function motionDuration(duration) {
  return reducedMotionQuery.matches ? Math.min(duration, 180) : duration;
}

class StormAudio {
  constructor() {
    this.supported = Boolean(window.AudioContext ?? window.webkitAudioContext);
    this.context = null;
    this.master = null;
    this.rainGain = null;
    this.windGain = null;
    this.enabled = false;
    this.pageVisible = true;
    this.ambienceStarted = false;
  }

  async setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled && !this.context) return;

    this.#ensureContext();
    if (!this.context) return;
    if (this.context.state === "suspended") await this.context.resume();
    if (!this.ambienceStarted) this.#startAmbience();
    this.#ramp(this.master.gain, enabled && this.pageVisible ? 0.34 : 0, 0.18);
  }

  resume() {
    if (this.enabled && this.context?.state === "suspended") this.context.resume();
  }

  setPageVisible(visible) {
    this.pageVisible = visible;
    if (!this.master) return;
    this.#ramp(this.master.gain, this.enabled && visible ? 0.34 : 0, 0.25);
  }

  playLatch() {
    if (!this.#canPlay()) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(190, now);
    oscillator.frequency.exponentialRampToValueAtTime(72, now + 0.12);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.16);
  }

  playEvent(id) {
    if (!this.#canPlay()) return;
    if (id === "wind" || id === "curtains" || id === "wall") this.#playGust();
    if (id === "bird") this.#playChirp();
    if (id === "handle" || id === "lock" || id === "small-window") this.#playClatter();
    if (id === "inside-rain") this.#ramp(this.rainGain.gain, 0.38, 0.1);
    if (id === "character") this.#playFootsteps();
    if (id === "lightning") this.playThunder();
  }

  playThunder() {
    if (!this.#canPlay()) return;
    const now = this.context.currentTime;
    const duration = 2.8;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.#noiseBuffer(duration, true);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(210, now);
    filter.frequency.exponentialRampToValueAtTime(62, now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.72, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);

    [43, 57].forEach((frequency, index) => {
      const rumble = this.context.createOscillator();
      const rumbleGain = this.context.createGain();
      rumble.type = "sine";
      rumble.frequency.setValueAtTime(frequency, now);
      rumble.frequency.exponentialRampToValueAtTime(frequency * 0.72, now + 1.8);
      rumbleGain.gain.setValueAtTime(0.001, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.24 - index * 0.06, now + 0.05);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
      rumble.connect(rumbleGain).connect(this.master);
      rumble.start(now);
      rumble.stop(now + 2.3);
    });
  }

  calmStorm() {
    if (!this.#canPlay()) return;
    this.#ramp(this.rainGain.gain, 0.001, 1.8);
    this.#ramp(this.windGain.gain, 0.001, 1.8);
    const now = this.context.currentTime;
    [261.63, 329.63, 392].forEach((frequency, index) => {
      const tone = this.context.createOscillator();
      const gain = this.context.createGain();
      tone.type = "sine";
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0.001, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.25 + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      tone.connect(gain).connect(this.master);
      tone.start(now + index * 0.08);
      tone.stop(now + 1.9);
    });
  }

  restartStorm() {
    if (!this.#canPlay() || !this.rainGain || !this.windGain) return;
    this.#ramp(this.rainGain.gain, 0.2, 0.45);
    this.#ramp(this.windGain.gain, 0.12, 0.45);
  }

  #ensureContext() {
    if (this.context) return;
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
  }

  #startAmbience() {
    if (!this.context || this.ambienceStarted) return;
    const rainSource = this.context.createBufferSource();
    const rainFilter = this.context.createBiquadFilter();
    const windSource = this.context.createBufferSource();
    const windFilter = this.context.createBiquadFilter();

    this.rainGain = this.context.createGain();
    this.windGain = this.context.createGain();
    rainSource.buffer = this.#noiseBuffer(2.5);
    rainSource.loop = true;
    rainFilter.type = "highpass";
    rainFilter.frequency.value = 980;
    this.rainGain.gain.value = 0.2;
    rainSource.connect(rainFilter).connect(this.rainGain).connect(this.master);

    windSource.buffer = this.#noiseBuffer(3.2, true);
    windSource.loop = true;
    windFilter.type = "bandpass";
    windFilter.frequency.value = 310;
    windFilter.Q.value = 0.55;
    this.windGain.gain.value = 0.12;
    windSource.connect(windFilter).connect(this.windGain).connect(this.master);

    rainSource.start();
    windSource.start();
    this.ambienceStarted = true;
  }

  #playGust() {
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.#noiseBuffer(1.25);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(180, now);
    filter.frequency.exponentialRampToValueAtTime(920, now + 0.7);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.42, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
  }

  #playChirp() {
    const now = this.context.currentTime;
    [0, 0.13].forEach((offset) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1100, now + offset);
      oscillator.frequency.exponentialRampToValueAtTime(1900, now + offset + 0.09);
      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
      oscillator.connect(gain).connect(this.master);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.13);
    });
  }

  #playClatter() {
    const now = this.context.currentTime;
    [0, 0.08, 0.17].forEach((offset, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = 220 - index * 38;
      gain.gain.setValueAtTime(0.07, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);
      oscillator.connect(gain).connect(this.master);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.07);
    });
  }

  #playFootsteps() {
    const now = this.context.currentTime;
    [0, 0.11, 0.22, 0.33].forEach((offset) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = 95;
      gain.gain.setValueAtTime(0.055, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.07);
      oscillator.connect(gain).connect(this.master);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.08);
    });
  }

  #noiseBuffer(duration, brown = false) {
    const frameCount = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;

    for (let index = 0; index < frameCount; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = brown ? (previous + 0.02 * white) / 1.02 : white;
      data[index] = brown ? previous * 3.4 : white;
    }
    return buffer;
  }

  #ramp(parameter, value, duration) {
    const now = this.context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(Math.max(parameter.value, 0.001), now);
    parameter.exponentialRampToValueAtTime(Math.max(value, 0.001), now + duration);
  }

  #canPlay() {
    return Boolean(this.enabled && this.pageVisible && this.context && this.master);
  }
}

audio = new StormAudio();
if (!audio.supported) {
  elements.soundToggle.disabled = true;
  elements.soundToggle.title = "Web Audio is not supported by this browser";
  elements.soundLabel.textContent = "Sound unavailable";
}
