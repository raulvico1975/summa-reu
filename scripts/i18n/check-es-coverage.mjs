#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  ca: path.join(root, "src/i18n/ca.ts"),
  esCore: path.join(root, "src/i18n/es.core.ts"),
  esExtra: path.join(root, "src/i18n/es.extra.ts"),
};

const coreSections = ["appName", "nav", "session", "status", "home", "login", "signup", "errors"];
const noFallbackSections = ["home", "nav", "session", "status", "errors", "dashboard", "poll", "meeting"];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractObjectLiteral(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Marker not found: ${marker}`);
  }

  const start = source.indexOf("{", markerIndex);
  if (start < 0) {
    throw new Error(`Object start not found after marker: ${marker}`);
  }

  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  throw new Error(`Object end not found for marker: ${marker}`);
}

function parseObjectLiteral(literal) {
  return Function(`"use strict"; return (${literal});`)();
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch ?? base;
  }

  const result = { ...base };
  for (const key of Object.keys(patch)) {
    const patchValue = patch[key];
    if (patchValue === undefined) continue;

    const baseValue = result[key];
    result[key] = isPlainObject(baseValue) && isPlainObject(patchValue)
      ? deepMerge(baseValue, patchValue)
      : patchValue;
  }
  return result;
}

function collectPlaceholderSet(value) {
  const matches = value.matchAll(/\{([a-zA-Z0-9_]+)\}/g);
  return new Set(Array.from(matches, (match) => match[1]));
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

function validateCoverage(base, candidate, pathPrefix, errors) {
  if (Array.isArray(base)) {
    if (!Array.isArray(candidate)) {
      errors.push(`[missing] ${pathPrefix}`);
    }
    return;
  }

  if (isPlainObject(base)) {
    if (!isPlainObject(candidate)) {
      errors.push(`[missing] ${pathPrefix}`);
      return;
    }

    for (const key of Object.keys(base)) {
      const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      validateCoverage(base[key], candidate[key], nextPath, errors);
    }
    return;
  }

  if (candidate === undefined) {
    errors.push(`[missing] ${pathPrefix}`);
  }
}

function validatePlaceholders(base, candidate, pathPrefix, errors) {
  if (Array.isArray(base) || Array.isArray(candidate)) return;

  if (isPlainObject(base) && isPlainObject(candidate)) {
    for (const key of Object.keys(base)) {
      const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      validatePlaceholders(base[key], candidate[key], nextPath, errors);
    }
    return;
  }

  if (typeof base === "string" && typeof candidate === "string") {
    const baseSet = collectPlaceholderSet(base);
    const candidateSet = collectPlaceholderSet(candidate);
    if (!setsEqual(baseSet, candidateSet)) {
      errors.push(
        `[placeholders] ${pathPrefix} expected {${Array.from(baseSet).sort().join(",")}} got {${Array.from(
          candidateSet
        )
          .sort()
          .join(",")}}`
      );
    }
  }
}

function run() {
  const caSource = read(files.ca);
  const esCoreSource = read(files.esCore);
  const esExtraSource = read(files.esExtra);

  const ca = parseObjectLiteral(extractObjectLiteral(caSource, "export const ca ="));
  const esCore = parseObjectLiteral(extractObjectLiteral(esCoreSource, "export const esCore"));
  const esExtra = parseObjectLiteral(extractObjectLiteral(esExtraSource, "export const esExtra"));
  const esMerged = deepMerge(esCore, esExtra);

  const errors = [];

  for (const section of coreSections) {
    validateCoverage(ca[section], esCore[section], section, errors);
  }

  for (const section of noFallbackSections) {
    validateCoverage(ca[section], esMerged[section], section, errors);
  }

  validatePlaceholders(ca, esMerged, "", errors);

  if (errors.length > 0) {
    console.error("i18n:check-es failed");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("i18n:check-es OK");
}

run();
