# Data AI Lab website

Static HTML, CSS, JavaScript and public JSON hosted at <https://da.snu.ac.kr/>.
GitHub's Pages build checks out `main`, builds the repository root with Jekyll,
and publishes `_site`. This PR keeps that publishing mode.

## Development and checks

Use Node.js 24 LTS and npm. The dependencies are CSS build tools; they are not a
website backend.

```sh
npm ci --ignore-scripts
npm test
npm audit --audit-level=low
npm run build:css
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/>. Commit `css/output.css` whenever its source or
Tailwind classes change. The Tailwind input explicitly scans the public HTML and
page scripts so tests and documentation cannot change generated CSS.

The `Security validation` Actions check also builds with GitHub's Pages Jekyll
action, verifies the committed CSS is current, and runs `npm run check:site`
against the generated `_site`. The publication check rejects files outside the
public asset allowlist and checks page script/stylesheet references.

## Publication and content security

- `_config.yml` excludes build tooling, tests, scripts, documentation and other
  development files from the existing Jekyll publication. `.gitignore` alone does
  not control what Pages publishes. Serve `_site` when testing publication rules;
  a development server at the repository root also serves development files.
- The page CSP permits same-origin external JavaScript and same-origin resource
  requests. Inline JavaScript and event attributes are blocked. Inline CSS is
  retained for the existing layouts; local/data images support the calculator
  favicon. Add scripts as separate files, not inline snippets.
- JSON text inserted into HTML must use `SiteSecurity.escapeHtml`, links must
  use `safeWebUrl`, images must use `safeImageUrl`, and email links must use
  `safeEmailUrl`. Prefer `textContent` for new text-only DOM nodes.
- Member JSON, images and all repository history are public. Hiding a field with
  CSS does not restrict access. Publish only approved information.
- The calculator reads selected Java/C++ files in browser memory; it does not
  upload or execute them on a server.

## Owner follow-up

The exact GitHub settings and institutional evidence still needed are in
[the owner checklist](docs/security-owner-checklist.md). Repository changes do
not enable branch protection, organization MFA, domain verification or log
retention automatically.
