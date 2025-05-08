# Project Overview

The "Dive" VS Code extension enhances code understanding and navigation by providing AI-powered diagram generation and REST endpoint analysis capabilities.

### Core Features:

1.  **AI-Powered Diagram Generation:**
    *   Users can select a block of code or use the entire active file.
    *   Commands like `/simpleUML`, `/relationUML`, and `/sequence` leverage a Large Language Model (LLM) to analyze the code and generate corresponding diagrams in Mermaid syntax.
    *   Generated diagrams are displayed in a dedicated webview panel within VS Code, allowing for easy visualization of code structure, relationships, and interactions.
    *   Mermaid syntax validation is performed (using a Node.js environment with JSDOM and the `mermaid` library) before attempting to render, providing feedback on syntax errors.

2.  **REST Endpoint Analysis & Sequence Diagram Generation:**
    *   The `/restEndpoint` command allows users to query for specific REST endpoints within their workspace (currently focused on Java Spring Boot projects).
    *   **Endpoint Discovery:** The system scans Java files, identifies Spring annotations (e.g., `@RestController`, `@GetMapping`), and builds a list of discoverable endpoints.
    *   **Endpoint Disambiguation:** If the user's query is ambiguous or matches multiple endpoints, an LLM is used to help select the most relevant target endpoint from the discovered list.
    *   **Call Hierarchy Construction:** For the selected endpoint, VS Code's built-in Call Hierarchy feature is utilized to trace outgoing calls from the endpoint's handler method. This produces a detailed call tree.
    *   **Mermaid Sequence Diagram:** The constructed call hierarchy is then translated into a Mermaid sequence diagram, which is displayed in a webview. This provides a visual representation of the runtime execution flow originating from the REST endpoint.

### Technical Details & Architecture:

*   **Language Support:** Primarily TypeScript for the extension logic.
*   **Diagramming:** Uses Mermaid.js for diagram syntax and rendering.
*   **AI/LLM Integration:** Leverages VS Code's built-in Language Model Chat API (`vscode.LanguageModelChat`) for tasks like code-to-diagram generation and endpoint disambiguation. An adapter pattern (`ILanguageModelAdapter`) is used to abstract direct LLM interactions for better testability.
*   **Endpoint Discovery:** Relies on VS Code's Language Server Protocol (LSP) features, specifically `vscode.executeDocumentSymbolProvider` to find classes and methods, and then parses annotations from the source code text to identify REST mappings.
*   **Call Hierarchy:** Uses `vscode.prepareCallHierarchy` and `vscode.provideOutgoingCalls` (via `vscode.commands.executeCommand`) to build call trees.
*   **Webviews:** Standard VS Code webview panels are used to display Mermaid diagrams.
*   **Testing:** The project includes unit tests (focused on isolated logic, aiming to minimize direct `vscode` API dependencies) and E2E tests (validating full command flows within a VS Code test environment).
    *   Unit tests mock abstracted interfaces for VS Code APIs (`IUri`, `IPosition`, `ICommandExecutor`, `ILogger`, `ILanguageModelAdapter`, etc.).
    *   E2E tests interact with a live VS Code instance and a fixture project (Java Spring Boot) to test features like endpoint discovery and call hierarchy-based diagram generation.

### Current Status:

*   All core features are implemented.
*   The test suite (unit and E2E) is passing, ensuring stability and correctness of the implemented functionalities.
*   Recent debugging efforts have focused on resolving E2E test failures related to endpoint discovery, call hierarchy stubbing, and Mermaid diagram generation, all of which are now resolved.

This project aims to provide developers with powerful tools to quickly understand and navigate complex codebases through intuitive visualizations and AI-assisted analysis.

## Core Functionality

- The command registration logic uses `@diagram` (participant ID `dive.diagram` in `src/simple.ts`).
- The corresponding participant ID in `package.json` has been updated to `dive.diagram`.
- The participant `name` in `package.json` (used for invocation, e.g., `@diagram`) is `diagram`.
- The participant `fullName` in `package.json` for `dive.diagram` is "Diagram".
- An `iconPath` property has been added to the `dive.diagram` participant in `package.json`, pointing to `diagram.png` (placeholder).
- The main `@diagram` handler in `src/simple.ts` does not appear to have legacy participant ID checks remaining.
- Documentation (`README.md`) updated to refer to `@diagram`.
- The agent's persona prompt in `src/simple.ts` has been updated to be diagram-focused.
- `README.md` updated to reflect the new diagram theme for the `@diagram` participant.
- The `mermaid` npm package has been added as a project dependency.

## Diagram Generation and Display

