# Testing Infrastructure

This document outlines the structure and components of the testing setup for this VS Code extension.

## Overview

We employ two primary types of tests:

1.  **Unit Tests:** These tests run in a standard Node.js environment using Mocha. They focus on testing individual functions and modules in isolation, often using mocks to simulate VS Code API interactions or external dependencies (like LSP responses).
2.  **End-to-End (E2E) Tests:** These tests run within a special instance of VS Code (`@vscode/test-electron`) launched with the extension activated. They interact with a real VS Code environment, including potentially live language servers (like the Java LSP), to test the integrated behavior of the extension's features.

## Directory Structure & Key Files

```
test/
├── fixtures/                  # Contains test data and projects used by tests
│   └── java-spring-test-project/ # A sample Java Spring Boot project used for:
│       │                       #   - E2E tests interacting with Java LSP
│       │                       #   - Providing realistic context for unit tests (mocking LSP responses based on this project)
│       └── src/main/java/com/example/demo/ # Actual Java source files with controllers/endpoints
│           ├── TestController.java
│           ├── UserController.java
│           ├── OrderController.java
│           ├── ProductController.java
│           └── LegacyController.java
│
├── suite/                     # Contains the test source code (run via Mocha)
│   ├── e2e/                   # End-to-End test specific files
│   │   └── index.ts           # Entry point and test definitions for E2E tests
│   │
│   ├── endpoint-discovery.test.ts # Unit tests for endpoint discovery logic (`src/endpoint-discovery.ts`)
│   ├── extension.test.ts      # Basic unit tests for extension activation/deactivation (can be expanded)
│   └── index.ts               # Main entry point for running tests (both unit and potentially triggering E2E setup) - Configures Mocha.
│
└── runTest.ts                 # Script responsible for launching the VS Code E2E test environment using `@vscode/test-electron`.
                               # Handles downloading VS Code, launching it with the extension, and running the tests defined in `test/suite/e2e/index.ts`.

package.json                   # Defines test scripts (e.g., `npm test`, `npm run e2e-test`) that trigger Mocha and `runTest.ts`.
tsconfig.json                  # TypeScript configuration, potentially including paths or settings relevant to tests.
```

## Test Execution

*   **Unit Tests:** Typically run via a command like `npm test` or `yarn test`. This usually invokes Mocha to execute tests within the `test/suite/` directory (excluding the `e2e` subdirectory).
*   **E2E Tests:** Typically run via a command like `npm run e2e-test` or `yarn e2e-test`. This executes the `test/runTest.ts` script, which launches VS Code and runs the tests specified in `test/suite/e2e/index.ts`.

## Role of Components

*   **`test/fixtures/java-spring-test-project/`:** Provides a consistent, controlled Java codebase for testing features that rely on Java code analysis, such as REST endpoint discovery and call hierarchy generation. It's used directly by E2E tests and serves as the basis for creating realistic mock data for unit tests.
*   **`test/suite/endpoint-discovery.test.ts`:** Ensures the logic for finding and parsing REST endpoints (`discoverEndpoints` function) works correctly under various scenarios, using mocked LSP responses based on the fixture project.
*   **`test/suite/e2e/index.ts`:** Validates the *interaction* between the extension and the VS Code environment, especially the Java Language Server. Tests here verify that LSP commands (like workspace symbol search or call hierarchy requests) are executed correctly and return expected results based on the live analysis of the fixture project.
*   **`test/runTest.ts`:** The bridge between the development environment and the E2E testing environment. It automates the setup and execution of tests within a controlled VS Code instance.
