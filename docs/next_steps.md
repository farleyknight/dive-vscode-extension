# Project Status & Next Steps

This document tracks the ongoing development goals, completed tasks, and immediate next steps for the VS Code extension.

## Immediate Next Task: ~~Create E2E Test for LSP Annotation Discovery~~ *(Completed)*

*   **Goal:** ~~Create an End-to-End (E2E) test that uses the Java Language Server Protocol (LSP) to discover all specified Spring Boot REST annotations within a test fixture file.~~ **Investigate LSP capabilities for endpoint discovery via E2E tests.**
*   **Why:** ~~This is a **crucial first step** before refining `discoverEndpoints`. We need to execute LSP commands (e.g., `vscode.executeWorkspaceSymbolProvider`, `vscode.executeDocumentSymbolProvider`, potentially hover/definition providers) against the Java fixtures (`test/fixtures/java-spring-test-project`) and **log the raw results**. Understanding the *exact* structure and content of the LSP responses for REST annotations is essential for parsing them correctly.~~ **Completed E2E investigation revealed limitations.** Standard LSP features (`workspaceSymbol`, `documentSymbol`, `hover`) and available custom commands **do not reliably provide annotation parameters** (e.g., path, method). However, LSP *can* reliably locate class and method symbols.
*   **Outcome:** The optimal strategy is a **hybrid approach**: Use LSP (e.g., `documentSymbolProvider`) to find controller classes and handler methods (getting accurate URI/position/name), then use targeted text/regex parsing on the source code lines preceding these symbols to extract annotation parameters. This leverages LSP for robust location finding while using regex for the specific parameter details the LSP couldn't provide.
*   **Target Test File:** `test/suite/e2e/e2e.test.ts` was used for investigation.
*   **Annotations Investigated:**
    *   `@RestController`
    *   `@Controller` (including verification of `@ResponseBody` presence if needed)
    *   `@RequestMapping` (class and method level)
    *   `@GetMapping`
    *   `@PostMapping`
    *   `@PutMapping`
    *   `@DeleteMapping`
    *   `@PatchMapping`
*   **Fixture Verification:** *(Completed)* Fixtures are adequate.
*   **Test Steps:** *(Completed)*
    1.  Configured `test/runTest.ts`.
    2.  Opened Java controller files.
    3.  Waited for LSP.
    4.  Executed `vscode.executeWorkspaceSymbolProvider`, `vscode.executeDocumentSymbolProvider`, `vscode.executeHoverProvider`, and `vscode.commands.getCommands(true)`.
    5.  Logged results, analyzed limitations.
*   **Status:** E2E investigation **completed**. Ready to implement `discoverEndpoints` using the hybrid approach. **The immediate next step is implementing this logic, focusing first on comprehensive *unit testing* of the annotation text/regex parsing.**

---

## `/restEndpoint` Feature: Overall Goal & Remaining Steps

*   **Overall Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Immediate Next Task (Step 1): Implement Hybrid Endpoint Discovery & Unit Test Parsing**

1.  **Endpoint Discovery and Disambiguation (`src/endpoint-discovery.ts`):** *(Partially Implemented - Strategy Defined)*
    *   **Implement `discoverEndpoints` (Hybrid Approach):**
        *   Use LSP (e.g., `documentSymbolProvider` or `workspaceSymbolProvider`) to find candidate controller classes and handler methods within the workspace.
        *   For each identified symbol (class/method), get its accurate `vscode.Uri` and `vscode.Range`/`vscode.Position`.
        *   Read the text content of the relevant source file lines preceding the symbol's location.
        *   Use **text/regex parsing** (e.g., in a dedicated helper function like `parseMappingAnnotations`) on these lines to identify Spring mapping annotations (`@RequestMapping`, `@GetMapping`, etc.) and **extract their parameters** (path, value, method).
        *   Combine class-level and method-level paths. Determine the HTTP method.
        *   Create the structured list: `[{ method: string, path: string, uri: vscode.Uri, position: vscode.Position, handlerMethodName: string, description?: string }, ...]`.
    *   **Implement `disambiguateEndpoint`:** Match the user's natural language query against the discovered endpoints. Handle ambiguity.
    *   **Unit Tests (`test/suite/endpoint-discovery.test.ts`):** ***PRIORITY:*** **Expand unit tests significantly.** Mock LSP responses *only* for symbol locations (based on E2E findings, even if simple). Focus tests heavily on the **regex/text parsing logic** for annotation parameters, covering various formats and edge cases identified below. Add test for "no relevant annotations found". **Comprehensive unit testing of the parsing logic is crucial before worrying about full E2E integration tests.**
    *   **E2E Tests (`test/suite/e2e/e2e.test.ts`):** *(Investigation Completed)* E2E tests confirmed LSP limitations. Further E2E work *for discovery integration* can be deferred until the core logic and unit tests are robust.
