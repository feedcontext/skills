# Briefing Page

Use this action when the user asks for a digest, briefing, newspaper, recap,
roundup, or visual summary from FeedContext.

The output is a local, single-file HTML page composed by the agent. It is not a
Feed Item, not an api resource, and not a page hosted by `web`.

## Workflow

1. Run `version` first if this is the first FeedContext action in the session.
2. Use `items:list` or `items:list-all` to discover candidate Feed Items.
3. Use `items:get` to read the Feed Items that materially support the page.
4. Curate the page around the user's request. If the user does not give a
   precise scope, choose a coherent recent theme from visible Feed Items.
5. Write one standalone `.html` file with embedded CSS.

The page may contain agent-curated Feed Item selections or agent-synthesized
insights from visible Feed Items. Do not imply unsupported facts. Important
claims should be traceable to the Feed Items that support them.

## Editorial Shape

Default to a traditional newspaper reading experience:

- a masthead at the top with the page title, date, theme, and scope;
- a hero or lead module for the most important story or synthesized insight;
- mixed module sizes arranged by importance, not a uniform card list;
- dense but readable columns, rules, captions, sidebars, and pull quotes;
- old-money editorial styling: restrained palette, serif typography, generous
  margins, precise borders, and no app-dashboard chrome;
- a footer area with a complete source index.

The layout should feel like a complex editorial waterfall: large, medium, and
small modules interlock according to importance. Avoid generic SaaS cards,
marketing hero sections, and plain Markdown exported as HTML.

## Sources

Use compact source marks inside modules, such as the feed name, publication
date, and a short linked Feed Item title. Add a complete source index at the
bottom with every Feed Item that materially supports the page.

Each major insight should cite one to three supporting Feed Items. If an insight
is the agent's synthesis across several items, say so through the framing and
include the supporting items in the source index.

## Images

Images are editorial visuals for the page, not automatic per-item media copies.
The agent may use relevant available images, compose imagery from the source
material, or generate images when the environment supports it. If no image
clearly improves the page, rely on typography, borders, hierarchy, and captions
instead of forcing an unrelated visual.

## Starting Template

