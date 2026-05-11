/**
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const templatePath = resolve(
  import.meta.dirname,
  "..",
  "skills",
  "feedcontext",
  "templates",
  "combined-briefing.html",
);

function loadTemplate(): Document {
  const html = readFileSync(templatePath, "utf8");
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    url: "http://localhost/",
  });
  return dom.window.document;
}

describe("Combined Briefing Page template", () => {
  it("has a masthead with title, date, and scope", () => {
    const doc = loadTemplate();

    const masthead = doc.querySelector(".masthead");
    expect(masthead).not.toBeNull();

    const title = masthead!.querySelector("h1");
    expect(title).not.toBeNull();

    const dateEl = masthead!.querySelector("[data-meta='date']");
    expect(dateEl).not.toBeNull();

    const scopeEl = masthead!.querySelector("[data-meta='scope']");
    expect(scopeEl).not.toBeNull();
  });

  it("has a newspaper section with grid layout", () => {
    const doc = loadTemplate();

    const newspaperSection = doc.querySelector("[data-mode-content='newspaper']");
    expect(newspaperSection).not.toBeNull();

    const grid = newspaperSection!.querySelector(".grid");
    expect(grid).not.toBeNull();
  });

  it("has a narrative section with a prose container", () => {
    const doc = loadTemplate();

    const narrativeSection = doc.querySelector("[data-mode-content='narrative']");
    expect(narrativeSection).not.toBeNull();

    const prose = narrativeSection!.querySelector(".narrative-prose");
    expect(prose).not.toBeNull();
  });

  it("has a header mode toggle with newspaper and narrative options", () => {
    const doc = loadTemplate();

    const newspaperRadio = doc.querySelector("#mode-newspaper") as HTMLInputElement | null;
    expect(newspaperRadio).not.toBeNull();
    expect(newspaperRadio!.type).toBe("radio");
    expect(newspaperRadio!.value).toBe("newspaper");

    const narrativeRadio = doc.querySelector("#mode-narrative") as HTMLInputElement | null;
    expect(narrativeRadio).not.toBeNull();
    expect(narrativeRadio!.type).toBe("radio");
    expect(narrativeRadio!.value).toBe("narrative");
  });

  it("shows newspaper view by default and switches to narrative on toggle", () => {
    const doc = loadTemplate();

    const getVisibility = (mode: string) => {
      return (doc.querySelector(`[data-mode-content='${mode}']`) as HTMLElement)?.style.display;
    };

    // Default: newspaper visible, narrative hidden
    expect(getVisibility("newspaper")).toBe("");
    expect(getVisibility("narrative")).toBe("none");

    // Switch to narrative
    const narrativeRadio = doc.querySelector("#mode-narrative") as HTMLInputElement;
    narrativeRadio.checked = true;
    narrativeRadio.dispatchEvent(new Event("change", { bubbles: true }));
    expect(getVisibility("newspaper")).toBe("none");
    expect(getVisibility("narrative")).toBe("");

    // Switch back to newspaper
    const newspaperRadio = doc.querySelector("#mode-newspaper") as HTMLInputElement;
    newspaperRadio.checked = true;
    newspaperRadio.dispatchEvent(new Event("change", { bubbles: true }));
    expect(getVisibility("newspaper")).toBe("");
    expect(getVisibility("narrative")).toBe("none");
  });

  it("saves mode to sessionStorage on toggle and reads it on page load", () => {
    const doc = loadTemplate();

    // Default writes to sessionStorage
    const stored = doc.defaultView!.sessionStorage.getItem("feedcontext-briefing-mode");
    expect(stored).toBe("newspaper");

    // Switch to narrative — sessionStorage should update
    const narrativeRadio = doc.querySelector("#mode-narrative") as HTMLInputElement;
    narrativeRadio.checked = true;
    narrativeRadio.dispatchEvent(new Event("change", { bubbles: true }));
    expect(doc.defaultView!.sessionStorage.getItem("feedcontext-briefing-mode")).toBe("narrative");

    // Simulate a page reload: load a new document with sessionStorage pre-set to "narrative"
    const html = readFileSync(templatePath, "utf8");
    const dom2 = new JSDOM(html, {
      runScripts: "dangerously",
      resources: "usable",
      url: "http://localhost/",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      beforeParse(window: any) {
        window.sessionStorage.setItem("feedcontext-briefing-mode", "narrative");
      },
    });
    const doc2 = dom2.window.document;

    const getVis = (mode: string) =>
      (doc2.querySelector(`[data-mode-content='${mode}']`) as HTMLElement)?.style.display;

    expect(getVis("newspaper")).toBe("none");
    expect(getVis("narrative")).toBe("");
  });

  it("has a shared footer source index accessible in both modes", () => {
    const doc = loadTemplate();

    const sourceIndex = doc.querySelector(".source-index");
    expect(sourceIndex).not.toBeNull();

    // Source index should be outside both mode-content sections (shared)
    const newspaperParent = sourceIndex!.closest("[data-mode-content='newspaper']");
    expect(newspaperParent).toBeNull();

    const narrativeParent = sourceIndex!.closest("[data-mode-content='narrative']");
    expect(narrativeParent).toBeNull();

    // It should contain a heading and ordered list
    const heading = sourceIndex!.querySelector("h2");
    expect(heading).not.toBeNull();

    const list = sourceIndex!.querySelector("ol");
    expect(list).not.toBeNull();
  });

  it("supports dark mode via prefers-color-scheme media query", () => {
    const html = readFileSync(templatePath, "utf8");

    // Declares both color schemes for the browser
    expect(html).toContain("color-scheme: light dark");

    // Has a dark mode media query
    expect(html).toContain("@media (prefers-color-scheme: dark)");

    // Dark mode overrides the key CSS variables
    const darkBlock = html.match(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{([^}]+)\}/s,
    );
    expect(darkBlock).not.toBeNull();

    const darkCss = darkBlock![1];
    expect(darkCss).toContain("--paper:");
    expect(darkCss).toContain("--ink:");
    expect(darkCss).toContain("--accent:");
    expect(darkCss).toContain("--wash:");
  });
});
