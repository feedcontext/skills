import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const evalsRoot = join(repoRoot, "evals");

export function resolveFrom(baseDir, value) {
  return isAbsolute(value) ? value : resolve(baseDir, value);
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function fileSize(file) {
  return (await stat(file)).size;
}

export function assertInside(parent, child, label) {
  const parentPath = resolve(parent);
  const childPath = resolve(child);
  const rel = relative(parentPath, childPath);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) return;
  throw new Error(`${label} must stay inside ${parentPath}: ${childPath}`);
}

export function jsonPathValue(value, path) {
  const parts = path.startsWith("$.") ? path.slice(2).split(".") : path.split(".");
  let current = value;
  for (const part of parts) {
    if (part === "") continue;
    if (current === null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

export function matchesExpected(actual, expected) {
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    if ("exists" in expected) {
      return expected.exists ? actual !== undefined : actual === undefined;
    }
    if ("includes" in expected) {
      return typeof actual === "string" && actual.includes(expected.includes);
    }
    if ("min_length" in expected) {
      const length = Array.isArray(actual) || typeof actual === "string" ? actual.length : undefined;
      return typeof length === "number" && length >= expected.min_length;
    }
    if ("equals" in expected) {
      return Object.is(actual, expected.equals);
    }
  }
  return Object.is(actual, expected);
}
