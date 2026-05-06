import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import structuredSynthesisSchema from "../src/structured-synthesis.schema.json" assert { type: "json" };

const outputPath = "skills/feedcontext/schemas/structured-synthesis.schema.json";

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(structuredSynthesisSchema, null, 2)}\n`);

