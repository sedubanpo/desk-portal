# Behavioral QA

## Automated Verification

- PASS: root multi-path updates use `database.ref()` and do not call `database.ref("")`.
- PASS: schedule batch deletion writes dated version history.
- PASS: supply snapshot writes retain consumable branch and tags.
- PASS: supply snapshot writes retain asset branch.
- PASS: complete API suite, 63 tests passed.

## Production Recovery Baseline

- Read-only snapshot captured before recovery: 44 consumables and 4 assets.
- Snapshot SHA-256: `c854b719041724c35e3cb0983ba6fbc0f331d54467e4556d397df2afb4b83faa`.
- No consumable records were missing; branch metadata had been stripped.
- Recovery scope: nine consecutive consumables registered on 2026-07-30 between 21:32 and 22:01 KST.
- Recovery operation: update only each selected record's `branch` leaf to `2관`.

## Visual Impact

None. The current supply and schedule interfaces are unchanged, so no new rendered-surface claim is made.