- Multiple commands generate/display diagrams: `/simpleUML`, `/relationUML`, `/sequence`.
- **Webview Rendering:**
    - `/simpleUML`, `/relationUML`, `/sequence` directly create `vscode.WebviewPanel` instances within their handlers in `src/simple.ts` using the `createAndShowDiagramWebview` helper.
    - These commands generate HTML manually, embedding the Mermaid syntax and loading the Mermaid library from a CDN.
    - There are slight variations in the webview setup between these commands (e.g., Mermaid CDN URL, theme settings, panel ID, error handling JS).
    - The `diagram_renderDiagram` tool handles webview creation internally using helper functions in `src/tool-handlers.ts`.
- **Mermaid Theme:**
    - A theme dropdown (`<select>`) has been added to the webview HTML for all diagram rendering commands (`/simpleUML`, `/relationUML`, `/sequence`).
    - Supported themes: `default`, `neutral`, `dark`, `forest`.
    - JavaScript handles theme changes by re-rendering the diagram using `mermaid.run()` with the new theme configuration.
    - Webviews now use `retainContextWhenHidden: true` to preserve the selected theme if the panel is hidden and shown again.
    - Default theme is set to `dark`.
- **Diagram Content:**
    - `/simpleUML`: Prompts LLM for a *simple* diagram from current file content.
    - `/relationUML`: Prompts LLM for a diagram showing object relationships from current file content.
    - `/sequence`: Prompts LLM for a sequence diagram from current file content.

## Tool Implementation

- Diagram-specific tools (`dive_getCodeContext`, `dive_renderDiagram`) are defined in `package.json` (verification needed for exact definition).
- Tool implementation exists in `src/tool-handlers.ts`:
  - `GetCodeContextTool`: Gets code from the active editor (selection or full file).
  - `RenderDiagramTool`: Renders a provided Mermaid string in a webview using helper functions (`getWebviewContent`, `renderDiagramInWebview`). Takes `vscode.ExtensionContext` in constructor.
- Tools are registered in `src/diagram-tools.ts` using `vscode.lm.registerTool`.
- `src/extension.ts` calls `registerDiagramTools` during activation.
- Tool invocation:
    - `/simpleUML`, `/relationUML`, `/sequence` **do not** use the `renderDiagram` tool for rendering; they handle it directly via `createAndShowDiagramWebview`.

## Command Structure

- Key commands: `/simpleUML`, `/relationUML`, `/sequence`.
- New command: `/restEndpoint <query>` (Command registered, handler exists in `src/simple.ts`, underlying discovery logic in `src/endpoint-discovery.ts` is **implemented using hybrid approach**; disambiguation is pending).
- Removed `/randomTeach` and `/play` endpoints.
- Updated default help message in `src/simple.ts` to reflect current commands.
- `/simpleUML` and `/relationUML` include prompts for the LLM to automatically detect appropriate diagram types based on code analysis.

## Save Diagram Functionality

- **Completed:** Ability to save diagrams is implemented.
- `diagram.saveAs` command defined in `package.json` and registered in `src/extension.ts`.
- Handler uses `vscode.window.showSaveDialog` and `vscode.workspace.fs.writeFile`.
- Supports saving as `.mmd` (raw syntax) and `.md` (syntax in code block).
- **SVG/PNG Export:** Handled client-side within the webview (`src/views/mermaid-webview-template.ts`).
    - Webview has "Export SVG" and "Export PNG" buttons.
    - Uses JavaScript (`Blob`, `URL.createObjectURL`, `Canvas`) to generate and trigger downloads directly from the browser.
    - Does NOT use the Mermaid CLI (`mmdc`).
- A "Save As..." button (`vscode.Command`) is still added to chat responses for `/simpleUML`, `/relationUML`, and `/sequence` in `src/simple.ts`, triggering the `diagram.saveAs` command for saving `.mmd` or `.md` formats.

## Testing Infrastructure

- **Framework:** Mocha is used as the test runner.
- **VS Code Integration:** Tests are run within a dedicated VS Code instance using `@vscode/test-electron` to ensure the `vscode` API is available.
- **Configuration:**
    - `tsconfig.json` is configured to compile both `src` and `test` files.
    - `package.json` includes a `test` script (`npm test`) that compiles the code and invokes the test runner (`node ./out/test/runTest.js`).
    - Helper scripts `test/runTest.ts` (main runner) and `test/suite/index.ts` (Mocha entry point) manage the test execution process.
- **Fixtures:**
    - A Java Spring Boot project exists in `test/fixtures/java-spring-test-project` containing `pom.xml` and several controller files (`TestController.java`, `UserController.java`, etc.) with a range of REST endpoint annotations.
    - An inventory of these fixtures against the specific test cases outlined in `docs/next_steps.md` has been completed, identifying good coverage but requiring one additional test case for "no relevant annotations found".
