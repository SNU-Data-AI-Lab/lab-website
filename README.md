# Data AI Lab website

Static HTML, CSS, JavaScript and public JSON hosted at <https://da.snu.ac.kr/>.
GitHub Pages builds the repository root from `main` with Jekyll and publishes
`_site`.

## Local development

Use Node.js 24 LTS and npm to build the CSS.

```sh
npm ci --ignore-scripts
npm run build:css
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/>. Commit `css/output.css` whenever its source or
Tailwind classes change. Tailwind scans the public HTML and page scripts.

## Publication

`_config.yml` controls which files Jekyll publishes. To preview the published
output, serve `_site` instead of the repository root.

The calculator reads selected Java/C++ files in browser memory.
