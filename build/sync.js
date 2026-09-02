#!/usr/bin/env node
/*
 * Keeps the shared header and footer identical across every page.
 *
 *   node build/sync.js
 *
 * Edit the files in partials/, then run this. It rewrites whatever sits
 * between the marker comments in each HTML file:
 *
 *   <!-- @@header -->  ...replaced...  <!-- @@end -->
 *
 * Per-page <title>, meta description and canonical live outside the markers
 * and are never touched.
 *
 * No dependencies - plain Node, so it will still run years from now.
 * If it ever breaks, edit the HTML files by hand; nothing depends on it.
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const partials = ["head", "header", "footer"];

const content = {};
for (const name of partials) {
  content[name] = fs.readFileSync(path.join(root, "partials", `${name}.html`), "utf8").trim();
}

const pages = fs.readdirSync(root).filter(f => f.endsWith(".html"));
let totalBlocks = 0;
const report = [];

for (const page of pages) {
  const file = path.join(root, page);
  let html = fs.readFileSync(file, "utf8");
  const slug = page.replace(/\.html$/, "");
  let blocks = 0;

  for (const name of partials) {
    const marker = new RegExp(
      `([ \\t]*)<!-- @@${name} -->[\\s\\S]*?<!-- @@end -->`, "g"
    );

    html = html.replace(marker, (_m, indent) => {
      blocks++;
      let body = content[name];

      // Mark the current page in both navs. 404.html matches nothing, which
      // is correct - it is not one of the nav destinations.
      body = body.replace(
        new RegExp(`(<a\\s+href="${slug}\\.html"[^>]*data-nav="${slug}")`, "g"),
        '$1 aria-current="page"'
      );

      // The homepage logo link should not be marked as the current page.
      if (slug === "index") {
        body = body.replace(
          /(class="site-logo"[^>]*?)\s+aria-current="page"/,
          "$1"
        );
      }

      const indented = body.split("\n").map(l => (l ? indent + l : l)).join("\n");
      return `${indent}<!-- @@${name} -->\n${indented}\n${indent}<!-- @@end -->`;
    });
  }

  if (blocks) {
    fs.writeFileSync(file, html);
    totalBlocks += blocks;
    report.push(`  ${page.padEnd(26)} ${blocks} block(s) synced`);
  } else {
    report.push(`  ${page.padEnd(26)} no markers, skipped`);
  }
}

console.log(report.join("\n"));
console.log(`\n${totalBlocks} blocks across ${pages.length} files.`);
