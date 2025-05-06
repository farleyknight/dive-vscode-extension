# Project Status & Next Steps

This document tracks the ongoing development goals, completed tasks, and immediate next steps for the VS Code extension.

**VERY HIGH PRIORITY: Decouple Unit Tests from VSCode Specifics**

*   **Guiding Principle:** All new and refactored **unit tests** (especially for core logic like in `src/endpoint-discovery.ts`) MUST be designed to be independent of direct `vscode` module dependencies and runtime environment specifics.
*   **Why:**
    *   **Robustness & Stability:** Avoids test flakiness due to VSCode API changes or environment issues.
    *   **Clarity & Focus:** Unit tests should validate the module's logic, not the intricacies of mocking a complex external API like VSCode's.
    *   **Maintainability:** Simpler tests are easier to write, understand, and maintain.
*   **How:**
    *   **Abstraction Layers:** If a module interacts with `vscode` APIs, these interactions should be encapsulated within dedicated functions or services.
    *   **Mock Abstractions:** Unit tests should mock these custom abstractions/interfaces, not the `vscode` objects directly. For example, if `discoverEndpoints` needs to read a file, it should call a service like `fileReader.readFileContent(uri)` which can be easily mocked, rather than directly calling and mocking `vscode.workspace.openTextDocument().then(doc => doc.getText())`.
    *   **Focus on Pure Logic:** Extract core algorithms (e.g., annotation parsing, path combination) into pure functions that operate on simple data structures and can be tested in complete isolation.
*   **Scope:** This principle is paramount for the ongoing refactoring of `discoverEndpoints` and all future unit test development. E2E tests will necessarily interact with the VSCode environment, but unit tests must strive for independence.

**Immediate Next Task: Refactor `discoverEndpoints` for Clarity and Testability**

*   **Goal:** Break down the complex `discoverEndpoints` function (`src/endpoint-discovery.ts`) into smaller, focused, and independently testable helper functions. This will improve maintainability and allow for reliable fixes, including the incorrect path combination bug (e.g., `/` instead of `/api/todo-statuses`).

Example where we report `/` instead of `/api/todo-statuses`:

```java
@RestController
@RequestMapping("/api/todo-statuses")
public class TodoStatusController {

    private final TodoStatusService todoStatusService;

    @Autowired
    public TodoStatusController(TodoStatusService todoStatusService) {
        this.todoStatusService = todoStatusService;
    }

    @GetMapping
    public ResponseEntity<List<TodoStatus>> getAllTodoStatuses() {
        return ResponseEntity.ok(todoStatusService.findAll());
    }
}
```

*   **Why:** The current function is too large and mixes several responsibilities (file finding, symbol parsing, annotation parsing, path combination), making it difficult to test and debug effectively. Refactoring is necessary before confidently fixing bugs or adding features. The previous E2E investigation confirmed a hybrid LSP+Regex approach is viable, but the integration logic needs to be cleaner.
*   **Plan:**
    1.  **Analyze `discoverEndpoints` Structure:** Identify distinct logical steps (file finding, symbol processing, class annotation parsing, method annotation parsing, path combination, etc.). *(Analysis Done)*
    2.  **Iterative Extraction:**
        *   **Extract:** Choose a self-contained block (e.g., finding controller classes and their base paths). Extract it into a new, private helper function within `endpoint-discovery.ts`.
        *   **Integrate:** Update `discoverEndpoints` to call the new helper.
        *   **Verify (E2E):** Run `npm run test` *immediately* to ensure the refactoring hasn't broken existing end-to-end functionality. Fix if necessary.
        *   **Unit Test:** Write specific unit tests in `test/suite/endpoint-discovery.test.ts` for the *newly extracted helper function*, mocking its inputs.
    3.  **Repeat:** Continue step 2 for other logical blocks, progressively simplifying `discoverEndpoints`.
    4.  **Address Path Combination:** Ensure the path combination logic is isolated in its own well-tested helper function (`combinePaths` likely needs refinement or verification within this process). Fix the path combination bug here, covered by specific unit tests.
*   **Status:** *(Not Started)*

---

