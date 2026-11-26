import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["{src,server,scripts}/**/*.test.ts"],
          maxWorkers: 4,
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: "interfaccia",
          include: ["src/**/*.test.tsx"],
          environment: "jsdom",
          // DOM queries and React renders are CPU-bound. Do not overlap them
          // with other jsdom instances or real CLI subprocesses.
          maxWorkers: 1,
          sequence: { groupOrder: 1, hooks: "list" },
          setupFiles: ["./src/testSetup.ts"],
        },
      },
    ],
  },
});
