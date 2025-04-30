# Project Scripts

This document describes the npm scripts available in this project, defined in `package.json`.

## Development Scripts

-   **`npm run compile`**
    -   Compiles the TypeScript code from the `src` directory to JavaScript in the `out` directory using `tsc`.
    -   Uses the configuration defined in `tsconfig.json`.

-   **`npm run lint`**
    -   Runs the ESLint linter to check the codebase for potential errors and style issues.

-   **`npm run watch`**
    -   Runs the TypeScript compiler (`tsc`) in watch mode.
    -   Automatically recompiles the code whenever a `.ts` file is saved.
    -   Useful during active development to get immediate feedback.

## Release Scripts

These scripts automate the process of versioning the extension and pushing the changes to GitHub, which triggers the release workflow defined in `.github/workflows/release.yml`.

**Important:** These scripts perform a `git push`. Ensure your working directory is clean and you are ready to release before running them.

-   **`npm run release:patch`**
    -   Increments the patch version number in `package.json` (e.g., 1.0.0 -> 1.0.1).
    -   Creates a git commit for the version bump.
    -   Creates a git tag corresponding to the new version (e.g., `v1.0.1`).
    -   Pushes the commit and the tag to the remote repository (`origin`).

-   **`npm run release:minor`**
    -   Increments the minor version number in `package.json` (e.g., 1.0.1 -> 1.1.0).
    -   Creates the git commit and tag.
    -   Pushes the commit and tag to the remote repository.

-   **`npm run release:major`**
    -   Increments the major version number in `package.json` (e.g., 1.1.0 -> 2.0.0).
    -   Creates the git commit and tag.
    -   Pushes the commit and tag to the remote repository.

## VS Code Specific Scripts

-   **`npm run vscode:prepublish`**
    -   This script is automatically run by VS Code before packaging the extension.
    -   It currently runs `npm run compile` to ensure the code is compiled before packaging.