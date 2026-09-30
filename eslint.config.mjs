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
  // Block direct Dialog/Sheet imports — use ResponsiveDialog
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "components/ui/dialog.tsx",
      "components/ui/sheet.tsx",
      "components/shared/responsive-dialog.tsx",
      // Legacy: existing pages using Dialog directly for simple inline modals
      "components/tareas/task-detail-sheet.tsx",
      "components/hotel/room-detail-drawer.tsx",
      "components/layout/mobile-nav.tsx",
      "components/shared/filter-bar.tsx",
      "app/(app)/configuracion/usuarios/page.tsx",
      "app/(app)/configuracion/roles/page.tsx",
      "app/(app)/configuracion/horarios/page.tsx",
      "app/(app)/configuracion/catalogos/page.tsx",
      "app/(app)/hotel/habitaciones/page.tsx",
    ],
    rules: {
      "no-restricted-imports": ["warn", {
        paths: [
          {
            name: "@/components/ui/dialog",
            message: "Usa ResponsiveDialog en vez de Dialog directo.",
          },
          {
            name: "@/components/ui/sheet",
            message: "Usa ResponsiveDialog en vez de Sheet directo.",
          },
        ],
      }],
    },
  },
]);

export default eslintConfig;
