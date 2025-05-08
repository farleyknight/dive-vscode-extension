# Next Steps

This file provides a high-level overview of the current development focus.

## Current Focus

**NEW TOP PRIORITY: Removing `vscode` Dependencies from Unit Tests**

*   **Problem:** Direct usage of the `vscode` module in unit tests (files in `test/suite/*.test.ts`, excluding `test/suite/e2e/**`) leads to brittle tests that are hard to write and maintain. This is because they become dependent on the complex VS Code API surface, requiring intricate mocking.
*   **Objective:** Refactor unit tests to eliminate direct dependencies on the `vscode` module. This involves introducing abstraction layers (interfaces, wrapper functions) for any VS Code services needed by core logic. Unit tests will then mock these custom abstractions, not `vscode` objects directly. This aligns with the principle outlined in `docs/mistakes.md#1-using-vscode-module-directly-in-unit-tests-for-core-logic`.
*   **Scope:**
    *   `test/suite/call-hierarchy.test.ts`
    *   `test/suite/extension.test.ts`
    *   `test/suite/mermaid-sequence-translator.test.ts`
    *   `test/suite/diagramParticipant.test.ts`
    *   `test/suite/endpoint-disambiguation.test.ts`
*   **Expected Outcome:** Unit tests will be more robust, easier to understand, and faster to run, focusing purely on validating the intended logic in isolation.

*   **Detailed Implementation Strategy:**
    *   **Iterative Approach:** This refactoring will be performed incrementally, one `vscode` API usage at a time, across the specified test files. The goal is to ensure the test suite (`npm test` or `npm run test`) passes after each individual change.
    *   **Progress on `test/suite/call-hierarchy.test.ts`:**
        *   **(Completed)** Abstracted `vscode.commands.executeCommand` using `ICommandExecutor` (in `src/adapters/vscodeExecution.ts`). Updated `src/call-hierarchy.ts` and the test file.
        *   **(Completed)** Abstracted `vscode.SymbolKind` using `VSCodeSymbolKind` enum (in `src/adapters/vscodeTypes.ts`). Updated the test file.
        *   **(Next Steps for this file):** Abstract remaining direct `vscode` usages, likely starting with `vscode.Uri`, `vscode.Position`, and `vscode.Range` used in helper functions and test setup.
    *   **Process for Each `vscode` API Usage:**
        1.  **Identify:** Within one of the target test files (from the "Scope" list), identify a specific direct usage of a `vscode` API (e.g., `vscode.Uri`, `vscode.window.showQuickPick`, `vscode.commands.executeCommand`, `vscode.workspace.workspaceFolders`). Since many files use `import * as vscode from 'vscode'`, this will involve inspecting how the `vscode` namespace object is used.
        2.  **Abstract:** Define a new interface or wrapper function/class (e.g., `IVscodeWindow`, `executeVscodeCommand`, `getWorkspaceFolders`) in a suitable shared location (e.g., `src/adapters/vscode.ts` or similar). This abstraction will define the minimal signature needed by the consuming code.
        3.  **Implement:** Create a concrete implementation of this abstraction that calls the actual `vscode` API. This will reside in the production codebase.
        4.  **Refactor Core Logic (If Necessary):** Update the core application logic that was using the `vscode` API directly to now depend on the new abstraction (using dependency injection or by directly calling the wrapper function).
        5.  **Refactor Test:** Modify the unit test to:
            *   Import and use the new abstraction.
            *   Mock the abstraction. Provide a test-specific implementation or use a mocking library (e.g., Sinon.JS stubs) to control its behavior for the test scenario.
        6.  **Test:** Run the relevant unit tests and the full test suite (`npm test` or `npm run test`).
        7.  **Verify & Iterate:**
            *   If tests pass, commit the changes. Proceed to the next identified `vscode` API usage in the same file or a new file from the scope.
            *   If tests fail, debug and fix the implementation or the test setup until all tests pass. Then, commit and proceed.
    *   **File-by-File Focus:** It's recommended to tackle one test file at a time. Before starting on a file, it may be beneficial to list out all direct `vscode` API usages within that file to plan the sequence of abstractions.
    *   **The `vscode.LanguageModelChat` Abstraction:** The plan outlined in "**Abstracting `vscode.LanguageModelChat` for Testability and Flexibility**" serves as a good example of this process for a specific, complex `vscode` API. Similar principles will be applied to other `vscode` API usages.

---

**(The "Abstracting vscode.LanguageModelChat" section, which is related to this new top priority, will be reviewed and potentially merged or updated as part of this effort. The "Simplifying Generated Sequence Diagrams" task, previously the top priority, will now become a secondary priority.)**

**Simplifying Generated Sequence Diagrams to High-Level Architectural View (Secondary Priority)**

