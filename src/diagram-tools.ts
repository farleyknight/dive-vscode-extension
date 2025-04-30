import * as vscode from 'vscode';
import { GetCodeContextTool, RenderDiagramTool } from './tool-handlers';

/**
 * Registers diagram-specific language model tools
 */
export function registerDiagramTools(context: vscode.ExtensionContext) {
    // Register the getCodeContext tool
    context.subscriptions.push(
        vscode.lm.registerTool('dive_getCodeContext', new GetCodeContextTool())
    );

    // Register the renderDiagram tool (passing the extension context)
    context.subscriptions.push(
        vscode.lm.registerTool('dive_renderDiagram', new RenderDiagramTool(context))
    );
}