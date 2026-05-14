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

type BodyUnitRole = "context_paragraph" | "detail_paragraph" | "lead_paragraph";
type DisplayFormat = "analysis" | "bulletin" | "quote" | "story";
type LayoutRole = "brief" | "lead" | "major" | "standard";

type NewspaperBodyUnit = {
  evidence_refs: string[];
  role: BodyUnitRole;
  text: string;
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

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function plainTextFromHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gu, " ")
    .replace(/<style[\s\S]*?<\/style>/gu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
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

function titleCaseFragment(value: string) {
  return value
    .replace(/[“”"']/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function compactChineseTitle(value: string) {
  return value
    .replace(/^AI 平台.+$/u, "AI 平台")
    .replace(/^C 端 AI.+$/u, "C 端商业化")
    .replace(/^具身智能.+$/u, "具身智能")
    .replace(/^算力链条.+$/u, "算力链条")
    .replace(/^AI 安全.+$/u, "AI 安全")
    .replace(/开始认真谈.+$/u, "商业化")
    .replace(/从 .+$/u, "")
    .replace(/的关键词.+$/u, "")
    .replace(/[、，:：].+$/u, "")
    .trim();
}

function instructionLikeRequest(value: string) {
  return /读取|总结|生成|页面|给我|update|brief|summarize|create|make|render/iu.test(value) && value.length > 20;
}

function readableDateLabel(label: string | undefined) {
  const match = label?.match(/\d{4}-\d{2}-\d{2}/u);
  return match?.[0] ?? new Date().toISOString().slice(0, 10);
}

function generatedTitle(synthesis: StructuredSynthesis) {
  const request = synthesis.scope.request?.trim() ?? "";
  if (request && !instructionLikeRequest(request)) return request;

  const date = readableDateLabel(synthesis.scope.time_range?.label);
  const titles = synthesis.units
    .slice(0, 3)
    .map((unit) => titleCaseFragment(unit.title).replace(/更新综述$/u, ""))
    .filter(Boolean);

  if (titles.length === 0) return `FeedContext ${date} Briefing`;
  if (/[\u3400-\u9fff]/u.test(titles.join(""))) {
    const compact = titles
      .map(compactChineseTitle)
      .filter(Boolean)
      .slice(0, 3)
      .join("、");
    if (/AI 平台/u.test(compact) && /C 端商业化/u.test(compact) && /具身智能/u.test(compact)) {
      return `${date} 更新综述：AI 商业化与具身智能`;
    }
    return `${date} 更新综述：${compact}`;
  }

  return `${date} Briefing: ${titles.slice(0, 2).join(" and ")}`;
}

function deckText(synthesis: StructuredSynthesis) {
  return synthesis.units[0]?.claim ?? synthesis.scope.selection_rule;
}

function evidenceContext(unit: SynthesisUnit, items: FeedItemEvidence[]) {
  const reasons = items
    .map((item) => item.reason)
    .filter(Boolean)
    .slice(0, 2);
  if (reasons.length === 0) return "";
  if (!/[\u3400-\u9fff]/u.test(`${unit.claim} ${unit.selection_rationale}`)) {
    return `The supporting material adds the operational detail: ${reasons.join("; ")}.`;
  }
  return `支撑这些判断的材料分别强调：${reasons.join("；")}。`;
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

function layoutRoleForUnit(unit: SynthesisUnit, index: number): LayoutRole {
  if (unit.rendering_priority === "lead" || index === 0) return "lead";
  if (unit.rendering_priority === "main") return "major";
  if (unit.rendering_priority === "collapsed") return "brief";
  return "standard";
}

function displayFormatForUnit(unit: SynthesisUnit, index: number): DisplayFormat {
  if (unit.rendering_priority === "collapsed") return "bulletin";
  if (index === 0 || unit.selection_rationale.length > 140) return "analysis";
  return "story";
}

function bodyUnitsForUnit(unit: SynthesisUnit, items: FeedItemEvidence[]): NewspaperBodyUnit[] {
  const evidenceRefs = items.map((item) => item.feed_item_id);
  const units: NewspaperBodyUnit[] = [
    {
      evidence_refs: evidenceRefs,
      role: "lead_paragraph",
      text: unit.claim,
    },
    {
      evidence_refs: evidenceRefs,
      role: "detail_paragraph",
      text: unit.selection_rationale,
    },
  ];
  const context = evidenceContext(unit, items);
  if (context) {
    units.push({
      evidence_refs: evidenceRefs,
      role: "context_paragraph",
      text: context,
    });
  }
  return units;
}

function renderNewspaperBody(unit: SynthesisUnit, items: FeedItemEvidence[]) {
  return bodyUnitsForUnit(unit, items)
    .map((bodyUnit) =>
      `<p data-body-role="${bodyUnit.role}">${escapeHtml(bodyUnit.text)}</p>`,
    )
    .join("\n          ");
}

function renderNewspaper(synthesis: StructuredSynthesis) {
  return synthesis.units
    .map((unit, index) => {
      const tag = classForUnit(unit, index) ? ` class="${classForUnit(unit, index)}"` : "";
      const heading = index === 0 ? "h2" : "h3";
      const items = evidenceItems(unit);
      const layoutRole = layoutRoleForUnit(unit, index);
      const displayFormat = displayFormatForUnit(unit, index);
      const visual = index === 0
        ? `<figure>
            <div class="photo">Editorial Briefing</div>
            <figcaption>${escapeHtml(unit.selection_rationale)}</figcaption>
          </figure>`
        : "";
      return `<article${tag} data-display-format="${displayFormat}" data-layout-role="${layoutRole}" data-rendering-priority="${synthesis.units.length - index}" data-unit-id="${escapeAttribute(unit.id)}">
          ${visual}
          <${heading}>${escapeHtml(unit.title)}</${heading}>
          ${renderNewspaperBody(unit, items)}
        </article>`;
    })
    .join("\n\n        ");
}

function renderNarrative(synthesis: StructuredSynthesis) {
  return synthesis.units
    .map((unit, index) => {
      const items = evidenceItems(unit);
      const className = index === 0 ? ` class="drop-cap"` : "";
      const context = evidenceContext(unit, items);
      return `<article data-unit-id="${escapeAttribute(unit.id)}">
          <p${className}>${escapeHtml(unit.claim)}</p>
          <p>${escapeHtml(unit.selection_rationale)}</p>
          ${context ? `<p>${escapeHtml(context)}</p>` : ""}
        </article>`;
    })
    .join("\n\n        ");
}

function renderSourceIndex(synthesis: StructuredSynthesis) {
  return uniqueFeedItems(synthesis)
    .map((item) =>
      `<li><a href="${escapeAttribute(item.url)}">${escapeHtml(item.title)}</a> - ${escapeHtml(item.subscription_title)}, ${escapeHtml(formatDate(item.published_at))}. <span>${escapeHtml(item.reason)}</span></li>`,
    )
    .join("\n        ");
}

function replaceTemplate(template: string, synthesis: StructuredSynthesis) {
  const title = generatedTitle(synthesis);
  const deck = deckText(synthesis);
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
  if (!html.includes('data-document-format="magazine"')) errors.push("missing magazine document format marker");
  if (!html.includes('data-document-format="longform"')) errors.push("missing longform document format marker");
  if (!html.includes('class="mode-toggle"')) errors.push("missing mode toggle");
  if (!html.includes("grid-template-areas:") || !html.includes('"kicker title"')) {
    errors.push("masthead must use explicit grid areas to keep title, deck, meta, and toggle aligned");
  }
  if (html.includes("Supported by")) errors.push('narrative mode must not render literal "Supported by" source text');
  if (html.includes('class="source-cluster"')) errors.push("newspaper mode must not render inline source icon clusters");
  if (html.includes('class="inline-citation"')) errors.push("narrative mode must not render inline citation popovers");
  const request = synthesis.scope.request?.trim();
  if (request && instructionLikeRequest(request) && html.includes(`<h1>${escapeHtml(request)}</h1>`)) {
    errors.push("masthead title must be a generated briefing title, not the raw user request");
  }
  for (const unit of synthesis.units) {
    const marker = `data-unit-id="${escapeAttribute(unit.id)}"`;
    const occurrences = html.split(marker).length - 1;
    if (occurrences < 2) {
      errors.push(`unit ${unit.id} is not rendered in both modes`);
    }
  }
  for (const item of uniqueFeedItems(synthesis)) {
    if (!html.includes(escapeAttribute(item.url))) {
      errors.push(`source index missing ${item.feed_item_id}`);
    }
  }
  const sourcesHeadingCount = html.match(/<h2>Source Index<\/h2>/gu)?.length ?? 0;
  if (sourcesHeadingCount !== 1) errors.push("page must render exactly one footer source index");
  const narrative = html.match(/<section[^>]+data-mode-content="narrative"[\s\S]*?<section class="source-index"/u)?.[0] ?? "";
  const shortArticle = [...narrative.matchAll(/<article[^>]*>[\s\S]*?<\/article>/gu)].find((match) => {
    const text = plainTextFromHtml(match[0]);
    return text.length < 120;
  });
  if (shortArticle) {
    errors.push("narrative mode has a topic with too little body text");
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
