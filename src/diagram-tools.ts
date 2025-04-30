import * as vscode from 'vscode';
import { GetCodeContextTool } from './tool-handlers';

/**
 * Registers diagram-specific language model tools
 */
export function registerDiagramTools(context: vscode.ExtensionContext) {
    // Register the getCodeContext tool
    context.subscriptions.push(
        vscode.lm.registerTool('dive_getCodeContext', new GetCodeContextTool())
    );
}