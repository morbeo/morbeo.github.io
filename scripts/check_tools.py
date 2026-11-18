"""Loads every page under tools/ in Chromium and fails on console errors, failed requests or uncaught exceptions.

Usage:
  python3 scripts/check_tools.py             # every tools/<name>/index.html
  python3 scripts/check_tools.py mahjong pad # only the named tools

Needs Python Playwright. Uses the preinstalled Chromium at /opt/pw-browsers/chromium when present, or CHROMIUM=/path/to/chrome.
Exits non-zero when anything fails.
"""
import argparse, functools, http.server, os, sys, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SETTLE_MS = 1500


def tools():
    return sorted(d.name for d in (ROOT / "tools").iterdir() if (d / "index.html").is_file())


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def check_load(names):
    from playwright.sync_api import sync_playwright

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    exe = os.environ.get("CHROMIUM") or ("/opt/pw-browsers/chromium" if Path("/opt/pw-browsers/chromium").exists() else None)
    problems = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        for n in names:
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            errors = []
            # external requests (fonts, CDNs) get an empty 200 so the result does not depend on the network
            page.route(lambda u: not u.startswith(base), lambda r: r.fulfill(status=200, body="", content_type="text/plain"))
            page.on("response", lambda r, e=errors: r.status >= 400 and e.append(f"HTTP {r.status}: {r.url}"))
            page.on("console", lambda m, e=errors: m.type == "error" and e.append(f"console error: {m.text}"))
            page.on("pageerror", lambda x, e=errors: e.append(f"uncaught exception: {x}"))
            try:
                page.goto(f"{base}/tools/{n}/", wait_until="load", timeout=30000)
                page.wait_for_timeout(SETTLE_MS)
            except Exception as x:
                errors.append(f"failed to load: {x}")
            page.close()
            print(f"{'FAIL' if errors else 'ok  '} tools/{n}")
            problems += [f"tools/{n}/: {e}" for e in errors]
        browser.close()
    server.shutdown()
    return problems


def main():
    ap = argparse.ArgumentParser(description="Check that each page under tools/ loads without errors.")
    ap.add_argument("tools", nargs="*", help="limit to these tool folders (default: all)")
    a = ap.parse_args()
    every = tools()
    unknown = [t for t in a.tools if t not in every]
    if unknown:
        sys.exit(f"not a tool folder: {', '.join(unknown)}")
    problems = check_load(a.tools or every)
    for pr in problems:
        print(pr, file=sys.stderr)
    print(f"{len(problems)} problem(s)" if problems else "all checks passed")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
