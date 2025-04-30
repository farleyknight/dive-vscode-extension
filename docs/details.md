## Features

This extension provides the following features:

### Chat Participants

1.  **`@diagram` (`dive.diagram`):**
    *   **Description:** "What diagram can I draw for you?" (Provided via `package.json`)
    *   **Purpose:** Assists with generating various diagrams from code or descriptions.
    *   **Slash Commands:**
        *   `/simpleUML`: Generate a *simple* Mermaid diagram (flowchart, class, or sequence, max 10 lines) from the code in the current editor.
        *   `/relationUML`: Show a Mermaid diagram depicting class/object relationships (inheritance, composition, etc.) based on the current editor's code.
        *   `/sequence`: Generate a sequence diagram from the current file's code analysis.
    *   **Default Behavior:** Handles general diagram requests and provides guidance.

### Language Model Tools

The extension defines and registers the following tools that the language model can use:

1.  **`dive_getCodeContext` (Get Code Context):**
    *   Retrieves code from the user's active text editor (preferring the selection, otherwise the entire file).
2.  **`dive_renderDiagram` (Render Mermaid Diagram):**
    *   Takes Mermaid syntax (optionally including `%% theme: <theme_name> %%`) and displays it as a diagram in a VS Code Webview panel.

### VS Code Commands (Command Palette)

-   **`diagram.saveAs`:** Save the displayed Mermaid diagram to a file (supports `.mmd`, `.md`, `.svg`, `.png`). Requires Mermaid CLI (`mmdc`) for SVG/PNG export.

## Installing DIVE

1.  **Install Dependencies:** Run `npm install` in the terminal.
2.  **Compile/Watch:** Run `npm run watch` to compile the TypeScript code and watch for changes.
3.  **Run Extension:** Press `F5` or use the `Run Extension` target in the Debug View (Run and Debug side bar). This will:
    *   Start the `npm: watch` task if not already running.
    *   Launch a new VS Code window (Extension Development Host) with the extension activated.
    *   You should see the `@diagram` chat participant available in the Chat view.

**Alternative: Compile and Run from Terminal**

You can also compile and run the extension directly from the terminal:

```bash
# Compile the extension
npm run compile

# Launch VS Code with the extension in development mode
# (Replace 'code' with 'code-insiders' if using the Insiders build)
code --extensionDevelopmentPath=$PWD --log debug
```

## Development

-   **Compile:** `npm run compile` (runs `tsc -p ./`)
-   **Lint:** `npm run lint` (runs `eslint`)
-   **Watch:** `npm run watch` (runs `tsc -watch -p ./`)