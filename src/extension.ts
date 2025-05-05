import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { registerSimpleParticipant } from './diagramParticipant';
import { registerDiagramTools } from './diagram-tools';

export function activate(context: vscode.ExtensionContext) {
    registerSimpleParticipant(context);
    // registerChatLibChatParticipant(context);

    registerDiagramTools(context);

    // Register the save command
    context.subscriptions.push(vscode.commands.registerCommand('diagram.saveAs', async (mermaidSyntax: string, defaultFileName: string /*, theme: string = 'default' */) => {
        if (!mermaidSyntax) {
            vscode.window.showErrorMessage('No diagram syntax available to save.');
            return;
        }

        const defaultUri = vscode.workspace.workspaceFolders
            ? vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, `${defaultFileName || 'diagram'}`)
            : undefined;

        const possibleFormats = {
            'Mermaid (.mmd)': ['mmd'],
            'Markdown (.md)': ['md']
            // Removed SVG/PNG options
            // 'Scalable Vector Graphics (.svg)': ['svg'],
            // 'Portable Network Graphics (.png)': ['png']
        };

        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: defaultUri,
            filters: possibleFormats,
            saveLabel: 'Export Diagram'
        });

        if (saveUri) {
            const fileExtension = path.extname(saveUri.fsPath).toLowerCase().substring(1);

            try {
                if (fileExtension === 'mmd') {
                    await vscode.workspace.fs.writeFile(saveUri, Buffer.from(mermaidSyntax, 'utf8'));
                    vscode.window.showInformationMessage(`Diagram saved as MMD: ${saveUri.fsPath}`);
                } else if (fileExtension === 'md') {
                    const markdownContent = `\`\`\`mermaid\n${mermaidSyntax}\n\`\`\``;
                    await vscode.workspace.fs.writeFile(saveUri, Buffer.from(markdownContent, 'utf8'));
                    vscode.window.showInformationMessage(`Diagram saved as Markdown: ${saveUri.fsPath}`);
                // Removed SVG/PNG handling
                // } else if (fileExtension === 'svg' || fileExtension === 'png') {
                //    await exportDiagramWithMMDC(mermaidSyntax, saveUri, fileExtension as ('svg' | 'png'), context, theme);
                } else {
                    // Inform user about client-side export if they somehow choose SVG/PNG
                    if (fileExtension === 'svg' || fileExtension === 'png') {
                         vscode.window.showInformationMessage(`To save as ${fileExtension.toUpperCase()}, please use the 'Export ${fileExtension.toUpperCase()}' button directly within the diagram view.`);
                    } else {
                        vscode.window.showErrorMessage(`Unsupported file format for direct save: .${fileExtension}. Please use .mmd or .md.`);
                    }
                }
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to save diagram: ${err.message}`);
                console.error('Save diagram error:', err);
            }
        }
    }));
}

// This method is called when your extension is deactivated
export function deactivate() { }
