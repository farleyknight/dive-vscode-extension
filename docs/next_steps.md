# Project Status & Next Steps

This document tracks the ongoing development goals, completed tasks, and immediate next steps for the VS Code extension.

## Current Focus: `/restEndpoint` Diagram Generation

*   **Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Immediate Next Steps:**

1.  **Setup Endpoint Test Fixtures (TDD Investigation - Part 1):**
    *   Expand `test/fixtures/java-spring-test-project` with more Java files and controller classes.
    *   Add diverse examples of Spring REST annotations (`@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`, `@RequestMapping` with various attributes, path variables, multiple paths, etc.) as outlined in the "Goal: Implement & Test Endpoint Discovery" section. Ensure fixtures cover cases needed for parsing paths and methods.
2.  **E2E Test LSP Capabilities (TDD Investigation - Part 2):**
    *   In `test/suite/e2e/index.ts`, write E2E tests targeting the new fixtures (ensure Java LSP is active).
    *   Use `vscode.executeWorkspaceSymbolProvider` (and potentially others like hover providers or document symbols if needed) to query for symbols related to the REST annotations added in Step 1.
    *   **Log the detailed results** (e.g., `SymbolInformation` structure, relevant properties) returned by the LSP calls. The goal is to understand precisely what metadata is available for each annotation type (e.g., can we get annotation arguments directly? class vs. method scope? position?).
3.  **Implement `discoverEndpoints` using LSP (TDD Implementation):**
    *   Based *directly* on the findings (available commands and metadata structure) from the E2E investigation (Step 2), implement the core logic in `src/endpoint-discovery.ts#discoverEndpoints`.
    *   Use the identified LSP command(s) via `vscode.commands.executeCommand`.
    *   Parse the *actual metadata structure observed in the E2E logs* to extract essential endpoint details: HTTP method, full path (considering class-level paths), source URI, and position.
    *   Return a list of `EndpointInfo` objects.
4.  **Unit Test `discoverEndpoints` (TDD Test):**
    *   In `test/suite/endpoint-discovery.test.ts`, write comprehensive unit tests for `discoverEndpoints`.
    *   **Mock** the `vscode.commands.executeCommand` calls. The mocked responses should *precisely mirror the actual LSP metadata structure and content* logged during the E2E investigation (Step 2).
    *   Ensure test cases cover the annotations and path variations added in Step 1, verifying the parsing logic against the mocked LSP data.
5.  **Verify `discoverEndpoints` with E2E Tests (TDD Verify):**
    *   Enhance the E2E tests from Step 2. Instead of (or in addition to) logging, call the *actual* `discoverEndpoints` function within the E2E test environment (after LSP activation).
    *   Add **assertions** to verify that `discoverEndpoints` returns the correct list of `EndpointInfo` objects, matching the endpoints defined in the fixtures from Step 1.
6.  **Implement Endpoint Disambiguation (`src/endpoint-discovery.ts`):** *(Depends on Step 5)*
    *   Implement the `disambiguateEndpoint` function.
    *   Develop logic (e.g., keyword matching) to match the user's natural language query against the list of discovered endpoints (`EndpointInfo[]` from `discoverEndpoints`).
    *   Implement a user interaction flow (e.g., using `stream.markdown` and potentially `vscode.QuickPick`) if multiple matches are found or confidence is low.
7.  **Integrate Java LSP Call Hierarchy:** *(Depends on Step 6)*
    *   Investigate and identify the correct VS Code command(s) provided by the Java extension for fetching call hierarchies (e.g., `vscode.prepareCallHierarchy`, `vscode.provideOutgoingCalls`, or Java-specific commands).
    *   Implement logic (likely in `src/simple.ts` or a new module) to invoke the call hierarchy provider using the URI/position of the disambiguated endpoint.
    *   Recursively fetch *outgoing* calls to build the call tree data structure. Handle cycles.

---

## Feature Backlog & Goals