## Previous Immediate Task: ~~Create E2E Test for LSP Annotation Discovery~~ *(Completed)*

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
    *   **Implement `discoverEndpoints` (Hybrid Approach):** *(Implementation Done)*
        *   Use LSP (e.g., `documentSymbolProvider` or `workspaceSymbolProvider`) to find candidate controller classes and handler methods within the workspace. *(Implemented)*
        *   For each identified symbol (class/method), get its accurate `vscode.Uri` and `vscode.Range`/`vscode.Position`. *(Implemented)*
        *   Read the text content of the relevant source file lines preceding the symbol's location. *(Implemented)*
        *   Use **text/regex parsing** (e.g., in a dedicated helper function like `parseMappingAnnotations`) on these lines to identify Spring mapping annotations (`@RequestMapping`, `@GetMapping`, etc.) and **extract their parameters** (path, value, method). *(Helper function `parseMappingAnnotations` implemented and unit tested)*. *(Implemented)*
        *   Combine class-level and method-level paths. Determine the HTTP method. *(Implemented)*
        *   Create the structured list: `[{ method: string, path: string, uri: vscode.Uri, position: vscode.Position, handlerMethodName: string, description?: string }, ...]`. *(Implemented)*
    *   **Implement `disambiguateEndpoint`:** Match the user's natural language query against the discovered endpoints. Handle ambiguity. *(Not Started - Stub Exists)*
    *   **Unit Tests (`test/suite/endpoint-discovery.test.ts`):** *(Partially Completed - Unit tests for `parseMappingAnnotations` are implemented. Initial integration test for `discoverEndpoints` is passing. **Needs significant expansion for `discoverEndpoints` logic, edge cases, and integration points.**)*
    *   **E2E Tests (`test/suite/e2e/e2e.test.ts`):** *(Completed for Investigation)* - E2E tests executed LSP commands, revealing limitations and informing the hybrid strategy. No further E2E work needed *for discovery* at this stage. E2E test logging improved for readability.
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
2.  **Endpoint Discovery and Disambiguation (`src/endpoint-discovery.ts`):** ***(Current Focus - Discovery Implemented, Disambiguation Pending)***
    *   **Goal:** Implement `discoverEndpoints` using the **hybrid approach** and implement `disambiguateEndpoint`. Critically, **write comprehensive unit tests for the `discoverEndpoints` function and the text/regex parsing component.**
    *   **Status:**
        *   `discoverEndpoints`: *(Implementation Done)* - Implemented based on the **hybrid approach**. It uses LSP symbols to find methods/classes and text parsing (`parseMappingAnnotations`) to extract annotation details.
        *   `disambiguateEndpoint`: *(Not Started - Stub Exists)*
        *   Unit Tests (`test/suite/endpoint-discovery.test.ts`): *(Partially Completed - Unit tests for `parseMappingAnnotations` are implemented. Initial integration test for `discoverEndpoints` is passing. **Needs significant expansion for `discoverEndpoints` logic, edge cases, and integration points.**)*
        *   E2E Tests (`test/suite/e2e/e2e.test.ts`): *(Completed for Investigation)* - E2E tests executed LSP commands, revealing limitations and informing the hybrid strategy. No further E2E work needed *for discovery* at this stage. E2E test logging improved for readability.
    *   **Approach (Hybrid LSP + Regex):** *(Implemented for discovery)*
        *   Use LSP (`documentSymbolProvider` or similar) to identify candidate controller classes and handler methods and get their precise locations (`Uri`, `Position`). *(Done)*
        *   Read the source code lines around these locations. *(Done)*
        *   Use **text/regex parsing** (in a dedicated, testable function like `parseMappingAnnotations`) to find mapping annotations on those lines and extract path/method parameters. *(Parsing function implemented and unit tested).* *(Done)*
        *   Combine paths and determine HTTP methods. *(Done)*
        *   Implement `disambiguateEndpoint` logic. *(Pending)*
        *   Expand unit tests (`endpoint-discovery.test.ts`) focusing on the `discoverEndpoints` function itself and any remaining parsing edge cases and LSP/file reading integration. *(Pending)*
    *   **Test Fixtures & Coverage (`test/fixtures/java-spring-test-project`):**
        *   *(Inventory Completed)* Fixtures cover most annotation cases needed for unit testing the parser.
    *   **Annotations to Support:** `@RestController`, `@Controller` (+`@ResponseBody`), `@RequestMapping`, `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`. (Verify parameter/return type annotations don't break discovery).
3.  **Java LSP Call Hierarchy Integration:** *(Next - Depends on Step 2)*
    *   Identify Java extension call hierarchy command(s) (e.g., `vscode.prepareCallHierarchy`, `java.showCallHierarchy`, followed by `vscode.provideOutgoingCalls`).
    *   Use `vscode.commands.executeCommand` to invoke the call hierarchy provider with the specific URI and position identified in step 2 (**using the location found via LSP in the hybrid discovery**).

4.  **Sequence Diagram Generation:**
    *   Create a function that traverses the call hierarchy data structure generated in step 3.
    *   Translate the call flow into Mermaid `sequenceDiagram` syntax.
    *   Add unit tests for the generation logic.

---

## Feature Backlog & Goals

### Goal: `/restEndpoint` Diagram Generation (Detailed Steps)

*   **Overall Goal:** Allow users to generate a sequence diagram visualizing the call hierarchy for a specified Java Spring Boot REST endpoint using the Java LSP.

**Status & Remaining Steps:**

1.  **Command Setup (`/restEndpoint`):** *(Completed - See Completed Tasks)*
2.  **Endpoint Discovery and Disambiguation:** ***(Current Focus)***
    *   Implement `discoverEndpoints` logic in `src/endpoint-discovery.ts` using the **Hybrid LSP + Regex approach**. *(Implementation Done)*
    *   Implement `disambiguateEndpoint` logic in `src/endpoint-discovery.ts`. *(Stub exists)*
    *   **Add comprehensive unit tests** in `test/suite/endpoint-discovery.test.ts`, focusing **primarily** on the **`discoverEndpoints` integration logic** and any remaining edge cases for `parseMappingAnnotations`. Mock simple LSP location results. *(Needs major expansion)*
    *   ~~Create E2E tests in `test/suite/e2e/index.ts` to investigate LSP behavior.~~ *(E2E Investigation Completed)* Limited E2E integration tests can be added *later* if deemed necessary after unit tests are complete.
3.  **Java LSP Call Hierarchy Integration:** *(Next - Depends on Step 2)*
    *   Identify Java extension call hierarchy command(s).
    *   Implement logic to call the command(s) with the target endpoint's URI/position.
    *   Build the call hierarchy data structure recursively (outgoing calls).
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
*   **Status:** E2E investigation completed, defining the hybrid strategy. The helper function `parseMappingAnnotations` for annotation parsing is **implemented and significantly unit tested**. The main `discoverEndpoints` function implementation is **done**. Its specific unit tests need **significant expansion**.
*   **Annotations to Support & Test (for Regex/Text Parsing via Unit Tests):**
    *   `@RestController`, `@Controller` (with `@ResponseBody`)
    *   `@RequestMapping` (Class/Method, various attributes: `path`, `value`, `method`, `params`, `headers`, `consumes`, `produces`) - ***Unit tests largely implemented for `parseMappingAnnotations`***
    *   `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping` - ***Unit tests largely implemented for `parseMappingAnnotations`***
    *   Parameter Annotations (verify they don't break discovery): `@PathVariable`, `@RequestParam`, `@RequestBody`
    *   Return Type: `ResponseEntity` (verify it doesn't break discovery)
*   **Strategy:**
    *   Use LSP (`documentSymbolProvider`, etc.) to locate candidate class/method symbols (`Uri`, `Position`).
    *   Read corresponding file content.
    *   Use **text/regex parsing** (in the helper function `parseMappingAnnotations`) to extract annotation parameters (path, method) from lines preceding the symbols. *(Helper implemented and unit tested)*.
    *   **Write extensive unit tests** mocking simple LSP symbol results but **thoroughly testing the parsing logic** against various annotation formats found in `test/fixtures/java-spring-test-project`. ***(Status: Unit tests for `parseMappingAnnotations` are done. Need tests for `discoverEndpoints` itself).***
    *   (Later) Consider adding a few E2E tests to verify the LSP-to-parser integration points work.
*   **Test Categories & Cases (Ensure Fixtures & Unit Tests Exist):**
        *   **Basic Discovery & HTTP Methods:** *(Fixtures Cover Cases - Need **Unit Tests** for `discoverEndpoints` integration)*
        *   Find `@PostMapping` on a method in a `@RestController`. *(Unit Test for parsing exists)*
        *   Find `@PutMapping`. *(Unit Test for parsing exists)*
        *   Find `@DeleteMapping`. *(Unit Test for parsing exists)*
        *   Find `@PatchMapping`. *(Unit Test for parsing exists)*
        *   Find `@RequestMapping` with `method = RequestMethod.XXX`. *(Unit Test for parsing exists)*
        *   Handle `@RequestMapping` without specific method (defaults to GET). *(Unit Test for parsing exists)*
    *   **Path Variations:** *(Fixtures Cover Cases - Need **Unit Tests** for `discoverEndpoints` integration)*
        *   Combine class and method level paths. *(Basic Unit Test Passing - Needs More Coverage)*
        *   Handle path variables (`/users/{userId}`). *(Unit Test for parsing exists - path stored as string)*
        *   Handle multiple paths (`@GetMapping({"/a", "/b"})`). *(Unit Test for parsing exists)*
        *   Handle root paths (`/`) and empty paths (`""`). *(Unit Test for parsing exists)*
        *   Handle paths with/without leading/trailing slashes. *(Unit Test for parsing exists - normalization is separate)*
    *   **Annotation Placement & Combinations:** *(Fixtures Cover Cases - Need **Unit Tests** for `discoverEndpoints` integration)*
        *   Find endpoints in `@RestController` without class-level `@RequestMapping`. *(Needs `discoverEndpoints` Unit Test)*
        *   Find endpoints in `@Controller` using method-level `@ResponseBody`. *(Needs `discoverEndpoints` Unit Test)*
        *   Verify methods *without* mapping annotations are ignored. *(Needs `discoverEndpoints` Unit Test)*
        *   Verify parameter annotations don't prevent discovery. *(Needs `discoverEndpoints` Unit Test)*
        *   Verify `ResponseEntity` return type doesn't prevent discovery. *(Needs `discoverEndpoints` Unit Test)*
    *   **Multiple Files/Controllers:** *(Covered by Fixtures)*
        *   Discover endpoints spread across multiple files. *(Needs `discoverEndpoints` Unit Test)*
    *   **Edge Cases:**
        *   Handle no relevant annotations found (empty list). *(Unit Test for parsing exists - returns null. Need `discoverEndpoints` test)*
        *   Handle annotations spanning multiple lines. *(Unit Test for parsing exists)*
        *   Handle comments within/between annotations. *(Unit Test for parsing exists)*
        *   **Testing:** ***PRIORITY:***
            *   Write/expand **unit tests** (`test/suite/endpoint-discovery.test.ts`) focusing heavily on the **`discoverEndpoints` logic**, mocking LSP results and file content, and covering integration points. ***(Status: Parsing logic unit tests (`parseMappingAnnotations`) largely complete. Initial integration test for `discoverEndpoints` is passing. Needs significant expansion.)***
            *   Unit test disambiguation logic. *(Pending)*
            *   (Later) Consider minimal E2E tests for basic integration verification if needed.
            *   Manually test.
    3.  **Java LSP Call Hierarchy Integration:** *(Next Step)*
        *   Identify the correct VS Code command provided by the installed Java extension for fetching call hierarchies (e.g., `vscode.prepareCallHierarchy`, `java.showCallHierarchy`, followed by `vscode.provideOutgoingCalls`).
        *   Use `vscode.commands.executeCommand` to invoke the call hierarchy provider with the specific URI and position identified in step 2 (**using the location found via LSP in the hybrid discovery**).

4.  **Sequence Diagram Generation:**
    *   Create a function that traverses the call hierarchy data structure generated in step 3.
    *   Translate the call flow (classes/methods calling other methods) into a Mermaid `sequenceDiagram` syntax.
    *   Add unit tests for the generation logic.