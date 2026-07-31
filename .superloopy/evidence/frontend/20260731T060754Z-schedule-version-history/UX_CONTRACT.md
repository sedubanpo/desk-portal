# Monthly Schedule Version History UX Contract

## User Goal

Confirm whether each day's schedule is current, identify who changed it and when, and inspect any earlier saved version without leaving the monthly calendar.

## Primary Journey

1. Scan a day cell and read its latest version timestamp and account.
2. Select the version row above the add-schedule action.
3. Review versions newest-first.
4. Select a version and inspect its added, changed, and deleted counts plus the exact schedule snapshot.
5. Close the history dialog and continue editing the calendar.

## States

- Existing legacy day: `버전 기록 시작 전`, with a note that the next save starts history.
- Versioned day: latest month/day/time and editor account are visible.
- Loading: history list and detail show bounded loading text.
- Empty: legacy limitation is explained without implying a recoverable timestamp.
- Error: the modal subtitle reports the read failure.

## Accessibility

- History is a real button with a descriptive title.
- Dialog uses `role="dialog"`, `aria-modal`, and a labelled heading.
- Version selection remains keyboard-focusable.
- Account, time, summary, and snapshot remain text, not color-only signals.

