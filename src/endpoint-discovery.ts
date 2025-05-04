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
 * Searches the workspace for potential Spring Boot REST endpoints using LSP symbols and text parsing.
 */
export async function discoverEndpoints(token: vscode.CancellationToken): Promise<EndpointInfo[]> {
    const endpoints: EndpointInfo[] = [];
    const javaFiles = await vscode.workspace.findFiles('**/*.java', '**/node_modules/**', undefined, token);
    const decoder = new TextDecoder('utf-8');

    console.log(`[discoverEndpoints] Found ${javaFiles.length} Java files.`);

    for (const uri of javaFiles) {
        if (token.isCancellationRequested) {
            console.log('[discoverEndpoints] Cancellation requested.');
            break;
        }

        try {
            const document = await vscode.workspace.openTextDocument(uri);
            if (!document) continue;

            console.log(`[discoverEndpoints] Processing: ${uri.fsPath}`);

            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );

            if (!symbols) {
                console.log(`[discoverEndpoints] No symbols found for: ${uri.fsPath}`);
                continue;
            }

            // Find top-level classes (potential controllers)
            const potentialControllers = symbols.filter(symbol => symbol.kind === vscode.SymbolKind.Class);

            for (const classSymbol of potentialControllers) {
                if (token.isCancellationRequested) break;

                const classRange = classSymbol.range;
                // Get text around the class definition to check for @RestController/@Controller
                // Expand range slightly to catch annotations just before the class line
                const classStartLine = Math.max(0, classRange.start.line - 5); // Look back 5 lines
                const classAnnotationRange = new vscode.Range(classStartLine, 0, classRange.start.line + 1, 0);
                const classAnnotationText = document.getText(classAnnotationRange);

                // Basic check for controller annotations (could be more robust)
                const isRestController = classAnnotationText.includes('@RestController');
                const isController = classAnnotationText.includes('@Controller');

                if (!isRestController && !isController) {
                    continue; // Skip classes not annotated as controllers
                }
                 // TODO: Add check for @ResponseBody if only @Controller is present?
                 // For now, assume @Controller implies potential REST endpoints for simplicity

                console.log(`[discoverEndpoints] Found potential controller: ${classSymbol.name} in ${uri.fsPath}`);

                // Parse class-level @RequestMapping (if any)
                const classMappingInfo = parseMappingAnnotations(classAnnotationText);
                const classBasePath = classMappingInfo?.paths[0] ?? ''; // Assuming single path for class for now
                console.log(`[discoverEndpoints] Class base path for ${classSymbol.name}: "${classBasePath}"`);

                // Find methods within this class
                const methods = classSymbol.children.filter(symbol => symbol.kind === vscode.SymbolKind.Method);

                for (const methodSymbol of methods) {
                    if (token.isCancellationRequested) break;

                    const methodRange = methodSymbol.range;
                    // Get text around the method definition for annotations
                    // Look back a few lines from the method start
                    const methodStartLine = Math.max(0, methodRange.start.line - 5); // Look back 5 lines
                    const methodAnnotationRange = new vscode.Range(methodStartLine, 0, methodRange.start.line + 1, 0);
                    const methodAnnotationText = document.getText(methodAnnotationRange);

                    const methodMappingInfo = parseMappingAnnotations(methodAnnotationText);

                    if (methodMappingInfo && methodMappingInfo.httpMethod) {
                        // If a specific method mapping (@GetMapping, etc.) is found, use it
                        for (const methodPath of methodMappingInfo.paths) {
                            const fullPath = combinePaths(classBasePath, methodPath);
                            endpoints.push({
                                method: methodMappingInfo.httpMethod,
                                path: fullPath,
                                uri: uri,
                                // Use the range start for position - more accurate than selectionRange?
                                position: methodRange.start, // Position of the method definition itself
                                handlerMethodName: methodSymbol.name,
                            });
                            console.log(`[discoverEndpoints] --> Added endpoint: ${methodMappingInfo.httpMethod} ${fullPath} (${methodSymbol.name})`);
                        }
                    } else if (methodMappingInfo && !methodMappingInfo.httpMethod && classMappingInfo) {
                        // Handle case where method has @RequestMapping without method defined,
                        // potentially inheriting method from class (though rare/complex, focus on path)
                        // Or if method mapping doesn't specify HTTP method, default to GET (handled in parse)
                        // For now, just handle the path combination, assuming GET if not specified
                         const effectiveHttpMethod = methodMappingInfo.httpMethod ?? 'GET'; // Should be handled by parse, but double check
                         for (const methodPath of methodMappingInfo.paths) {
                             const fullPath = combinePaths(classBasePath, methodPath);
                             endpoints.push({
                                 method: effectiveHttpMethod,
                                 path: fullPath,
                                 uri: uri,
                                 position: methodRange.start,
                                 handlerMethodName: methodSymbol.name,
                             });
                              console.log(`[discoverEndpoints] --> Added endpoint (default/class method?): ${effectiveHttpMethod} ${fullPath} (${methodSymbol.name})`);
                         }
                    }
                     // Else: Method has no mapping annotation, ignore it.
                }
            }

        } catch (error) {
            console.error(`[discoverEndpoints] Error processing file ${uri.fsPath}:`, error);
            vscode.window.showWarningMessage(`Failed to process Java file for endpoints: ${uri.fsPath}. See console for details.`);
        }
    }

    console.log(`[discoverEndpoints] Discovery finished. Found ${endpoints.length} endpoints.`);
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