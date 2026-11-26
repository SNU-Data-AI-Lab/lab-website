const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("publication validation accepts site assets and rejects development files", (t) => {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), "lab-site-publication-"));
  t.after(() => fs.rmSync(site, { recursive: true, force: true }));
  for (const filename of [
    "index.html",
    "members.html",
    "publications.html",
    "tools.html",
    "header.html",
    "footer.html",
    "include-header-footer.js",
    "js",
    "data",
    "images",
    "tools",
  ]) {
    fs.cpSync(filename, path.join(site, filename), {
      recursive: true,
      filter: (source) => !path.basename(source).startsWith("."),
    });
  }
  fs.mkdirSync(path.join(site, "css"));
  fs.copyFileSync("css/output.css", path.join(site, "css/output.css"));
  const validate = () =>
    spawnSync(process.execPath, ["scripts/check-site.cjs", site], {
      encoding: "utf8",
    });
  const valid = validate();
  assert.equal(valid.status, 0, valid.stderr);

  for (const filename of [
    "package.json",
    "extract.py",
    "CNAME",
    "images/backup.zip",
  ]) {
    const file = path.join(site, filename);
    fs.writeFileSync(file, "should not be published");
    const invalid = validate();
    assert.notEqual(invalid.status, 0, `${filename} was accepted`);
    assert(invalid.stderr.includes(filename), invalid.stderr);
    fs.unlinkSync(file);
  }
});