*   **Problem:** The current sequence diagrams generated by the `/restEndpoint` command, which uses VS Code's Call Hierarchy feature, are excessively detailed. For example, a simple endpoint like `TodoItemController.createTodoItem` can produce a diagram with dozens of internal framework calls (e.g., Spring's `ResponseEntity` builder steps, `Assert` calls, `HttpHeaders` manipulations) rather than a concise architectural overview. The recent example for `createTodoItem` (see `docs/example-detailed-sequence-diagram.md` for the full Mermaid output) demonstrates this, resulting in a complex diagram far removed from an expected 3-5 line high-level view.

*   **Objective:** Develop a strategy to transform the detailed call hierarchy data into a more abstract, high-level sequence diagram. The goal is to achieve a representation similar to this conceptual architectural flow:
    1.  HTTP Request -> Controller
    2.  Controller -> Service
    3.  Service -> Repository
    4.  (Repository -> Database - often implicit)
    5.  Controller -> HTTP Response

*   **Plan (Initial Thoughts):**
    1.  **Analyze Call Hierarchy Data:** *(Substantially completed for initial rule definition)*
        *   Investigate the structure of the `CustomHierarchyNode` tree provided by VS Code's call hierarchy feature. *(Completed)*
        *   Identify patterns and characteristics of "significant" architectural interactions (e.g., calls between major components like Controller, Service, Repository) versus internal or low-level framework calls (e.g., utility functions, getters/setters, framework-specific boilerplate). *(Initial patterns identified through E2E test data capture)*
            *   Successfully captured `CustomHierarchyNode` data for various scenarios: no outgoing calls, intra-class calls (`TestController.complexHello` -> `privateHelperHello`), inter-class calls (`TestController.fullComplexHello` -> `TestService.getServiceData`), and external JDK library calls with internal depth (`TestService.getListSize` -> `java.util.ArrayList` methods like `ArrayList()`, `add()`, `size()`, and internal `grow()`).
            *   Confirmed `item.uri.path` as the primary field to distinguish local project calls (e.g., within `test/fixtures/java-spring-test-project`) from external library/JDK calls (e.g., `/Library/Java/.../java/util/ArrayList.java`).
        *   Consider properties such as call depth, source/target module/package names (e.g., `org.springframework.*` vs. project-specific packages), and frequency of certain call types. *(Initial observations made; deeper analysis on frequency/common patterns will be part of heuristic refinement).*
    2.  **Define Abstraction Rules/Heuristics:** *(Next immediate priority)* Develop a robust set of rules or heuristics to filter, group, or abstract calls from the call hierarchy data. This will primarily involve:
        *   **Rule 1: Identify Local vs. External Calls:**
            *   **Input:** `CustomHierarchyNode.item.uri.path` (path to the code file) and `vscode.workspace.workspaceFolders` (project root folder(s)).
            *   **Logic:** Determine if a node's URI path is within any of the `workspaceFolders` (or a more specific, configurable list of project source directories). This distinguishes project-specific "local" code from "external" code (e.g., JDK, libraries).
            *   **Output:** Classification of each call hierarchy node as "local" or "external".
        *   **Rule 2: Prioritize Direct Local Project Calls:**
            *   Local-to-local calls (e.g., `Controller` -> `Service`, `Service` -> `Repository`, or a `Controller` -> `private helper` in the same class) should generally be included in the abstracted diagram, at least at the first level of calls originating from another local component.
        *   **Rule 3: Aggressively Filter/Abstract External Calls:**
            *   **Default Behavior (MVP):** For a call from local code to an external method (e.g., to `java.util.ArrayList.size()` or a Spring internal), the diagram should not show the external call itself or any of its children. The call effectively "terminates" at this local-to-external boundary for diagram purposes. Complete filtering of external calls and their children is simpler for MVP.
            *   **Future Enhancement (Abstraction):** Instead of complete filtering, consider replacing a sequence of calls *to* and *within* a well-known external library/framework with a single representative node (e.g., an interaction box labeled "java.util" or "Spring Framework").
            *   The path analysis from step 1 (identifying patterns for `java.util.*`, `org.springframework.*`, `node_modules`, etc.) will be crucial input for this rule.
        *   **Rule 4: Collapse Sequential Calls within the Same Local Component (Optional for MVP):**
            *   If a local method A makes multiple calls to other private/internal methods (B, C, D) within the *same class or immediate local module*, and B, C, D do not call out to other major architectural components, consider if these internal calls should be collapsed, or if only the call to A (from an external caller) is architecturally significant. For MVP, showing all direct local calls might be acceptable.
            *   Defining "same logical component" and "significant architectural insight" will need careful consideration (e.g., based on class boundaries, package structure, or specific annotations).
        *   **Rule 5: Handling Call Depth (Primarily for External Calls):**
            *   If external calls are not completely filtered (e.g., if showing the first external call but not its children), apply a strict maximum depth for traversing into any external call chain (e.g., depth 0 or 1 relative to the *first* call that crossed the local-to-external boundary).
            *   The current `MAX_CALL_HIERARCHY_DEPTH` (e.g., 5) in `call-hierarchy.ts` is for the raw tree; this abstraction layer will apply its own, much stricter depth limits for external branches.
        *   **(Future Consideration)** Allow user configuration for "always include" or "always exclude" packages/modules, or to set a maximum depth for displaying external calls.
    3.  **Modify Diagram Generation Logic:** *(Following Rule Definition)*
        *   Update the existing `generateMermaidSequenceDiagram` function, or preferably, introduce a new abstraction layer (e.g., a `CallHierarchyProcessor` or `DiagramAbstractor` class/module).
        *   This new layer would take the raw `CustomHierarchyNode` tree as input, apply the defined abstraction rules and heuristics, and produce a *filtered/abstracted* tree or an intermediate representation.
        *   The `generateMermaidSequenceDiagram` function would then consume this processed representation to generate the Mermaid syntax. This separation of concerns (processing vs. rendering) will improve maintainability.
    4.  **Iterative Refinement and Testing:**
        *   Test rigorously with various endpoints, project types (e.g., Java Spring Boot, Node.js Express, Python Django/Flask), and common frameworks to ensure the abstraction is effective and produces meaningful, easy-to-understand high-level diagrams.
        *   Establish clear metrics for "effectiveness" and "meaningfulness," possibly including diagram complexity (node/edge count reduction), task completion time for understanding an endpoint, and qualitative user feedback.
    5.  **User Control (Future Iteration):**
        *   Consider providing users with clear and simple options to toggle between the new abstracted/high-level view and the original detailed/raw view.
        *   This could be implemented as a command option, a setting in `settings.json`, or a UI control within the webview displaying the diagram.

