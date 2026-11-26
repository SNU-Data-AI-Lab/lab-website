const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const site = path.resolve(process.argv[2] || "_site");
const pages = [
  "index.html",
  "members.html",
  "publications.html",
  "tools.html",
  "tools/code-cost-calculator.html",
];
for (const filename of [
  ...pages,
  "header.html",
  "footer.html",
  "css/output.css",
  "js/site-security.js",
  "js/research.js",
  "js/members.js",
  "js/publications.js",
  "tools/code-cost-calculator.js",
  "tools/code-cost-hw3.js",
  "tools/code-cost-hw4.js",
]) {
  assert(
    fs.statSync(path.join(site, filename)).isFile(),
    `Missing site asset: ${filename}`,
  );
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(site, absolute).split(path.sep).join("/");
    assert(!entry.isSymbolicLink(), `Published symlink: ${relative}`);
    if (entry.isDirectory()) {
      assert(
        /^(?:images|data|css|js|tools|assets)(?:\/|$)/.test(relative),
        `Unexpected published directory: ${relative}`,
      );
      walk(absolute);
    } else {
      assert(
        /^(?:index|members|publications|tools|header|footer)\.html$/.test(
          relative,
        ) ||
          /^(?:images\/.+\.(?:png|jpe?g|ico|svg)|data\/[\w-]+\.json|(?:css|assets\/css)\/[\w.-]+\.css|(?:js|tools)\/[\w.-]+\.js|tools\/code-cost-calculator\.html)$/.test(
            relative,
          ),
        `Unexpected published file: ${relative}`,
      );
      assert.notEqual(
        relative,
        "css/style.css",
        "Do not publish the CSS build input",
      );
    }
  }
}
walk(site);

// Every local script and stylesheet referenced by a page must survive publication.
for (const filename of pages) {
  const html = fs.readFileSync(path.join(site, filename), "utf8");
  for (const match of html.matchAll(
    /<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g,
  )) {
    const url = match[1].split("?")[0];
    if (/^(?:data:|https?:|\/\/)/.test(url)) continue;
    const target = path.resolve(site, path.dirname(filename), url);
    assert(
      target.startsWith(site + path.sep),
      `Asset escapes site root: ${url}`,
    );
    assert(fs.statSync(target).isFile(), `Broken asset in ${filename}: ${url}`);
  }
}
console.log(
  "Published site contains only allowed assets; page scripts and styles resolve.",
);