- **Current Status:** Basic test infrastructure is set up. Fixture inventory is complete (pending one addition). The E2E test file (`test/suite/e2e/e2e.test.ts`) exists, but the specific tests needed to investigate LSP behavior for endpoint discovery are pending implementation.
- **Unit Test Refactoring (In Progress):** Work is underway to remove direct `vscode` API dependencies from unit tests (scope: `test/suite/*.test.ts`, excluding E2E) to improve robustness and maintainability. This involves introducing adapters/abstractions.
    - **Progress:**
        - `test/suite/call-hierarchy.test.ts`:
            - Abstracted `vscode.commands.executeCommand` via `ICommandExecutor` (`src/adapters/vscodeExecution.ts`).
            - Abstracted `vscode.SymbolKind` via `VSCodeSymbolKind` enum (`src/adapters/vscodeTypes.ts`).
- **Debugging LSP Interactions:** The E2E tests (`test/suite/e2e/e2e.test.ts`) are intended for debugging interactions with the Java Language Server. By running the tests (`npm test`), you can observe the console output, which logs the requests made to the LSP (e.g., `vscode.executeWorkspaceSymbolProvider`) and the responses received. This helps verify if the LSP is running correctly and providing the expected symbols. For example, successful symbol discovery looks like this:

  ```
  Executing vscode.executeWorkspaceSymbolProvider for "TestController"...

  --- Found Symbols ---
  [
    {
      "name": "TestController",
      "kind": "Class",
      "location": {
        "uri": {
          "$mid": 1,
          "path": "/Users/farleyknight/Projects/dive-vscode-extension/test-fixtures/e2e-java-project/src/main/java/com/example/demo/DemoApplication.java",
          "scheme": "file"
        },
        "range": [
          {
            "line": 17,
            "character": 6
          },
          {
            "line": 17,
            "character": 20
          }
        ]
      },
      "containerName": "com.example.demo"
    }
  ]
  ---------------------

  Executing vscode.executeDocumentSymbolProvider...

  --- Found Document Symbols ---
  [
    {
      "name": "TestController",
      "kind": "Class",
      "location": {
        "uri": {
          "$mid": 1,
          "fsPath": "/Users/farleyknight/Projects/dive-vscode-extension/test-fixtures/e2e-java-project/src/main/java/com/example/demo/DemoApplication.java",
          "external": "file:///Users/farleyknight/Projects/dive-vscode-extension/test-fixtures/e2e-java-project/src/main/java/com/example/demo/DemoApplication.java",
          "path": "/Users/farleyknight/Projects/dive-vscode-extension/test-fixtures/e2e-java-project/src/main/java/com/example/demo/DemoApplication.java",
          "scheme": "file"
        },
        "range": [
          {
            "line": 16,
            "character": 0
          },
          {
            "line": 23,
            "character": 1
          }
        ]
      },
      "containerName": ""
    }
  ]
  ---------------------------
  ```

## Dependencies

- `mermaid` npm package.
- VS Code Webview API.
- VS Code Language Model API (for tools and chat participants).

## Documentation

- `README.md` updated for diagram focus.
- `docs/current_state.md` and `docs/next_steps.md` maintained.

## Key Features & Commands

*   **Chat Participant:** `@diagram`
*   **Language Model Integration:** Uses `vscode.lm` API (specifically tested with Copilot models like GPT-3.5 Turbo) for generating diagram syntax based on code or natural language prompts.
*   **Mermaid Rendering:** Renders generated Mermaid syntax into diagrams within VS Code `WebviewPanel`s.
*   **Code Analysis for Diagrams:**
    *   `/simpleUML`: Analyzes the current file/selection and generates a basic UML diagram (class or sequence, LLM decides).
    *   `/relationUML`: Prompts LLM for a diagram showing object relationships from current file content.
    *   (Implicitly) Can analyze selected code via context variables.
*   **Direct Diagram Generation:**
    *   `/sequence`: Generate a sequence diagram from the current file's code analysis.
    *   `/restEndpoint`: Generate a sequence diagram for a specified Java Spring Boot REST endpoint (implementation in progress, not yet functional).
*   **Webview Interaction:**
    *   Theme selection dropdown in the webview panel.
    *   "Export SVG" and "Export PNG" buttons in the webview panel trigger direct browser downloads.
*   **Diagram Export:**
    *   `diagram.saveAs` command allows exporting diagrams as Mermaid syntax (`.mmd`) or Markdown (`.md`).
    *   SVG/PNG export is handled via buttons directly in the webview.
*   **Language Model Tools:**
    *   `dive_getCodeContext`: Retrieves code from the active editor (used implicitly by commands like `/simpleUML`).
    *   `dive_renderDiagram`: Renders provided Mermaid syntax.
*   **Basic Telemetry:** Logs usage and errors using `