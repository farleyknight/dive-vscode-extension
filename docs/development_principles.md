# Development Principles

This document outlines key principles guiding the development of this extension.

## Decouple Unit Tests from VSCode Specifics

*   **Guiding Principle:** All new and refactored **unit tests** (especially for core logic like in `src/endpoint-discovery.ts`) MUST be designed to be independent of direct `vscode` module dependencies and runtime environment specifics. *(Status: Largely Implemented and Actively Followed. Core parsing logic is tested purely, and VSCode interactions in discovery logic are tested via abstractions and mocks.)*
*   **Why:**
    *   **Robustness & Stability:** Avoids test flakiness due to VSCode API changes or environment issues.
    *   **Clarity & Focus:** Unit tests should validate the module's logic, not the intricacies of mocking a complex external API like VSCode's.
    *   **Maintainability:** Simpler tests are easier to write, understand, and maintain.
*   **How:**
    *   **Abstraction Layers:** If a module interacts with `vscode` APIs, these interactions should be encapsulated within dedicated functions or services.
    *   **Mock Abstractions:** Unit tests should mock these custom abstractions/interfaces, not the `vscode` objects directly. For example, if `discoverEndpoints` needs to read a file, it should call a service like `fileReader.readFileContent(uri)` which can be easily mocked, rather than directly calling and mocking `vscode.workspace.openTextDocument().then(doc => doc.getText())`.
    *   **Focus on Pure Logic:** Extract core algorithms (e.g., annotation parsing, path combination) into pure functions that operate on simple data structures and can be tested in complete isolation.
*   **Scope:** This principle is paramount for the ongoing refactoring of `discoverEndpoints` and all future unit test development. E2E tests will necessarily interact with the VSCode environment, but unit tests must strive for independence.