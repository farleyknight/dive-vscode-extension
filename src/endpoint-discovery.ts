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
 * Represents the result of parsing mapping annotations.
 */
interface ParsedAnnotationInfo {
    httpMethod: string | null;
    paths: string[];
}

/**
 * Parses Spring mapping annotations (like @RequestMapping, @GetMapping) from a text block.
 * Handles common attributes like `value`, `path`, and `method`.
 * Extracts HTTP method and paths.
 *
 * @param text Block of text potentially containing annotations (e.g., lines preceding a method/class).
 * @returns An object containing the determined HTTP method and an array of paths, or null if no mapping annotation is found.
 */
export function parseMappingAnnotations(text: string): ParsedAnnotationInfo | null {
    const annotationRegex = /@([A-Za-z]+Mapping)\s*(?:\((.*?)\))?/gs; // `s` flag for dot to match newline (for potential multiline later)
    let match;
    let result: ParsedAnnotationInfo | null = null;
    let primaryAnnotationName: string | null = null; // e.g., GetMapping, RequestMapping

    while ((match = annotationRegex.exec(text)) !== null) {
        const annotationName = match[1]; // e.g., "GetMapping", "RequestMapping"
        const attributesString = match[2]?.trim() || ''; // Content inside parentheses

        const httpMethod = getHttpMethodFromAnnotationName(annotationName);
        if (!httpMethod && annotationName !== 'RequestMapping') {
            continue; // Only process known mapping annotations
        }

        // Prioritize more specific annotations (@GetMapping over @RequestMapping)
        if (result && annotationName === 'RequestMapping' && primaryAnnotationName !== 'RequestMapping') {
            continue; // Already found a more specific mapping
        }
        if (result && annotationName !== 'RequestMapping' && primaryAnnotationName === 'RequestMapping') {
           result = null; // Override RequestMapping with specific mapping
        }

        result = parseAttributes(attributesString, annotationName);
        primaryAnnotationName = annotationName;

        // If we found a specific mapping (GET, POST, etc.), we can stop looking unless it's RequestMapping
        if (annotationName !== 'RequestMapping') {
             break; // Assume only one specific mapping annotation is primary
        }
    }

    // console.log(`[parseMappingAnnotations] Text: "${text}" => Result:`, result);
    // Apply default GET method for RequestMapping *after* processing attributes
    if (result && primaryAnnotationName === 'RequestMapping' && !result.httpMethod) {
        result.httpMethod = 'GET';
    }

    return result;
}

/**
 * Parses the attribute string within a mapping annotation's parentheses.
 * Extracts path(s) and method.
 */
function parseAttributes(attributesString: string, annotationName: string): ParsedAnnotationInfo {
    let paths: string[] = [];
    let httpMethod: string | null = getHttpMethodFromAnnotationName(annotationName); // Initial method from annotation type

    // 1. Handle simple case: @GetMapping("/path") or @RequestMapping("/path")
    const simplePathMatch = attributesString.match(/^\s*"(.*?)"\s*$/);
    if (simplePathMatch && !attributesString.includes('=')) {
        paths = [simplePathMatch[1]];
        return { httpMethod, paths };
    }

    // 2. Handle simple array case: @GetMapping({"/path1", "/path2"})
    const simpleArrayMatch = attributesString.match(/^\s*\{(.*?)\}\s*$/);
     if (simpleArrayMatch && !attributesString.includes('=')) {
        paths = extractStringArray(simpleArrayMatch[1]);
        return { httpMethod, paths };
     }


    // 3. Handle named attributes: @RequestMapping(value="/path", method=RequestMethod.POST)
    // Very simplified parsing - assumes key=value pairs, strings in quotes, RequestMethods
    const attributeRegex = /(\w+)\s*=\s*(?:\{(.*?)\}|"([^"]*)"|(RequestMethod\.\w+))/g;
    let attrMatch;
    let foundPathAttribute = false;

    while ((attrMatch = attributeRegex.exec(attributesString)) !== null) {
        const key = attrMatch[1];
        const arrayContent = attrMatch[2];
        const stringValue = attrMatch[3];
        const enumValue = attrMatch[4];

        if ((key === 'value' || key === 'path')) {
             foundPathAttribute = true;
            if (arrayContent !== undefined) { // paths = {"/p1", "/p2"}
                paths = extractStringArray(arrayContent);
            } else if (stringValue !== undefined) { // path = "/p1"
                paths = [stringValue];
            }
        } else if (key === 'method' && enumValue) {
            // Extract method from RequestMethod.XXX
            const methodMatch = enumValue.match(/RequestMethod\.(\w+)/);
            if (methodMatch) {
                httpMethod = methodMatch[1].toUpperCase(); // POST, GET etc.
            }
        }
    }

     // 4. If no path attribute (value= or path=) was found, check if the *entire* attribute string
     // might be just the path array (e.g., @RequestMapping({"/p1", "/p2"}) )
     // This is slightly redundant with case 2 but handles cases where regex fails
     if (!foundPathAttribute && simpleArrayMatch) {
        paths = extractStringArray(simpleArrayMatch[1]);
     }


    // Default path if none found
    if (paths.length === 0 && !foundPathAttribute && !simplePathMatch && !simpleArrayMatch) {
        paths = ['/']; // Default to root if annotation present but no path specified? Or empty? Let's use '/' for now.
    }

    return { httpMethod, paths };
}

