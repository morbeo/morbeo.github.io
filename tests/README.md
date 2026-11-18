# Checks

Pull requests run three checks (`.github/workflows/checks.yml`). Each can be run locally.

| Check | Command | What it does |
| --- | --- | --- |
| HTML | `npx html-validate@9 index.html "tools/**/index.html"` | Validates every page; rules are in `.htmlvalidate.json` |
| Unit tests | `node --test tests/*.test.js` | Logic tests, currently the mahjong scoring in `tools/mahjong/rules.js` |
| Page load | `python3 scripts/check_tools.py [tool ...]` | Opens each `tools/<name>/` in Chromium and fails on console errors, failed requests or uncaught exceptions |

The page-load check needs Python Playwright (`pip install playwright`); it uses the Chromium at `/opt/pw-browsers/chromium` if present, or `CHROMIUM=/path/to/chrome`. External requests such as web fonts are answered with an empty response so the result does not depend on the network.

A new tool under `tools/<name>/index.html` is picked up by the HTML and page-load checks automatically.
