import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
for (const args of [
  ["node_modules/typescript/bin/tsc", "--noEmit"],
  ["node_modules/vite/bin/vite.js", "build", "--outDir", "dist-menu"],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, VITE_MENU_PREVIEW: "true" },
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
