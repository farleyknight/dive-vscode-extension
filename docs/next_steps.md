# Project Status & Next Steps

This document tracks the ongoing development goals, completed tasks, and immediate next steps for the VS Code extension.

## Current Focus: `/restEndpoint` Diagram Generation

*   **Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Immediate Next Steps:**

*   **Consolidate Test Directories (Highest Priority):**
    1.  **Analyze Differences:** Compare `src/test` vs `test/` contents (`runTest.ts`, `suite/index.ts`, `test/suite/e2e/index.ts` *if created*). Identify necessary logic in `src/test`.
    2.  **Consolidate Logic:** Merge required test logic/config from `src/test` into `test/` (specifically `test/suite/index.ts`, `test/runTest.ts`, potentially `test/suite/e2e/index.ts`).
    3.  **Update Configuration:** Modify `package.json` test scripts to use `test/runTest.ts`. Remove `"src/test/**/*.ts"` from `tsconfig.json` includes.
    4.  **Verify E2E/Unit Tests:** Run all tests via `test/runTest.ts` and confirm they pass.
    5.  **Delete Redundant Directory:** Delete the `src/test` directory.
    6.  **Update Documentation:** Ensure `docs/testing_infrastructure.md` is accurate.

*   **Endpoint Discovery & Implementation (TDD-style):**
    0.  **Inventory Existing Fixtures & Covered Cases:** *(Completed)*
        *   Review existing Java files in `test/fixtures/java-spring-test-project`.
        *   Compare against the "Test Categories & Cases" list.
        *   Document covered/missing cases. *(Conclusion: All listed cases covered except "no annotations found" edge case test).*
    1.  **Setup/Expand Endpoint Test Fixtures:** *(Mostly Done - Minor Pending)*
        *   Add/modify Java files/annotations in `test/fixtures/java-spring-test-project` as needed. *(Note: Only the "no annotations found" edge case test is pending; fixtures seem sufficient for now).*
    2.  **Implement E2E Test for LSP Capabilities (Investigation):** *(Not Started)*
        *   Create `test/suite/e2e/index.ts`.
        *   Write E2E tests targeting fixtures (ensure Java LSP is active).
        *   Use `vscode.executeWorkspaceSymbolProvider` (and potentially others) to query for symbols related to REST annotations.
        *   **Log the detailed results** returned by LSP calls to understand available metadata *before* refining `discoverEndpoints`.
    3.  **Refine/Implement `discoverEndpoints` using LSP (Implementation):** *(Started - Partial Implementation Exists)*
        *   Based *directly* on the findings from the E2E investigation (Step 2), refine or complete the implementation in `src/endpoint-discovery.ts#discoverEndpoints`.
        *   *Current implementation uses workspace symbols and basic text parsing; needs verification/refinement based on Step 2 logs.*
        *   Use identified LSP command(s) via `vscode.commands.executeCommand`.
        *   Parse the *actual metadata structure observed in the E2E logs* to extract essential endpoint details.
        *   Return a list of `EndpointInfo` objects.
    4.  **Unit Test `discoverEndpoints` (Test):** *(Started - Initial Test Exists)*
        *   In `test/suite/endpoint-discovery.test.ts`, write/expand comprehensive unit tests for `discoverEndpoints`.
        *   *One initial test mocking LSP calls exists.*
        *   **Mock** `vscode.commands.executeCommand` calls. Mocked responses should *precisely mirror the actual LSP metadata structure and content* logged during the E2E investigation (Step 2).
        *   Ensure test cases cover annotations and path variations, verifying parsing logic against the mocked LSP data.
    5.  **Verify `discoverEndpoints` with E2E Tests (Verify):** *(Pending Step 2 & 3)*
        *   Enhance/Create E2E tests (from Step 2). Call the *actual* `discoverEndpoints` function within the E2E test environment.
        *   Add **assertions** to verify `discoverEndpoints` returns the correct `EndpointInfo` list matching fixtures.
    6.  **Implement Endpoint Disambiguation (`src/endpoint-discovery.ts`):** *(Not Started - Stub Exists)*
        *   Implement the `disambiguateEndpoint` function.
        *   Develop logic to match user query against discovered endpoints.
        *   Implement user interaction flow for multiple matches.
    7.  **Integrate Java LSP Call Hierarchy:** *(Pending Previous Steps)*
        *   Investigate and identify VS Code command(s) for fetching call hierarchies.
        *   Implement logic to invoke the call hierarchy provider.
        *   Recursively fetch *outgoing* calls.

---

## Feature Backlog & Goals

### Goal: `/restEndpoint` Diagram Generation (Detailed Steps)

*   **Overall Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Status & Remaining Steps:**

1.  **Command Setup (`/restEndpoint`):** *(Completed - See Completed Tasks)*
2.  **Endpoint Discovery and Disambiguation:** *(In Progress - See Immediate Next Steps - Implementation Started, E2E Investigation Pending)*
    *   Refine/Implement `discoverEndpoints` logic in `src/endpoint-discovery.ts`. *(Initial implementation exists)*
    *   Implement `disambiguateEndpoint` logic in `src/endpoint-discovery.ts`. *(Stub exists)*
    *   Add comprehensive unit tests in `test/suite/endpoint-discovery.test.ts`. *(Initial test exists)*
    *   Create E2E tests in `test/suite/e2e/index.ts` to investigate LSP behavior. *(Not started)*
