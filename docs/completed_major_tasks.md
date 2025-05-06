# Completed Major Tasks

This document lists significant milestones and completed investigation tasks.

## Refactor `discoverEndpoints` for Clarity and Testability *(Completed)*

*   **Goal:** Break down the complex `discoverEndpoints` function (`src/endpoint-discovery.ts`) into smaller, focused, and independently testable helper functions.
*   **Outcome:** `discoverEndpoints` now orchestrates calls to helper functions like `processJavaFileForEndpoints`, `findControllerClasses`, `findEndpointsInClass`, with core parsing logic moved to `parseMappingAnnotations`, `getControllerDetailsFromClassAnnotationText`, `processMethodAnnotationsAndCreateEndpoints`, etc. This improved testability and maintainability, adhering to the decoupling principle.

## E2E Test Investigation for LSP Annotation Discovery *(Completed)*

*   **Goal:** Investigate LSP capabilities for endpoint discovery via E2E tests.
*   **Outcome:** Completed E2E investigation revealed limitations in standard LSP features for reliably providing annotation parameters (path, method). However, LSP *can* reliably locate class and method symbols. This led to the adoption of the **hybrid approach**: use LSP for symbol location and targeted text/regex parsing for annotation parameter extraction.
*   **Details:**
    *   Investigated: `@RestController`, `@Controller`, `@RequestMapping`, `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`.
    *   Used test file: `test/suite/e2e/e2e.test.ts`.
    *   Executed: `vscode.executeWorkspaceSymbolProvider`, `vscode.executeDocumentSymbolProvider`, `vscode.executeHoverProvider`, `vscode.commands.getCommands(true)`.

## Initial Setup and Recent Features

*(Recent major items moved from old next_steps.md)*

1.  **Consolidate Test Directories:** Merged `src/test` logic into `test/`.
2.  **Set Up Basic Unit/E2E Testing Infrastructure:** Created structure, fixtures, installed dependencies, configured scripts.
3.  **Command Setup (`/restEndpoint`):** Registered command, created handler `handleRestEndpoint`.
4.  **Implement Client-Side Diagram Export:** Replaced `mmdc` with client-side JS, added buttons.
5.  **Add Diagram Theme Dropdown:** Added selector and handling logic.
6.  **Add "Save Diagram" Button:** Implemented `diagram.saveAs` command.
7.  **Bug Fixes & Cleanup:** Fixed webview rendering, removed unused commands.
8.  **Tool Implementation:** Implemented `RenderDiagramTool`, `GenerateMermaidDiagramTool`.