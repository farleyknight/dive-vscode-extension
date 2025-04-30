import * as vscode from 'vscode';
import { getMermaidWebviewHtml } from './views/mermaid-webview-template';

/**
 * Generates the HTML content for the Mermaid Webview.
 * @param mermaidDiagram The Mermaid diagram syntax string.
 * @param theme The Mermaid theme to use (default: 'default')
 */
function getWebviewContent(mermaidDiagram: string, theme: string = 'default'): string {
	return getMermaidWebviewHtml(mermaidDiagram, theme);
}

/**
 * Creates and shows a VS Code Webview panel to render the given Mermaid diagram.
 * @param mermaidDiagram The Mermaid diagram syntax string.
 * @param extensionContext The extension context for managing disposables.
 * @param theme The Mermaid theme to use (default: 'default')
 */
function renderDiagramInWebview(mermaidDiagram: string, extensionContext: vscode.ExtensionContext, theme: string = 'default') {
	const panel = vscode.window.createWebviewPanel(
		'mermaidDiagram', // Identifies the type of the webview. Used internally
		'Mermaid Diagram', // Title of the panel displayed to the user
		vscode.ViewColumn.Beside, // Editor column to show the new webview panel in.
		{ // Webview options
			// Enable scripts in the webview
			enableScripts: true,
			// Keep context when hidden
			retainContextWhenHidden: true
		}
	);

	// Set the webview's HTML content with theme
	panel.webview.html = getWebviewContent(mermaidDiagram, theme);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        message => {
            if (message.command === 'exportDiagram') {
                 console.log(`Received export request for format: ${message.format} with theme: ${message.theme}`);
                // Trigger the save command with syntax, format, AND theme
                vscode.commands.executeCommand('diagram.saveAs', message.syntax, message.format, message.theme)
                    .then(undefined, err => {
                        console.error("Error executing diagram.saveAs command:", err);
                        vscode.window.showErrorMessage(`Failed to export diagram: ${err.message || err}`);
                    });
            }
        },
        undefined,
        extensionContext.subscriptions
    );

	// Handle disposal (when the panel is closed)
	panel.onDidDispose(
		() => {
			// Clean up resources, if any
			console.log('Mermaid panel disposed');
		},
		null,
		extensionContext.subscriptions
	);
}

// Interface for GetCodeContextTool parameters (empty object)
interface IGetCodeContextParameters {
	// No parameters needed
}

export class GetCodeContextTool implements vscode.LanguageModelTool<IGetCodeContextParameters> {
	readonly name = 'dive_getCodeContext'; // Must match package.json
	readonly description = 'Gets the code context from the active editor, preferring the current selection.';
	readonly tags: string[] = ['dive'];

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IGetCodeContextParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('No active text editor found.')
			]);
		}

		const selection = editor.selection;
		let codeContext: string;
		if (!selection.isEmpty) {
			codeContext = editor.document.getText(selection);
		} else {
			codeContext = editor.document.getText();
		}

		return new vscode.LanguageModelToolResult([
			new vscode.LanguageModelTextPart(codeContext)
		]);
	}

	async prepareInvocation(
		_options: vscode.LanguageModelToolInvocationPrepareOptions<IGetCodeContextParameters>,
		_token: vscode.CancellationToken
	): Promise<{ invocationMessage: string }> {
		return {
			invocationMessage: 'Getting code from the active editor...',
		};
	}
}

// Interface for RenderDiagramTool parameters
interface IRenderDiagramParameters {
	mermaidDiagram: string;
}

export class RenderDiagramTool implements vscode.LanguageModelTool<IRenderDiagramParameters> {
	readonly name = 'dive_renderDiagram'; // Must match package.json
	readonly description = 'Renders a Mermaid diagram string in a VS Code Webview panel.';
	readonly tags: string[] = ['dive'];
	private extensionContext: vscode.ExtensionContext;

	constructor(context: vscode.ExtensionContext) {
		this.extensionContext = context;
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IRenderDiagramParameters>,
		_token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		const params = options.input;
		if (!params.mermaidDiagram) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('Error: No Mermaid diagram string provided in tool input.')
			]);
		}

		try {
			// Extract theme from the diagram string if specified
			const themeMatch = params.mermaidDiagram.match(/%%\s*theme:\s*(\w+)\s*%%/);
			const theme = themeMatch ? themeMatch[1] : 'dark'; // Default to dark if not specified

			// Remove theme directive if present
			const cleanDiagram = params.mermaidDiagram.replace(/%%\s*theme:\s*\w+\s*%%\n?/, '');

			renderDiagramInWebview(cleanDiagram, this.extensionContext, theme);

			const successMessage = 'Diagram rendered successfully in a webview panel.';
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(successMessage)
			]);
		} catch (error: any) {
			console.error('Failed to render diagram:', error);
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Error rendering diagram: ${error.message || error}`)
			]);
		}
	}

	async prepareInvocation(
		_options: vscode.LanguageModelToolInvocationPrepareOptions<IRenderDiagramParameters>,
		_token: vscode.CancellationToken
	): Promise<{ invocationMessage: string }> {
		return {
			invocationMessage: 'Rendering diagram in webview...',
		};
	}
}