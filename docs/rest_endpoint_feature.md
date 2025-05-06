# `/restEndpoint` Feature Development

This document tracks the development progress for the `/restEndpoint` chat command.

## Overall Goal

Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

## Current Status & Remaining Steps

1.  **Command Setup (`/restEndpoint`):** *(Completed - See `docs/completed_major_tasks.md`)*
2.  **Endpoint Discovery and Disambiguation (`src/endpoint-discovery.ts`):** ***(Current Focus)***
    *   **Discovery (Hybrid Approach):** *(Implementation Done)* - Uses LSP for symbol location and text parsing for annotation details.
    *   **Disambiguation:** *(Partially Implemented - Basic flow exists, LLM/Chat Clarification logic is next)*
    *   **Unit Tests:** *(Partially Completed - Good coverage for parsing, initial tests for discovery. Needs expansion for disambiguation.)* - See `test/suite/endpoint-discovery.test.ts`.
3.  **Java LSP Call Hierarchy Integration:** *(Next - Depends on successful disambiguation)*
    *   Identify Java extension call hierarchy command(s).
    *   Implement logic to invoke command(s) with selected endpoint's URI/position.
    *   Build call hierarchy data structure.
    *   Add unit tests mocking `vscode.commands.executeCommand`.
4.  **Sequence Diagram Generation:** *(Future)*
    *   Create function to traverse call hierarchy data.
    *   Translate flow to Mermaid `sequenceDiagram` syntax.
    *   Add unit tests.
5.  **Display Results:** *(Partially Done - Webview exists, needs generated diagram)*
    *   Pass generated Mermaid syntax to `createAndShowDiagramWebview`.
6.  **User Feedback and Error Handling:** *(Largely Implemented - Core messages exist, needs refinement for later stages)*
7.  **Documentation:** *(Future)*

## Current Task Details: Implement Core `disambiguateEndpoint` Logic

*   **Goal:** Enhance `disambiguateEndpoint` to handle cases where multiple endpoints match the user's query, using heuristics, LLM assistance, and chat-based clarification instead of native UI elements.
*   **Status:** Initial implementation with heuristic checks and LLM call structure is done. Fallback logic needs to be updated to use chat clarification.
*   **Next Steps:**
    *   **1. Refactor `disambiguateEndpoint` Fallback:**
        *   Remove the call to `vscode.window.showQuickPick`.
        *   Implement the chat clarification message using `stream.markdown()` when heuristics fail and LLM is inconclusive or encounters an error.
        *   Ensure the function returns `null` in this case to wait for user clarification.
    *   **2. Update Unit Tests:**
        *   Modify existing unit tests for `disambiguateEndpoint` in `test/suite/endpoint-discovery.test.ts` that previously tested the QuickPick fallback.
        *   Ensure tests now verify that `stream.markdown` is called with the clarification prompt and `null` is returned in ambiguous/error scenarios (instead of checking `showQuickPickStub`).
    *   **3. Continue Expanding Unit Tests for `discoverEndpoints`:** *(Ongoing side task)*
*   **Detailed Plan (from previous `next_steps.md`):**
    *   **A. Disambiguation Strategies:**
        *   **i. Simple Heuristic Check:** Direct method/path match, unique keyword match. *(Implemented)*
        *   **ii. LLM-based Disambiguation:** If heuristics fail, use LLM to select index. *(Implemented - basic call structure)*
        *   **iii. Chat-based Clarification:** If LLM fails/ambiguous, use `stream.markdown` to ask user, return `null`. *(Needs Implementation - Replaces QuickPick)*
    *   **B. Implementation Steps:**
        *   **i. Refactor `disambiguateEndpoint`:** *(In Progress - Focus on fallback)*
        *   **ii. Develop LLM Prompt/Parsing:** *(Done - Initial version)*
        *   **iii. User Interface for Fallback:** Craft `stream.markdown` message. *(Needs Implementation)*
        *   **iv. Progress/Error Handling:** Refine messages. *(Partially Done)*