#!/usr/bin/env node
// Warns when ARCHITECTURE.md describes an older build than the newest one
// PROJECT_STATUS.md says shipped.
//
// This is not a GitHub Actions workflow. The repo has no CI - GitHub Pages
// serves it directly - so this is a local check the builder runs alongside
// `npm test` and `npm run build`. Exit 1 on a lag, silence otherwise.
//
// No dependencies, by the same rule the rest of the repo follows.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ARCHITECTURE = path.join(ROOT, "ARCHITECTURE.md");
const PROJECT_STATUS = path.join(ROOT, "PROJECT_STATUS.md");

// "current as of **v1.17**" - the bold markers are optional so a plain
// "current as of v1.17" keeps working if the heading is ever restyled.
//
// Global, and the highest match wins (v1.24). Reading only the first occurrence
// meant a historical note further down the file - "this section is current as of
// v1.9" - would silently become the version under test, and the check would
// start reporting a lag that the header does not have, or miss one it does.
const ARCHITECTURE_VERSION = /current as of\s+\**v(\d+)\.(\d+)([a-z]?)\**/gi;

// Section headers in PROJECT_STATUS.md read "## v1.17 Voice & Copy Polish ...".
// Only ## headers count: prose elsewhere mentions old versions constantly and
// matching those would make every build look behind.
const STATUS_HEADER = /^#{2,3}\s+v(\d+)\.(\d+)([a-z]?)\b/gim;

// A version is ordered by major, then minor, then the optional letter suffix
// (v1.9a < v1.9b < v1.9c). An absent letter sorts before any letter, which is
// what "v1.9 shipped before v1.9a" means here.
function toKey(major, minor, suffix) {
  return [Number(major), Number(minor), suffix ? suffix.charCodeAt(0) - 96 : 0];
}

function compare(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function label(key) {
  return `v${key[0]}.${key[1]}${key[2] ? String.fromCharCode(96 + key[2]) : ""}`;
}

function read(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    console.error(`check-docs: cannot read ${path.relative(ROOT, file)} (${error.code}).`);
    process.exit(1);
  }
}

const architectureText = read(ARCHITECTURE);
const statusText = read(PROJECT_STATUS);

let architectureKey = null;
for (const match of architectureText.matchAll(ARCHITECTURE_VERSION)) {
  const key = toKey(match[1], match[2], match[3]);
  if (!architectureKey || compare(key, architectureKey) > 0) architectureKey = key;
}
if (!architectureKey) {
  console.error('check-docs: ARCHITECTURE.md has no "current as of vX.XX" line to read.');
  process.exit(1);
}

let latestKey = null;
for (const match of statusText.matchAll(STATUS_HEADER)) {
  const key = toKey(match[1], match[2], match[3]);
  if (!latestKey || compare(key, latestKey) > 0) latestKey = key;
}

if (!latestKey) {
  console.error("check-docs: PROJECT_STATUS.md has no vX.XX section header to compare against.");
  process.exit(1);
}

if (compare(architectureKey, latestKey) < 0) {
  console.error(
    `⚠️  ARCHITECTURE.md describes ${label(architectureKey)} but PROJECT_STATUS.md shows ${label(latestKey)} shipped. Update ARCHITECTURE.md.`,
  );
  process.exit(1);
}

process.exit(0);
