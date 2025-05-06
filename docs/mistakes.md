# Development Mistakes to Avoid

This document lists patterns and practices we have identified as counter-productive or error-prone during the development of this extension. Adhering to these avoids known pitfalls.

1.  **Using `vscode` Module Directly in Unit Tests (for Core Logic):**
    *   **Mistake:** Importing `vscode` and using its APIs directly within unit test files (`test/suite/*.test.ts`) for testing core logic (like parsing, data transformation, non-UI helper functions).
    *   **Why it's Bad:** Creates brittle tests dependent on the complex and potentially changing VS Code API surface. Makes tests harder to write, slower to run, and less focused on the actual logic being validated.
    *   **Correction:** Use abstraction layers. If a core logic module needs a VS Code service (like file reading, symbol providing), interact with it through an injected interface or wrapper function. Unit tests should then mock/stub these custom abstractions, not the `vscode` objects directly. Keep core algorithms in pure functions testable in complete isolation.
    *   **Note:** This applies primarily to *unit tests*. End-to-End (E2E) tests (`test/suite/e2e/*.test.ts`) necessarily interact with the real VS Code environment and its APIs.

2.  **Using Native UI Elements (e.g., `showQuickPick`) for Disambiguation in Chat:**
    *   **Mistake:** Calling native VS Code UI elements like `vscode.window.showQuickPick` or `vscode.window.showInputBox` from within a chat command handler (like `/restEndpoint`) to resolve ambiguity or gather further information from the user.
    *   **Why it's Bad:** Breaks the conversational flow of the chat interface. The user interaction shifts unexpectedly from the chat panel to a modal dialog or quick pick menu, which is jarring and inconsistent with the chat paradigm.
    *   **Correction:** Keep the interaction within the chat. If the assistant needs clarification or needs the user to choose from options:
        *   Use `stream.markdown()` to present the options or ask the clarifying question clearly within the chat response.
        *   The assistant's turn should end, allowing the user to respond naturally in the chat input.
        *   The assistant should be prepared to handle the user's clarifying response in their next turn.