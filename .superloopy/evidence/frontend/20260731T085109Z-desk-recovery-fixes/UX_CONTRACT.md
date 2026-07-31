# UX Contract

## Affected Workflows

- Monthly schedule: deleting every worker on a selected date must complete as one auditable batch operation.
- Supply inventory: selecting `2관` must reveal every item whose stored branch is `2관`.
- Supply writes: editing quantities, inventory details, assets, or purchase state must preserve branch and tag metadata.

## Behavioral Requirements

- Root-level Firebase multi-location updates use the database root reference, never an empty child path.
- Schedule batch deletion continues to write one dated history version for every affected date.
- Supply normalization preserves `branch` and `tags` for consumables and `branch` for assets.
- Recovery changes only the branch leaf for the identified July 30 inventory batch.

## Design Impact

Unchanged. This repair changes persistence and batch-write behavior only; existing controls, layout, labels, and interaction placement remain authoritative.
