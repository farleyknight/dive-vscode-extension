import * as vscode from 'vscode';
import { TextDecoder } from 'util'; // Node.js util

/**
 * Represents information about a discovered REST endpoint.
 */
export interface EndpointInfo {
    method: string; // e.g., 'GET', 'POST'
    path: string; // e.g., '/api/users', '/api/users/{id}'
    uri: vscode.Uri; // File URI
    position: vscode.Position; // Position of the method definition
    handlerMethodName: string; // Name of the Java method handling the endpoint
    description?: string; // Optional description from Javadoc/comments
}

/**
 * Parses annotations (like @RequestMapping, @GetMapping) from a given text block.
 * Very basic parsing, assumes simple annotation format.
 */
function parseAnnotations(text: string): Map<string, string | null> {
    const annotations = new Map<string, string | null>();
    const annotationRegex = /@(\w+)(?:\s*\(\s*"?([^"\)]*)"?\s*\))?/g;
    let match;
    while ((match = annotationRegex.exec(text)) !== null) {
        const name = match[1];
        const value = match[2] || null; // Value inside parentheses, or null if none
        annotations.set(name, value);
    }
    return annotations;
}

/**
 * Normalizes a path segment, ensuring it starts with a slash and removing trailing slashes.
 */
function normalizePath(path: string | null | undefined): string {
    if (!path) return '';
    let normalized = path.trim();
    if (!normalized.startsWith('/')) {
        normalized = '/' + normalized;
    }
    if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}

/**
 * Combines base path and method path correctly.
 */
function combinePaths(basePath: string, methodPath: string): string {
    const normalizedBase = normalizePath(basePath);
    const normalizedMethod = normalizePath(methodPath);
    // Avoid double slash if method path is empty or just "/"
    if (normalizedMethod === '' || normalizedMethod === '/') {
        return normalizedBase === '' ? '/' : normalizedBase;
    }
    return `${normalizedBase}${normalizedMethod}`;
}

/**
 * Maps annotation names to HTTP methods.
 */
function getHttpMethodFromAnnotation(annotationName: string): string | null {
    switch (annotationName) {
        case 'GetMapping': return 'GET';
        case 'PostMapping': return 'POST';
        case 'PutMapping': return 'PUT';
        case 'DeleteMapping': return 'DELETE';
        case 'PatchMapping': return 'PATCH';
        case 'RequestMapping': return 'GET'; // Default for RequestMapping if method not specified
        default: return null;
    }
}

/**
 * Searches the workspace for potential Spring Boot REST endpoints using LSP symbols.
 */