/** Helper to extract strings from a comma-separated list within braces, e.g., {"/a", "/b"} */
function extractStringArray(arrayContent: string): string[] {
     if (!arrayContent) return [];
     // Match strings within double quotes
     const stringLiteralRegex = /"([^"]*)"/g;
     let match;
     const results: string[] = [];
     while ((match = stringLiteralRegex.exec(arrayContent)) !== null) {
        results.push(match[1]);
     }
     return results;
}

/**
 * Maps annotation names to HTTP methods.
 * Handles RequestMapping potentially needing method attribute parsed later.
 */
function getHttpMethodFromAnnotationName(annotationName: string): string | null {
    switch (annotationName) {
        case 'GetMapping': return 'GET';
        case 'PostMapping': return 'POST';
        case 'PutMapping': return 'PUT';
        case 'DeleteMapping': return 'DELETE';
        case 'PatchMapping': return 'PATCH';
        case 'RequestMapping': return null; // Method determined by attributes or defaults to GET later
        default: return null;
    }
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
 * Searches the workspace for potential Spring Boot REST endpoints using LSP symbols.
 */
export async function discoverEndpoints(token: vscode.CancellationToken): Promise<EndpointInfo[]> {
    console.log("Attempting to discover endpoints using hybrid approach (LSP Symbols + Text Parsing)...");
    const endpoints: EndpointInfo[] = [];

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
            let classLevelBasePaths: string[] = ['']; // Classes can have multiple base paths
            let isController = false;
            let classSymbol: vscode.SymbolInformation | undefined = undefined; // Define here

            // Find the primary class symbol first
            classSymbol = symbolsInFile.find(s => s.kind === vscode.SymbolKind.Class);

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
                const classParsedInfo = parseMappingAnnotations(annotationText); // Use new parser for class RequestMapping

                // Check for @RestController or @Controller separately as parseMappingAnnotations doesn't handle them
                const controllerAnnotationRegex = /@(?:RestController|Controller)/;
                if (controllerAnnotationRegex.test(annotationText)) {
                     isController = true;
                     // If RequestMapping exists, use its paths, otherwise default to root
                     if (classParsedInfo && classParsedInfo.paths.length > 0) {
                        classLevelBasePaths = classParsedInfo.paths.map(p => normalizePath(p));
                     } else {
                        classLevelBasePaths = ['']; // Default root path if no @RequestMapping
                     }
                     console.log(`[discoverEndpoints] Found controller class \'${classSymbol.name}\' in ${fileUri.fsPath} with base paths: \'${classLevelBasePaths.join(', ')}\'`);
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

                const methodParsedInfo = parseMappingAnnotations(methodAnnotationText);

                if (methodParsedInfo && methodParsedInfo.httpMethod) {
                    const httpMethod = methodParsedInfo.httpMethod;
                    const methodPaths = methodParsedInfo.paths.length > 0
                                            ? methodParsedInfo.paths.map(p => normalizePath(p))
                                            : ['']; // Default to empty path if annotation exists but has no path attribute (e.g. @GetMapping())

                    // Combine all class base paths with all method paths
                    for (const classBasePath of classLevelBasePaths) {
                        for (const methodPath of methodPaths) {
                            const fullPath = combinePaths(classBasePath, methodPath);
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