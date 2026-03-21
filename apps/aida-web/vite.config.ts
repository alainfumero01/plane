import path from "node:path";
import * as dotenv from "@dotenvx/dotenvx";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const viteEnv = Object.keys(process.env)
  .filter((key) => key.startsWith("VITE_"))
  .reduce<Record<string, string>>((acc, key) => {
    acc[key] = process.env[key] ?? "";
    return acc;
  }, {});

export default defineConfig({
  define: {
    "process.env": JSON.stringify(viteEnv),
  },
  plugins: [reactRouter(), tsconfigPaths({ projects: [path.resolve(__dirname, "tsconfig.json")] })],
  server: {
    host: "127.0.0.1",
  },
});
