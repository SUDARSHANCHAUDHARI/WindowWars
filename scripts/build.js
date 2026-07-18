import { copyFile, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const outputDirectory = new URL("../dist/", import.meta.url);
const productionFiles = [
  "404.html",
  "LICENSE",
  "_headers",
  "favicon.svg",
  "game-state.js",
  "index.html",
  "robots.txt",
  "script.js",
  "site.webmanifest",
  "styles.css",
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of productionFiles) {
  const source = new URL(file, projectRoot);
  const destination = new URL(file, outputDirectory);
  await copyFile(source, destination);
}

const indexHtml = await readFile(new URL("index.html", outputDirectory), "utf8");
const requiredReferences = [
  'href="favicon.svg"',
  'href="site.webmanifest"',
  'href="styles.css"',
  'src="script.js"',
];

for (const reference of requiredReferences) {
  if (!indexHtml.includes(reference)) {
    throw new Error(`Production index is missing ${reference}`);
  }
}

const artifactFiles = await readdir(outputDirectory);
let artifactBytes = 0;

for (const file of artifactFiles) {
  artifactBytes += (await stat(new URL(file, outputDirectory))).size;
}

console.log(
  `Built ${artifactFiles.length} production files (${artifactBytes.toLocaleString("en-US")} bytes) in dist/.`,
);
