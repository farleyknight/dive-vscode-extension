# Diagram Illustration & Visualization Engine (DIVE)

This Visual Studio Code extension integrates with GitHub Copilot Chat to help you generate diagrams directly within the editor. Using the `@diagram` chat participant, you can create various diagrams based on your code or natural language descriptions.

Key features include:

*   **Diagram Generation:** Create Mermaid diagrams (flowcharts, class diagrams, sequence diagrams, relationship diagrams) by interacting with the `@diagram` chat participant.
*   **Slash Commands:** Use commands like `/simpleUML`, `/relationUML`, and `/sequence` for quick diagram generation from the active editor's code.
*   **Code Analysis:** The extension analyzes your code context to generate relevant diagrams.
*   **Diagram Rendering:** Renders generated Mermaid diagrams in a VS Code Webview panel.
*   **Theme Selection:** Allows choosing different themes for the rendered Mermaid diagrams.
*   **Save Functionality:** Save diagrams as `.mmd`, `.md`, `.svg`, or `.png` files using the `Export` feature

## Class Diagram Example (`@diagram /simpleUML`)

![](docs/uml_diagram.png)

## Class Diagram Example (`@diagram /relationUML`)

![](docs/relation_diagram.png)

## Sequence Diagram Example (`@diagram /sequence`)

![](docs/sequence_diagram.png)

## Theme Selection

![](docs/themes.png)

## Export Formats

![](docs/export_options.png)