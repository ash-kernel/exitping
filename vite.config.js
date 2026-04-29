import { defineConfig } from "vite";

export default defineConfig({
  root: "renderer",
  build: {
    outDir: "../dist",
    minify: false,
  },
  base: "./",
});