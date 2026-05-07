# Feed Items

Use this action when an agent needs to discover, filter, search, or read visible
Feed Items.

## Discovery

High-level discovery commands:

```bash
node scripts/helper.mjs item list
node scripts/helper.mjs item list --subscription-id sub_123
node scripts/helper.mjs item list --limit 100 --cursor '<next_cursor>'
node scripts/helper.mjs item list --all
```

`item list` is a discovery command. It is paginated and returns only one page of
Feed Item metadata:

- Default page size is `20`.
- Maximum page size is `100`.
- It does not return Feed Item content.
- If the JSON response has a non-null `next_cursor`, more Feed Items exist. Use
  that cursor with `item list --cursor '<next_cursor>'`.
- Use `item list --all` when the user asks for all matching Feed Items. It
  follows `next_cursor` automatically and uses `--limit 100` per page by default.
- Use `--search-content` only when the user explicitly wants to search Feed Item
  content, not just discovery metadata. It broadens search but still does not
  return Feed Item content in list responses.

Supported filters:

```bash
node scripts/helper.mjs item list --limit 100
node scripts/helper.mjs item list --cursor '<next_cursor>'
node scripts/helper.mjs item list --subscription-id sub_123
node scripts/helper.mjs item list --keyword 'agent'
node scripts/helper.mjs item list --keyword 'agent' --search-content
node scripts/helper.mjs item list --published-after 1700000000000
node scripts/helper.mjs item list --published-before 1800000000000
node scripts/helper.mjs item list --id item_1 --id item_2
node scripts/helper.mjs item list --all --subscription-id sub_123
node scripts/helper.mjs item list --all --max-pages 20
```

## Reading

Use `item get` to read Feed Item content:

```bash
node scripts/helper.mjs item get --id item_123
node scripts/helper.mjs item get --id item_123 --cursor '<next_content_cursor>'
```

`item get` returns `content_text` as Limited Markdown in chunks of up to `12,000`
characters by default. If `next_content_cursor` is non-null, pass it back with
`--cursor` to continue reading the same Feed Item.

Use `--include-raw` only for recovery, debugging, or local handling of
item-level metadata such as podcast audio references. It returns a nested `raw`
object with `content_raw` and `metadata` alongside `content_text`.
