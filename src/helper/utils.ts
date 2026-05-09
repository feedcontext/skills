import type { JsonRecord } from "./types";

export function parseConcurrency(value: string | number | undefined, defaultValue = 32) {
  if (value === undefined) return defaultValue;
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("--concurrency must be a positive integer.");
  }
  return parsed;
}

export function parseItemIdsFile(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string" || id.trim() === "")) {
      throw new Error("--ids-file JSON must be an array of non-empty strings.");
    }
    return parsed;
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function normalizeItemIds(options: { ids?: string[]; idsFileContent?: string }) {
  const ids = [...(options.ids ?? []), ...(options.idsFileContent ? parseItemIdsFile(options.idsFileContent) : [])]
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    throw new Error("item get-many requires at least one --id or --ids-file entry.");
  }
  return ids;
}

export function parsePositiveIntegerOption(input: {
  defaultValue?: number;
  max?: number;
  name: string;
  value?: string | number;
}): number | undefined {
  if (input.value === undefined) return input.defaultValue;
  const parsed = typeof input.value === "number" ? input.value : Number.parseInt(input.value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${input.name} must be a positive integer.`);
  }
  if (input.max !== undefined && parsed > input.max) {
    throw new Error(`${input.name} must be less than or equal to ${input.max}.`);
  }
  return parsed;
}

export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]!, currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
