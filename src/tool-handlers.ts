import * as vscode from 'vscode';
import { getMermaidWebviewHtml } from './views/mermaid-webview-template';

// Removed renderDiagramInWebview function as it was only used by the removed RenderDiagramTool

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

// Removed IRenderDiagramParameters interface and RenderDiagramTool class