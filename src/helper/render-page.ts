import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { JsonRecord } from "./types";
import { validateStructuredSynthesis } from "./validation";

type FeedItemEvidence = {
  feed_item_id: string;
  kind: "feed_item";
  reason: string;
  relevance: string;
  subscription_title: string;
  title: string;
  url: string;
  published_at?: number | null;
};

type SynthesisUnit = {
  claim: string;
  id: string;
  rendering_priority: "lead" | "main" | "secondary" | "collapsed";
  selection_rationale: string;
  supporting_evidence: JsonRecord[];
  title: string;
  type: string;
};

type StructuredSynthesis = {
  scope: {
    request: string;
    selection_rule: string;
    time_range?: {
      label?: string;
      published_after?: number;
      published_before?: number;
    };
  };
  units: SynthesisUnit[];
  secondary_items?: Array<{
    feed_item_id: string;
    group: string;
    reason: string;
    subscription_title: string;
    title: string;
    url: string;
    published_at?: number | null;
  }>;
};

function asRecord(value: unknown): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Structured synthesis must be a JSON object.");
  }
  return value as JsonRecord;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function evidenceItems(unit: SynthesisUnit) {
  return unit.supporting_evidence.filter((evidence): evidence is FeedItemEvidence =>
    evidence.kind === "feed_item" &&
    typeof evidence.feed_item_id === "string" &&
    typeof evidence.url === "string" &&
    typeof evidence.subscription_title === "string" &&
    typeof evidence.title === "string" &&
    typeof evidence.reason === "string" &&
    typeof evidence.relevance === "string",
  );
}

function formatDate(timestamp: number | null | undefined) {
  if (!Number.isFinite(timestamp)) return "undated";
  return new Date(timestamp as number).toISOString().slice(0, 10);
}

function sourceLabel(items: FeedItemEvidence[]) {
  if (items.length === 0) return "Sources: contextual evidence";
  return `Sources: ${items
    .map((item) => `${item.subscription_title}, ${item.title}`)
    .join("; ")}`;
}

function uniqueFeedItems(synthesis: StructuredSynthesis) {
  const seen = new Set<string>();
  const items: FeedItemEvidence[] = [];

  for (const unit of synthesis.units) {
    for (const item of evidenceItems(unit)) {
      const key = item.feed_item_id || item.url;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  for (const item of synthesis.secondary_items ?? []) {
    const key = item.feed_item_id || item.url;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      feed_item_id: item.feed_item_id,
      kind: "feed_item",
      reason: item.reason,
      relevance: item.group,
      subscription_title: item.subscription_title,
      title: item.title,
      url: item.url,
      published_at: item.published_at,
    });
  }

  return items;
}

function classForUnit(unit: SynthesisUnit, index: number) {
  if (unit.rendering_priority === "lead" || index === 0) return "lead";
  if (unit.rendering_priority === "main" && index % 3 === 0) return "wide";
  return "";
}

function renderNewspaper(synthesis: StructuredSynthesis) {
  return synthesis.units
    .map((unit, index) => {
      const tag = classForUnit(unit, index) ? ` class="${classForUnit(unit, index)}"` : "";
      const heading = index === 0 ? "h2" : "h3";
      const items = evidenceItems(unit);
      const visual = index === 0
        ? `<figure>
            <div class="photo">Editorial Briefing</div>
            <figcaption>${escapeHtml(unit.selection_rationale)}</figcaption>
          </figure>`
        : "";
      return `<article${tag} data-unit-id="${escapeHtml(unit.id)}">
          ${visual}
          <${heading}>${escapeHtml(unit.title)}</${heading}>
          <p>${escapeHtml(unit.claim)}</p>
          <p>${escapeHtml(unit.selection_rationale)}</p>
          <span class="source-mark">${escapeHtml(sourceLabel(items))}</span>
        </article>`;
    })
    .join("\n\n        ");
}

