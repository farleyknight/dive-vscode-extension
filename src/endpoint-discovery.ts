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
    // Create a new regex instance for each call to avoid state issues with /g flag
    const annotationRegex = new RegExp(
        '@(Get|Post|Put|Delete|Patch|Request)Mapping\\s*(?:\\((.*?)\\))?',
        'gs' // Global and Dotall flags
    );
    let lastMatch: RegExpExecArray | null = null;
    let currentMatch;

    // Find the *last* matching annotation in the text block.
    // This assumes the annotation immediately preceding the method/class is the relevant one.
    while ((currentMatch = annotationRegex.exec(text)) !== null) {
        lastMatch = currentMatch;
    }

    if (!lastMatch) {
        // console.log(`[parseMappingAnnotations] No specific mapping annotation found in text: "${text}"`);
        return null; // No relevant mapping annotation found
    }

    const annotationType = lastMatch[1]; // e.g., "Get", "Post", "Request"
    const fullAnnotationName = `${annotationType}Mapping`; // e.g., "GetMapping", "RequestMapping"
    const attributesString = lastMatch[2]?.trim() || ''; // Content inside parentheses

    // console.log(`[parseMappingAnnotations] Last match: ${fullAnnotationName}, Attrs: "${attributesString}"`);

    // Parse the attributes of the last found annotation
    let result = parseAttributes(attributesString, fullAnnotationName);

    // Apply default GET method for RequestMapping *only if* no method was specified in its attributes
    if (fullAnnotationName === 'RequestMapping' && !result.httpMethod) {
        // console.log(`[parseMappingAnnotations] Applying default GET for RequestMapping`);
        result.httpMethod = 'GET';
    }

    // Ensure we always have a method if a specific mapping annotation was found
    if (!result.httpMethod) {
         // This case should primarily happen only if parseAttributes failed unexpectedly for a specific mapping type
        console.warn(`[parseMappingAnnotations] Could not determine HTTP method for annotation ${fullAnnotationName} with attributes "${attributesString}". Attempting fallback based on type.`);
        result.httpMethod = getHttpMethodFromAnnotationName(fullAnnotationName); // Fallback based on annotation type
        if (!result.httpMethod) {
             console.error(`[parseMappingAnnotations] CRITICAL: Failed to determine HTTP method for ${fullAnnotationName}. Defaulting to GET.`);
             result.httpMethod = 'GET'; // Final safety net
        }
    }

    // console.log(`[parseMappingAnnotations] Text: "${text.substring(0, 50)}..." => Result:`, result);
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
    const attributeRegex = /(\w+)\s*=\s*(?:"([^"]*)"|\{(.*?)\}|(RequestMethod\.\w+))/gs; // Try simple string first, add 's' flag
    let attrMatch;
    let foundPathAttribute = false;

    while ((attrMatch = attributeRegex.exec(attributesString)) !== null) {
        const key = attrMatch[1];
        const stringValue = attrMatch[2]; // Value in quotes "..."
        const arrayContent = attrMatch[3]; // Content inside {...}
        const enumValue = attrMatch[4]; // RequestMethod.XXX

        if ((key === 'value' || key === 'path')) {
             foundPathAttribute = true;
            if (arrayContent !== undefined) { // paths = {"/p1", "/p2"}
                paths = extractStringArray(arrayContent);
            } else if (stringValue !== undefined) { // path = "/p1"
                paths = [stringValue];
            }
        } else if (key === 'method') {
            if (enumValue) {
                 // Simple case: method = RequestMethod.XXX
                 const methodMatch = enumValue.match(/RequestMethod\.(\w+)/);
                 if (methodMatch) {
                     httpMethod = methodMatch[1].toUpperCase();
                 }
            } else if (arrayContent) {
                // Complex case: method = { RequestMethod.XXX, ... }
                // Try to extract the *first* method found in the array content
                const firstMethodMatch = arrayContent.match(/RequestMethod\.(\w+)/);
                if (firstMethodMatch) {
                    httpMethod = firstMethodMatch[1].toUpperCase();
                    // console.log(`[parseAttributes] Extracted first method from array: ${httpMethod}`); // DEBUG
                } else {
                     console.warn(`[parseAttributes] Could not extract RequestMethod from method array: ${arrayContent}`);
                }
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
 * Represents a potential controller class found via symbols.
 */
interface PotentialController {
    classSymbol: vscode.DocumentSymbol;
    basePath: string; // Base path from class-level @RequestMapping, defaults to '/'
    isRestController: boolean; // True if @RestController or @Controller found
}


/**
 * Finds potential Spring controller classes within a document using symbols and annotation checks.
 * @param document The text document to analyze.
 * @param symbols The symbols found in the document.
 * @returns An array of potential controller symbols and their base paths.
 */
export async function findControllerClasses(document: vscode.TextDocument, symbols: vscode.DocumentSymbol[]): Promise<PotentialController[]> {
    const controllers: PotentialController[] = [];
    const potentialControllerSymbols = symbols.filter(symbol => symbol.kind === vscode.SymbolKind.Class);

    for (const classSymbol of potentialControllerSymbols) {
        const classRange = classSymbol.range;
        const classStartLine = Math.max(0, classRange.start.line - 5);
        const classAnnotationRange = new vscode.Range(classStartLine, 0, classRange.start.line + 1, 0);
        const classAnnotationText = document.getText(classAnnotationRange);

        const isRestController = /@(RestController|Controller)/.test(classAnnotationText);

        if (isRestController) {
            const classMappingInfo = parseMappingAnnotations(classAnnotationText);
            let basePath = '/';
            if (classMappingInfo && classMappingInfo.paths.length > 0) {
                basePath = normalizePath(classMappingInfo.paths[0]);
            }

            if (basePath === '' || basePath === '/') {
                 basePath = '/';
            }

            controllers.push({ classSymbol, basePath, isRestController });
        }
    }
    return controllers;
}

/**
 * Finds endpoint information within a given controller class symbol.
 *
 * @param document The text document containing the class.
 * @param classSymbol The DocumentSymbol representing the controller class.
 * @param basePath The base path determined from class-level annotations.
 * @param token A cancellation token.
 * @returns An array of EndpointInfo found within the class.
 */
export async function findEndpointsInClass(
    document: vscode.TextDocument,
    classSymbol: vscode.DocumentSymbol,
    basePath: string,
    token: vscode.CancellationToken
): Promise<EndpointInfo[]> {
    const endpoints: EndpointInfo[] = [];
    const potentialMethods = classSymbol.children.filter(symbol => symbol.kind === vscode.SymbolKind.Method);

    // Sort methods by start line to process them in order for correct annotation range calculation
    potentialMethods.sort((a, b) => a.range.start.line - b.range.start.line);

    for (let i = 0; i < potentialMethods.length; i++) {
        const methodSymbol = potentialMethods[i];
        if (token.isCancellationRequested) break;

        const methodRange = methodSymbol.selectionRange; // More precise range for the method name/signature

        // Determine the range for annotations *specific* to this method.
        let annotationStartLine: number;
        if (i > 0) {
            annotationStartLine = potentialMethods[i - 1].range.end.line + 1;
        } else {
            annotationStartLine = classSymbol.range.start.line + 1;
        }
        annotationStartLine = Math.min(annotationStartLine, methodRange.start.line);
        const annotationEndLine = methodRange.start.line;

        let methodAnnotationText = '';
        if (annotationStartLine <= annotationEndLine) {
            const methodAnnotationRange = new vscode.Range(
                annotationStartLine, 0,
                annotationEndLine + 1, 0
            );
            methodAnnotationText = document.getText(methodAnnotationRange).trimEnd();
        }

        // Parse annotations like @GetMapping, @PostMapping etc. for this method
        const methodMappingInfo = parseMappingAnnotations(methodAnnotationText);

        if (methodMappingInfo && methodMappingInfo.httpMethod && methodMappingInfo.paths.length > 0) {
            // Combine class base path with method paths
            for (const methodPath of methodMappingInfo.paths) {
                const fullPath = combinePaths(basePath, methodPath);
                endpoints.push({
                    method: methodMappingInfo.httpMethod,
                    path: fullPath,
                    uri: document.uri, // Use document URI
                    position: methodSymbol.selectionRange.start,
                    handlerMethodName: methodSymbol.name,
                });
            }
        }
    }
    return endpoints;
}

/**
 * Processes a single Java file URI to find REST endpoints.
 *
 * @param uri The URI of the Java file.
 * @param token A cancellation token.
 * @returns A promise resolving to an array of EndpointInfo found in the file.
 */
async function processJavaFileForEndpoints(uri: vscode.Uri, token: vscode.CancellationToken): Promise<EndpointInfo[]> {
    let fileEndpoints: EndpointInfo[] = [];
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        if (!document) return [];

        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri);
        if (!symbols) return [];

        // Find controller classes and their base paths using the helper
        const controllerClasses = await findControllerClasses(document, symbols);

        // Iterate through the identified controller classes and find endpoints within each
        for (const { classSymbol, basePath, isRestController } of controllerClasses) {
             if (!isRestController || token.isCancellationRequested) continue;

            // Find endpoints within this specific class using the helper
            const classEndpoints = await findEndpointsInClass(document, classSymbol, basePath, token);
            fileEndpoints = fileEndpoints.concat(classEndpoints);

            if (token.isCancellationRequested) break; // Check cancellation after processing a class
        }
    } catch (error) {
        console.error(`[processJavaFileForEndpoints] Error processing file ${uri.fsPath}:`, error);
        // Optionally add user-facing error reporting here or re-throw
    }
    return fileEndpoints;
}

/**
 * Searches the workspace for potential Spring Boot REST endpoints using LSP symbols and text parsing.
 */
export async function discoverEndpoints(token: vscode.CancellationToken): Promise<EndpointInfo[]> {
    let allEndpoints: EndpointInfo[] = [];
    const javaFiles = await vscode.workspace.findFiles('**/*.java', '**/node_modules/**', undefined, token);

    console.log(`[discoverEndpoints] Found ${javaFiles.length} Java files.`);

    // Process files in parallel?
    // Consider using Promise.all for potentially faster discovery, but manage cancellation.
    // For simplicity now, process sequentially.
    for (const uri of javaFiles) {
        if (token.isCancellationRequested) {
            console.log('[discoverEndpoints] Cancellation requested.');
            break;
        }
        const fileEndpoints = await processJavaFileForEndpoints(uri, token);
        allEndpoints = allEndpoints.concat(fileEndpoints);
    }

    console.log(`[discoverEndpoints] Discovered ${allEndpoints.length} endpoints.`);
    return allEndpoints;
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