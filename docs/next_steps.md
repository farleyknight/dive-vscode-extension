# Next Steps

This file provides a high-level overview of the current development focus.

## Current Focus

The primary focus has shifted to implementing the **Call Hierarchy** feature for `/restEndpoint`. We are taking an MVP (Minimum Viable Product) approach to get this working end-to-end.

*   **Previous Task (Endpoint Disambiguation):** Initial implementation for endpoint disambiguation (including heuristic checks and basic LLM integration) is complete. Further enhancements and advanced scenarios will be revisited after the MVP for call hierarchy is established. The immediate next step for disambiguation is to refactor the fallback mechanism to use chat-based clarification instead of `showQuickPick`.
*   **Current Top Priority:** Design and implement the call hierarchy determination for a selected endpoint. This is the core of the Call Hierarchy MVP.
    *   **(Completed)** Integrate the existing `buildCallHierarchyTree` function (from `src/call-hierarchy.ts`) into the `/restEndpoint` command handler.
    *   Implement logic to translate the `CustomHierarchyNode` tree structure (from `buildCallHierarchyTree`) into a Mermaid sequence diagram format.
    *   Display the generated Mermaid diagram to the user within the webview (likely using the existing `createAndShowDiagramWebview` mechanism).
    *   **Manual Testing & Observation:** Run the `/restEndpoint` command with a Java Spring Boot project to observe the generated sequence diagram. Note issues with participant names, call flow, and overall clarity.
    *   **Refinement (based on testing):** Refine `getParticipantName`, consider adding `activate`/`deactivate` logic, and address any issues in `sanitizeParticipantName` or `escapeMermaidMessage` in `src/mermaid-sequence-translator.ts`.
    *   Add dedicated unit tests for `src/call-hierarchy.ts` (mocking `vscode.commands.executeCommand`).
    *   Add unit tests for the Mermaid diagram translation logic (`src/mermaid-sequence-translator.ts`).
*   **Detailed Status & Plan:** See `docs/rest_endpoint_feature.md` (this document is also being updated to reflect the current priorities and progress).

## Guiding Principles

Please refer to `docs/development_principles.md` for important guidelines, especially regarding unit testing.

## Recently Completed Tasks

See `docs/completed_major_tasks.md` for a list of recently finished items.

## Anti-Patterns

See `docs/mistakes.md` for patterns to avoid.