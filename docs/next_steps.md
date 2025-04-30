## New Feature: `/restEndpoint` Diagram Generation

*   **Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Next Steps:**

1.  **Command Setup (`/restEndpoint`):**
    *   Update the chat participant handler in `src/simple.ts` to recognize the `/restEndpoint` command.
    *   Extract the endpoint identifier (e.g., "GET /api/users") provided by the user as an argument to the command.
    *   Create a new handler function `handleRestEndpoint(params: CommandHandlerParams, endpointString: string)` in `src/simple.ts`.
    *   Parse `endpointString` to get the HTTP method and path pattern.
    *   **Testing:** Manually invoke `@dive /restEndpoint GET /api/test` in chat and verify the handler is called (via logging/debugger). Unit test the endpoint string parsing logic.

2.  **Endpoint Method Location:**
    *   Implement workspace searching logic (e.g., using `vscode.workspace.findFiles('**/*.java')`) to find potential controller files.
    *   Within Java files, parse or use LSP symbols (`vscode.executeCommand('vscode.executeWorkspaceSymbolProvider', query)`) to find method definitions annotated with Spring REST annotations (e.g., `@GetMapping`, `@PostMapping`).
    *   Match the annotations' paths and methods against the user-provided `endpointString` to pinpoint the exact `vscode.Uri` and `vscode.Position` of the target endpoint method. Handle path variables appropriately.
    *   **Testing:** Unit test the file searching and annotation matching logic against mock Java files. Manually test against a real Spring Boot project to ensure it finds the correct method location for various endpoints.

3.  **Java LSP Call Hierarchy Integration:**
    *   Identify the correct VS Code command provided by the installed Java extension for fetching call hierarchies (e.g., `vscode.prepareCallHierarchy`, `java.showCallHierarchy`, followed by `vscode.provideOutgoingCalls`). This might require checking the Java extension's contributions.
    *   Use `vscode.commands.executeCommand` to invoke the call hierarchy provider with the URI and position found in step 2.
    *   Recursively fetch *outgoing* calls (`vscode.provideOutgoingCalls`) to build a data structure (like a tree or graph) representing the call flow from the endpoint method down to a reasonable depth (e.g., 3-5 levels). Handle cycles gracefully.
    *   **Testing:** Unit test the recursive call fetching and data structure building logic by mocking `vscode.commands.executeCommand`. Manually test against a real Spring Boot project with a known call structure and verify the resulting diagram accuracy.

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
    *   Implemented proper tool classes with `vscode.LanguageModelTool` interface
    *   Created `GetCodeContextTool` and `RenderDiagramTool` classes
    *   Fixed tool result handling with proper types
    *   Added tool registration in `src/diagram-tools.ts`

6.  **Auto-Detection of Diagram Type:**
    *   Updated prompts and tool handling to automatically detect appropriate diagram types
    *   Implemented code analysis for diagram type selection
    *   Added requirement for model to explain diagram type choices

7.  **Documentation Updates:**
    *   Updated README.md to reflect new diagram-focused functionality
    *   Added documentation for `/fromCurrentFile` command
    *   Updated current state and next steps documentation

8.  **Connection Visualization:**
    *   Implemented `/showConnections` command to show object relationships
    *   Added support for inheritance, composition, and aggregation relationships
    *   Enhanced diagram generation to include related objects and their connections
    *   Added dark mode support for connection diagrams

9.  **Implement PNG/SVG Rendering for Save:**
    *   Integrated the Mermaid CLI (`mmdc`) via `@mermaid-js/mermaid-cli` dev dependency.
    *   Modified the `diagram.saveAs` command handler in `src/extension.ts` to render PNG/SVG using `mmdc`.
    *   Writes image data for `.png` and `.svg` extensions.
    *   Added error handling for `mmdc` execution (not found, rendering errors).
    *   Checks for `mmdc` existence before attempting render.

10. **Improved Save Diagram Functionality:**
    *   Used the Mermaid CLI (`mmdc`) to convert diagrams to SVG/PNG on save.
    *   Checked if `mmdc` is installed; prompt user if not.
    *   Handled `.svg`, `.png`, `.mmd`, and `.md` file extensions during save.
    *   Used `child_process` to run `mmdc`.
    *   Added error handling for the conversion process.

### 3. Add Export/Save Functionality

*Goal: Allow users to save the generated Mermaid diagrams in various formats.* Currently implemented for diagrams generated via `/simpleUML`, `/relationUML`, and `/sequence` command (via the `renderDiagram` tool).

1.  **Define Export Formats:** Decided on `.mmd` (raw syntax), `.md` (Markdown code block), `.svg`, and `.png`.
2.  **Webview Controls:**
    *   Added an "Export Diagram" button/dropdown to the webview HTML (`src/views/mermaid-webview-template.ts`).
    *   The dropdown lists the export formats (SVG, PNG, MMD, MD).
    *   Added JavaScript in the webview to handle button clicks/dropdown selections and send a `postMessage` back to the extension with the desired format, current theme, and the original Mermaid syntax.
3.  **Register `