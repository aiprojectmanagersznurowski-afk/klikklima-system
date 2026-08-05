---
name: business-workflow-doc
description: >-
  Automates the creation and updating of business workflow documentation.
  Generates Markdown with Mermaid flowcharts, Database implications,
  Playwright BDD test scenarios, and automatically renders a PNG visualization.
---

# Business Workflow Documenter

## Overview
This skill standardizes how business logic and workflows are documented in the Monorepo. Whenever you define or update a business process (like a user journey, decision tree, or Triage), use this skill to ensure consistency, generate test cases, and automatically render diagrams.

## Workflow

### 1. File Naming and Location
All business workflows must be saved in the `docs/workflows/` directory relative to the repository root.
The file naming convention is `[nazwa_workflow]_workflow.md` (e.g., `triage_workflow.md`).
If the folder does not exist, create it.

### 2. Generate/Update the Markdown Content
Use the `write_to_file` or `replace_file_content` tool to populate the markdown file with the following exact structure:

1. **Title & Description**: Provide a brief human-readable overview of the workflow.
2. **Mermaid Flowchart**: Write the detailed logic using ````mermaid ```` syntax.
3. **`## Implikacje dla Bazy Danych`**: Explicitly write out the JSON or SQL structures that represent the outputs of this workflow.
4. **`## Scenariusze Testowe (Playwright)`**: For each ending path/branch in the workflow, write out BDD (Given, When, Then) test scenarios. Example:
   - **Scenariusz: Ścieżka B (Multisplit)**
     - **Given** użytkownik wybiera dom i 2 pokoje
     - **When** wprowadza metraż 25m2 i 35m2
     - **Then** trafia do bramki Stan Lokalu
5. **`## Wizualizacja Diagramu`**: Include the following exact markdown image tag at the end of the document:
   `![Diagram [Nazwa]](./[nazwa_workflow]_workflow.png)`

### 3. Generate the PNG Visualization
Mermaid code must always be accompanied by a rendered `.png` image for visibility on GitHub.
Execute the following process:
1. Create a temporary file (e.g., `temp.mmd`) containing ONLY the raw mermaid code (without the markdown backticks).
2. Run the Mermaid CLI via the `run_command` tool:
   `npx -y @mermaid-js/mermaid-cli@10.8.0 -i temp.mmd -o docs/workflows/[nazwa_workflow]_workflow.png`
3. Delete the temporary file.

*Note: Ensure you wait for the background task to complete to confirm the PNG was generated successfully.*

### 4. Updating Existing Workflows
If a user requests a change to an existing workflow, modify the `[nazwa_workflow]_workflow.md` file in place. **Crucially, you must repeat Step 3** to overwrite the `.png` file so the visualization stays in sync with the updated Mermaid code.
