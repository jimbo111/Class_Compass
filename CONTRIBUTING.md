# Contributing Guide

Thanks for helping improve the Degree Works Scanner! This project was prototyped during **SBUHacks 2025**, so contributions that keep the setup lightweight and the UI consistent with the SBU theme are especially welcome.

## Project Workflow

1. **Fork + branch**  
   - Work on a feature branch per change (`feature/add-dashboard-filter`, etc.).

2. **Install dependencies**  
   - Only the dashboard uses Node tooling.  
     ```bash
     cd src/dashboard
     npm install
     ```

3. **Run locally**
   - Load the extension via `chrome://extensions` → “Load unpacked…”.
   - After making changes, click “Reload” on the extensions page before testing.

4. **Formatting**
   - Prefer readable, well‑commented JS (only add comments for non-obvious logic).
   - Keep CSS values in custom properties where possible so theming stays centralized.

5. **Testing checklist**
   - Trigger a fresh scan from the popup and ensure the dashboard renders the updated data.
   - Open DevTools console for both popup and dashboard to ensure no new errors.
   - Verify the background service worker logs expected messages (optional but useful).

6. **Pull requests**
   - Describe the problem being solved and how you tested it.
   - Include screenshots/GIFs for UI changes (popup or dashboard).
   - Keep PRs scoped – one functional improvement or bug fix at a time.

## Coding Guidelines

- **Messaging**: Extend `src/background/background.js` switch statements carefully; always return `{ ok: false, error }` on failures for consistent error handling.
- **UI**: Maintain accessibility attributes (`aria-live`, `aria-expanded`, focus outlines). Avoid hardcoding text without considering localization (strings can move to `_locales/en/messages.json` if needed).
- **Data parsing**: Any adjustments to the Degree Works converter should include fallback logic so scans don’t fail when a selector changes.

## Need Help?

Open an issue describing the bug/idea, or tag maintainers in existing discussions. Happy hacking!