3.  **Java LSP Call Hierarchy Integration:** *(Next - Depends on Step 2)*
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
*   **Status:** Initial function implementation and one unit test exist. E2E investigation for LSP behavior and comprehensive testing are **pending**.
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
*   **Status:** Basic structure exists (`test/runTest.ts`, `test/fixtures/java-spring-test-project`), but the core E2E test file (`test/suite/e2e/index.ts`) and specific LSP interaction tests are **pending creation**.
*   **Remaining Steps:**
    *   Verify/Configure `test/runTest.ts` to reliably launch with the Java extension installed.
    *   **Create and implement tests in `test/suite/e2e/index.ts`** that:
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
*   **Status:** **Requires creation of `test/suite/e2e/index.ts` and implementation of LSP query tests.**

**Next Steps:**

1.  **Configure Test Runner (`@vscode/test-electron`):**
    *   Locate or create `src/test/runTest.ts`.
    *   Configure it to launch VS Code with a dedicated test workspace.
    *   Ensure it can specify extensions to install (e.g., a Java LSP extension).
2.  **Create E2E Test Workspace:**
    *   Create a directory (e.g., `test-fixtures/e2e-java-project`) containing a minimal Java Spring Boot project.
    *   Include Java files with annotations relevant to endpoint discovery.
3.  **Create E2E Test Suite:**
    *   Add a new test file (`test/suite/e2e/index.ts`) using Mocha.
4.  **Implement LSP Interaction Tests (Primary Goal):**
    *   Write tests within `test/suite/e2e/index.ts` that:
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

1.  **Create and Add Specific E2E LSP Queries:** Create `test/suite/e2e/index.ts` and implement tests that query the Java LSP for Spring Boot annotations/symbols. Log results to inform `discoverEndpoints` implementation.

---

## New Feature: `/restEndpoint` Diagram Generation

*   **Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Next Steps:**

2.  **Endpoint Discovery and Disambiguation:**
    *   **Discover All Endpoints:** Refine/Implement logic (in `src/endpoint-discovery.ts` function `discoverEndpoints`) to find *all* Spring Boot REST endpoints using the Java Language Support extension. *(Initial implementation exists)*.
        *   **Primary Approach: LSP-based:** Use `vscode.commands.executeCommand` with relevant commands provided by the Java extension. This likely involves symbol providers and potentially other calls (hovers, etc.). **Requires investigation via E2E tests (see below) to confirm exact commands and metadata structure.**
        *   Create a structured list of found endpoints, including method, path, and source location (URI and position). Example: `[{ method: 'POST', path: '/api/users', uri: vscode.Uri, position: vscode.Position, handlerMethodName: 'createUser', description: 'Creates a new user' /* Optional: extracted from Javadoc/comments */ }, ...] `.
        *   **Identify Target Endpoint:** Use the `naturalLanguageQuery` from step 1 to identify the most likely target endpoint from the discovered list. This may involve:
            *   Simple keyword matching between the query and the endpoint paths/methods/descriptions.
            *   Potentially using an LLM (via a dedicated tool or API call) to perform semantic matching between the user's query and the list of available endpoints, asking it to return the best match(es).
            *   If multiple potential matches are found or the confidence is low, interact with the user.
        *   Once a single endpoint is confidently identified, store its `vscode.Uri` and `vscode.Position`.
        *   **Testing:**
            *   **(Crucial First Step):** Create E2E tests (`test/suite/e2e/index.ts`) that execute LSP commands (`executeWorkspaceSymbolProvider`, etc.) against the fixtures and **log the raw results**. This is needed to understand what data the LSP *actually* provides before refining the `discoverEndpoints` implementation.
            *   Write/expand unit tests (`test/suite/endpoint-discovery.test.ts`) for endpoint discovery logic, **mocking LSP responses based on the findings from the E2E logs**.
            *   Unit test the disambiguation logic.
            *   Manually test against a real Spring Boot project.
    3.  **Java LSP Call Hierarchy Integration:**
        *   Identify the correct VS Code command provided by the installed Java extension for fetching call hierarchies (e.g., `vscode.prepareCallHierarchy`, `java.showCallHierarchy`, followed by `vscode.provideOutgoingCalls`). This might require checking the Java extension's contributions.
        *   Use `vscode.commands.executeCommand` to invoke the call hierarchy provider with the specific URI and position identified in step 2.
        *   Recursively fetch *outgoing* calls.
        *   **Testing:** Unit test the recursive call fetching by mocking `vscode.commands.executeCommand`. Manually test against a real Spring Boot project.

4.  **Sequence Diagram Generation:**
    *   Create a function that traverses the call hierarchy data structure generated in step 3.
    *   Translate the call flow (classes/methods calling other methods) into a Mermaid `sequenceDiagram` syntax.
    *   Add unit tests for the generation logic.