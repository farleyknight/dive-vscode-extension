## Goal: Set Up End-to-End Testing Infrastructure

*   **Goal:** Set up an end-to-end (E2E) testing environment that runs the extension within a real VS Code instance, interacting with a live Java Language Server, to test LSP interactions and observe LSP behavior.

**Next Steps:**

1.  **Configure Test Runner (`@vscode/test-electron`):**
    *   Locate or create `src/test/runTest.ts`.
    *   Configure it to launch VS Code with a dedicated test workspace.
    *   Ensure it can specify extensions to install (e.g., a Java LSP extension).
2.  **Create E2E Test Workspace:**
    *   Create a directory (e.g., `test-fixtures/e2e-java-project`) containing a minimal Java Spring Boot project.
    *   Include Java files with annotations relevant to endpoint discovery.
3.  **Create E2E Test Suite:**
    *   Add a new test file (e.g., `test/suite/e2e.test.ts`) using Mocha (or the existing framework).
4.  **Implement LSP Interaction Tests:**
    *   Write tests within the E2E suite that:
        *   Open Java files from the test workspace (`vscode.workspace.openTextDocument`, `vscode.window.showTextDocument`).
        *   **Wait for LSP Initialization:** Implement a reliable mechanism (e.g., checking LSP status, or using a sufficient delay initially).
        *   Execute Java LSP commands (`vscode.executeWorkspaceSymbolProvider`, `vscode.executeDocumentSymbolProvider`, etc.).
        *   Log LSP results for observation (`console.log`).
        *   (Future) Add assertions to verify LSP responses against expected outcomes.

## Goal: Set Up Unit Testing Infrastructure

*   **Goal:** Establish a unit testing framework (e.g., Mocha) and create initial test fixtures, including a simple Java Spring Boot project, to enable testing of features like endpoint discovery.

**Next Steps:**

