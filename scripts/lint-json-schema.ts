import Ajv2020 from "ajv/dist/2020.js";
import structuredSynthesisSchema from "../src/structured-synthesis.schema.json" assert { type: "json" };

const ajv = new Ajv2020({ strict: true });
const isValidSchema = ajv.validateSchema(structuredSynthesisSchema);

if (!isValidSchema) {
  console.error("Structured Synthesis JSON Schema is invalid:");
  console.error(JSON.stringify(ajv.errors, null, 2));
  process.exitCode = 1;
} else {
  ajv.compile(structuredSynthesisSchema);
  console.log("Structured Synthesis JSON Schema is valid.");
}

