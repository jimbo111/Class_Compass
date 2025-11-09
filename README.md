# Degree Works Scanner

A Chrome extension built during **SBUHacks 2025** by Evan Zhang & Jimmy Kim to capture a live Degree Works audit, transform it into structured data, and render a clean progress dashboard with SBU-inspired styling.

## Features

- **One-click scan** – injects a content script into Degree Works, captures the HTML, and stores a snapshot of your audit.
- **Automated parsing** – converts the captured HTML into structured JSON (student info, requirements, completed/in‑progress/incomplete courses, and unmet conditions).
- **Rich dashboard** – presents the parsed data inside `src/dashboard/index.html` with a red-themed layout, hoverable cards, and requirement drill-downs.
- **Popup insights** – action popup shows the active tab, highlights if the tab is unsupported, includes the cute “Scan Degree Works” button, and exposes the build credits/about toggle.

## Repository Layout

```
manifest.json              # Chrome extension manifest (MV3)
src/
  background/              # Service worker that coordinates scans & storage
  content/                 # Content script that scrapes & analyzes the page
  popup/                   # Popup UI (HTML/CSS/JS)
  dashboard/               # Standalone status dashboard + converter tooling
  dashboard/converter.js   # Degree Works HTML → JSON converter
  dashboard/script.js      # Renders converted data into the dashboard UI
```

## Getting Started

1. **Install dependencies** (optional – only needed if you plan to tweak dashboard tooling):
   ```bash
   cd src/dashboard
   npm install
   ```
2. **Load the extension**:
   - Open `chrome://extensions`, enable Developer Mode, choose “Load unpacked…”.
   - Select this repository directory.
3. **Scan a Degree Works page**:
   - Navigate to your university’s Degree Works portal.
   - Open the extension popup and click **Scan Degree Works**.
   - The popup will open the dashboard tab once processing finishes.
4. **View the dashboard**:
   - The dashboard pulls the last captured HTML via the background service.
   - You can also open `chrome-extension://<id>/src/dashboard/index.html` directly.

## Development Tips

- **Popup tweaks** live in `src/popup`. Remember to keep accessibility attributes (`aria-live`, `aria-expanded`, etc.) in sync with UI changes.
- **Content/Background communication** uses `chrome.runtime.sendMessage`. When adding new message types, update both the sender and the handler in `src/background/background.js`.
- **Dashboard data** is sourced from `chrome.storage.local.latestStatus`. If a scan hasn’t run yet, the dashboard falls back to the bundled sample HTML.
- **Styling** prefers CSS custom properties (see both `src/dashboard/styles.css` and `src/popup/popup.css`) so you can adjust the palette quickly.

## Testing

- Use Chrome’s Extensions page “Service Worker” console to inspect background logs.
- Open DevTools for the popup (`chrome://extensions` → “Inspect views”) to debug UI interactions.
- The dashboard runs as a regular web page – you can reload it with DevTools open to profile rendering or inspect the converted JSON in the console.

## License

Specify your license of choice (e.g., MIT) before publishing. Add a `LICENSE` file if required.
