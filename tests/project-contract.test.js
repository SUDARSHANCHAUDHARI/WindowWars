import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { EVENTS } from "../game-state.js";

const [html, css, script, readme] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../script.js", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
]);

test("required interactive and accessible scene landmarks exist", () => {
  const requiredFragments = [
    "<main",
    "<button",
    'id="sound-toggle"',
    'id="reset-button"',
    'id="window-sash"',
    'role="button"',
    'tabindex="0"',
    'aria-live="polite"',
    'id="attempt-track"',
    '<script type="module"',
  ];

  requiredFragments.forEach((fragment) => assert.match(html, new RegExp(fragment)));
});

test("HTML ids are unique", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size);
});

test("every authored event has a visual CSS performance", () => {
  EVENTS.forEach((event) => {
    assert.match(css, new RegExp(`data-effect=\\"${event.id}\\"`));
  });
});

test("responsive and reduced-motion contracts are present", () => {
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(script, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
});

test("production metadata is present and local development remains HTTP-compatible", () => {
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /rel="manifest" href="site\.webmanifest"/);
  assert.match(html, /property="og:title"/);
  assert.doesNotMatch(html, /upgrade-insecure-requests/);
});

test("the project does not depend on remote visual or audio assets", () => {
  assert.doesNotMatch(html, /<(?:img|audio|video|source)\b/i);
  assert.doesNotMatch(css, /url\(["']?https?:\/\//i);
  assert.match(script, /AudioContext/);
  assert.match(script, /createOscillator/);
  assert.match(script, /createBuffer/);
});

test("README documents running, controls, accessibility, audio, and verification", () => {
  ["Run locally", "Controls", "Audio design", "Accessibility", "Verification"].forEach(
    (heading) => assert.match(readme, new RegExp(`## ${heading}`)),
  );
});
