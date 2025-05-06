# Project Structure Overview

This document provides an overview of the main directories and key files within this project, explaining their primary roles.

## `/docs` Directory

This directory contains all project-related documentation.

*   `adding_buttons_to_chat.md`: Describes how to add buttons to the chat interface.
*   `completed_major_tasks.md`: Lists recently completed major development tasks.
*   `current_state.md`: Contains a snapshot or detailed description of the project's current state at a point in time.
*   `details.md`: Provides detailed information on specific aspects of the project or features.
*   `development_principles.md`: Outlines guiding principles for development, including coding standards and best practices.
*   `export_options.png`: Image file, likely showing export options in the UI.
*   `mistakes.md`: Documents anti-patterns or mistakes to avoid, learned from past development.
*   `next_steps.md`: Tracks the current development focus and upcoming tasks.
*   `relation_diagram.png`: Image file, likely a diagram showing relationships between components.
*   `rest_endpoint_feature.md`: Detailed documentation specifically for the REST endpoint feature.
*   `run_tests.md`: Instructions or notes on how to run project tests.
*   `scripts.md`: Documentation for any utility scripts used in the project.
*   `sequence_diagram.png`: Image file, likely a sequence diagram illustrating a process or interaction.
*   `testing_infrastructure.md`: Describes the setup and tools used for testing.
*   `themes.png`: Image file, possibly related to UI themes.
*   `uml_diagram.png`: Image file, likely a UML diagram for system design.
*   `project_structure.md`: This file - an overview of the project's directory and file structure.

## `/src` Directory (Assumed)

This directory typically contains the main source code for the application/extension.
*   `endpoint-disambiguation.ts`: (Based on existing files) Likely handles the logic for disambiguating between multiple discovered endpoints.
*   `endpoint-discovery.ts`: (Based on existing files) Likely responsible for finding and collecting information about endpoints in the codebase.
*   `call-hierarchy.ts`: Intended to house the logic for finding callers of a given function (e.g., an endpoint handler).
*   *(Other core logic files would reside here)*

## `/test` Directory (Assumed)

This directory typically contains all test files.
*   `/test/suite`: Contains integration or suite-level tests.
    *   `endpoint-disambiguation.test.ts`: (Based on existing files) Unit/integration tests for the endpoint disambiguation logic.
    *   `endpoint-discovery.test.ts`: (Based on existing files) Unit/integration tests for the endpoint discovery logic.
    *   `call-hierarchy.test.ts`: Intended for unit/integration tests for the call hierarchy logic.
*   *(Other test files, potentially mirroring the `src` structure, would reside here)*

*(Other top-level directories like `node_modules/`, `out/`, `images/`, etc., will be documented as their roles become clearer or more relevant).*