2.  **Java LSP Call Hierarchy Integration:** *(Not Started - Depends on Step 1)*
    *   Identify Java extension call hierarchy command(s) (e.g., `vscode.prepareCallHierarchy`, `vscode.provideOutgoingCalls`).
    *   Implement logic to invoke the command(s) with the selected endpoint's URI/position (**obtained via the hybrid discovery in Step 1**).
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
2.  **Endpoint Discovery and Disambiguation (`src/endpoint-discovery.ts`):** ***(Current Focus)***
    *   **Goal:** Implement `discoverEndpoints` using the **hybrid approach** and implement `disambiguateEndpoint`. Critically, **write comprehensive unit tests for the text/regex parsing component.**
    *   **Status:**
        *   `discoverEndpoints`: *(Implementation Pending)* - Needs implementation based on the **hybrid approach**.
        *   `disambiguateEndpoint`: *(Not Started - Stub Exists)*
        *   Unit Tests (`test/suite/endpoint-discovery.test.ts`): *(Started - **Needs Major Expansion for Parsing Logic**) - Requires mocking simple LSP symbol location results and comprehensive testing of **regex-based annotation parameter parsing**.
        *   E2E Tests (`test/suite/e2e/e2e.test.ts`): *(Completed for Investigation)* - E2E tests executed LSP commands, revealing limitations and informing the hybrid strategy. No further E2E work needed *for discovery* at this stage.
    *   **Approach (Hybrid LSP + Regex):**
        *   Use LSP (`documentSymbolProvider` or similar) to identify candidate controller classes and handler methods and get their precise locations (`Uri`, `Position`).
        *   Read the source code lines around these locations.
        *   Use **text/regex parsing** (in a dedicated, testable function) to find mapping annotations on those lines and extract path/method parameters. This parsing logic needs extensive **unit testing**.
        *   Combine paths and determine HTTP methods.
        *   Implement `disambiguateEndpoint` logic.
        *   Expand unit tests (`endpoint-discovery.test.ts`) focusing on the parsing logic.
    *   **Test Fixtures & Coverage (`test/fixtures/java-spring-test-project`):**
        *   *(Inventory Completed)* Fixtures cover most annotation cases needed for unit testing the parser.
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
2.  **Endpoint Discovery and Disambiguation:** ***(Current Focus)***
    *   Implement `discoverEndpoints` logic in `src/endpoint-discovery.ts` using the **Hybrid LSP + Regex approach**. *(Needs implementation)*
    *   Implement `disambiguateEndpoint` logic in `src/endpoint-discovery.ts`. *(Stub exists)*
    *   **Add comprehensive unit tests** in `test/suite/endpoint-discovery.test.ts`, focusing **primarily** on the **regex/text parameter parsing logic**. Mock simple LSP location results. *(Needs major expansion)*
    *   ~~Create E2E tests in `test/suite/e2e/index.ts` to investigate LSP behavior.~~ *(E2E Investigation Completed)* Limited E2E integration tests can be added *later* if deemed necessary after unit tests are complete.
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

