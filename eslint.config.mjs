import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Block direct Select imports — use EntitySelect for dropdowns
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "components/ui/select.tsx",
      "components/shared/entity-select.tsx",
    ],
    rules: {
      "no-restricted-imports": ["warn", {
        paths: [{
          name: "@/components/ui/select",
          importNames: ["SelectValue"],
          message: "Usa EntitySelect para dropdowns con IDs. SelectValue de Base UI muestra el UUID crudo si las opciones no han cargado.",
        }],
      }],
    },
  },
]);

export default eslintConfig;
