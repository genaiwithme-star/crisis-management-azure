import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  base: "/",       // important for Azure SWA
  build: {
    outDir: "build"  // matches your workflow output_location
  }
});
