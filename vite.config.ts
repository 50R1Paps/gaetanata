import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Four workers leave CPU headroom for jsdom and real CLI subprocesses.
    maxWorkers: 4,
  },
});
