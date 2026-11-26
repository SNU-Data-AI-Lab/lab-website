const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  escapeHtml,
  safeWebUrl,
  safeImageUrl,
  safeEmailUrl,
} = require("../js/site-security.js");
const base = "https://da.snu.ac.kr/members.html";

test("JSON text cannot introduce HTML tags or escape quoted attributes", () => {
  assert.equal(
    escapeHtml("<img src=x onerror=\"alert(1)\"> & 'hi'"),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;hi&#39;",
  );
  assert.equal(escapeHtml(null), "");
});

test("publication and homepage links reject executable schemes and embedded credentials", () => {
  for (const value of [
    "javascript:alert(1)",
    "\njava\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "https://user:password@example.com/",
    "",
    null,
  ]) {
    assert.equal(safeWebUrl(value, base), "", String(value));
  }
  assert.equal(
    safeWebUrl("https://arxiv.org/abs/1234.5678", base),
    "https://arxiv.org/abs/1234.5678",
  );
  assert.equal(
    safeWebUrl("http://arxiv.org/abs/1234.5678", base),
    "http://arxiv.org/abs/1234.5678",
  );
});

test("JSON images stay on the site, including protocol-relative and encoded URL cases", () => {
  assert.equal(
    safeImageUrl("images/member.jpg", base),
    "https://da.snu.ac.kr/images/member.jpg",
  );
  for (const value of [
    "https://tracker.example/image.png",
    "//tracker.example/image.png",
    "https://da.snu.ac.kr@tracker.example/x",
    "https://da.snu.ac.kr.evil.example/x",
    "data:image/svg+xml,<svg/>",
    "javascript:alert(1)",
  ]) {
    assert.equal(safeImageUrl(value, base), "", value);
  }
  assert.equal(safeImageUrl("https://da.snu.ac.kr/images/member.jpg"), "");
});

test("email links cannot introduce mail headers, newlines or HTML attributes", () => {
  assert.equal(
    safeEmailUrl("person+lab@snu.ac.kr"),
    "mailto:person%2Blab@snu.ac.kr",
  );
  for (const value of [
    'x" onclick="alert(1)@snu.ac.kr',
    "x@snu.ac.kr?bcc=elsewhere@example.com",
    "x@snu.ac.kr\nBcc:elsewhere@example.com",
    "not an email",
    null,
  ]) {
    assert.equal(safeEmailUrl(value), "", String(value));
  }
  assert.equal(safeEmailUrl("x%0A@snu.ac.kr"), "mailto:x%250A@snu.ac.kr");
});

test("all pages block inline scripts and use external scripts compatible with CSP", () => {
  for (const filename of [
    "index.html",
    "members.html",
    "publications.html",
    "tools.html",
    "tools/code-cost-calculator.html",
    "footer.html",
  ]) {
    const html = fs.readFileSync(filename, "utf8");
    assert.match(
      html,
      /http-equiv="Content-Security-Policy"[^>]*script-src 'self';/,
    );
    assert.match(
      html,
      /base-uri 'none'; object-src 'none'; form-action 'none'/,
    );
    assert.match(
      html,
      /name="referrer" content="strict-origin-when-cross-origin"/,
    );
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
    assert.doesNotMatch(html, /\son\w+\s*=/i);
  }
});
