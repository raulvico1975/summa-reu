import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = process.cwd();

function resolveExistingPath(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.mjs"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const resolvedPath = resolveExistingPath(path.join(rootDir, specifier.slice(2)));
    if (!resolvedPath) {
      throw new Error(`Cannot resolve alias import: ${specifier}`);
    }

    return {
      url: pathToFileURL(resolvedPath).href,
      shortCircuit: true,
    };
  }

  const isRelativeWithoutExtension =
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    path.extname(specifier) === "";

  if (isRelativeWithoutExtension && context.parentURL?.startsWith("file://")) {
    const parentPath = fileURLToPath(context.parentURL);
    const resolvedPath = resolveExistingPath(path.resolve(path.dirname(parentPath), specifier));
    if (resolvedPath) {
      return {
        url: pathToFileURL(resolvedPath).href,
        shortCircuit: true,
      };
    }
  }

  return nextResolve(specifier, context);
}