### Goal: `/restEndpoint` Diagram Generation (Detailed Steps)

*   **Overall Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Status & Remaining Steps:**

1.  **Command Setup (`/restEndpoint`):** *(Completed - See Completed Tasks)*
2.  **Endpoint Discovery and Disambiguation:** *(In Progress - See Immediate Next Steps)*
    *   Implement `discoverEndpoints` logic in `src/endpoint-discovery.ts`.
    *   Implement `disambiguateEndpoint` logic in `src/endpoint-discovery.ts`.
    *   Add comprehensive unit tests in `test/suite/endpoint-discovery.test.ts`.
3.  **Java LSP Call Hierarchy Integration:** *(Next - See Immediate Next Steps)*
    *   Identify Java extension call hierarchy command(s).
    *   Implement logic to call the command(s) with the target endpoint's URI/position.
    *   Build the call hierarchy data structure recursively.
    *   Add unit tests mocking `vscode.commands.executeCommand`.
4.  **Sequence Diagram Generation:** *(Future)*
    *   Create a function to traverse the call hierarchy data structure.
    *   Translate the call flow into Mermaid `sequenceDiagram` syntax.
    *   Add unit tests for the generation logic.
5.  **Display Results:** *(Partially Done - Dependent)*
    *   Pass the generated Mermaid syntax to `createAndShowDiagramWebview`.
    *   Requires preceding steps to be functional.
6.  **User Feedback and Error Handling:** *(Partially Done - Requires Refinement)*
    *   Implement specific progress messages (`stream.progress`) for discovery, analysis, generation.
    *   Refine error handling (`stream.markdown`) for endpoint-not-found, LSP errors, etc.
7.  **Documentation:** *(Future)*
    *   Update `README.md` with usage instructions and prerequisites.

### Goal: Implement & Test Endpoint Discovery (`src/endpoint-discovery.ts`)

