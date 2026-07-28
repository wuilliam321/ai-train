import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Train App",
        short_name: "Train",
        description: "Bitácora local de fuerza e hipertrofia",
        theme_color: "#1d4ed8",
        background_color: "#f8fafc",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        globPatterns: ["**/*.{html,js,css,svg}"],
      },
    }),
  ],
});
