# Project Status & Next Steps

This document tracks the ongoing development goals, completed tasks, and immediate next steps for the VS Code extension.

## Current Focus: `/restEndpoint` Diagram Generation

*   **Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Immediate Next Steps:**

*   **Consolidate Test Directories (Highest Priority):**
    1.  **Analyze Differences:** Compare `src/test` vs `test/` contents (`runTest.ts`, `suite/index.ts`, `suite/e2e.*`). Identify necessary logic in `src/test`.
    2.  **Consolidate Logic:** Merge required test logic/config from `src/test` into `test/` (specifically `test/suite/e2e/index.ts` and `test/runTest.ts`).
    3.  **Update Configuration:** Modify `package.json` test scripts to use `test/runTest.ts`. Remove `"src/test/**/*.ts"` from `tsconfig.json` includes.
    4.  **Verify E2E Tests:** Run E2E tests via `test/runTest.ts` and confirm they pass.
    5.  **Delete Redundant Directory:** Delete the `src/test` directory.
    6.  **Update Documentation:** Ensure `docs/testing_infrastructure.md` is accurate.

0.  **Inventory Existing Fixtures & Covered Cases:** *(Completed)*
    *   Review existing Java files in `test/fixtures/java-spring-test-project` (`TestController.java`, `UserController.java`, `OrderController.java`, `ProductController.java`, `LegacyController.java`).
    *   Compare the existing endpoints against the detailed "Test Categories & Cases" list under the "Goal: Implement & Test Endpoint Discovery" section below.
    *   Document which specific test cases are already covered by the current fixtures and which require new fixtures or modifications. *(Conclusion: All listed cases are covered except the "no annotations found" edge case, which requires a test but not necessarily new fixtures yet).*
1.  **Setup/Expand Endpoint Test Fixtures (TDD Investigation - Part 1):** *(Next)*
    *   Based on the inventory (Step 0), add or modify Java files/annotations in `test/fixtures/java-spring-test-project` to cover the remaining test cases. *(Note: Only the "no annotations found" edge case test is pending, fixtures seem sufficient for now).*
    *   *(Added `UserController.java` initially, covering several cases like `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`, path vars, `@RequestMapping` variations).*\
2.  **E2E Test LSP Capabilities (TDD Investigation - Part 2):** *(Depends on Step 1)*
    *   In `test/suite/e2e/index.ts`, write E2E tests targeting the *updated* fixtures (ensure Java LSP is active).
    *   Use `vscode.executeWorkspaceSymbolProvider` (and potentially others like hover providers or document symbols if needed) to query for symbols related to the REST annotations.
    *   **Log the detailed results** (e.g., `SymbolInformation` structure, relevant properties) returned by the LSP calls. The goal is to understand precisely what metadata is available for each annotation type.
3.  **Implement `discoverEndpoints` using LSP (TDD Implementation):** *(Depends on Step 2)*
    *   Based *directly* on the findings (available commands and metadata structure) from the E2E investigation (Step 2), implement the core logic in `src/endpoint-discovery.ts#discoverEndpoints`.
    *   Use the identified LSP command(s) via `vscode.commands.executeCommand`.
    *   Parse the *actual metadata structure observed in the E2E logs* to extract essential endpoint details: HTTP method, full path, source URI, and position.
    *   Return a list of `EndpointInfo` objects.
4.  **Unit Test `discoverEndpoints` (TDD Test):** *(Depends on Step 3)*
    *   In `test/suite/endpoint-discovery.test.ts`, write comprehensive unit tests for `discoverEndpoints`.
    *   **Mock** the `vscode.commands.executeCommand` calls. The mocked responses should *precisely mirror the actual LSP metadata structure and content* logged during the E2E investigation (Step 2).
    *   Ensure test cases cover the annotations and path variations added in Step 1, verifying the parsing logic against the mocked LSP data.
5.  **Verify `discoverEndpoints` with E2E Tests (TDD Verify):** *(Depends on Step 4)*
    *   Enhance the E2E tests from Step 2. Instead of (or in addition to) logging, call the *actual* `discoverEndpoints` function within the E2E test environment (after LSP activation).
    *   Add **assertions** to verify that `discoverEndpoints` returns the correct list of `EndpointInfo` objects, matching the endpoints defined in the fixtures from Step 1.
6.  **Implement Endpoint Disambiguation (`src/endpoint-discovery.ts`):** *(Depends on Step 5)*
    *   Implement the `disambiguateEndpoint` function.
    *   Develop logic to match the user's natural language query against the list of discovered endpoints.
    *   Implement a user interaction flow if multiple matches are found.
7.  **Integrate Java LSP Call Hierarchy:** *(Depends on Step 6)*
    *   Investigate and identify the correct VS Code command(s) for fetching call hierarchies.
    *   Implement logic to invoke the call hierarchy provider.
    *   Recursively fetch *outgoing* calls to build the call tree data structure.

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
        *   **Basic Discovery & HTTP Methods:** *(All Covered)*
        *   Find `@PostMapping` on a method in a `@RestController`. *(Covered: TestController, UserController, OrderController)*
        *   Find `@PutMapping`. *(Covered: UserController, ProductController)*
        *   Find `@DeleteMapping`. *(Covered: UserController, ProductController)*
        *   Find `@PatchMapping`. *(Covered: UserController, ProductController)*
        *   Find `@RequestMapping` with `method = RequestMethod.XXX`. *(Covered: UserController, OrderController)*
        *   Handle `@RequestMapping` without specific method (TBD: 'ANY' or all methods). *(Covered: TestController, UserController)*
    *   **Path Variations:** *(All Covered)*
        *   Combine class and method level paths. *(Covered: TestController, UserController, ProductController)*
        *   Handle path variables (`/users/{userId}`). *(Covered: TestController, UserController, ProductController)*
        *   Handle multiple paths (`@GetMapping({"/a", "/b"})`). *(Covered: UserController, OrderController)*
        *   Handle root paths (`/`) and empty paths (`""`). *(Covered: UserController, OrderController)*
        *   Handle paths with/without leading/trailing slashes. *(Covered: Implicitly)*
    *   **Annotation Placement & Combinations:** *(All Covered)*
        *   Find endpoints in `@RestController` without class-level `@RequestMapping`. *(Covered: OrderController)*
        *   Find endpoints in `@Controller` using method-level `@ResponseBody`. *(Covered: LegacyController)*
        *   Verify methods *without* mapping annotations are ignored. *(Covered: UserController#helperMethod)*
        *   Verify parameter annotations don't prevent discovery. *(Covered: Multiple controllers)*
        *   Verify `ResponseEntity` return type doesn't prevent discovery. *(Covered: UserController, ProductController)*
    *   **Multiple Files/Controllers:** *(Covered)*
        *   Discover endpoints spread across multiple files. *(Covered: Have 5 controller files)*
    *   **Edge Cases:**
        *   Handle no relevant annotations found (empty list). *(Test Needed - Requires a test case, not necessarily a fixture change yet)*

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
    *   Translate the call flow (classes/methods calling other methods) into a Mermaid `