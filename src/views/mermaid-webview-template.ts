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
			 <!-- Replace single button with two -->
			 <button id="export-svg-button">Export SVG</button>
			 <button id="export-png-button">Export PNG</button>
			 <!-- Removed Single Export Button and Dropdown -->
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
		const exportSvgButton = document.getElementById('export-svg-button');
		const exportPngButton = document.getElementById('export-png-button');

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
                    // Disable export buttons if no syntax
                    if (exportSvgButton) exportSvgButton.disabled = true;
                    if (exportPngButton) exportPngButton.disabled = true;
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
					// Disable export buttons on error
					if (exportSvgButton) exportSvgButton.disabled = true;
					if (exportPngButton) exportPngButton.disabled = true;
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
						 // Enable export buttons on successful render
						 if (exportSvgButton) exportSvgButton.disabled = false;
						 if (exportPngButton) exportPngButton.disabled = false;
					}
				} else {
					// Handle cases where svg is undefined, null, or empty string
					console.error('Mermaid rendering returned invalid SVG:', svg);
					if (errorDiv) {
						errorDiv.textContent = 'Mermaid rendering failed to produce valid SVG.\\n\\nSyntax:\\n' + rawMermaidSyntax;
						errorDiv.style.display = 'block';
					}
					container.innerHTML = '<p style="color:red;">Failed to render diagram. SVG output was invalid. Check syntax and Developer Tools console.</p>';
					// Disable export buttons on error
					if (exportSvgButton) exportSvgButton.disabled = true;
					if (exportPngButton) exportPngButton.disabled = true;
				}

			} catch (error) {
				console.error('Mermaid rendering error caught:', error);
				if (errorDiv) {
					errorDiv.textContent = 'Mermaid Syntax Error: ' + (error?.message || String(error)) + '\\n\\nSyntax:\\n' + rawMermaidSyntax;
					errorDiv.style.display = 'block';
				}
				 // Provide fallback content in the main container on error
                 container.innerHTML = '<p style="color:red;">Error rendering diagram. Check syntax and Developer Tools console (Developer: Open Webview Developer Tools).</p>';
				 // Disable export buttons on error
				 if (exportSvgButton) exportSvgButton.disabled = true;
				 if (exportPngButton) exportPngButton.disabled = true;
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

		// --- Client-Side Export Logic ---

		function exportSVG() {
			console.log('Exporting SVG...');
			const svgElement = document.querySelector('#mermaid-container svg');
			if (!svgElement) {
				console.error('SVG element not found for export.');
				vscode.postMessage({ type: 'error', message: 'Could not find the rendered SVG to export.' });
				return;
			}
			const svgData = new XMLSerializer().serializeToString(svgElement);
			// Send data back to the extension instead of triggering download
			vscode.postMessage({
				command: 'exportData',
				format: 'svg',
				data: svgData,
				theme: themeSelector.value // Also send theme in case needed later
			});
		}

		function exportPNG() {
			console.log('Exporting PNG...');
			const svgElement = document.querySelector('#mermaid-container svg');
			if (!svgElement) {
				console.error('SVG element not found for PNG export.');
				vscode.postMessage({ type: 'error', message: 'Could not find the rendered SVG to create PNG.' });
				return;
			}

			const svgData = new XMLSerializer().serializeToString(svgElement);
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			const img = new Image();

			// Store cleanup function
			let cleanupObjectUrl = () => {};

			img.onload = () => {
				console.log('Image loaded, drawing to canvas...');
				// Get SVG dimensions
				const svgRect = svgElement.getBoundingClientRect();

				// Add some padding maybe?
				const padding = 10;
				canvas.width = svgRect.width + padding * 2;
				canvas.height = svgRect.height + padding * 2;

				// Draw the image onto the canvas
				ctx.drawImage(img, padding, padding, svgRect.width, svgRect.height);

				try {
					console.log('Converting canvas to PNG data URL...');
					const pngDataUrl = canvas.toDataURL('image/png');
					// Send data URL back to extension
					vscode.postMessage({
						command: 'exportData',
						format: 'png',
						data: pngDataUrl, // Send base64 data URL
						theme: themeSelector.value // Also send theme
					});
				} catch (e) {
					console.error('Error during canvas.toDataURL:', e);
					vscode.postMessage({ type: 'error', message: 'An error occurred while creating the PNG data.' });
				}
			};

			img.onerror = (e) => {
				cleanupObjectUrl(); // Clean up URL on error too
				cleanupObjectUrl = () => {};
				console.error('Error loading SVG into image element:', e);
				vscode.postMessage({ type: 'error', message: 'Failed to load the SVG diagram for PNG conversion.' });
			};

			console.log('Setting image source to SVG data URI...');
			const svgDataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
			img.src = svgDataUri;
		}

		// --- Event Listeners ---

		// Initial render
		renderMermaid(initialTheme);

		// Handle theme changes
		themeSelector.addEventListener('change', (event) => {
			const newTheme = event.target.value;
			console.log('Theme changed to:', newTheme);
			renderMermaid(newTheme);
		});

		// Handle Export Button Clicks
		if (exportSvgButton) {
			exportSvgButton.addEventListener('click', exportSVG);
		} else {
			console.error('Export SVG button not found');
		}

		if (exportPngButton) {
			exportPngButton.addEventListener('click', exportPNG);
		} else {
			console.error('Export PNG button not found');
		}

		// Remove old message listener if it exists
		/*
		window.addEventListener('message', event => {
			// Handle messages FROM the extension (if any)
			// const message = event.data;
		});
		*/
	</script>
</body>
</html>`;
}