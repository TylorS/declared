import { defineConfig, type Plugin } from "vite";
import viteDeno from "vite-deno";

export default defineConfig({
  plugins: [
    ...viteDeno({}) as Plugin[],
  ],
});
