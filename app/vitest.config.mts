import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // Several files each start an in-memory Postgres and run every migration;
    // side by side on a busy machine that setup can pass the 10-second default.
    hookTimeout: 30000,
  },
});
