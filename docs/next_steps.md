# Project Status & Next Steps

This document tracks the ongoing development goals, completed tasks, and immediate next steps for the VS Code extension.

## Immediate Next Task: Create E2E Test for LSP Annotation Discovery

*   **Goal:** Create an End-to-End (E2E) test that uses the Java Language Server Protocol (LSP) to discover all specified Spring Boot REST annotations within a test fixture file.
*   **Why:** This is a **crucial first step** before refining `discoverEndpoints`. We need to execute LSP commands (e.g., `vscode.executeWorkspaceSymbolProvider`, `vscode.executeDocumentSymbolProvider`, potentially hover/definition providers) against the Java fixtures (`test/fixtures/java-spring-test-project`) and **log the raw results**. Understanding the *exact* structure and content of the LSP responses for REST annotations is essential for parsing them correctly.
*   **Target Test File:** Implement the test in `test/suite/e2e/index.ts` (or create a dedicated `test/suite/e2e/annotation-discovery.test.ts`).
*   **Annotations to Discover:**
    *   `@RestController`
    *   `@Controller` (including verification of `@ResponseBody` presence if needed)
    *   `@RequestMapping` (class and method level)
    *   `@GetMapping`
    *   `@PostMapping`
    *   `@PutMapping`
    *   `@DeleteMapping`
    *   `@PatchMapping`
*   **Fixture Verification:** *(Completed)* The existing fixtures in `test/fixtures/java-spring-test-project/src/main/java/com/example/testfixture/` contain examples of all the required annotations. No fixture modification is needed for *this* specific test.
*   **Test Steps:**
    1.  Configure `test/runTest.ts` to reliably launch with the Java extension installed and activated.
    2.  Write test setup to open a relevant Java controller file from the fixtures (e.g., `UserController.java`).
    3.  Wait for the Java LSP to initialize and be ready.
    4.  Execute relevant VS Code commands that trigger Java LSP providers (e.g., `vscode.executeWorkspaceSymbolProvider`, `vscode.executeDocumentSymbolProvider` looking for symbols related to annotations or methods). Experiment to find the most effective command(s).
    5.  **Log the full, raw JSON response** returned by the LSP commands. Assertion is secondary; the primary goal is data gathering.
*   **Status:** E2E test structure exists (`test/runTest.ts`, fixtures), but the specific LSP interaction test logic is **pending creation**.

---

## `/restEndpoint` Feature: Overall Goal & Remaining Steps

*   **Overall Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Remaining Steps (Post-E2E Investigation):**

1.  **Endpoint Discovery and Disambiguation (`src/endpoint-discovery.ts`):** *(Partially Implemented - Blocked by E2E)*
    *   **Refine `discoverEndpoints`:** Use the insights gained from the E2E LSP annotation discovery test to accurately parse LSP responses and identify all REST endpoints. Create a structured list: `[{ method: string, path: string, uri: vscode.Uri, position: vscode.Position, handlerMethodName: string, description?: string }, ...]`.
    *   **Implement `disambiguateEndpoint`:** Match the user's natural language query against the discovered endpoints. Handle multiple matches or ambiguity, potentially prompting the user.
    *   **Unit Tests (`test/suite/endpoint-discovery.test.ts`):** Expand unit tests, mocking LSP responses *precisely* based on E2E findings. Cover all annotation types and path variations. Add test for "no relevant annotations found".
2.  **Java LSP Call Hierarchy Integration:** *(Not Started)*
    *   Identify Java extension call hierarchy command(s) (e.g., `vscode.prepareCallHierarchy`, `vscode.provideOutgoingCalls`).
    *   Implement logic to invoke the command(s) with the selected endpoint's URI/position.
    *   Build the call hierarchy data structure recursively (outgoing calls).
    *   Add unit tests mocking `vscode.commands.executeCommand`.
3.  **Sequence Diagram Generation:** *(Not Started)*
    *   Create a function to traverse the call hierarchy data.
    *   Translate the call flow into Mermaid `sequenceDiagram` syntax.
    *   Add unit tests for the generation logic.
4.  **Display Results:** *(Partially Done - Dependent)*
    *   Pass the generated Mermaid syntax to `createAndShowDiagramWebview`.
5.  **User Feedback and Error Handling:** *(Partially Done - Requires Refinement)*
    *   Implement specific progress messages (`stream.progress`).
    *   Refine error handling (`stream.markdown`).
6.  **Documentation:** *(Future)*
    *   Update `README.md` and potentially `docs/testing_infrastructure.md`.

---

## Completed Tasks

