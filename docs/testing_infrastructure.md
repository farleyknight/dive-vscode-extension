# Testing Infrastructure

This document outlines the structure and components of the testing setup for this VS Code extension.

## Overview

Tests are run using Mocha within a special instance of VS Code launched via `@vscode/test-electron`. This allows tests to interact with the full VS Code API, including making calls to language servers like the Java Language Server (LSP) for integration testing.

While all tests run in this environment, we conceptually distinguish:

1.  **Unit Tests:** These focus on testing individual functions and modules (`src/` files). They often use mocks (e.g., `sinon`) to simulate dependencies like VS Code API calls or LSP responses, allowing for isolated logic verification. Examples include tests for diagram generation logic or endpoint parsing.
2.  **End-to-End (E2E) Tests:** These tests verify the interaction between the extension and the live VS Code environment, particularly the Java LSP. They open files from a test fixture project, execute actual LSP commands (e.g., finding symbols, getting call hierarchies), and assert the results. This ensures the extension correctly integrates with the services provided by VS Code and other extensions.

## Directory Structure & Key Files

```
test/
├── fixtures/                      # Contains test data and projects used by tests
│   └── java-spring-test-project/     # A sample Java Spring Boot project used for:
│       │                           #   - E2E tests interacting with Java LSP
│       │                           #   - Providing realistic context for unit tests (mocking LSP responses based on this project)
│       └── src/main/java/com/example/testfixture/ # Actual Java source files with controllers/endpoints
│           ├── TestController.java
│           ├── UserController.java
│           ├── OrderController.java
│           ├── ProductController.java
│           └── LegacyController.java
│
├── suite/                         # Contains the test source code (run via Mocha within the test environment)
│   ├── e2e/                       # End-to-End test specific files
│   │   └── e2e.test.ts            # Test definitions for E2E tests (LSP interactions, etc.)
│   │
│   ├── endpoint-discovery.test.ts # Unit tests for endpoint discovery logic (`src/endpoint-discovery.ts`)
│   ├── extension.test.ts          # Basic tests for extension activation/overall health
│   └── index.ts                   # Entry point run by runTest.ts - Configures and runs Mocha, discovering all *.test.ts files.
│
└── runTest.ts                     # Script using `@vscode/test-electron` to:
                                   # - Download/setup a specific VS Code version.
                                   # - Install necessary extensions (e.g., redhat.java).
                                   # - Launch VS Code with the extension loaded and the test workspace open.
                                   # - Execute `test/suite/index.ts` to run all discovered tests.

package.json                       # Defines test scripts (`npm test`) that trigger `runTest.ts`.
tsconfig.json                      # TypeScript configuration including `src/` and `test/` paths.
```

## Test Execution

*   **Run All Tests:** Execute `npm test`. This command performs the following steps:
    1.  Compiles the extension TypeScript code (`src/` and `test/`) to JavaScript in the `out/` directory (`npm run compile`).
    2.  Executes the `out/test/runTest.js` script.
    3.  `runTest.js` launches the VS Code test instance.
    4.  The test instance runs the test runner specified by `extensionTestsPath` (which points to `out/test/suite/index.js`).
    5.  `out/test/suite/index.js` uses Mocha to find and run all test files (`**/*.test.js`) within `out/test/suite/` (including those in `out/test/suite/e2e/`).

## Role of Components

*   **`test/fixtures/java-spring-test-project/`:** Provides a consistent, controlled Java codebase for testing features that rely on Java code analysis (endpoint discovery, call hierarchy). It's opened as the workspace in E2E tests and serves as the basis for creating realistic mock data for unit tests.
*   **`test/suite/endpoint-discovery.test.ts`:** Ensures the logic for finding and parsing REST endpoints (`discoverEndpoints` function) works correctly under various scenarios, primarily using mocked LSP responses based on the fixture project.
*   **`test/suite/e2e/e2e.test.ts`:** Validates the *interaction* between the extension and the VS Code environment, especially the Java Language Server. Tests here open fixture files, execute real LSP commands, wait for results, and assert their validity.
*   **`test/runTest.ts`:** The core test runner script that orchestrates the setup (VS Code download, extension installation) and execution of the test suite within the controlled VS Code instance.
*   **`test/suite/index.ts`:** Configures the Mocha test runner within the VS Code test host, finding and adding all compiled test files (`*.test.js`) for execution.
