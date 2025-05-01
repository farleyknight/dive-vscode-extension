## New Feature: `/restEndpoint` Diagram Generation

*   **Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Next Steps:**

1.  **Command Setup (`/restEndpoint`):**
    *   Update the chat participant handler in `src/simple.ts` to recognize the `/restEndpoint` command.
    *   Extract the natural language query provided by the user (e.g., "Give me details on the test API") as an argument to the command.
    *   Create a new handler function `handleRestEndpoint(params: CommandHandlerParams, naturalLanguageQuery: string)` in `src/simple.ts`.
    *   **Testing:** Manually invoke `@dive /restEndpoint Show the user creation flow` in chat and verify the handler is called with the correct query string (via logging/debugger).

2.  **Endpoint Discovery and Disambiguation:**
    *   **Discover All Endpoints:** Implement logic to find *all* Spring Boot REST endpoints within the workspace. This could involve:
        *   Using Java LSP features (e.g., `vscode.executeWorkspaceSymbolProvider` searching for annotations like `@RestController`, `@RequestMapping`, `@GetMapping`, etc.).
        *   Alternatively, using `vscode.workspace.findFiles('**/*.java')` and parsing files to find these annotations directly.
    *   Create a structured list of found endpoints, including method, path, and source location (URI and position). Example: `[{ method: 'POST', path: '/api/users', uri: vscode.Uri, position: vscode.Position, description: 'Creates a new user' /* Optional: extracted from Javadoc/comments */ }, ...] `.
    *   **Identify Target Endpoint:** Use the `naturalLanguageQuery` from step 1 to identify the most likely target endpoint from the discovered list. This may involve:
        *   Simple keyword matching between the query and the endpoint paths/methods/descriptions.
        *   Potentially using an LLM (via a dedicated tool or API call) to perform semantic matching between the user's query and the list of available endpoints, asking it to return the best match(es).
        *   If multiple potential matches are found or the confidence is low, interact with the user (e.g., `stream.markdown('Did you mean GET /api/test or POST /api/tests?')`) to confirm the correct endpoint.
    *   Once a single endpoint is confidently identified, store its `vscode.Uri` and `vscode.Position`.
    *   **Testing:** Unit test endpoint discovery logic. Unit test the disambiguation logic with various queries and mock endpoint lists. Manually test against a real Spring Boot project with diverse endpoints and natural language queries.

3.  **Java LSP Call Hierarchy Integration:**
    *   Identify the correct VS Code command provided by the installed Java extension for fetching call hierarchies (e.g., `vscode.prepareCallHierarchy`, `java.showCallHierarchy`, followed by `vscode.provideOutgoingCalls`). This might require checking the Java extension's contributions.
    *   Use `vscode.commands.executeCommand` to invoke the call hierarchy provider with the specific URI and position identified in step 2.
    *   Recursively fetch *outgoing* calls (`vscode.provideOutgoingCalls`) to build a data structure (like a tree or graph) representing the call flow from the endpoint method down to a reasonable depth (e.g., 3-5 levels). Handle cycles gracefully.
    *   **Testing:** Unit test the recursive call fetching and data structure building logic by mocking `vscode.commands.executeCommand`. Manually test against a real Spring Boot project (using an endpoint confirmed in step 2) with a known call structure and verify the resulting diagram accuracy.

4.  **Sequence Diagram Generation:**
    *   Create a function that traverses the call hierarchy data structure generated in step 3.
    *   Translate the call flow (classes/methods calling other methods) into a Mermaid `sequenceDiagram` syntax string.
    *   **Testing:** Unit test the diagram generation function with various pre-defined call hierarchy data structures (simple, branched, cyclic, deep) and verify the output Mermaid syntax is correct and valid.

5.  **Display Results:**
    *   Pass the generated Mermaid syntax to the existing `createAndShowDiagramWebview` function in `src/simple.ts` to render the diagram in a webview panel.
    *   Use a distinct `panelId` and `panelTitle` for this feature.
    *   **Testing:** Manually invoke the command and verify the webview opens with the correct title and renders the diagram. (Relies on existing tested functionality).

6.  **User Feedback and Error Handling:**
    *   Implement progress messages using `stream.progress()` (e.g., "Finding endpoint...", "Analyzing calls...", "Generating diagram...").
    *   Add robust error handling and user-friendly messages via `stream.markdown()` for scenarios like:
        *   Endpoint string parsing failure.
        *   Endpoint method not found in the workspace.
        *   Java extension or call hierarchy feature not available/failing.
        *   Errors during diagram generation.
    *   **Testing:** Manually trigger error conditions (invalid input, missing endpoint, disabled Java extension) and verify correct progress/error messages appear in the chat. Unit test specific error paths by mocking failures in dependencies.

7.  **Documentation:**
    *   Update `README.md` to document the new `/restEndpoint <METHOD /path>` command, its usage, and prerequisites (Java extension with call hierarchy support).
    *   **Testing:** Manually review the updated `README.md` for clarity and accuracy.

## Next Steps:

*Goal: [Describe next major goal here]*

[List next steps here]

## Completed Tasks

1.  **Implement Client-Side Diagram Export:**
    *   *Goal: Replace backend `mmdc`-based export with client-side `mermaid.min.js`.*
    *   Modified webview template (`src/views/mermaid-webview-template.ts`) to include "Export SVG" and "Export PNG" buttons.
    *   Added JavaScript logic to the webview for SVG export (`Blob`, `URL.createObjectURL`) and PNG export (`Canvas`, `Image`, `toBlob`).
    *   Removed SVG/PNG export logic using `@mermaid-js/mermaid-cli` from the `diagram.saveAs` command handler in `src/extension.ts`.
    *   Removed the `@mermaid-js/mermaid-cli` dependency from `package.json`.

2.  **Add a dropdown that can change the theme of the diagram.**
    *   Added a `<select>` dropdown to the webview HTML generated by `/simpleUML`, `/relationUML`, and the `RenderDiagramTool` (in `src/tool-handlers.ts`).
    *   Added JavaScript to handle dropdown changes, re-initializing/re-rendering the Mermaid diagram with the selected theme (`default`, `neutral`, `dark`, `forest`).
    *   Set `retainContextWhenHidden: true` for webviews to preserve theme selection.
2.  **Add a "Save Diagram" Button:**
    1.  **Declare Command:** Defined `diagram.saveAs` in `package.json`.
    2.  **Register Command:** Registered handler in `extension.ts` using `vscode.commands.registerCommand`, implementing save dialog and file writing.
    3.  **Create Button Command:** Created `vscode.Command` object in the `/fromCurrentFile` and `/showConnections` handlers in `src/simple.ts`.
    4.  **Add Button to Stream:** Called `stream.button()` in the `/fromCurrentFile` and `/showConnections` handlers to display the button.

3.  **Bug Fixes:**
    *   Fixed webview panel rendering regression in `RenderDiagramTool`

4.  **Command Structure Cleanup:**
    *   Removed `/randomTeach` endpoint
    *   Removed `/play` endpoint
    *   Simplified command structure to focus on diagram-related functionality

5.  **Tool Implementation:**
    *   Implemented proper tool classes with `