function renderNarrative(synthesis: StructuredSynthesis) {
  return synthesis.units
    .map((unit, index) => {
      const items = evidenceItems(unit);
      const sourceText = items.length > 0
        ? ` Supported by ${items
            .map((item) => `${item.subscription_title}'s "${item.title}"`)
            .join("; ")}.`
        : "";
      const className = index === 0 ? ` class="drop-cap"` : "";
      return `<article data-unit-id="${escapeHtml(unit.id)}">
          <p${className}>${escapeHtml(unit.claim)}${escapeHtml(sourceText)}</p>
          <p>${escapeHtml(unit.selection_rationale)}</p>
        </article>`;
    })
    .join("\n\n        ");
}

function renderSourceIndex(synthesis: StructuredSynthesis) {
  return uniqueFeedItems(synthesis)
    .map((item) =>
      `<li><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a> - ${escapeHtml(item.subscription_title)}, ${escapeHtml(formatDate(item.published_at))}. <span>${escapeHtml(item.reason)}</span></li>`,
    )
    .join("\n        ");
}

function replaceTemplate(template: string, synthesis: StructuredSynthesis) {
  const title = synthesis.scope.request || "FeedContext Briefing";
  const deck = synthesis.scope.selection_rule;
  const date = synthesis.scope.time_range?.label ?? new Date().toISOString().slice(0, 10);
  const scope = synthesis.scope.time_range?.label ?? `${synthesis.units.length} Artifact Topics`;

  return template
    .replace("<title>FeedContext Briefing</title>", `<title>${escapeHtml(title)}</title>`)
    .replace("<h1>Theme Goes Here</h1>", `<h1>${escapeHtml(title)}</h1>`)
    .replace(
      "<p class=\"deck\">One sentence that frames the editorial judgment behind this page.</p>",
      `<p class="deck">${escapeHtml(deck)}</p>`,
    )
    .replace("<span data-meta=\"date\">May 6, 2026</span>", `<span data-meta="date">${escapeHtml(date)}</span>`)
    .replace("<span data-meta=\"scope\">Scope: Recent Feed Items</span>", `<span data-meta="scope">Scope: ${escapeHtml(scope)}</span>`)
    .replace(
      /<section class="grid" aria-label="Briefing stories">[\s\S]*?<\/section>\s*<\/section>/,
      `<section class="grid" aria-label="Briefing stories">
        ${renderNewspaper(synthesis)}
      </section>
    </section>`,
    )
    .replace(
      /<div class="narrative-prose">[\s\S]*?<\/div>\s*<\/section>/,
      `<div class="narrative-prose">
        ${renderNarrative(synthesis)}
      </div>
    </section>`,
    )
    .replace(
      /<section class="source-index" aria-label="Source index">[\s\S]*?<\/section>/,
      `<section class="source-index" aria-label="Source index">
      <h2>Source Index</h2>
      <ol>
        ${renderSourceIndex(synthesis)}
      </ol>
    </section>`,
    );
}

function verifyRenderedPage(html: string, synthesis: StructuredSynthesis) {
  const errors: string[] = [];
  if (!html.includes('data-mode-content="newspaper"')) errors.push("missing newspaper mode container");
  if (!html.includes('data-mode-content="narrative"')) errors.push("missing narrative mode container");
  if (!html.includes('class="mode-toggle"')) errors.push("missing mode toggle");
  for (const unit of synthesis.units) {
    const marker = `data-unit-id="${escapeHtml(unit.id)}"`;
    const occurrences = html.split(marker).length - 1;
    if (occurrences < 2) {
      errors.push(`unit ${unit.id} is not rendered in both modes`);
    }
  }
  for (const item of uniqueFeedItems(synthesis)) {
    if (!html.includes(escapeHtml(item.url))) {
      errors.push(`source index missing ${item.feed_item_id}`);
    }
  }
  return errors;
}

async function readSynthesis(file: string): Promise<StructuredSynthesis> {
  const parsed = asRecord(JSON.parse(await readFile(file, "utf8")));
  const errors = validateStructuredSynthesis(parsed);
  if (errors.length > 0) {
    throw new Error(`Structured synthesis validation failed for ${file}:\n- ${errors.join("\n- ")}`);
  }
  return parsed as unknown as StructuredSynthesis;
}

async function readTemplate() {
  const helperDir = dirname(fileURLToPath(import.meta.url));
  return readFile(join(helperDir, "..", "templates", "combined-briefing.html"), "utf8");
}

export async function renderBriefingPage(options: { out: string; synthesisFile: string }) {
  const synthesis = await readSynthesis(options.synthesisFile);
  const html = replaceTemplate(await readTemplate(), synthesis);
  const errors = verifyRenderedPage(html, synthesis);
  if (errors.length > 0) {
    throw new Error(`Rendered briefing page failed structure checks:\n- ${errors.join("\n- ")}`);
  }

  await mkdir(dirname(options.out), { recursive: true });
  await writeFile(options.out, html);
  console.log(`Briefing page rendered: ${options.out}`);
}