*   **Goal:** Implement the `discoverEndpoints` function using the **hybrid LSP + Regex approach** and write comprehensive **unit tests**, focusing specifically on the **regex/text parsing** component.
*   **Status:** E2E investigation completed, defining the hybrid strategy. Function implementation and comprehensive **unit testing of the parser** are **pending**.
*   **Annotations to Support & Test (for Regex/Text Parsing via Unit Tests):**
    *   `@RestController`, `@Controller` (with `@ResponseBody`)
    *   `@RequestMapping` (Class/Method, various attributes: `path`, `value`, `method`, `params`, `headers`, `consumes`, `produces`) - **Focus unit tests here!**
    *   `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`
    *   Parameter Annotations (verify they don't break discovery): `@PathVariable`, `@RequestParam`, `@RequestBody`
    *   Return Type: `ResponseEntity` (verify it doesn't break discovery)
*   **Strategy:**
    *   Use LSP (`documentSymbolProvider`, etc.) to locate candidate class/method symbols (`Uri`, `Position`).
    *   Read corresponding file content.
    *   Use **text/regex parsing** (in a dedicated helper function) to extract annotation parameters (path, method) from lines preceding the symbols.
    *   **Write extensive unit tests** mocking simple LSP symbol results but **thoroughly testing the parsing logic** against various annotation formats found in `test/fixtures/java-spring-test-project`. This is the immediate testing priority.
    *   (Later) Consider adding a few E2E tests to verify the LSP-to-parser integration points work.
*   **Test Categories & Cases (Ensure Fixtures & Unit Tests Exist):**
        *   **Basic Discovery & HTTP Methods:** *(All Covered by Fixtures - Need **Unit Tests** for Parsing)*
        *   Find `@PostMapping` on a method in a `@RestController`. *(Covered: TestController, UserController, OrderController - Need Unit Test)*
        *   Find `@PutMapping`. *(Covered: UserController, ProductController - Need Unit Test)*
        *   Find `@DeleteMapping`. *(Covered: UserController, ProductController - Need Unit Test)*
        *   Find `@PatchMapping`. *(Covered: UserController, ProductController - Need Unit Test)*
        *   Find `@RequestMapping` with `method = RequestMethod.XXX`. *(Covered: UserController, OrderController - Need Unit Test)*
        *   Handle `@RequestMapping` without specific method (TBD: 'ANY' or all methods). *(Covered: TestController, UserController - Need Unit Test)*
    *   **Path Variations:** *(All Covered - Need **Unit Tests** for Parsing)*
        *   Combine class and method level paths. *(Covered: TestController, UserController, ProductController - Need Unit Test)*
        *   Handle path variables (`/users/{userId}`). *(Covered: TestController, UserController, ProductController - Need Unit Test)*
        *   Handle multiple paths (`@GetMapping({"/a", "/b"})`). *(Covered: UserController, OrderController - Need Unit Test)*
        *   Handle root paths (`/`) and empty paths (`""`). *(Covered: UserController, OrderController - Need Unit Test)*
        *   Handle paths with/without leading/trailing slashes. *(Covered: Implicitly - Need Unit Test)*
    *   **Annotation Placement & Combinations:** *(All Covered - Need **Unit Tests** for Parsing)*
        *   Find endpoints in `@RestController` without class-level `@RequestMapping`. *(Covered: OrderController - Need Unit Test)*
        *   Find endpoints in `@Controller` using method-level `@ResponseBody`. *(Covered: LegacyController - Need Unit Test)*
        *   Verify methods *without* mapping annotations are ignored. *(Covered: UserController#helperMethod)*
        *   Verify parameter annotations don't prevent discovery. *(Covered: Multiple controllers)*
        *   Verify `ResponseEntity` return type doesn't prevent discovery. *(Covered: UserController, ProductController)*
    *   **Multiple Files/Controllers:** *(Covered)*
        *   Discover endpoints spread across multiple files. *(Covered: Have 5 controller files)*
    *   **Edge Cases:**
        *   Handle no relevant annotations found (empty list). *(Unit Test Needed)*
        *   Handle annotations spanning multiple lines. *(Unit Test Needed)*
        *   Handle comments within/between annotations. *(Unit Test Needed)*

### Goal: Set Up End-to-End Testing Infrastructure

*   **Goal:** Set up an E2E testing environment that runs the extension within a real VS Code instance, interacting with a live Java Language Server, to test LSP interactions.
*   **Status:** Basic structure exists. E2E tests were successfully used to **investigate LSP capabilities**, confirming limitations and leading to the hybrid discovery strategy. **No further E2E development needed for the discovery step itself at this time.** Unit testing the parsing logic is the priority.
*   **Remaining Steps:** *(Effectively Completed for Discovery Investigation Phase)*
    *   ~~Verify/Configure `test/runTest.ts` to reliably launch with the Java extension installed.~~ *(Done)*
    *   ~~**Create and implement tests in `test/suite/e2e/index.ts`** that:~~ *(Done)*
        *   ~~Open Java files from `test/fixtures/java-spring-test-project`.~~ *(Done)*
        *   ~~Wait for LSP initialization.~~ *(Done)*
        *   ~~Execute Java LSP commands (e.g., `vscode.executeWorkspaceSymbolProvider` querying for `@RestController`).~~ *(Done - Tested multiple commands)*
        *   ~~Log/Assert results.~~ *(Done)*

---

## New Feature: `/restEndpoint` Diagram Generation

*   **Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Next Steps:**

2.  **Endpoint Discovery and Disambiguation:** ***(Current Focus)***
    *   **Discover All Endpoints (Hybrid Approach):** Implement logic (in `src/endpoint-discovery.ts` function `discoverEndpoints`). *(Implementation needed)*.
        *   **Approach:**
            1.  Use LSP (`documentSymbolProvider` / `workspaceSymbolProvider`) to identify candidate controller classes and handler methods, obtaining their precise `Uri` and `Position`/`Range`.
            2.  Read the source file text around these locations.
            3.  Apply **text/regex parsing** (in a helper function) to lines preceding the symbols to find mapping annotations (`@RequestMapping`, `@GetMapping`, etc.) and extract their parameters (path/value, method).
            4.  Combine class and method paths; determine HTTP method.
        *   Create a structured list of found endpoints: `[{ method: 'POST', path: '/api/users', uri: vscode.Uri, position: vscode.Position, handlerMethodName: 'createUser', description: 'Creates a new user' /* Optional */ }, ...] `.
        *   **Identify Target Endpoint:** Implement `disambiguateEndpoint`. Use the `naturalLanguageQuery` to identify the target endpoint.
            *   Simple keyword matching.
            *   (Future) LLM semantic matching.
            *   User interaction for ambiguity.
        *   Store the target endpoint's `vscode.Uri` and `vscode.Position`.
        *   **Testing:** ***PRIORITY:***
            *   Write/expand **unit tests** (`test/suite/endpoint-discovery.test.ts`) focusing heavily on the **regex/text parsing logic** for annotation parameters, using examples from fixtures. Mock simple LSP symbol results. This is the main testing task for this step.
            *   Unit test disambiguation logic.
            *   (Later) Consider minimal E2E tests for basic integration verification if needed.
            *   Manually test.
    3.  **Java LSP Call Hierarchy Integration:** *(Next Step)*
        *   Identify the correct VS Code command provided by the installed Java extension for fetching call hierarchies (e.g., `vscode.prepareCallHierarchy`, `java.showCallHierarchy`, followed by `vscode.provideOutgoingCalls`).
        *   Use `vscode.commands.executeCommand` to invoke the call hierarchy provider with the specific URI and position identified in step 2 (**using the location found via LSP in the hybrid discovery**).

4.  **Sequence Diagram Generation:**
    *   Create a function that traverses the call hierarchy data structure generated in step 3.
    *   Translate the call flow (classes/methods calling other methods) into a Mermaid `sequenceDiagram` syntax.
    *   Add unit tests for the generation logic.