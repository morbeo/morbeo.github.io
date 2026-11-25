"""Load every page in tools/ and fail on console errors or uncaught exceptions."""
import http.server, pathlib, sys, threading, functools
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
pages = ['index.html', 'tools/index.html'] + sorted(
    str(p.relative_to(ROOT)) for p in (ROOT / 'tools').glob('*/index.html'))

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k):
        pass


handler = functools.partial(Quiet, directory=str(ROOT))
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{srv.server_port}/'

failed = False
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for page_path in pages:
        page = browser.new_page()
        problems = []
        # Google Fonts links are external; failing to reach them is not a page bug.
        page.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and problems.append(m.text))
        page.on('pageerror', lambda e: problems.append(str(e)))
        page.on('requestfailed', lambda r: r.url.startswith(base) and problems.append('request failed: ' + r.url))
        page.goto(base + page_path, wait_until='load')
        page.wait_for_timeout(500)
        print(('FAIL ' if problems else 'ok   ') + page_path)
        for p in problems:
            print('     ' + p)
        failed |= bool(problems)
        page.close()
    browser.close()
sys.exit(1 if failed else 0)
