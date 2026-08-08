# Validation

- `node --check services/desk-api/src/desk/handlers.js`: passed
- `node --check services/desk-api/src/app.js`: passed
- Inline `<script>` parse using `new Function`: passed (1 script)
- `npm test` in `services/desk-api`: 86 passed, 0 failed
- `git diff --check`: passed

## Covered Cases

- Staff without `canManageSchedules` receives `403 schedule_access_required`.
- Staff with explicit schedule permission can write.
- Non-admin correction decisions receive `403 attendance_admin_required`.
- Clock-in and clock-out retain planned schedule times.
- Correction request approval updates the attendance record and audit trail.
- Staff month reads exclude other staff UIDs.
- Frontend contract includes attendance controls, admin view, permission-aware tabs, and all-task shared-work rotation.