Treat this as a starting point. Adapt the module count, ordering, and copy to
the user's request and the available Feed Items, while preserving the masthead,
newspaper hierarchy, compact source marks, bottom source index, and single-file
HTML form.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FeedContext Briefing</title>
  <style>
    :root {
      color-scheme: light;
      --paper: #f5f0e6;
      --ink: #201b16;
      --muted: #6f665b;
      --rule: #2b241d;
      --wash: #e5ddcf;
      --accent: #7a2f20;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: #d8d0c2;
      color: var(--ink);
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.45;
    }

    .newspaper {
      width: min(1180px, calc(100% - 32px));
      margin: 24px auto;
      padding: 28px;
      background: var(--paper);
      border: 1px solid var(--rule);
      box-shadow: 0 18px 45px rgba(32, 27, 22, 0.18);
    }

    .masthead {
      text-align: center;
      border-bottom: 4px double var(--rule);
      padding-bottom: 18px;
      margin-bottom: 22px;
    }

    .kicker {
      margin: 0 0 8px;
      color: var(--muted);
      font: 700 12px/1.2 Arial, sans-serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: clamp(42px, 8vw, 104px);
      line-height: 0.88;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .deck {
      margin: 12px auto 0;
      max-width: 780px;
      color: var(--muted);
      font-size: 18px;
    }

    .meta {
      display: flex;
      justify-content: center;
      gap: 18px;
      flex-wrap: wrap;
      margin-top: 14px;
      font: 700 12px/1.2 Arial, sans-serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .grid {
      display: grid;
      grid-template-columns: 1.35fr 0.9fr 0.9fr;
      gap: 18px;
      align-items: start;
    }

    article, aside {
      border-top: 1px solid var(--rule);
      padding-top: 12px;
    }

    .lead {
      grid-row: span 2;
      border-top-width: 6px;
    }

    .wide {
      grid-column: span 2;
    }

    h2, h3 {
      margin: 0 0 8px;
      line-height: 0.98;
      letter-spacing: 0;
    }

    h2 { font-size: clamp(34px, 4.5vw, 64px); }
    h3 { font-size: 26px; }

    p { margin: 0 0 12px; }

    .source-mark {
      display: block;
      margin-top: 10px;
      color: var(--accent);
      font: 700 12px/1.35 Arial, sans-serif;
      text-transform: uppercase;
    }

    figure {
      margin: 0 0 12px;
      padding: 10px;
      background: var(--wash);
      border: 1px solid rgba(32, 27, 22, 0.35);
    }

    .photo {
      min-height: 220px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(32, 27, 22, 0.45);
      background:
        linear-gradient(135deg, rgba(122, 47, 32, 0.14), transparent 42%),
        repeating-linear-gradient(0deg, rgba(32, 27, 22, 0.08), rgba(32, 27, 22, 0.08) 1px, transparent 1px, transparent 6px);
      color: var(--muted);
      font: 700 12px/1.2 Arial, sans-serif;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    figcaption {
      margin-top: 8px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.35;
    }

    .pullquote {
      margin: 0;
      padding: 12px 0;
      border-top: 3px solid var(--rule);
      border-bottom: 1px solid var(--rule);
      font-size: 24px;
      line-height: 1.15;
      font-style: italic;
    }

    .source-index {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 4px double var(--rule);
      columns: 2 320px;
      font-size: 14px;
    }

    .source-index h2 {
      column-span: all;
      font-size: 24px;
      text-transform: uppercase;
    }

    .source-index li {
      break-inside: avoid;
      margin-bottom: 8px;
    }

    a { color: inherit; text-decoration-thickness: 1px; }

    @media (max-width: 860px) {
      .newspaper {
        width: min(100% - 18px, 680px);
        margin: 9px auto;
        padding: 18px;
      }

      .grid {
        grid-template-columns: 1fr;
      }

      .lead, .wide {
        grid-column: auto;
        grid-row: auto;
      }
    }
  </style>
</head>
<body>
  <main class="newspaper">
    <header class="masthead">
      <p class="kicker">FeedContext Briefing</p>
      <h1>Theme Goes Here</h1>
      <p class="deck">One sentence that frames the editorial judgment behind this page.</p>
      <div class="meta">
        <span>May 6, 2026</span>
        <span>Scope: Recent Feed Items</span>
        <span>Prepared by Agent</span>
      </div>
    </header>

    <section class="grid" aria-label="Briefing stories">
      <article class="lead">
        <figure>
          <div class="photo">Editorial Visual</div>
          <figcaption>Caption the visual as an editorial choice, not as automatic source media.</figcaption>
        </figure>
        <h2>Lead insight written like a front-page story</h2>
        <p>Summarize the most important synthesized point. Keep it grounded in visible Feed Items and explain why it matters now.</p>
        <p>Use a second paragraph when the nuance matters. Keep the prose dense, edited, and readable.</p>
        <span class="source-mark">Sources: Feed Name, Item Title; Feed Name, Item Title</span>
      </article>

      <article>
        <h3>Secondary module</h3>
        <p>Use this for an important supporting development, pattern, or contrast.</p>
        <span class="source-mark">Source: Feed Name, Item Title</span>
      </article>

      <aside>
        <p class="pullquote">A sharp quote, number, or synthesis can become a visual rhythm break.</p>
        <span class="source-mark">Source: Feed Name, Item Title</span>
      </aside>

      <article class="wide">
        <h3>Cross-feed pattern</h3>
        <p>Use wider modules for synthesis across several Feed Items rather than for a single item recap.</p>
        <span class="source-mark">Sources: Feed Name, Item Title; Feed Name, Item Title</span>
      </article>

      <article>
        <h3>Brief</h3>
        <p>Small modules can capture concise items that deserve attention but not the lead position.</p>
        <span class="source-mark">Source: Feed Name, Item Title</span>
      </article>
    </section>

    <section class="source-index" aria-label="Source index">
      <h2>Source Index</h2>
      <ol>
        <li><a href="#">Feed Item title</a> - Feed name, publication date.</li>
        <li><a href="#">Feed Item title</a> - Feed name, publication date.</li>
        <li><a href="#">Feed Item title</a> - Feed name, publication date.</li>
      </ol>
    </section>
  </main>
</body>
</html>
```
