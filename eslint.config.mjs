import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "src/app/auth/**/*.{ts,tsx}",
      "src/app/api/demo/**/*.{ts,tsx}",
      "src/lib/auth/**/*.{ts,tsx}",
      "src/lib/supabase/**/*.{ts,tsx}",
      "src/components/profile-view.tsx",
      "src/proxy.ts",
    ],
    rules: { "no-console": "error" },
  },
  globalIgnores([
    ".next/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
