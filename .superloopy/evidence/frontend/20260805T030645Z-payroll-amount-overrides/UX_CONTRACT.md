# UX Contract

## Scope

Teacher payroll amount editing in the existing dense operations table.

## Claims

- Every payroll row exposes its gross amount as a non-negative numeric input.
- Leaving an edited field commits the value through the existing payroll override save path.
- Entering the original amount removes the manual amount override.
- A manual amount updates discount, net sales, calendar totals, canceled totals, and estimated teacher pay on the server before the refreshed result is rendered.
- The individual-regular bulk action selects one teacher, accepts one non-negative amount, and previews the visible target count.
- Applying the bulk action fetches the selected teacher's unfiltered month rows and updates every `개별정규` row, even when a page-level subject filter is active.
- Zero won is a valid explicit override.
- Saving and lookup failures leave the controls recoverable and surface an error message.

## Interaction

- Amount inputs have student-specific accessible labels.
- The bulk apply button is disabled until teacher, target rows, and amount are valid.
- Save progress and result status are announced through an `aria-live` region.
- Existing table collapse, column visibility, filtering, and keyboard focus behavior remains intact.

## Layout

- The bulk editor is a compact full-width operations band above the existing filters.
- At the existing narrow breakpoint, the four-column editor stacks to one column.
- Amount fields use tabular numerals and fixed width to prevent row layout shifts.
