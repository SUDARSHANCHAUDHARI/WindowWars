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

function declaration(selector, property, source = css) {
  const start = source.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Missing CSS rule ${selector}`);
  const body = source.slice(source.indexOf("{", start) + 1, source.indexOf("}", start));
  const match = body.match(new RegExp(`(?:^|\\n)\\s*${property.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*:\\s*([\\s\\S]*?);`));
  assert.ok(match, `Missing ${property} in ${selector}`);
  return match[1].trim();
}

function resolvedColor(value, seen = new Set()) {
  const variable = value.match(/^var\(--([^)]+)\)$/);
  if (!variable) {
    assert.match(value, /^#[0-9a-f]{6}$/i, `Unsupported color ${value}`);
    return value.toLowerCase();
  }
  assert.equal(seen.has(variable[1]), false, `Circular CSS variable --${variable[1]}`);
  seen.add(variable[1]);
  return resolvedColor(declaration(":root", `--${variable[1]}`), seen);
}

function contrastRatio(first, second) {
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/.{2}/g).map((value) => Number.parseInt(value, 16) / 255);
    const linear = channels.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function mediaStart(query) {
  const position = css.indexOf(`@media ${query} {`);
  assert.notEqual(position, -1, `Missing media query ${query}`);
  return position;
}

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
  const widths = [...css.matchAll(/@media \(max-width: (\d+)px\)\s*\{/g)].map((match) => Number(match[1]));
  assert.deepEqual(widths, [760, 440], "Width breakpoints must cover tablet and 320/375px layouts");

  const tablet = mediaStart("(max-width: 760px)");
  const mobile = mediaStart("(max-width: 440px)");
  const narrowShort = mediaStart("(max-width: 640px) and (max-height: 500px)");
  const reduced = mediaStart("(prefers-reduced-motion: reduce)");
  assert.ok(tablet < mobile && mobile < narrowShort && narrowShort < reduced, "Responsive cascade order changed");

  const narrowSection = css.slice(narrowShort, reduced);
  assert.equal(declaration(".game-shell", "width", narrowSection), "calc(100% - 14px)");
  assert.equal(declaration(".game-shell", "padding-top", narrowSection), "14px");
  assert.doesNotMatch(css.slice(reduced), /\.game-shell\s*\{[^}]*width\s*:/s, "A later rule overrides narrow/short width");
  assert.equal(declaration("body", "overflow-y"), "auto", "Short viewports must retain vertical scrolling");
  assert.equal(declaration("body", "overflow-x"), "clip");
  assert.equal(declaration("html", "min-width"), "0");
  assert.equal(declaration("body", "min-width"), "0");
  assert.match(declaration(".game-shell", "width"), /1240px/, "Base rule must retain laptop/desktop cap");
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(script, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
});

test("keyboard hint contrast is bound to its rendered selector and gradient endpoints", () => {
  const hint = resolvedColor(declaration(".keyboard-hint", "color"));
  const background = declaration("body", "background");
  assert.match(background, /var\(--page-gradient-start\)/);
  assert.match(background, /var\(--page-gradient-end\)/);
  const endpoints = [
    resolvedColor(declaration(":root", "--page-gradient-start")),
    resolvedColor(declaration(":root", "--page-gradient-end")),
  ];
  endpoints.forEach((endpoint) => {
    assert.ok(contrastRatio(hint, endpoint) >= 4.5, `${hint} is below 4.5:1 on ${endpoint}`);
  });
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
