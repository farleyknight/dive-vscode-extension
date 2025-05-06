import * as vscode from 'vscode';
import { EndpointInfo } from './endpoint-discovery'; // Assuming this path, adjust if necessary

// Data Structures
export interface CallLocation {
    uri: vscode.Uri;
    range: vscode.Range; // The range of the calling statement
    callingFunction?: string; // Optional: Name of the function that contains the call
}

export interface CallHierarchyResult {
    targetFunction: EndpointInfo; // Or a simpler representation if only name/location is needed
    callers: CallLocation[];
}

// Exported object for internal helpers to allow stubbing in tests
export const internalHelpers = {
    // This would eventually use grep_search and vscode.workspace.openTextDocument
    _performInternalSearchAndResolve: async (
        searchTerm: string,
        excludeFilePath: string,
        excludeStartLine: number,
        excludeEndLine: number
    ): Promise<Array<{ uri: vscode.Uri; range: vscode.Range; lineText: string }>> => {
        console.log(`internalHelpers._performInternalSearchAndResolve called with searchTerm: ${searchTerm}, exclude: ${excludeFilePath} L${excludeStartLine}-${excludeEndLine} (Not implemented yet)`);
        // In real implementation:
        // 1. Use grep_search to find searchTerm globally.
        // 2. For each grep match:
        //    - If match.uri is excludeFilePath and match.lineNumber is between excludeStartLine and excludeEndLine, IGNORE (it's the definition).
        //    - Otherwise, openTextDocument(match.uri) to get lineText at match.lineNumber.
        //    - Construct and return the object { uri, range (from grep), lineText }.
        return [];
    },

    // This would eventually use vscode.workspace.openTextDocument
    _getLineTextForCheck: async (uri: vscode.Uri, lineNumber: number): Promise<string | undefined> => {
        console.log(`internalHelpers._getLineTextForCheck called for ${uri.fsPath} L${lineNumber} (Not implemented yet)`);
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            return document.lineAt(lineNumber).text;
        } catch (error) {
            console.error(`Failed to get line text for ${uri.fsPath} L${lineNumber}:`, error);
            return undefined;
        }
    }
};

/**
 * Finds direct callers of a given endpoint's handler method.
 * For MVP, this will use a workspace-wide text search.
 * @param endpoint The endpoint information for which to find callers.
 * @returns A CallHierarchyResult if callers are found or an empty array if none, null on error.
 */
export async function findCallers(
    endpoint: EndpointInfo,
    // token?: vscode.CancellationToken // Placeholder for future cancellation support
): Promise<CallHierarchyResult | null> {
    if (!endpoint || !endpoint.handlerMethodName) {
        console.error('CallHierarchy: Invalid endpoint provided to findCallers.');
        return null;
    }

    const callers: CallLocation[] = [];
    const searchTerm = endpoint.handlerMethodName;

    console.log(`CallHierarchy: Searching for callers of ${searchTerm} in workspace...`);

    // Use the internal search function via the exported helper object
    const potentialMatches = await internalHelpers._performInternalSearchAndResolve(
        searchTerm,
        endpoint.uri.fsPath, // Path of the file containing the endpoint definition
        endpoint.startLine,    // Start line of the endpoint definition
        endpoint.endLine       // End line of the endpoint definition
    );

    for (const match of potentialMatches) {
        // Basic comment check (can be made more robust)
        const lineText = match.lineText.trim();
        if (lineText.startsWith('//') || lineText.startsWith('/*') || lineText.startsWith('*')) {
            // A more sophisticated check might involve _getLineTextForCheck if lineText from search isn't enough
            // or if we need to check multi-line block comment context.
            // For now, direct lineText check from _performInternalSearchAndResolve is used.
            continue;
        }

        // TODO: Add more sophisticated filtering if needed, e.g., ensuring it's a valid call syntax

        callers.push({
            uri: match.uri,
            range: match.range,
            // callingFunction: undefined, // Placeholder for future enhancement
        });
    }

    return {
        targetFunction: endpoint,
        callers,
    };
}