export async function discoverEndpoints(token: vscode.CancellationToken): Promise<EndpointInfo[]> {
    console.log("Attempting to discover endpoints using LSP...");
    const endpoints: EndpointInfo[] = [];
    const classAnnotationsCache = new Map<string, { annotations: Map<string, string | null>, uri: vscode.Uri }>(); // Cache class annotations by URI

    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        console.log("No workspace folder open.");
        return [];
    }

    try {
        // 1. Find all symbols in the workspace
        const allSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            'vscode.executeWorkspaceSymbolProvider',
            '' // Querying for empty string often returns all symbols
        );

        console.log(`Found ${allSymbols?.length ?? 0} total symbols.`);
        if (!allSymbols) return [];

        // Group symbols by file URI for efficient processing
        const symbolsByUri = new Map<string, vscode.SymbolInformation[]>();
        for (const symbol of allSymbols) {
            if (token.isCancellationRequested) return [];
            const uriString = symbol.location.uri.toString();
            if (!symbolsByUri.has(uriString)) {
                symbolsByUri.set(uriString, []);
            }
            symbolsByUri.get(uriString)?.push(symbol);
        }

        // 2. Process each file that contains symbols
        for (const [uriString, symbolsInFile] of symbolsByUri.entries()) {
            if (token.isCancellationRequested) return [];

            const fileUri = vscode.Uri.parse(uriString);
            let document: vscode.TextDocument | undefined;
            try {
                document = await vscode.workspace.openTextDocument(fileUri);
            } catch (err) {
                console.warn(`[discoverEndpoints] Failed to open document ${uriString}: ${err}`);
                continue; // Skip this file if it cannot be opened
            }

            const fileContent = document.getText();
            const lines = fileContent.split(/\r?\n/);

            // Find potential controller classes and their annotations first
            let classLevelBasePath = '';
            let isController = false;
            const classSymbol = symbolsInFile.find(s => s.kind === vscode.SymbolKind.Class);

            // Function to gather relevant annotation lines immediately preceding a symbol
            const getAnnotationText = (symbolStartLine: number): string => {
                let relevantAnnotationLines: string[] = [];
                // Read backwards from the line *before* the symbol definition
                for (let i = symbolStartLine - 1; i >= 0; i--) {
                    const line = lines[i]?.trim(); // Use optional chaining and trim
                    if (line === undefined) break; // Should not happen, but safe guard
                    if (line === '') {
                        break; // Stop at blank line
                    }
                    if (line.startsWith('@')) {
                        relevantAnnotationLines.unshift(line); // Add annotation line to the beginning
                    } else if (line.startsWith('//') || line.startsWith('/*') || line.endsWith('*/')) {
                        // Skip comments
                        continue;
                    } else {
                        // Stop at the first non-annotation, non-comment, non-blank line
                        break;
                    }
                }
                return relevantAnnotationLines.join('\n');
            };

            if (classSymbol) {
                const classStartLine = classSymbol.location.range.start.line;
                const annotationText = getAnnotationText(classStartLine);
                const annotations = parseAnnotations(annotationText);

                if (annotations.has('RestController') || annotations.has('Controller')) {
                    isController = true;
                    classLevelBasePath = normalizePath(annotations.get('RequestMapping'));
                    classAnnotationsCache.set(uriString, { annotations, uri: fileUri }); // Cache result
                    console.log(`[discoverEndpoints] Found controller class '${classSymbol.name}' in ${fileUri.fsPath} with base path: '${classLevelBasePath}'`);
                }
            }

            if (!isController) {
                // If no class symbol found annotations, maybe check methods individually? Less efficient.
                 console.log(`[discoverEndpoints] Skipping file ${fileUri.fsPath} as no @RestController or @Controller class annotation found.`);
                continue;
            }

            // 3. Find method symbols within the controller class
            for (const symbol of symbolsInFile) {
                 if (token.isCancellationRequested) return [];

                // Only process methods within the identified controller class context
                 if (symbol.kind !== vscode.SymbolKind.Method || symbol.containerName !== classSymbol?.name) {
                    continue;
                 }

                const methodStartLine = symbol.location.range.start.line;
                const methodAnnotationText = getAnnotationText(methodStartLine);

                const methodAnnotations = parseAnnotations(methodAnnotationText);
                // console.log(`[discoverEndpoints] Method '${symbol.name}' annotations raw text: ${methodAnnotationText}`);
                // console.log(`[discoverEndpoints] Method '${symbol.name}' parsed annotations:`, methodAnnotations);

                for (const [annotationName, annotationValue] of methodAnnotations.entries()) {
                    const httpMethod = getHttpMethodFromAnnotation(annotationName);
                    if (httpMethod) {
                        let methodPath = '';
                        if (annotationName === 'RequestMapping') {
                            // RequestMapping might have path in 'value' or directly, and method attribute
                            // This simplified parser only gets the first string literal value
                            methodPath = normalizePath(annotationValue);
                            // TODO: Parse method attribute if present in @RequestMapping
                        } else {
                            // Specific mappings (@GetMapping, etc.) usually have path as the direct value
                            methodPath = normalizePath(annotationValue);
                        }

                        const fullPath = combinePaths(classLevelBasePath, methodPath);

                        console.log(`[discoverEndpoints] --> Found endpoint: ${httpMethod} ${fullPath} (Handler: ${symbol.name})`);
                        endpoints.push({
                            method: httpMethod,
                            path: fullPath,
                            uri: fileUri,
                            position: symbol.location.range.start, // Use method symbol start position
                            handlerMethodName: symbol.name,
                        });
                    }
                }
            }
        }

    } catch (error) {
        console.error("[discoverEndpoints] Error discovering endpoints:", error);
        vscode.window.showErrorMessage(`Error discovering endpoints: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log(`[discoverEndpoints] Discovered ${endpoints.length} endpoints total.`);
    return endpoints;
}

/**
 * Placeholder for endpoint disambiguation logic.
 * Tries to match the user query against the list of discovered endpoints.
 * Asks for clarification if needed.
 */
export async function disambiguateEndpoint(
    query: string,
    endpoints: EndpointInfo[],
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
): Promise<EndpointInfo | null> {
    console.log(`Attempting to disambiguate query "${query}" against ${endpoints.length} endpoints.`);

    if (endpoints.length === 0) {
        stream.markdown("I couldn't find any REST endpoints in this workspace. Finding endpoints isn't fully implemented yet.\n");
        return null;
    }

    // TODO: Implement matching logic (keyword-based, semantic, etc.)
    console.log("Endpoint matching logic not yet implemented.");

    // TODO: Implement user clarification flow if multiple matches or no confident match
    console.log("User clarification flow not yet implemented.");


    // For now, return null as a placeholder
    stream.markdown("Sorry, I can't identify the specific endpoint yet. Endpoint selection is not fully implemented.\n");
    return null;
}