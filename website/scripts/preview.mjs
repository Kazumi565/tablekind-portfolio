import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { root } from "./build.mjs";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};
const allowed = new Set([
  "index.html",
  "contact.html",
  "pilot.html",
  "privacy.html",
  "404.html",
  "ro/index.html",
  "ro/contact.html",
  "ro/pilot.html",
  "ro/privacy.html",
  "ro/404.html",
  "robots.txt",
  "sitemap.xml",
  "assets/site.css",
  "assets/site.js",
  "assets/motion.css",
  "assets/motion.js",
  "assets/experience.css",
  "assets/table-example.js",
  "assets/contact.js",
  "assets/config.js",
  "assets/favicon.svg",
]);
export async function createPreviewServer({
  directory = path.join(root, "dist"),
  port = 5190,
} = {}) {
  const base = await realpath(directory);
  const text = await readFile(path.join(base, "_headers"), "utf8");
  const headers = Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => /^  [\w-]+:/.test(line))
      .map((line) => {
        const colon = line.indexOf(":");
        return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
      }),
  );
  const server = createServer(async (request, response) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        response.writeHead(405, { ...headers, Allow: "GET, HEAD" });
        response.end();
        return;
      }
      let pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      if (pathname === "/") pathname = "/index.html";
      if (pathname === "/ro" || pathname === "/ro/") pathname = "/ro/index.html";
      if (["/contact", "/privacy", "/pilot"].includes(pathname))
        pathname += ".html";
      if (["/ro/contact", "/ro/privacy", "/ro/pilot"].includes(pathname))
        pathname += ".html";
      const relative = pathname.slice(1);
      const found = allowed.has(relative);
      const selected = found ? relative : pathname.startsWith("/ro/") ? "ro/404.html" : "404.html";
      const target = await realpath(path.join(base, selected));
      if (!target.startsWith(base + path.sep))
        throw new Error("Not a website asset.");
      const content = await readFile(target);
      response.writeHead(found ? 200 : 404, {
        ...headers,
        "Content-Type":
          mime[path.extname(selected)] || "application/octet-stream",
        "Content-Length": content.byteLength,
      });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch {
      response.writeHead(400, headers);
      response.end("Unable to serve this website path.");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const server = await createPreviewServer();
    console.log(
      "Tablekind website preview: http://127.0.0.1:5190 (loopback only, no restaurant services)",
    );
    const close = () => server.close(() => process.exit());
    process.on("SIGINT", close);
    process.on("SIGTERM", close);
  } catch (error) {
    console.error(
      `Preview unavailable: ${error.message}. Run npm run build first.`,
    );
    process.exitCode = 1;
  }
}
