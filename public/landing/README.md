# Landing page product screenshots

These images are captured from the actual Fairplay React workspace, using the
public preview fixtures (not real account data). They are not mock UI layouts.

- Source baseline: `235d644860545b5e6d2659f531deec1ec3b121c2`
- Fixed preview date: 2026-11-07 12:00 Asia/Seoul
- Roles: team leader for collaboration screens; space manager for team management
- Routes: `/preview/spaces/1/teams/1/tasks`, `deliverables`, `reports`
- Manager route: `/preview/spaces/1/dashboard`
- Scenario: active for tasks/materials; published for the contribution report
- Viewports: 1440×810 desktop, 390×780 mobile; 2× pixel density
- The preview-environment switch in the header is hidden only while capturing.
  The actual application and its preview controls are not changed.

To refresh after workspace UI changes, start Vite locally and run:

```sh
node scripts/capture-landing-screens.mjs
```

Set `LANDING_CAPTURE_URL` to use a different local server port. Only localhost
servers are accepted, so private production screens cannot be captured by mistake.
Set `LANDING_CAPTURE_SCREENS=manager` to refresh only the manager screenshots.
After recapturing, bump `LANDING_SCREEN_VERSION` in `src/lib/landingScreens.js`
so every landing placement loads the new revision instead of a cached image.
