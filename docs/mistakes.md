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

3.  **Overly Complex Regex in Mocks for Dynamic Content Parsing:**
    *   **Mistake:** Using intricate regular expressions within mock implementations (e.g., for `vscode.lm.sendRequest`) to parse dynamically generated content (like a formatted list of options) to simulate a choice.
    *   **Why it's Bad:** Regexes can become very difficult to write correctly for complex, multi-line structured text, especially when dealing with escaping special characters and ensuring they are robust to minor formatting changes. Debugging these regexes when they fail can be extremely time-consuming, as the exact string content and regex engine behavior can have subtle interactions. This was observed in an E2E test where a regex failed to extract an index from a formatted prompt, despite appearing correct visually.
    *   **Correction:** When a mock needs to find specific information within a dynamic string it receives (e.g., a prompt constructed by the system under test), consider using procedural, line-by-line string parsing instead of a single complex regex. This involves:
        *   Splitting the content into lines.
        *   Iterating through lines and using simple string equality checks (`===`), `startsWith()`, `includes()`, or very simple regexes for specific small parts (like extracting digits).
        *   Checking preceding/succeeding lines based on known structural patterns.
    *   **Benefit:** While potentially more verbose, this approach makes the parsing logic explicit, step-by-step, and much easier to debug. It avoids the "black box" nature of a failing complex regex. This change successfully resolved an E2E test failure where a regex could not reliably parse a list of endpoints to simulate an LLM's selection.
    *   **Note:** This doesn't mean "never use regex in mocks," but rather to be wary when the regex becomes a significant point of failure or complexity for parsing structured text that the mock itself didn't generate.

4.  **Generating Overly Detailed Sequence Diagrams from Call Hierarchy:**
    *   **Mistake:** Directly translating the raw output of VS Code's Call Hierarchy feature (especially when it includes deep framework/library calls) into a sequence diagram without abstraction.
    *   **Why it's Bad:** Results in excessively complex and verbose diagrams that obscure the essential architectural interactions. Users are forced to wade through numerous internal framework calls (e.g., Spring `ResponseEntity` construction, `Assert` utilities, `HttpHeaders` manipulations) to find the core application logic flow. This makes the diagrams difficult to understand and less useful for gaining a quick architectural overview. See `docs/example-detailed-sequence-diagram.md` for a concrete example.
    *   **Correction:** Implement an abstraction layer or filtering mechanism that processes the raw call hierarchy data. This mechanism should prioritize calls between components within the user's own project (identifiable via `vscode.workspace.workspaceFolders`) and aggressively filter out or simplify calls to external libraries and frameworks. The goal is to produce a high-level architectural view, as outlined in `docs/next_steps.md` under the current top priority.