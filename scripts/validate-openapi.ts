import allowlist from "@/allowlist.json" assert {type: "json"};

const openApiUrl = process.env.OPENAPI_URL ?? "https://api.feedcontext.io/openapi.json";
const response = await fetch(openApiUrl);

if (!response.ok) {
  throw new Error(`OpenAPI request failed for ${openApiUrl}: ${response.status}`);
}

const document = (await response.json()) as {
  paths?: Record<string, Record<string, unknown>>;
};

const missing = allowlist.paths.filter((entry) => {
  const operations = document.paths?.[entry.path];
  return !operations || !operations[entry.method.toLowerCase()];
});

if (missing.length > 0) {
  throw new Error(
    `Skill allowlist paths missing from OpenAPI: ${missing
      .map((entry) => `${entry.method} ${entry.path}`)
      .join(", ")}`,
  );
}

console.log(`Skill allowlist matches API OpenAPI at ${openApiUrl}.`);
