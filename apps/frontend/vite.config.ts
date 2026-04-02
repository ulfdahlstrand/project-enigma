import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig(({ mode }) => {
  // Load env vars from .env / .env.example so VITE_PORT is available here.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const allowedHosts = env["VITE_ALLOWED_HOSTS"]
    ?.split(",")
    .map((host) => host.trim())
    .filter(Boolean);

  return {
    plugins: [
      // TanStack Router Vite plugin: watches src/routes/ and auto-generates
      // src/route-tree.gen.ts on file changes during dev, and once before build.
      TanStackRouterVite({
        routesDirectory: "./src/routes",
        generatedRouteTree: "./src/route-tree.gen.ts",
        routeFileIgnorePattern: "__tests__",
      }),
      react(),
    ],
    server: {
      port: Number(env["VITE_PORT"] ?? 5173),
      ...(allowedHosts && allowedHosts.length > 0 ? { allowedHosts } : {}),
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/u, ""),
        },
      },
    },
  };
});
