import js from "@eslint/js";
import jsonSchemaValidator from "eslint-plugin-json-schema-validator";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["node_modules/**", "skills/feedcontext/scripts/helper.mjs"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...jsonSchemaValidator.configs.base,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
      },
    },
  },
  {
    files: [
      "src/structured-synthesis.schema.json",
      "src/show-script.schema.json",
      "skills/feedcontext/schemas/structured-synthesis.schema.json",
      "skills/feedcontext/schemas/show-script.schema.json",
    ],
    rules: {
      "json-schema-validator/no-invalid": ["error", { useSchemastoreCatalog: false }],
    },
  },
];
