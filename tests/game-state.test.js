import test from "node:test";
import assert from "node:assert/strict";

import {
  EVENTS,
  EventDeck,
  MAX_ATTEMPTS,
  createInitialState,
  gameReducer,
} from "../game-state.js";

test("a close request increments attempts only while the window is open", () => {
  const initial = createInitialState();
  const closing = gameReducer(initial, { type: "CLOSE_REQUEST" });
  const duplicate = gameReducer(closing, { type: "CLOSE_REQUEST" });

  assert.equal(closing.attempts, 1);
  assert.equal(closing.phase, "closing");
  assert.equal(duplicate, closing);
});

test("attempts one through nine resolve to events and reopen", () => {
  let state = createInitialState();

  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
    state = gameReducer(state, { type: "CLOSE_REQUEST" });
    state = gameReducer(state, { type: "RESOLVE_CLOSE", event: EVENTS[attempt - 1] });

    assert.equal(state.phase, "event");
    assert.equal(state.attempts, attempt);

    state = gameReducer(state, { type: "REOPEN" });
    assert.equal(state.phase, "open");
  }
});

test("the tenth close wins and can no longer reopen", () => {
  let state = createInitialState();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    state = gameReducer(state, { type: "CLOSE_REQUEST" });
    state = gameReducer(state, { type: "RESOLVE_CLOSE", event: EVENTS[0] });
    if (attempt < MAX_ATTEMPTS) state = gameReducer(state, { type: "REOPEN" });
  }

  assert.equal(state.attempts, MAX_ATTEMPTS);
  assert.equal(state.phase, "won");
  assert.equal(gameReducer(state, { type: "REOPEN" }), state);
  assert.equal(gameReducer(state, { type: "CLOSE_REQUEST" }), state);
});

test("reset clears progress while preserving the sound preference", () => {
  let state = createInitialState();
  state = gameReducer(state, { type: "SET_SOUND", enabled: true });
  state = gameReducer(state, { type: "CLOSE_REQUEST" });
  state = gameReducer(state, { type: "RESET" });

  assert.deepEqual(state, createInitialState({ soundEnabled: true }));
});

test("the event deck returns every event once before refilling", () => {
  const deck = new EventDeck(EVENTS, () => 0.42);
  const firstRound = Array.from({ length: EVENTS.length }, () => deck.next());

  assert.equal(new Set(firstRound.map((event) => event.id)).size, EVENTS.length);
  assert.deepEqual(
    new Set(firstRound.map((event) => event.id)),
    new Set(EVENTS.map((event) => event.id)),
  );
});

test("the event deck avoids repeating the last event across a refill", () => {
  const deck = new EventDeck(EVENTS.slice(0, 3), () => 0);
  const firstRound = Array.from({ length: 3 }, () => deck.next());
  const previous = firstRound.at(-1);
  const next = deck.next(previous.id);

  assert.notEqual(next.id, previous.id);
});

test("unknown events are rejected instead of corrupting state", () => {
  const closing = gameReducer(createInitialState(), { type: "CLOSE_REQUEST" });

  assert.throws(
    () => gameReducer(closing, { type: "RESOLVE_CLOSE", event: { id: "mystery" } }),
    /known WindowWars event/,
  );
});