1.  **Create Test Directory Structure:** Set up `test/suite` and `test/fixtures` directories.
2.  **Create Java Fixture Project:** Create a minimal Maven-based Spring Boot project in `test/fixtures/java-spring-test-project` with a basic controller containing various REST endpoint annotations (`@RestController`, `@GetMapping`, `@PostMapping`, path variables, etc.).
3.  **Install Testing Dependencies:** Add development dependencies for a testing framework like Mocha and its type definitions (`mocha`, `@types/mocha`, `@types/node`).
4.  **Configure Test Runner:** Configure `package.json` with a test script to run Mocha tests (e.g., `"test": "mocha"`). Set up necessary configuration for TypeScript tests (e.g., `tsconfig.json` for tests or using `ts-node`).
5.  **Write Initial Test:** Write a basic test case in `test/suite` (e.g., `endpoint-discovery.test.ts`) to verify the testing setup is working.
6.  **Test Endpoint Discovery (`src/endpoint-discovery.ts`)**
    *   **Goal:** Write comprehensive unit tests for the `discoverEndpoints` function. These tests will drive the implementation and ensure it correctly identifies Spring Boot REST endpoints under various conditions using a range of common annotations.
    *   **Annotations to Support & Test:**
        *   `@RestController`, `@Controller` (with `@ResponseBody`)
        *   `@RequestMapping` (Class/Method, various attributes: `path`, `value`, `method`, `params`, `headers`, `consumes`, `produces`)
        *   `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`
        *   Parameter Annotations (verify they don't break discovery): `@PathVariable`, `@RequestParam`, `@RequestBody`
        *   Return Type: `ResponseEntity` (verify it doesn't break discovery)
        *   (Future/Optional) Consider `@ExceptionHandler`, `@ControllerAdvice` if relevant to endpoint context later.
    *   **Strategy:** Use the Java fixture project (`test/fixtures/java-spring-test-project`). Tests will need to mock the underlying mechanism used for finding annotations. **We will prioritize using the Java Language Server Protocol (LSP) via `vscode.commands.executeCommand` calls (e.g., `vscode.executeWorkspaceSymbolProvider`, `vscode.executeDocumentSymbolProvider`, potentially others specific to the Java extension) to find symbols and their annotations.** Mocks will simulate the responses from these commands.
    *   **Test Categories & Cases (Ensure Fixtures Exist):**
        *   **Basic Discovery & HTTP Methods:**
            *   Find `@GetMapping` combined with class-level `@RequestMapping`.
            *   Find `@PostMapping` on a method in a `@RestController`.
            *   Find `@PutMapping` (Requires adding fixture).
            *   Find `@DeleteMapping` (Requires adding fixture).
            *   Find `@PatchMapping` (Requires adding fixture).
            *   Find `@RequestMapping` with `method = RequestMethod.XXX`.
            *   Handle `@RequestMapping` without specific method (TBD: 'ANY' or all methods).
        *   **Path Variations:**
            *   Combine class and method level paths (`@RequestMapping("/class")` + `@GetMapping("/method")` -> `/class/method`).
            *   Handle path variables correctly (`/users/{userId}`).
            *   Handle multiple paths in one annotation (`@GetMapping({"/a", "/b"})`). (Requires adding fixture).
            *   Handle root paths (`/`) and empty paths (`""`). (Requires adding fixture).
            *   Handle paths with/without leading/trailing slashes.
        *   **Annotation Placement & Combinations:**
            *   Find endpoints in `@RestController` without class-level `@RequestMapping`. (Requires adding fixture).
            *   Find endpoints in `@Controller` using method-level `@ResponseBody`. (Requires adding fixture).
            *   Verify methods *without* mapping annotations are ignored.
            *   Verify parameter annotations (`@PathVariable`, `@RequestParam`, `@RequestBody`) don't prevent discovery. (Requires adding fixture variations).
            *   Verify `ResponseEntity` return type doesn't prevent discovery. (Requires adding fixture variations).
        *   **Multiple Files/Controllers:**
            *   Discover endpoints spread across multiple `@RestController` classes/files. (Requires adding fixture).
        *   **Edge Cases:**
            *   Handle no relevant annotations found (empty list).
            *   (Optional) Handle unparseable Java files.
    *   **Iteration:** Acknowledge that more test cases or fixture modifications might be needed as implementation progresses.

---

## New Feature: `/restEndpoint` Diagram Generation

*   **Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Next Steps:**

2.  **Endpoint Discovery and Disambiguation:**
    *   **Discover All Endpoints:** Implement logic (in `src/endpoint-discovery.ts` function `discoverEndpoints`) to find *all* Spring Boot REST endpoints within the workspace using the installed Java Language Support extension.
        *   **Primary Approach: LSP-based:** Use `vscode.commands.executeCommand` with relevant commands provided by the Java extension. This will likely involve:
            *   Finding potential controller classes and endpoint methods using symbol providers (e.g., `'vscode.executeWorkspaceSymbolProvider'`, `'vscode.executeDocumentSymbolProvider'`). Query patterns might target annotations like `@RestController`, `@GetMapping`, etc., or broader searches filtered later.
            *   Extracting specific annotation details (like `path`, `value`, `method` attributes) from the found symbols. This might require additional LSP calls (e.g., requesting hover information, code actions, or custom commands provided by the Java extension) to get the necessary attribute values associated with the annotations.
        *   *(Manual parsing using `vscode.workspace.findFiles` and regex/parsers is discouraged due to complexity and fragility and should only be considered as a last resort if LSP proves insufficient.)*
    *   Create a structured list of found endpoints, including method, path, and source location (URI and position). Example: `[{ method: 'POST', path: '/api/users', uri: vscode.Uri, position: vscode.Position, handlerMethodName: 'createUser', description: 'Creates a new user' /* Optional: extracted from Javadoc/comments */ }, ...] `.
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

1.  **Set Up Unit Testing Infrastructure (Steps 1-5):**
    *   Created `test/suite` and `test/fixtures` directories.
    *   Created Java fixture project (`test/fixtures/java-spring-test-project`) with `pom.xml` and `TestController.java` containing various REST annotations.
    *   Installed Mocha, `@types/mocha`, `@types/node`, `glob`, `@types/glob`, `@vscode/test-electron`.
    *   Configured `tsconfig.json` to compile tests.
    *   Configured `package.json` test script (`npm test`) to use `@vscode/test-electron` runner.
    *   Created initial test runner scripts (`test/runTest.ts`, `test/suite/index.ts`) and a sample test file (`test/suite/extension.test.ts`).

2.  **Command Setup (`/restEndpoint`):**
    *   Update the chat participant handler in `src/simple.ts` to recognize the `/restEndpoint` command.
    *   Extract the natural language query provided by the user (e.g., "Give me details on the test API") as an argument to the command.
    *   Create a new handler function `handleRestEndpoint(params: CommandHandlerParams, naturalLanguageQuery: string)` in `src/simple.ts`.
    *   **Testing:** Manually invoke `@diagram /restEndpoint Show the user creation flow` in chat and verify the handler is called with the correct query string (via logging/debugger).

3.  **Implement Client-Side Diagram Export:**
    *   *Goal: Replace backend `mmdc`-based export with client-side `mermaid.min.js`.*
    *   Modified webview template (`src/views/mermaid-webview-template.ts`) to include "Export SVG" and "Export PNG" buttons.
    *   Added JavaScript logic to the webview for SVG export (`Blob`, `URL.createObjectURL`) and PNG export (`Canvas`, `Image`, `toBlob`).
    *   Removed SVG/PNG export logic using `@mermaid-js/mermaid-cli` from the `diagram.saveAs` command handler in `src/extension.ts`.
    *   Removed the `@mermaid-js/mermaid-cli` dependency from `package.json`.

4.  **Add a dropdown that can change the theme of the diagram.**
    *   Added a `<select>` dropdown to the webview HTML generated by `/simpleUML`, `/relationUML`, and the `RenderDiagramTool` (in `src/tool-handlers.ts`).
    *   Added JavaScript to handle dropdown changes, re-initializing/re-rendering the Mermaid diagram with the selected theme (`default`, `neutral`, `dark`, `forest`).
    *   Set `retainContextWhenHidden: true` for webviews to preserve theme selection.

5.  **Add a "Save Diagram" Button:**
    1.  **Declare Command:** Defined `diagram.saveAs` in `package.json`.
    2.  **Register Command:** Registered handler in `extension.ts` using `vscode.commands.registerCommand`, implementing save dialog and file writing.
    3.  **Create Button Command:** Created `vscode.Command` object in the `/fromCurrentFile` and `/showConnections` handlers in `src/simple.ts`.
    4.  **Add Button to Stream:** Called `stream.button()` in the `/fromCurrentFile` and `/showConnections` handlers to display the button.

6.  **Bug Fixes:**
    *   Fixed webview panel rendering regression in `RenderDiagramTool`

7.  **Command Structure Cleanup:**
    *   Removed `/randomTeach` endpoint
    *   Removed `/play` endpoint
    *   Simplified command structure to focus on diagram-related functionality

8.  **Tool Implementation:**
    *   Implemented proper tool classes with