*(Recent major items)*

1.  **Consolidate Test Directories:** Merged `src/test` logic into `test/`.
2.  **Set Up Basic Unit/E2E Testing Infrastructure:** Created structure, fixtures, installed dependencies, configured scripts.
3.  **Command Setup (`/restEndpoint`):** Registered command, created handler `handleRestEndpoint`.
4.  **Implement Client-Side Diagram Export:** Replaced `mmdc` with client-side JS, added buttons.
5.  **Add Diagram Theme Dropdown:** Added selector and handling logic.
6.  **Add "Save Diagram" Button:** Implemented `diagram.saveAs` command.
7.  **Bug Fixes & Cleanup:** Fixed webview rendering, removed unused commands.
8.  **Tool Implementation:** Implemented `RenderDiagramTool`, `GenerateMermaidDiagramTool`.

---

## Current Focus: `/restEndpoint` Diagram Generation

*   **Overall Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Status & Remaining Steps:**

1.  **Command Setup (`/restEndpoint`):** *(Completed - See Completed Tasks)*
2.  **Endpoint Discovery and Disambiguation (`src/endpoint-discovery.ts`):** *(In Progress)*
    *   **Goal:** Implement/refine `discoverEndpoints` and `disambiguateEndpoint` to find and select Spring Boot REST endpoints using the Java LSP.
    *   **Status:**
        *   `discoverEndpoints`: *(Started - Partial Implementation Exists, needs refinement based on E2E LSP investigation)* - Current logic uses workspace symbols and basic text parsing.
        *   `disambiguateEndpoint`: *(Not Started - Stub Exists)*
        *   Unit Tests (`test/suite/endpoint-discovery.test.ts`): *(Started - Initial Test Exists, needs expansion)* - Requires mocking LSP responses based on E2E findings.
        *   E2E Tests (`test/suite/e2e/e2e.test.ts`): *(Started - File Exists, Implementation Pending)* - Needs tests to execute LSP commands (e.g., `vscode.executeWorkspaceSymbolProvider`) against fixtures and log results to inform `discoverEndpoints`.
    *   **Approach:**
        *   Use E2E tests (`e2e.test.ts`) to investigate Java LSP capabilities (`executeWorkspaceSymbolProvider`, `executeDocumentSymbolProvider`, etc.) and log the exact metadata returned for REST annotations/symbols in the fixtures (`test/fixtures/java-spring-test-project`).
        *   Refine `discoverEndpoints` based *directly* on E2E findings to parse the actual LSP response structure.
        *   Implement `disambiguateEndpoint` logic for matching user query and handling multiple matches.
        *   Expand unit tests (`endpoint-discovery.test.ts`) using mocks that *precisely mirror* the LSP data structure observed in E2E logs.
    *   **Test Fixtures & Coverage (`test/fixtures/java-spring-test-project`):**
        *   *(Inventory Completed)* Fixtures cover most cases for annotations (`@RestController`, `@GetMapping`, etc.) and path variations.
        *   *(Pending)* Add test case for "no relevant annotations found" edge case.
    *   **Annotations to Support:** `@RestController`, `@Controller` (+`@ResponseBody`), `@RequestMapping`, `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`. (Verify parameter/return type annotations don't break discovery).
3.  **Java LSP Call Hierarchy Integration:** *(Next - Depends on Step 2)*
    *   Identify Java extension call hierarchy command(s) (e.g., `vscode.prepareCallHierarchy`, `vscode.provideOutgoingCalls`).
    *   Implement logic to call the command(s) with the target endpoint's URI/position.
    *   Build the call hierarchy data structure recursively (outgoing calls).
    *   Add unit tests mocking `vscode.commands.executeCommand`.
4.  **Sequence Diagram Generation:** *(Future)*
    *   Create a function to traverse the call hierarchy data structure.
    *   Translate the call flow into Mermaid `sequenceDiagram` syntax.
    *   Add unit tests for the generation logic.
5.  **Display Results:** *(Partially Done - Dependent)*
    *   Pass the generated Mermaid syntax to `createAndShowDiagramWebview`.
6.  **User Feedback and Error Handling:** *(Partially Done - Requires Refinement)*
    *   Implement specific progress messages (`stream.progress`) for discovery, analysis, generation.
    *   Refine error handling (`stream.markdown`) for endpoint-not-found, LSP errors, etc.
7.  **Documentation:** *(Future)*
    *   Update `README.md` with usage instructions and prerequisites.
    *   Update `docs/testing_infrastructure.md` (if necessary, regarding E2E setup).

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