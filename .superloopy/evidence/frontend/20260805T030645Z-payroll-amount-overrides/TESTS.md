# Tests

## Passed

- `npm test` in the original repository with local test-server binding allowed.
  - 76 tests passed.
- `node --test test/payroll-handlers.test.js test/frontend-cloud-routing.test.js`
  - 21 tests passed.
  - Covers amount override calculation, zero-won cancellation override, persistence replay, frontend controls, and bulk workflow wiring.
- `node --check src/payroll/normalizers.js`
- `node --check src/payroll/handlers.js`
- Node `vm.Script` parse of the single inline script in `docs/index.html`.
- `git diff --check`.

## Sandbox Note

The first full-suite run inside the filesystem sandbox passed 57 non-network tests but could not bind Supertest's local HTTP listener (`listen EPERM`). Re-running the same suite with local test-server binding allowed passed all 76 tests.
