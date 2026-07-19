import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { EVENTS } from "../game-state.js";

const [html, css, script, readme, packageJson] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../script.js", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
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

test("shared TinyChaos UI family contracts are present", () => {
  const sharedPalette = ["#15152a", "#fff5df", "#ff5d5d", "#4f7cff", "#ffd166", "#58d6a9", "#b695ff"];
  sharedPalette.forEach((color) => assert.match(css, new RegExp(color, "i"), `${color} must remain in the shared palette`));

  assert.match(html, /href="https:\/\/sudarshanchaudhari\.github\.io\/TinyChaos\/"/);
  assert.match(html, /WindowWars · by Sudarshan Chaudhari/);
  assert.match(css, /outline:\s*4px solid var\(--blue\)/);
  assert.match(css, /\.window-sash:focus-visible\s*\{[^}]*drop-shadow\([^}]*var\(--paper\)[^}]*var\(--blue\)/s);
  assert.match(css, /--display:\s*Impact/);
  assert.match(css, /--body:\s*"Arial Rounded MT Bold"/);
  assert.match(css, /overflow-x:\s*clip/);

  for (const rule of css.matchAll(/(?:^|\n)(?:html|body)\s*\{([^}]*)\}/g)) {
    assert.doesNotMatch(rule[1], /min-width:\s*(?:280|320)px/);
  }
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
  ["Technology", "Run locally", "Controls", "Audio design", "Accessibility", "Verification"].forEach(
    (heading) => assert.match(readme, new RegExp(`## ${heading}`)),
  );
});

test("README and package metadata identify the verified author", () => {
  assert.match(readme, /## Author/);
  assert.match(readme, /Sudarshan Chaudhari/);
  assert.match(readme, /SudarshanTechLabs/);
  assert.match(readme, /SUDARSHANCHAUDHARI/);
  assert.match(readme, /sunny\.sudarshan@gmail\.com/);
  assert.deepEqual(packageJson.author, {
    name: "Sudarshan Chaudhari",
    email: "sunny.sudarshan@gmail.com",
    url: "https://github.com/SUDARSHANCHAUDHARI",
  });
});
