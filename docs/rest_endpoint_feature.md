# `/restEndpoint` Feature Development

This document tracks the development progress for the `/restEndpoint` chat command.

## Overall Goal

Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

## Current Status & Remaining Steps

1.  **Command Setup (`/restEndpoint`):** *(Completed - See `docs/completed_major_tasks.md`)*
2.  **Endpoint Discovery and Disambiguation (`src/endpoint-discovery.ts`):**
    *   **Discovery (Hybrid Approach):** *(Completed)* - Uses LSP for symbol location and text parsing for annotation details.
    *   **Disambiguation:** *(Partially Implemented - Heuristics and basic LLM integration are done. Fallback to chat clarification is the next step.)*
    *   **Unit Tests:** *(Partially Completed - Good coverage for parsing and discovery. Disambiguation tests need to be updated for chat clarification fallback and then expanded.)* - See `test/suite/endpoint-discovery.test.ts`.
3.  **Java LSP Call Hierarchy Integration:** *(Next Major Phase - Depends on robust endpoint selection/disambiguation)*
    *   Identify Java extension call hierarchy command(s) (e.g., `java.showCallHierarchy`, `vscode.provideOutgoingCalls`, `vscode.provideIncomingCalls`).
    *   Implement logic to invoke command(s) with selected endpoint's URI/position.
    *   Build call hierarchy data structure.
    *   Add unit tests mocking `vscode.commands.executeCommand`.
4.  **Sequence Diagram Generation:** *(Future - Post Call Hierarchy MVP)*
    *   Create function to traverse call hierarchy data.
    *   Translate flow to Mermaid `sequenceDiagram` syntax.
    *   Add unit tests.
5.  **Display Results:** *(Partially Done - Webview exists, needs generated diagram)*
    *   Pass generated Mermaid syntax to `createAndShowDiagramWebview`.
6.  **User Feedback and Error Handling:** *(Largely Implemented - Core messages exist. Will be refined as new stages like call hierarchy are added.)*
7.  **Documentation:** *(Future - Primarily end-user documentation once features stabilize)*

## Current Task Details: Finalize `disambiguateEndpoint` & Prepare for Call Hierarchy

*   **Goal:** Complete the current iteration of `disambiguateEndpoint` by implementing chat-based clarification for ambiguous cases, and then transition to implementing the call hierarchy functionality.
*   **Status:**
    *   Heuristic checks for disambiguation: *(Implemented)*
    *   LLM-based selection for disambiguation (basic structure): *(Implemented)*
    *   Fallback logic: *(In Progress - Needs update from QuickPick to chat clarification)*
*   **Next Steps:**
    *   **1. Refactor `disambiguateEndpoint` Fallback to Chat Clarification:** *(Immediate)*
        *   Remove the call to `vscode.window.showQuickPick`.
        *   Implement the chat clarification message using `stream.markdown()` when heuristics fail and LLM is inconclusive or encounters an error.
        *   Ensure the function returns `null` to wait for user clarification via chat.
    *   **2. Update `disambiguateEndpoint` Unit Tests:** *(Following fallback refactor)*
        *   Modify existing unit tests in `test/suite/endpoint-discovery.test.ts` that previously tested the QuickPick fallback.
        *   Ensure tests now verify that `stream.markdown` is called with the appropriate clarification prompt and `null` is returned.
    *   **3. Expand Unit Tests for `discoverEndpoints` and `disambiguateEndpoint`:** *(Ongoing as Call Hierarchy work begins)* - Ensure robust coverage for various scenarios.
    *   **4. Begin Design and Implementation of Call Hierarchy:** *(After disambiguation refinement)* - See step 3 in "Current Status & Remaining Steps".
*   **Detailed Plan (Previously from `next_steps.md`, now integrated and updated here):**
    *   **A. Disambiguation Strategies:**
        *   **i. Simple Heuristic Check:** Direct method/path match, unique keyword match. *(Completed)*
        *   **ii. LLM-based Disambiguation:** If heuristics fail, use LLM to select index. *(Completed - basic call structure)*
        *   **iii. Chat-based Clarification:** If LLM fails/is ambiguous, use `stream.markdown` to ask user for clarification, return `null`. *(To Be Implemented - Replaces QuickPick)*
    *   **B. Implementation Steps for Disambiguation Refinement:**
        *   **i. Refactor `disambiguateEndpoint` fallback:** *(In Progress)*
        *   **ii. Develop LLM Prompt/Parsing:** *(Completed - Initial version, may need refinement later)*
        *   **iii. User Interface for Fallback (Chat):** Craft `stream.markdown` message. *(To Be Implemented)*
        *   **iv. Progress/Error Handling:** Refine messages. *(Partially Completed - Ongoing refinement)*