// Static SEO checks for the download site in web/.
//   node tests/web-seo.mjs
// - FAQPage JSON-LD questions and answers appear verbatim as visible text
// - one <h1>, title <= 70 chars, meta description 70-170 chars, canonical set
// - every sitemap URL maps to a file and carries that page's canonical
// - every <img> has an alt attribute, every internal link resolves to a file
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web");
const ORIGIN = "https://rescue.2342.ai";
let failures = 0;
const fail = (file, msg) => { failures++; console.error(`FAIL ${file}: ${msg}`); };

const decode = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const fileFor = (urlPath) => {
  let p = path.join(web, decodeURIComponent(urlPath.split(/[?#]/)[0]));
  if (urlPath.endsWith("/") || (existsSync(p) && statSync(p).isDirectory())) p = path.join(p, "index.html");
  return p;
};

const sitemap = readFileSync(path.join(web, "sitemap.xml"), "utf8");
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!pages.length) fail("sitemap.xml", "no URLs");

for (const url of pages) {
  if (!url.startsWith(ORIGIN + "/")) { fail("sitemap.xml", `foreign URL ${url}`); continue; }
  const rel = url.slice(ORIGIN.length);
  const file = fileFor(rel);
  const name = path.relative(web, file);
  if (!existsSync(file)) { fail("sitemap.xml", `${url} has no file`); continue; }
  const html = readFileSync(file, "utf8");

  const title = decode((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
  if (!title || title.length > 70) fail(name, `title length ${title.length}: "${title}"`);
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  if (desc.length < 70 || desc.length > 170) fail(name, `meta description length ${desc.length}`);
  const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  if (canonical !== url) fail(name, `canonical ${canonical} != sitemap ${url}`);
  const h1 = html.match(/<h1[\s>]/g) || [];
  if (h1.length !== 1) fail(name, `${h1.length} <h1> elements`);

  for (const img of html.match(/<img\b[^>]*>/g) || []) if (!/\balt=/.test(img)) fail(name, `img without alt: ${img}`);

  for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const link = m[1];
    if (/^(https?:|mailto:|data:|#)/.test(link)) continue;
    const target = link.startsWith("/") ? fileFor(link) : fileFor(path.posix.join(path.posix.dirname(rel.endsWith("/") ? rel + "x" : rel), link));
    if (!existsSync(target)) fail(name, `broken internal link ${link}`);
  }

  const visible = decode(html.replace(/<script[\s\S]*?<\/script>/g, ""));
  for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try { data = JSON.parse(block[1]); } catch (e) { fail(name, `invalid JSON-LD: ${e.message}`); continue; }
    const nodes = data["@graph"] || [data];
    for (const node of nodes.filter((n) => n["@type"] === "FAQPage")) {
      for (const q of node.mainEntity) {
        if (!visible.includes(q.name)) fail(name, `FAQ question not visible: ${q.name}`);
        if (!visible.includes(q.acceptedAnswer.text)) fail(name, `FAQ answer not visible: ${q.name}`);
      }
    }
  }
  console.log(`ok   ${name}  (${title.length} char title, ${desc.length} char description)`);
}

for (const f of ["robots.txt", "llms.txt", "404.html", "og.png"]) if (!existsSync(path.join(web, f))) fail(f, "missing");
if (!/Sitemap: https:\/\/rescue\.2342\.ai\/sitemap\.xml/.test(readFileSync(path.join(web, "robots.txt"), "utf8"))) fail("robots.txt", "no Sitemap line");

if (failures) { console.error(`${failures} SEO check(s) failed`); process.exit(1); }
console.log("web SEO checks passed");
