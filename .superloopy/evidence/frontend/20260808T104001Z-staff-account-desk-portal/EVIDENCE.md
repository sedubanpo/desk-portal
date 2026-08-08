# Staff Account Desk Portal Evidence

## Surface

- target: `{ id: "desk-portal-web", platform: "browser-hosted-web", environment: "production-github-pages" }`
- owner: `docs/index.html`
- scopeReason: Account-aware daily journal navigation and authenticated global header behavior changed.
- claims:
  - STAFF accounts receive one personal daily-journal tab bound to the authenticated account name.
  - ADMIN accounts retain the existing overview, manager, and worker tabs.
  - The global header shows the authenticated account, an explicit Asia/Seoul clock, and rotating current shared work with its recorder.
  - Account settings exposes the existing Firebase password-change flow.
  - Schedule and supply audit records continue to use the authenticated server identity name.

## Implementation Evidence

- `services/desk-api/src/roles.js` exposes `loginId` and `staffPosition` in the authenticated public identity.
- `docs/index.html` scopes workers, tasks, memos, and the live feed for STAFF while leaving ADMIN behavior unchanged.
- `docs/index.html` replaces the decorative search and sync labels with the shared-work notice, Seoul clock, account settings command, and authenticated user label.
- Existing API handlers attribute schedule versions and supply quantity history to `identity.name`.

## Limitations

- Browser automation and computer-use validation were intentionally not used, following the user's explicit request.
- Visual claims are therefore package-inspected rather than promoted as rendered-surface verified.
