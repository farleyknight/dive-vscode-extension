import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os'; // Added for temporary directory
import { execFile } from 'child_process'; // Added for running mmdc
import { registerSimpleParticipant } from './simple';
import { registerDiagramTools } from './diagram-tools';
import { promisify } from 'util';

export function activate(context: vscode.ExtensionContext) {
    registerSimpleParticipant(context);
    // registerChatLibChatParticipant(context);

    registerDiagramTools(context);

    // Register the save command
    context.subscriptions.push(vscode.commands.registerCommand('diagram.saveAs', async (mermaidSyntax: string, defaultFileName: string) => {
        if (!mermaidSyntax) {
            vscode.window.showErrorMessage('No diagram syntax available to save.');
            return;
        }

        const defaultUri = vscode.workspace.workspaceFolders
            ? vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, `${defaultFileName || 'diagram'}`)
            : undefined;

        const possibleFormats = {
            'Mermaid (.mmd)': ['mmd'],
            'Markdown (.md)': ['md'],
            'Scalable Vector Graphics (.svg)': ['svg'],
            'Portable Network Graphics (.png)': ['png']
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
                } else if (fileExtension === 'svg' || fileExtension === 'png') {
                    await exportDiagramWithMMDC(mermaidSyntax, saveUri, fileExtension, context);
                } else {
                    vscode.window.showErrorMessage(`Unsupported file format: .${fileExtension}`);
                }
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to save diagram: ${err.message}`);
                console.error('Save diagram error:', err);
            }
        }
    }));
}

// Helper function to find mmdc executable
async function findMmdcExecutable(context: vscode.ExtensionContext): Promise<string | null> {
    // 1. Check bundled node_modules (adjust path as needed)
    const bundledPath = path.join(context.extensionPath, 'node_modules', '.bin', os.platform() === 'win32' ? 'mmdc.cmd' : 'mmdc');
    try {
        await fs.promises.access(bundledPath, fs.constants.X_OK);
        console.log(`Found mmdc in bundled node_modules: ${bundledPath}`);
        return bundledPath;
    } catch (err) {
        // Not found or not executable, continue searching
        console.log(`MMDC not found or not executable in bundled node_modules: ${bundledPath}`);
    }

    // 2. Check workspace node_modules (if workspace exists)
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspacePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'node_modules', '.bin', os.platform() === 'win32' ? 'mmdc.cmd' : 'mmdc');
        try {
            await fs.promises.access(workspacePath, fs.constants.X_OK);
            console.log(`Found mmdc in workspace node_modules: ${workspacePath}`);
            return workspacePath;
        } catch (err) {
            // Not found or not executable, continue searching
            console.log(`MMDC not found or not executable in workspace node_modules: ${workspacePath}`);
        }
    }

    // 3. Check common global installation paths (this is less reliable)
    const command = os.platform() === 'win32' ? 'where' : 'which';
    const args = ['mmdc'];

    try {
        const promisifiedExecFile = promisify(execFile);
        const { stdout } = await promisifiedExecFile(command, args);
        const globalPath = stdout.trim().split('\n')[0]; // Take the first result
        if (globalPath) {
            await fs.promises.access(globalPath, fs.constants.X_OK);
            console.log(`Found mmdc via ${command}: ${globalPath}`);
            return globalPath;
        } else {
            console.log(`MMDC not found via ${command}.`);
        }
    } catch (err) {
        console.log(`Error finding mmdc via ${command}:`, err);
    }

    return null; // Not found
}

// Helper function to export using MMDC
async function exportDiagramWithMMDC(mermaidSyntax: string, outputUri: vscode.Uri, format: 'svg' | 'png', context: vscode.ExtensionContext) {
    const mmdcPath = await findMmdcExecutable(context);

    if (!mmdcPath) {
        vscode.window.showErrorMessage('Mermaid CLI (mmdc) not found. Please ensure it is installed globally (`npm install -g @mermaid-js/mermaid-cli`) or in your project devDependencies (`npm install --save-dev @mermaid-js/mermaid-cli`).');
        return;
    }

    // Create a temporary file for the Mermaid input
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vscode-mermaid-'));
    const tempInputFile = path.join(tempDir, 'input.mmd');
    const tempOutputFile = path.join(tempDir, `output.${format}`); // MMDC uses -o for output file

    try {
        await fs.promises.writeFile(tempInputFile, mermaidSyntax, 'utf8');

        const args = [
            '-i', tempInputFile,
            '-o', tempOutputFile,
            '-t', 'dark', // Or make theme configurable
            '-b', 'transparent' // Optional: set background color
        ];

        const promisifiedExecFile = promisify(execFile);
        console.log(`Executing MMDC: ${mmdcPath} ${args.join(' ')}`);

        await promisifiedExecFile(mmdcPath, args);

        // Check if the output file was actually created
        try {
            await fs.promises.access(tempOutputFile);
        } catch (accessErr) {
            console.error(`MMDC did not create the output file: ${tempOutputFile}`, accessErr);
            throw new Error(`Mermaid CLI (mmdc) failed to generate the ${format.toUpperCase()} file. Check console logs (Developer Tools) for details.`);
        }

        // Read the generated file and write it to the target URI
        const outputData = await fs.promises.readFile(tempOutputFile);
        await vscode.workspace.fs.writeFile(outputUri, outputData);

        vscode.window.showInformationMessage(`Diagram exported as ${format.toUpperCase()}: ${outputUri.fsPath}`);

    } catch (err: any) {
        console.error('MMDC execution failed:', err);
        // Attempt to provide a more informative error message
        let errorMessage = `Failed to export diagram as ${format.toUpperCase()}.`;
        if (err.stderr) {
            console.error('MMDC stderr:', err.stderr);
            // Try to find common error patterns in stderr
            if (err.stderr.includes('Syntax error') || err.stderr.includes('parse error')) {
                errorMessage += ' There might be a syntax error in the Mermaid code.';
            } else if (err.stderr.includes('command not found') || err.stderr.includes('ENOENT')) {
                errorMessage += ` Mermaid CLI (mmdc) command failed. Ensure it's correctly installed and in your PATH. Path used: ${mmdcPath}`;
            } else {
                errorMessage += ` Error details: ${err.stderr.split('\n')[0] || err.message}`;
            }
        } else {
            errorMessage += ` Error: ${err.message}`;
        }
        vscode.window.showErrorMessage(errorMessage);
    } finally {
        // Clean up the temporary directory
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        console.log(`Cleaned up temporary directory: ${tempDir}`);
    }
}

// This method is called when your extension is deactivated
export function deactivate() { }
