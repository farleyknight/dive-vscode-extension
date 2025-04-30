# Current State

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
*   **Webview Interaction:**
    *   Theme selection dropdown in the webview panel.
    *   "Export SVG" and "Export PNG" buttons in the webview panel trigger direct browser downloads.
*   **Diagram Export:**
    *   `diagram.saveAs` command allows exporting diagrams as Mermaid syntax (`.mmd`) or Markdown (`.md`).
    *   SVG/PNG export is handled via buttons directly in the webview.
*   **Language Model Tools:**
    *   `dive_getCodeContext`: Retrieves code from the active editor (used implicitly by commands like `/simpleUML`).
    *   `dive_renderDiagram`: Renders provided Mermaid syntax.
*   **Basic Telemetry:** Logs usage and errors using `vscode.TelemetryLogger`.

## Implementation Details

*   **Main Participant Logic:** Primarily in `src/simple.ts` (`registerSimpleParticipant`).
*   **Command Handling:** Uses a central handler that routes requests based on `request.command` to specific async functions (e.g., `handleSimpleUML`, `handleRelationUML`, `handleSequenceDiagram`).
*   **Webview Creation:** Uses a shared helper `createAndShowDiagramWebview` in `src/simple.ts` for `/simpleUML`, `/relationUML`, and `/sequence`.
*   **Webview HTML:** Generated by `getMermaidWebviewHtml` in `src/views/mermaid-webview-template.ts` (includes client-side export JS).
*   **Mermaid CLI Integration:** Removed. SVG/PNG export is client-side.
*   **Syntax Validation:** Uses `validateMermaidSyntax` helper in `src/simple.ts` which leverages JSDOM and the Mermaid library itself in a Node.js context.
*   **Tool Implementation:** Handlers are in `src/tool-handlers.ts`, registration in `src/diagram-tools.ts`.

## Notable Points & Potential Issues

*   `/simpleUML`, `/relationUML`, `/sequence` **do not** use the `renderDiagram` tool for rendering; they handle it directly via `createAndShowDiagramWebview`.
*   Error handling is implemented, including specific catches for LLM errors, stream errors, validation errors, and export errors.
*   Key commands: `/simpleUML`, `/relationUML`, `/sequence`.
*   The `lm` and `codeContext` are now fetched in the main handler and passed down via `CommandHandlerParams`.
*   `/simpleUML` and `/relationUML` include prompts for the LLM to automatically detect appropriate diagram types based on code analysis.
*   JSDOM/DOMPurify are used server-side for syntax validation (`validateMermaidSyntax`). This adds dependencies.
*   Webview communication (`postMessage`, `onDidReceiveMessage`) handles theme changes. Export is now handled fully client-side.
*   The "Save As..." button (`vscode.Command`) is added to chat responses for `/simpleUML`, `/relationUML`, and `/sequence`, triggering the `diagram.saveAs` command (for `.mmd`/`.md` save).

---