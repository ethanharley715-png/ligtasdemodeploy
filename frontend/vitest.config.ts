import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "src/main.tsx",
        "src/test/setup.ts",
        "**/*.d.ts"
      ],
      thresholds: {
        lines: 35,
        functions: 34,
        branches: 25,
        statements: 35
      }
    }
  }
});
