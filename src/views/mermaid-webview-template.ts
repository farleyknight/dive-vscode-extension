/**
 * Generates the HTML content for the Mermaid Webview.
 * @param mermaidDiagram The Mermaid diagram syntax string.
 * @param theme The Mermaid theme to use (default: 'default')
 * @returns The HTML string for the webview.
 */
export function getMermaidWebviewHtml(mermaidDiagram: string, theme: string = 'default'): string {
	// Define themes
	const themes = ['default', 'neutral', 'dark', 'forest'];
	const defaultTheme = themes.includes(theme) ? theme : 'default'; // Use provided theme or fallback

	// Ensure diagram syntax is properly escaped for embedding in JS/HTML if needed
	// For this case, embedding in <pre> is fine, but for JS variable, use JSON.stringify
	// Using textContent directly in the script is now preferred, avoiding double escaping issues.
	// const escapedMermaidSyntax = JSON.stringify(mermaidDiagram);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Mermaid Diagram</title>
	<style>
		body {
			margin: 20px;
			padding-top: 50px; /* Increased space for controls */
			/* Basic theme vars for dropdown */
			 color: var(--vscode-editor-foreground);
			 background-color: var(--vscode-editor-background);
			 display: flex;
			 flex-direction: column;
			 height: 100vh; /* Ensure body takes full height */
			 box-sizing: border-box;
		}
		.controls-container { /* Changed from #theme-selector-container */
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			padding: 5px 20px;
			background-color: var(--vscode-editor-background, #222); /* Use VS Code bg or fallback */
			border-bottom: 1px solid var(--vscode-panel-border, #444);
			z-index: 1000;
			display: flex;
			align-items: center;
			gap: 20px; /* Spacing between controls */
			box-sizing: border-box;
		 }
		 .control-group {
			 display: flex;
			 align-items: center;
			 gap: 5px; /* Spacing within a group */
		 }
		 .controls-container label {
			 color: var(--vscode-editor-foreground, #ccc); /* Use VS Code fg or fallback */
		 }
		 .controls-container select, .controls-container button {
			 padding: 4px 8px;
			 background-color: var(--vscode-input-background);
			 color: var(--vscode-input-foreground);
			 border: 1px solid var(--vscode-input-border);
			 border-radius: 3px;
			 cursor: pointer;
		 }
		 .controls-container select:hover, .controls-container button:hover {
			 background-color: var(--vscode-button-hoverBackground);
             color: #fff; /* Ensure text is readable on hover */
		 }
		 #mermaid-container { /* Container for the diagram */
			 flex-grow: 1; /* Allow container to grow */
			 overflow: auto; /* Add scrollbars if diagram is too large */
			 text-align: center; /* Center diagram */
			 margin-top: 10px; /* Space below controls */
		 }
		 .mermaid { /* Mermaid diagram itself */
			 display: inline-block; /* Prevent breaking */
             margin: 0 auto; /* Center horizontally */
		 }
		 #mermaidError { /* Basic error styling */
			display: none;
			background-color: #ffebee;
			color: #c62828;
			padding: 10px;
			margin: 10px 0;
			border-radius: 4px;
			font-family: monospace;
			white-space: pre-wrap;
		}
		/* Dropdown for Export - REMOVED */
		/*
		.dropdown {
			position: relative;
			display: inline-block;
		}
		.dropdown-content {
			display: none;
			position: absolute;
			background-color: var(--vscode-menu-background, #2c2c2c);
			min-width: 160px;
			box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
			z-index: 1;
			border: 1px solid var(--vscode-menu-border, #444);
			padding: 5px 0;
		}
		.dropdown-content button {
			color: var(--vscode-menu-foreground, #ccc);
			padding: 8px 12px;
			text-decoration: none;
			display: block;
			background: none;
			border: none;
			width: 100%;
			text-align: left;
			cursor: pointer;
		}
		.dropdown-content button:hover {
			background-color: var(--vscode-menu-selectionBackground, #04395e);
			color: var(--vscode-menu-selectionForeground, #fff);
		}
		.dropdown:hover .dropdown-content {
			display: block;
		}
		*/
	</style>
</head>
<body>
	 <div class="controls-container">
		<div class="control-group">
			<label for="theme-selector">Theme:</label>
			<select id="theme-selector">
				${themes.map(t => `<option value="${t}" ${t === defaultTheme ? 'selected' : ''}>${t}</option>`).join('')}
			</select>
		</div>
		<div class="control-group">
			 <!-- Single Export Button -->
			 <button id="export-button">Export</button>
			 <!-- Removed Dropdown -->
			 <!--
			 <div class="dropdown">
				 <button class="dropbtn">Export</button>
				 <div class="dropdown-content">
					 <button id="export-md">Export to Markdown (.md)</button>
					 <button id="export-svg">Export to SVG (.svg)</button>
					 <button id="export-png">Export to PNG (.png)</button>
				 </div>
			 </div>
			 -->
		</div>
	</div>

	<!-- Removed H1 title as it's in the panel title -->
	<div id="mermaidError"></div>
	<div id="mermaid-container">
		<pre class="mermaid">
			${mermaidDiagram}
		</pre>
	</div>

	 <!-- Use standard Mermaid v10 build -->
     <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

	 <script>
		// Get VS Code API handle (works in webviews)
        const vscode = acquireVsCodeApi();

		const mermaidContainer = document.getElementById('mermaid-container');
		const themeSelector = document.getElementById('theme-selector');
		const initialTheme = themeSelector.value;

		 // Store the raw syntax from the pre element's text content
        const preElement = document.querySelector('#mermaid-container pre.mermaid');
        const rawMermaidSyntax = preElement ? preElement.textContent.trim() : '';

		 // Define mermaid configuration globally before rendering
         mermaid.initialize({
            startOnLoad: false, // We control rendering
            theme: initialTheme,
            securityLevel: 'loose' // Keep loose security
        });

		 async function renderMermaid(theme) {
			const errorDiv = document.getElementById('mermaidError');
			const container = document.getElementById('mermaid-container'); // Use a different name to avoid confusion

			// Ensure elements exist
			if (!container) {
				console.error("Mermaid container not found!");
				return;
			}
			if (errorDiv) errorDiv.style.display = 'none'; // Hide previous errors

			container.innerHTML = ''; // Clear previous content

			console.log("Raw Mermaid Syntax passed to renderMermaid:", rawMermaidSyntax); // Log the syntax

			try {
                if (!rawMermaidSyntax || typeof rawMermaidSyntax !== 'string' || rawMermaidSyntax.trim() === '') {
					console.warn("No valid diagram syntax found to render.");
                    container.innerHTML = '<p style="color:orange;">No diagram syntax found to render.</p>';
                    return;
                }

                 // Apply the new theme if changed
                 // Update theme *before* rendering
                 mermaid.initialize({ startOnLoad: false, theme: theme, securityLevel: 'loose' });

				console.log('Attempting to render Mermaid diagram with theme:', theme);
                // Use mermaid.render to generate SVG directly
				// Assign a unique ID for each render attempt
				const renderId = 'mermaid-svg-' + Date.now();
                const result = await mermaid.render(renderId, rawMermaidSyntax);
				console.log('Mermaid.render result:', result); // Log the full result object

				// Add check for result object itself
				if (!result || typeof result !== 'object') {
					console.error('Mermaid.render did not return a valid object:', result);
					if (errorDiv) {
						errorDiv.textContent = 'Mermaid rendering failed internally (invalid result object).\\n\\nSyntax:\\n' + rawMermaidSyntax;
						errorDiv.style.display = 'block';
					}
					container.innerHTML = '<p style="color:red;">Failed to render diagram. Internal mermaid error. Check console.</p>';
					return; // Stop further processing
				}

				const svg = result?.svg; // Safely access svg property

				if (typeof svg === 'string' && svg.trim() !== '') {
					console.log('Mermaid rendering successful, inserting SVG.');
					container.innerHTML = svg;
					const bindFunctions = result?.bindFunctions;
					if (bindFunctions) {
						 console.log('Applying bindFunctions.');
						 bindFunctions(container); // Apply interactivity if any
					}
				} else {
					// Handle cases where svg is undefined, null, or empty string
					console.error('Mermaid rendering returned invalid SVG:', svg);
					if (errorDiv) {
						errorDiv.textContent = 'Mermaid rendering failed to produce valid SVG.\\n\\nSyntax:\\n' + rawMermaidSyntax;
						errorDiv.style.display = 'block';
					}
					container.innerHTML = '<p style="color:red;">Failed to render diagram. SVG output was invalid. Check syntax and Developer Tools console.</p>';
				}

			} catch (error) {
				console.error('Mermaid rendering error caught:', error);
				if (errorDiv) {
					errorDiv.textContent = 'Mermaid Syntax Error: ' + (error?.message || String(error)) + '\\n\\nSyntax:\\n' + rawMermaidSyntax;
					errorDiv.style.display = 'block';
				}
				 // Provide fallback content in the main container on error
                 container.innerHTML = '<p style="color:red;">Error rendering diagram. Check syntax and Developer Tools console (Developer: Open Webview Developer Tools).</p>';
			}
		}

		 // Initial render
		renderMermaid(initialTheme);

		 // Add event listener for theme changes
		themeSelector.addEventListener('change', (event) => {
			const newTheme = event.target.value;
			console.log('Theme changed to:', newTheme);
			renderMermaid(newTheme);
		});

		// --- Export Logic ---
		// Removed format-specific export function
		/*
		function exportDiagram(format) {
			const currentTheme = themeSelector.value;
			console.log('Exporting diagram as ' + format + ' with theme ' + currentTheme);
			vscode.postMessage({
				command: 'exportDiagram',
				format: format,
				syntax: rawMermaidSyntax, // Send the original syntax back
				theme: currentTheme      // Send the selected theme
			});
		}
		*/

		// Add event listener for the single export button
		document.getElementById('export-button').addEventListener('click', () => {
			const currentTheme = themeSelector.value; // Get current theme
			console.log('Export button clicked. Sending saveDiagram message with theme:', currentTheme);
			vscode.postMessage({
				command: 'saveDiagram', // Use the save command
				syntax: rawMermaidSyntax, // Send syntax back
				theme: currentTheme      // Send the selected theme
			});
		});

	</script>
</body>
</html>`;
}