export const MAX_ATTEMPTS = 10;

export const EVENTS = Object.freeze([
  Object.freeze({
    id: "wind",
    title: "Wind objects",
    message: "A rude gust shoulders the window back open.",
    glyph: "≈",
    duration: 1450,
  }),
  Object.freeze({
    id: "bird",
    title: "Unexpected tenant",
    message: "A bird claims the sill. Apparently, it has a reservation.",
    glyph: "◇",
    duration: 1600,
  }),
  Object.freeze({
    id: "handle",
    title: "Handle unavailable",
    message: "The handle relocates. Workplace boundaries, it says.",
    glyph: "↝",
    duration: 1550,
  }),
  Object.freeze({
    id: "curtains",
    title: "Curtain mutiny",
    message: "The curtains grab the frame and yank it open again.",
    glyph: "⋈",
    duration: 1500,
  }),
  Object.freeze({
    id: "small-window",
    title: "Window, junior",
    message: "You close one window. A smaller, wetter window appears.",
    glyph: "▣",
    duration: 1550,
  }),
  Object.freeze({
    id: "inside-rain",
    title: "Indoor weather",
    message: "The rain misunderstands the floor plan.",
    glyph: "////",
    duration: 1550,
  }),
  Object.freeze({
    id: "wall",
    title: "Wrong opening",
    message: "The window stays shut. The wall opens instead.",
    glyph: "⌁",
    duration: 1650,
  }),
  Object.freeze({
    id: "character",
    title: "Tiny sabotage",
    message: "A very small accomplice climbs up and pushes it open.",
    glyph: "♙",
    duration: 1550,
  }),
  Object.freeze({
    id: "lock",
    title: "Definitely locked",
    message: "The lock gives a confident click, then falls off.",
    glyph: "⌑",
    duration: 1550,
  }),
  Object.freeze({
    id: "lightning",
    title: "Window startled",
    message: "Lightning strikes. The window jumps open in fright.",
    glyph: "ϟ",
    duration: 1450,
  }),
]);

export function createInitialState({ soundEnabled = false } = {}) {
  return {
    attempts: 0,
    phase: "open",
    currentEvent: null,
    lastEventId: null,
    soundEnabled,
  };
}

export function gameReducer(state, action) {
  switch (action.type) {
    case "CLOSE_REQUEST": {
      if (state.phase !== "open") return state;

      return {
        ...state,
        attempts: Math.min(state.attempts + 1, MAX_ATTEMPTS),
        phase: "closing",
        currentEvent: null,
      };
    }

    case "RESOLVE_CLOSE": {
      if (state.phase !== "closing") return state;

      if (state.attempts >= MAX_ATTEMPTS) {
        return {
          ...state,
          attempts: MAX_ATTEMPTS,
          phase: "won",
          currentEvent: null,
        };
      }

      if (!action.event || !EVENTS.some((event) => event.id === action.event.id)) {
        throw new TypeError("RESOLVE_CLOSE requires a known WindowWars event.");
      }

      return {
        ...state,
        phase: "event",
        currentEvent: action.event,
        lastEventId: action.event.id,
      };
    }

    case "REOPEN": {
      if (state.phase !== "event") return state;

      return {
        ...state,
        phase: "open",
        currentEvent: null,
      };
    }

    case "SET_SOUND":
      return { ...state, soundEnabled: Boolean(action.enabled) };

    case "RESET":
      return createInitialState({ soundEnabled: state.soundEnabled });

    default:
      return state;
  }
}

export class EventDeck {
  constructor(events = EVENTS, random = Math.random) {
    if (!Array.isArray(events) || events.length === 0) {
      throw new TypeError("EventDeck requires at least one event.");
    }

    this.events = [...events];
    this.random = random;
    this.remaining = [];
  }

  next(lastEventId = null) {
    if (this.remaining.length === 0) this.#refill(lastEventId);
    return this.remaining.pop();
  }

  reset() {
    this.remaining = [];
  }

  #refill(lastEventId) {
    this.remaining = [...this.events];

    for (let index = this.remaining.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.random() * (index + 1));
      [this.remaining[index], this.remaining[swapIndex]] = [
        this.remaining[swapIndex],
        this.remaining[index],
      ];
    }

    if (this.remaining.length > 1 && this.remaining.at(-1).id === lastEventId) {
      [this.remaining[0], this.remaining[this.remaining.length - 1]] = [
        this.remaining.at(-1),
        this.remaining[0],
      ];
    }
  }
}
