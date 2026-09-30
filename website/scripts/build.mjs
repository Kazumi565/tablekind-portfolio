import {
  readFile,
  mkdir,
  writeFile,
  copyFile,
  readdir,
  lstat,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { translateRomanian } from "./ro.mjs";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const keys = [
  "siteUrl",
  "contactEmail",
  "operatorName",
  "hostingProvider",
  "hostingPrivacyUrl",
  "enquiryRetentionDays",
  "publicationReviewed",
];
export function validateConfig(config, release = false) {
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error("Configuration must be an object.");
  if (Object.keys(config).some((k) => !keys.includes(k)))
    throw new Error(
      "Only documented public settings are allowed. Never put secrets here.",
    );
  for (const key of keys.slice(0, 5)) {
    if (
      typeof config[key] !== "string" ||
      config[key].length > 250 ||
      /[\r\n\x00-\x1f]/.test(config[key])
    )
      throw new Error(`Invalid ${key}.`);
    if (release && !config[key].trim())
      throw new Error(`Configure ${key} before release.`);
  }
  if (
    config.contactEmail &&
    !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/.test(
      config.contactEmail,
    )
  )
    throw new Error("Use a single valid contact mailbox.");
  for (const key of ["siteUrl", "hostingPrivacyUrl"]) {
    if (!config[key]) continue;
    const url = new URL(config[key]);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      (key === "siteUrl" && url.pathname !== "/")
    )
      throw new Error(
        `Use an HTTPS ${key} without credentials, query or fragment.`,
      );
    if (
      /localhost$|\.local$|\.test$|\.invalid$|\.example$/.test(url.hostname) ||
      ["example.com", "example.org", "example.net"].includes(url.hostname)
    )
      throw new Error(
        "Use your real owned domain/provider URL, not an example.",
      );
  }
  if (typeof config.publicationReviewed !== "boolean")
    throw new Error("publicationReviewed must be true or false.");
  if (
    config.enquiryRetentionDays !== null &&
    (!Number.isInteger(config.enquiryRetentionDays) ||
      config.enquiryRetentionDays < 1 ||
      config.enquiryRetentionDays > 365)
  )
    throw new Error("Enquiry retention must be 1–365 days.");
  if (
    release &&
    (config.publicationReviewed !== true ||
      config.enquiryRetentionDays === null)
  )
    throw new Error(
      "Review the launch checklist and set an enquiry retention policy before release.",
    );
  return config;
}
export async function build({
  release = false,
  output = path.join(root, "dist"),
  config,
} = {}) {
  config = validateConfig(
    config ??
      JSON.parse(await readFile(path.join(root, "site.config.json"), "utf8")),
    release,
  );
  // Only a dedicated dist folder is writable. Unknown files stop the build rather than being shipped or deleted.
  if (path.basename(output) !== "dist" || path.resolve(output) === root)
    throw new Error("Output must be a dedicated dist directory.");
  const pages = ["index", "contact", "privacy", "pilot", "404"];
  const localizedPages = pages.map((page) => `ro/${page}.html`);
  const assetNames = [
    "site.css",
    "site.js",
    "motion.css",
    "motion.js",
    "experience.css",
    "table-example.js",
    "contact.js",
    "favicon.svg",
  ];
  const allowed = new Set([
    ...pages.map((p) => p + ".html"),
    ...localizedPages,
    ...assetNames.map((a) => "assets/" + a),
    "assets/config.js",
    "_headers",
    "robots.txt",
    "sitemap.xml",
  ]);
  async function inspect(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(
      (e) => {
        if (e.code === "ENOENT") return [];
        throw e;
      },
    )) {
      const relative = prefix + entry.name;
      if (entry.isSymbolicLink())
        throw new Error("Symlinks are not allowed in the website output.");
      if (entry.isDirectory() && ["assets", "ro"].includes(relative))
        await inspect(path.join(directory, entry.name), relative + "/");
      else if (!entry.isFile() || !allowed.has(relative))
        throw new Error(
          `Unexpected output entry: ${relative}. Use a new empty dist folder.`,
        );
    }
  }
  if (
    await lstat(output)
      .then((s) => s.isSymbolicLink())
      .catch((e) => {
        if (e.code === "ENOENT") return false;
        throw e;
      })
  )
    throw new Error("Output cannot be a symlink.");
  await inspect(output);
  await mkdir(path.join(output, "assets"), { recursive: true });
  await mkdir(path.join(output, "ro"), { recursive: true });
  const origin = config.siteUrl ? new URL(config.siteUrl).origin : "";
  const tokens = {
    YEAR: "2026",
    CONTACT_EMAIL: escapeHtml(
      config.contactEmail ||
        "Contact address not configured in this local preview.",
    ),
    OPERATOR: escapeHtml(
      config.operatorName ||
        "Operator details will be published before launch.",
    ),
    HOSTING: escapeHtml(
      config.hostingProvider || "Hosting has not yet been activated.",
    ),
    HOSTING_LINK: config.hostingPrivacyUrl
      ? `<a href="${escapeHtml(config.hostingPrivacyUrl)}" rel="noreferrer">Hosting provider privacy information</a>`
      : "Hosting provider information will be added before publication.",
    RETENTION: config.enquiryRetentionDays
      ? `${config.enquiryRetentionDays} days after the last enquiry interaction, unless a separate pilot agreement requires different retention.`
      : "The enquiry retention period must be agreed before launch.",
    CONTACT_DIRECT: config.contactEmail
      ? `<a class="text-link" href="mailto:${encodeURIComponent(config.contactEmail)}">${escapeHtml(config.contactEmail)}</a>`
      : '<p class="small">Contact address not configured yet. You can prepare a draft below, but nothing will be sent.</p>',
    PREVIEW: release
      ? ""
      : '<aside class="preview-notice" aria-label="Local preview">Local design preview · Not published · Contact delivery is not activated</aside>',
    ROBOTS: release ? "index, follow" : "noindex, nofollow",
    NAV: await readFile(path.join(root, "src/nav.html"), "utf8"),
    FOOTER: await readFile(path.join(root, "src/footer.html"), "utf8"),
  };
  const layout = await readFile(path.join(root, "src/layout.html"), "utf8");
  const titles = {
    index: "Tablekind · Order together. Pay your part.",
    contact: "Request a restaurant demo · Tablekind",
    privacy: "Website privacy · Tablekind",
    pilot: "Pilot information · Tablekind",
    404: "Page not found · Tablekind",
  };
  const titlesRo = {
    index: "Tablekind · Comandați împreună. Fiecare își achită partea.",
    contact: "Solicită o demonstrație pentru restaurant · Tablekind",
    privacy: "Confidențialitatea site-ului · Tablekind",
    pilot: "Informații despre pilot · Tablekind",
    404: "Pagina nu a fost găsită · Tablekind",
  };
  const descriptions = {
    en: "Guests scan a table QR code, order individually and see their exact share. See Tablekind’s restaurant prototype and request a guided demo in Moldova.",
    ro: "Clienții scanează codul QR al mesei, comandă individual și văd suma exactă care le revine. Descoperă prototipul Tablekind și solicită o demonstrație ghidată în Moldova.",
  };
  const route = (page, lang) => `${origin}${lang === "ro" ? "/ro/" : "/"}${page === "index" ? "" : page + ".html"}`;
  for (const lang of ["en", "ro"]) for (const page of pages) {
    const localize = (fragment) => lang === "ro" ? translateRomanian(fragment) : fragment;
    const target = `${lang === "ro" ? "ro/" : ""}${page}.html`;
    const alternate = lang === "ro" ? "en" : "ro";
    const label = alternate === "ro" ? "Română" : "English";
    const short = alternate === "ro" ? "RO" : "EN";
    const switcher = `<a class="language-switch" href="${route(page, alternate)}" hreflang="${alternate}" lang="${alternate}" aria-label="${alternate === "ro" ? "Schimbă limba în română" : "Switch language to English"}"><span class="language-long">${label}</span><span class="language-short">${short}</span></a>`;
    const pageTokens = {
      ...tokens,
      LANG: lang,
      TITLE: lang === "ro" ? titlesRo[page] : titles[page],
      DESCRIPTION: descriptions[lang],
      SKIP: lang === "ro" ? "Sari la conținut" : "Skip to content",
      PAGE: page,
      LANG_SWITCH: switcher,
      NAV: localize(tokens.NAV),
      FOOTER: localize(tokens.FOOTER),
      CONTENT: localize(await readFile(path.join(root, `src/${page}.html`), "utf8")),
      CONTACT_EMAIL: config.contactEmail ? tokens.CONTACT_EMAIL : lang === "ro" ? "Adresa de contact nu este configurată în această previzualizare locală." : tokens.CONTACT_EMAIL,
      OPERATOR: config.operatorName ? tokens.OPERATOR : lang === "ro" ? "Datele operatorului vor fi publicate înainte de lansare." : tokens.OPERATOR,
      HOSTING: config.hostingProvider ? tokens.HOSTING : lang === "ro" ? "Găzduirea nu a fost încă activată." : tokens.HOSTING,
      HOSTING_LINK: config.hostingPrivacyUrl ? `<a href="${escapeHtml(config.hostingPrivacyUrl)}" rel="noreferrer">Politica de confidențialitate a furnizorului de găzduire</a>` : lang === "ro" ? "Informațiile furnizorului de găzduire vor fi adăugate înainte de publicare." : tokens.HOSTING_LINK,
      RETENTION: lang === "ro" ? (config.enquiryRetentionDays ? `${config.enquiryRetentionDays} zile de la ultimul schimb privind solicitarea, cu excepția cazului în care un acord de pilot prevede alt termen.` : "Perioada de păstrare a solicitărilor trebuie stabilită înainte de lansare.") : tokens.RETENTION,
      CONTACT_DIRECT: config.contactEmail ? tokens.CONTACT_DIRECT : lang === "ro" ? '<p class="small">Adresa de contact nu este configurată. Poți pregăti o ciornă mai jos, dar nu se trimite nimic.</p>' : tokens.CONTACT_DIRECT,
      PREVIEW: release ? "" : lang === "ro" ? '<aside class="preview-notice" aria-label="Previzualizare locală">Previzualizare locală · Nepublicat · Trimiterea solicitărilor nu este activă</aside>' : tokens.PREVIEW,
      CANONICAL:
        release && page !== "404"
          ? `<link rel="canonical" href="${route(page, lang)}">`
          : "",
      ALTERNATES: release && page !== "404" ? `<link rel="alternate" hreflang="en" href="${route(page, "en")}"><link rel="alternate" hreflang="ro" href="${route(page, "ro")}">` : "",
    };
    let html = layout;
    for (let n = 0; n < 4; n++)
      html = html.replace(
        /\{\{([A-Z_]+)\}\}/g,
        (_, k) =>
          pageTokens[k] ??
          (() => {
            throw new Error(`Unknown template token ${k}`);
          })(),
      );
    await writeFile(path.join(output, target), html);
  }
  for (const asset of assetNames)
    await copyFile(
      path.join(root, "src/assets", asset),
      path.join(output, "assets", asset),
    );
  await writeFile(
    path.join(output, "assets/config.js"),
    `export const config = Object.freeze(${JSON.stringify({ contactEmail: config.contactEmail })});\n`,
  );
  const headers = await readFile(path.join(root, "src/_headers"), "utf8");
  await writeFile(
    path.join(output, "_headers"),
    headers + (release ? "" : "  X-Robots-Tag: noindex, nofollow\n"),
  );
  await writeFile(
    path.join(output, "robots.txt"),
    release
      ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
      : "User-agent: *\nDisallow: /\n",
  );
  await writeFile(
    path.join(output, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
      release
        ? ["en", "ro"].flatMap((lang) => pages.filter((p) => p !== "404").map((p) => `<url><loc>${route(p, lang)}</loc></url>`))
            .join("")
        : ""
    }</urlset>\n`,
  );
  return { release, output, fileCount: allowed.size };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(
      JSON.stringify(
        await build({ release: process.argv.includes("--release") }),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
