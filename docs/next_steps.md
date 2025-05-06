# Next Steps

This file provides a high-level overview of the current development focus.

## Current Focus

The **Endpoint Discovery and Disambiguation** phase for the `/restEndpoint` feature is considered sufficient for an MVP.

*   **Current Task:** The top priority is to implement the **Call Hierarchy** feature for selected endpoints (MVP). This involves:
    *   Creating `src/call-hierarchy.ts` for the main logic.
    *   Creating `test/suite/call-hierarchy.test.ts` for unit tests.
    *   Implementing the `findCallers` function within `src/call-hierarchy.ts` to identify direct callers of a given function/method name using a workspace-wide text search for the MVP.
    *   Defining necessary data structures like `CallLocation` and `CallHierarchyResult`.
*   **Detailed Status & Plan:** See `docs/rest_endpoint_feature.md` and the newly added call hierarchy section within it.

## Guiding Principles

Please refer to `docs/development_principles.md` for important guidelines, especially regarding unit testing.

## Recently Completed Tasks

See `docs/completed_major_tasks.md` for a list of recently finished items.

## Anti-Patterns

See `docs/mistakes.md` for patterns to avoid.