*   **Goal:** Implement the `discoverEndpoints` function and write comprehensive unit tests to ensure it correctly identifies Spring Boot REST endpoints using the Java LSP.
*   **Status:** Basic function structure and one test exist. Implementation and most tests are **pending**.
*   **Annotations to Support & Test:**
    *   `@RestController`, `@Controller` (with `@ResponseBody`)
    *   `@RequestMapping` (Class/Method, various attributes: `path`, `value`, `method`, `params`, `headers`, `consumes`, `produces`)
    *   `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`
    *   Parameter Annotations (verify they don't break discovery): `@PathVariable`, `@RequestParam`, `@RequestBody`
    *   Return Type: `ResponseEntity` (verify it doesn't break discovery)
*   **Strategy:** Use LSP via `vscode.commands.executeCommand` (e.g., `'vscode.executeWorkspaceSymbolProvider'`, hover, document symbols) mocking responses in tests. Use `test/fixtures/java-spring-test-project`.
*   **Test Categories & Cases (Ensure Fixtures & Tests Exist):**
    *   **Basic Discovery & HTTP Methods:** *(Partially Tested: `@GetMapping` with class `@RequestMapping`)*
        *   Find `@PostMapping` on a method in a `@RestController`. *(Test Needed)*
        *   Find `@PutMapping`. *(Test Needed)*
        *   Find `@DeleteMapping`. *(Test Needed)*
        *   Find `@PatchMapping`. *(Test Needed)*
        *   Find `@RequestMapping` with `method = RequestMethod.XXX`. *(Test Needed)*
        *   Handle `@RequestMapping` without specific method (TBD: 'ANY' or all methods). *(Test Needed)*
    *   **Path Variations:**
        *   Combine class and method level paths. *(Tested)*
        *   Handle path variables (`/users/{userId}`). *(Test Needed)*
        *   Handle multiple paths (`@GetMapping({"/a", "/b"})`). *(Fixture/Test Needed)*
        *   Handle root paths (`/`) and empty paths (`""`). *(Fixture/Test Needed)*
        *   Handle paths with/without leading/trailing slashes. *(Test Needed)*
    *   **Annotation Placement & Combinations:**
        *   Find endpoints in `@RestController` without class-level `@RequestMapping`. *(Fixture/Test Needed)*
        *   Find endpoints in `@Controller` using method-level `@ResponseBody`. *(Fixture/Test Needed)*
        *   Verify methods *without* mapping annotations are ignored. *(Test Needed)*
        *   Verify parameter annotations don't prevent discovery. *(Fixture/Test Needed)*
        *   Verify `ResponseEntity` return type doesn't prevent discovery. *(Fixture/Test Needed)*
    *   **Multiple Files/Controllers:**
        *   Discover endpoints spread across multiple files. *(Fixture/Test Needed)*
    *   **Edge Cases:**
        *   Handle no relevant annotations found (empty list). *(Test Needed)*

### Goal: Set Up End-to-End Testing Infrastructure

*   **Goal:** Set up an E2E testing environment that runs the extension within a real VS Code instance, interacting with a live Java Language Server, to test LSP interactions.
*   **Status:** Basic structure exists (`test/runTest.ts`, `test/suite/e2e/index.ts`, `test/fixtures/java-spring-test-project`). **Implementation of actual LSP tests is pending.**
*   **Remaining Steps:**
    *   Verify/Configure `test/runTest.ts` to reliably launch with the Java extension installed in the test instance.
    *   Implement tests in `test/suite/e2e/index.ts` that:
        *   Open Java files from `test/fixtures/java-spring-test-project`.
        *   Wait for LSP initialization.
        *   Execute Java LSP commands (e.g., `vscode.executeWorkspaceSymbolProvider` querying for `@RestController`).
        *   Log/Assert results.

---

## Completed Tasks

*(Moved less relevant items here, kept recent major ones)*

1.  **Set Up Basic Unit Testing Infrastructure:**
    *   Created `test/suite`, `test/fixtures`, `test/fixtures/java-spring-test-project`.
    *   Installed Mocha, `@vscode/test-electron`, etc.
    *   Configured `tsconfig.json`, `package.json` test script.
    *   Created `test/runTest.ts`, `test/suite/index.ts`, `test/suite/extension.test.ts`, `test/suite/endpoint-discovery.test.ts` (stub).
2.  **Command Setup (`/restEndpoint`):**
    *   Registered command, created handler `handleRestEndpoint` in `src/simple.ts`.
3.  **Implement Client-Side Diagram Export:**
    *   Replaced `mmdc` backend export with client-side JS in webview.
    *   Added "Export SVG/PNG" buttons. Removed `mermaid-cli` dependency.
4.  **Add Diagram Theme Dropdown:**
    *   Added theme selector to webview, updated JS to handle theme changes.
5.  **Add "Save Diagram" Button:**
    *   Implemented `diagram.saveAs` command and added button to relevant chat responses.
6.  **Bug Fixes & Cleanup:**
    *   Fixed webview rendering bug.
    *   Removed unused commands (`/randomTeach`, `/play`).
7.  **Tool Implementation:**
    *   Implemented `RenderDiagramTool`, `GenerateMermaidDiagramTool`.

---

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

1.  **Test Endpoint Discovery (`src/endpoint-discovery.ts`)**
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

## Goal: Add Specific E2E LSP Queries

*   **Goal:** Enhance `src/test/suite/e2e.test.ts` with tests that specifically query the Java LSP for Spring Boot REST annotations (`@GetMapping`, `@PostMapping`, etc.), controller classes (`@RestController`), and related objects (`ResponseEntity`) within the test workspace project.

**Next Steps:**

1.  **Add Specific E2E LSP Queries:** Enhance `src/test/suite/e2e.test.ts` with tests that specifically query the Java LSP for Spring Boot REST annotations (`@GetMapping`, `@PostMapping`, etc.), controller classes (`@RestController`), and related objects (`ResponseEntity`) within the test workspace project.

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