*   **Expected Outcome:** The `/restEndpoint` command will be able to produce sequence diagrams that offer a clear, high-level architectural understanding of an endpoint's interactions, making it more intuitive and useful for common use cases. The detailed view might still be available as an advanced option.

---
*(The "Abstracting vscode.LanguageModelChat" section, previously the top priority, will now become a secondary priority. The existing "Call Hierarchy MVP (Secondary Priority)" content will follow and may need to be re-prioritized or integrated accordingly.)*

**Abstracting `vscode.LanguageModelChat` for Testability and Flexibility (Related to Top Priority / To Be Reviewed)**

*   **Problem:** The direct usage of `vscode.LanguageModelChat` (and its associated types like `vscode.LanguageModelTextPart`) within `disambiguateEndpoint` has led to significant challenges in E2E testing. Specifically, mocking the `lm.sendRequest` method to return objects that satisfy strict `instanceof vscode.LanguageModelTextPart` checks performed by `disambiguateEndpoint` has proven difficult, as the test environment cannot easily create "real" instances of these potentially internal VS Code API classes. This has been a major blocker for the `test/suite/e2e/mermaid-real-callhierarchy.e2e.test.ts` test.

*   **Objective:** Decouple `disambiguateEndpoint` from the concrete `vscode.LanguageModelChat` implementation by introducing an abstraction layer (an adapter or wrapper class). This will allow for:
    1.  Easier and more reliable mocking in E2E tests, as we can provide a test-specific implementation of the adapter that returns plain, well-defined JavaScript objects, bypassing `instanceof` issues.
    2.  Improved observability into the data structures being passed to and from the LLM, by enabling detailed logging within the adapter.
    3.  Potential flexibility in the future to swap out LLM providers or modify request/response handling without altering the core logic of `disambiguateEndpoint`.

*   **Plan:**
    1.  **Define an Adapter Interface:**
        *   Create a new TypeScript interface (e.g., `ILanguageModelAdapter`) that defines the necessary methods for interacting with an LLM, primarily a `sendRequest` method.
        *   The `sendRequest` method in this interface should be defined to return promises of simplified, plain JavaScript objects that represent the LLM's response structure (e.g., `{ stream: AsyncIterable<{ type: 'text'; value: string } | { type: 'functionCall'; details: any }>} ` or similar, avoiding direct VS Code API types in its return signature if possible for maximum testability).

    2.  **Implement a `VscodeLanguageModelAdapter`:**
        *   Create a concrete class `VscodeLanguageModelAdapter` that implements `ILanguageModelAdapter`.
        *   This class will wrap an actual `vscode.LanguageModelChat` instance.
        *   Its `sendRequest` method will call the underlying `