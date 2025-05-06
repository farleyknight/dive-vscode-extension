import * as vscode from 'vscode';
import { TextDecoder } from 'util'; // Node.js util

/**
 * Represents information about a discovered REST endpoint.
 */
export interface EndpointInfo {
    method: string; // e.g., 'GET', 'POST'
    path: string; // e.g., '/api/users', '/api/users/{id}'
    uri: vscode.Uri; // File URI
    position: vscode.Position; // Position of the method *name* (for navigation, LSP interactions)
    handlerMethodName: string; // Name of the Java method handling the endpoint
    description?: string; // Optional description from Javadoc/comments
    startLine: number; // 0-indexed, actual start line of the mapping annotation
    endLine: number;   // 0-indexed, end of method body (`methodSymbol.range.end.line`)
}

/**
 * Represents the result of parsing mapping annotations.
 */
interface ParsedAnnotationInfo {
    httpMethod: string | null;
    paths: string[];
    annotationStartIndex?: number; // Index of the matched annotation string within the input text block
    annotationFullText?: string;   // The actual matched annotation text e.g. @GetMapping("/path")
}

/**
 * NEW: Details extracted from class annotation text.
 */
interface ControllerClassAnnotationDetails {
    isController: boolean;
    basePath: string;
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
    let resultAttributes = parseAttributes(attributesString, fullAnnotationName);

    let finalHttpMethod = resultAttributes.httpMethod;

    // Apply default GET method for RequestMapping *only if* no method was specified in its attributes
    if (fullAnnotationName === 'RequestMapping' && !finalHttpMethod) {
        // console.log(`[parseMappingAnnotations] Applying default GET for RequestMapping`);
        finalHttpMethod = 'GET';
    }

    // Ensure we always have a method if a specific mapping annotation was found
    if (!finalHttpMethod) {
         // This case should primarily happen only if parseAttributes failed unexpectedly for a specific mapping type
        console.warn(`[parseMappingAnnotations] Could not determine HTTP method for annotation ${fullAnnotationName} with attributes "${attributesString}". Attempting fallback based on type.`);
        finalHttpMethod = getHttpMethodFromAnnotationName(fullAnnotationName); // Fallback based on annotation type
        if (!finalHttpMethod) {
             console.error(`[parseMappingAnnotations] CRITICAL: Failed to determine HTTP method for ${fullAnnotationName}. Defaulting to GET.`);
             finalHttpMethod = 'GET'; // Final safety net
        }
    }

    // console.log(`[parseMappingAnnotations] Text: "${text.substring(0, 50)}..." => Result:`, result);
    return {
        httpMethod: finalHttpMethod,
        paths: resultAttributes.paths,
        annotationStartIndex: lastMatch.index,
        annotationFullText: lastMatch[0]
    };
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
 * NEW: Pure helper to get controller details from class annotation text.
 */
export function getControllerDetailsFromClassAnnotationText(annotationText: string): ControllerClassAnnotationDetails {
    const isController = /@(RestController|Controller)/.test(annotationText);
    let basePath = '/'; // Default base path

    if (isController) {
        const classMappingInfo = parseMappingAnnotations(annotationText);
        if (classMappingInfo && classMappingInfo.paths.length > 0) {
            const parsedPath = normalizePath(classMappingInfo.paths[0]);
            // Ensure basePath is at least '/'
            basePath = (parsedPath === '') ? '/' : parsedPath;
        }
    }
    return { isController, basePath };
}

/**
 * Combines base path and method path correctly.
 */
export function combinePaths(basePath: string, methodPath: string): string {
    const normBase = normalizePath(basePath);
    const normMethod = normalizePath(methodPath);

    if (normBase === '/') {
        // If base is just root, the method path (already normalized) is the full path.
        // If normMethod is also just '/', result is '/'. If normMethod is empty, result is '/'.
        return normMethod === '' ? '/' : normMethod;
    }

    // If method path is empty or just root, the base path (already normalized) is the full path.
    if (normMethod === '' || normMethod === '/') {
        // If normBase is also empty (e.g. from an empty input string), result is '/'.
        return normBase === '' ? '/' : normBase;
    }

    // Standard case: normBase is not '/' and normMethod is not '/' or empty.
    // normBase will be like '/api' and normMethod like '/users'.
    // Result should be '/api/users'.
    return `${normBase}${normMethod}`;
}

/**
 * Represents a potential controller class found via symbols.
 */
export interface PotentialController {
    classSymbol: vscode.DocumentSymbol;
    basePath: string; // Base path from class-level @RequestMapping, defaults to '/'
    isRestController: boolean; // True if @RestController or @Controller found
}

// --- Simple Data Structures for Internal Logic ---
// (Mirrors interfaces defined in test file for clarity)
interface SimplePosition { line: number; character: number; }
interface SimpleRange { start: SimplePosition; end: SimplePosition; }
interface SimpleDocumentSymbolData {
    name: string;
    kind: number; // Use number based on vscode.SymbolKind
    range: SimpleRange;
    selectionRange: SimpleRange;
    children: SimpleDocumentSymbolData[];
}
interface SimpleTextDocumentData {
    uriFsPath: string;
    getText(range?: SimpleRange): string;
    // Add lineCount or lineAt if needed by logic
}
// --- End Simple Data Structures ---

/**
 * NEW: Internal logic for finding controller classes from simple data.
 */
function internalFindControllerClassesLogic(
    simpleDoc: SimpleTextDocumentData,
    simpleSymbols: SimpleDocumentSymbolData[]
): { classSymbolData: SimpleDocumentSymbolData; basePath: string }[] {
    const controllers: { classSymbolData: SimpleDocumentSymbolData; basePath: string }[] = [];
    const potentialControllerSymbols = simpleSymbols.filter(symbol => symbol.kind === 4 /* Class */);

    for (const classSymbolData of potentialControllerSymbols) {
        const classRange = classSymbolData.range;
        const classAnnotationStartLine = Math.max(0, classRange.start.line - 5);
        // Define the range using SimplePosition/SimpleRange
        const classAnnotationRange: SimpleRange = {
            start: { line: classAnnotationStartLine, character: 0 },
            end: { line: classSymbolData.selectionRange.start.line + 1, character: 0 }
        };
        const classAnnotationText = simpleDoc.getText(classAnnotationRange);

        // Call the pure helper using the text
        const details = getControllerDetailsFromClassAnnotationText(classAnnotationText);

        if (details.isController) {
            controllers.push({
                classSymbolData: classSymbolData,
                basePath: details.basePath,
                // isRestController flag is handled by the caller if needed based on the original vscode.DocumentSymbol
            });
        }
    }
    return controllers;
}

/**
 * Finds potential Spring controller classes within a document using symbols and annotation checks.
 * (Wrapper around internal logic function)
 */
export async function findControllerClasses(document: vscode.TextDocument, symbols: vscode.DocumentSymbol[]): Promise<PotentialController[]> {
    // 1. Convert vscode types to simple data structures
    const simpleDoc: SimpleTextDocumentData = {
        uriFsPath: document.uri.fsPath,
        getText: (range?: SimpleRange) => {
            if (!range) return document.getText();
            const vscodeRange = new vscode.Range(
                new vscode.Position(range.start.line, range.start.character),
                new vscode.Position(range.end.line, range.end.character)
            );
            return document.getText(vscodeRange);
        }
        // Add lineCount/lineAt if internalFindControllerClassesLogic needs them
    };

    function convertSymbols(vscodeSymbols: vscode.DocumentSymbol[]): SimpleDocumentSymbolData[] {
        return vscodeSymbols.map(s => ({
            name: s.name,
            kind: s.kind, // Pass the number directly
            range: { // Convert vscode.Range
                start: { line: s.range.start.line, character: s.range.start.character },
                end: { line: s.range.end.line, character: s.range.end.character }
            },
            selectionRange: { // Convert vscode.Range
                start: { line: s.selectionRange.start.line, character: s.selectionRange.start.character },
                end: { line: s.selectionRange.end.line, character: s.selectionRange.end.character }
            },
            children: convertSymbols(s.children || []) // Recursively convert children
        }));
    }
    const simpleSymbols = convertSymbols(symbols);

    // 2. Call the internal logic function
    const internalResult = internalFindControllerClassesLogic(simpleDoc, simpleSymbols);

    // 3. Convert result back to PotentialController[] which includes the original vscode.DocumentSymbol
    // We need a way to map back from simpleSymbolData to the original vscode.DocumentSymbol.
    // This might require passing the original symbols alongside the simple ones or using a map.
    // Let's adjust internalFindControllerClassesLogic to return enough info, maybe just name/range?
    // Or, keep it simple for now: find the matching vscode.DocumentSymbol by name/range after getting result.
    const finalControllers: PotentialController[] = [];
    const symbolMap = new Map(symbols.map(s => [s.name + s.range.start.line, s])); // Simple map by name+line

    for (const item of internalResult) {
        const key = item.classSymbolData.name + item.classSymbolData.range.start.line;
        const originalSymbol = symbolMap.get(key);
        if (originalSymbol) {
            finalControllers.push({
                classSymbol: originalSymbol,
                basePath: item.basePath,
                isRestController: true // Matches original logic's output for @Controller/@RestController
            });
        } else {
             console.warn(`[findControllerClasses] Could not map internal result back to original symbol: ${item.classSymbolData.name}`);
        }
    }

    return finalControllers;
}

/**
 * Interface for parameters passed to the pure method processing helper.
 */
interface MethodProcessingParams {
    methodAnnotationText: string; // The block of text potentially containing annotations
    basePath: string;
    methodName: string;
    methodNameStartLine: number;     // 0-indexed, start line of the method name (from symbol's selectionRange)
    methodNameStartChar: number;     // Character offset for method name
    annotationBlockStartLine: number; // 0-indexed, the global start line of methodAnnotationText
}

/**
 * Interface for the simplified endpoint data returned by the pure helper.
 * This is before combining with methodSymbolData.range.end.line
 */
interface ProcessedAnnotationDetails { // New name
    httpMethod: string; // From parsed annotation
    paths: string[];    // From parsed annotation (can be multiple)
    handlerMethodName: string; // From original method symbol name
    methodNameLine: number;     // From original method symbol's selectionRange.start.line
    methodNameChar: number;     // From original method symbol's selectionRange.start.character
    actualAnnotationGlobalStartLine: number; // Calculated global start line of the annotation
}

/**
 * Internal structure used by `internalFindEndpointsInClassLogic` before creating final `EndpointInfo`.
 * This structure combines details from `ProcessedAnnotationDetails` with the method's body end line.
 */
interface ExtendedProcessedMethodEndpoint { // Existing, but to be populated from ProcessedAnnotationDetails + methodBodyEndLine
    method: string;
    path: string; // Fully combined path
    handlerMethodName: string;
    methodNameLine: number;
    methodNameChar: number;
    actualAnnotationGlobalStartLine: number;
    methodBodyEndLine: number; // From methodSymbolData.range.end.line
}

/**
 * Pure helper to process method annotations and create initial endpoint data.
 */
export function processMethodAnnotationsAndCreateEndpoints(
    params: MethodProcessingParams
): ProcessedAnnotationDetails[] {
    const processedDetailsList: ProcessedAnnotationDetails[] = [];
    const methodMappingInfo = parseMappingAnnotations(params.methodAnnotationText);

    if (methodMappingInfo && methodMappingInfo.httpMethod && methodMappingInfo.paths.length > 0) {
        let actualAnnotationGlobalStartLine = params.annotationBlockStartLine; // Default if no index
        if (methodMappingInfo.annotationStartIndex !== undefined) {
            const textBeforeAnnotation = params.methodAnnotationText.substring(0, methodMappingInfo.annotationStartIndex!);
            const newlinesBeforeAnnotation = (textBeforeAnnotation.match(/\n/g) || []).length;
            actualAnnotationGlobalStartLine = params.annotationBlockStartLine + newlinesBeforeAnnotation;
        }

        // No path combination here yet. Paths are directly from the annotation.
        processedDetailsList.push({
            httpMethod: methodMappingInfo.httpMethod,
            paths: methodMappingInfo.paths, // These are the raw paths from the annotation
            handlerMethodName: params.methodName,
            methodNameLine: params.methodNameStartLine,
            methodNameChar: params.methodNameStartChar,
            actualAnnotationGlobalStartLine: actualAnnotationGlobalStartLine,
        });
    }
    return processedDetailsList;
}

/**
 * NEW: Internal logic for finding endpoints within a class from simple data.
 */
function internalFindEndpointsInClassLogic(
    simpleDoc: SimpleTextDocumentData,
    simpleClassSymbol: SimpleDocumentSymbolData,
    basePath: string,
    token: vscode.CancellationToken // Keep token for potential cancellation checks in future
): ExtendedProcessedMethodEndpoint[] {
    const allClassEndpoints: ExtendedProcessedMethodEndpoint[] = [];
    const potentialMethods = simpleClassSymbol.children.filter(symbol => symbol.kind === 5 /* Method */);

    // Sort methods by start line (using simple data)
    potentialMethods.sort((a, b) => a.range.start.line - b.range.start.line);

    for (let i = 0; i < potentialMethods.length; i++) {
        const methodSymbolData = potentialMethods[i];
        if (token.isCancellationRequested) break;

        const methodSelectionStart = methodSymbolData.selectionRange.start;

        let annotationStartLine: number;
        if (i > 0 && potentialMethods[i - 1]) {
            annotationStartLine = potentialMethods[i - 1]!.range.end.line + 1;
        } else {
            annotationStartLine = simpleClassSymbol.range.start.line + 1;
        }
        annotationStartLine = Math.min(annotationStartLine, methodSelectionStart.line);
        const annotationEndLine = methodSelectionStart.line;

        let methodAnnotationText = '';
        if (annotationStartLine <= annotationEndLine) {
            // Define range using simple types
            const methodAnnotationRange: SimpleRange = {
                start: { line: annotationStartLine, character: 0 },
                end: { line: annotationEndLine + 1, character: 0 }
            };
            methodAnnotationText = simpleDoc.getText(methodAnnotationRange).trimEnd();
        }

        const processingParams: MethodProcessingParams = {
            methodAnnotationText,
            basePath,
            methodName: methodSymbolData.name,
            methodNameStartLine: methodSelectionStart.line,
            methodNameStartChar: methodSelectionStart.character,
            annotationBlockStartLine: annotationStartLine,
        };

        // processMethodAnnotationsAndCreateEndpoints is already pure and tested
        const processedAnnotationDetailList = processMethodAnnotationsAndCreateEndpoints(processingParams);

        for (const annDetail of processedAnnotationDetailList) {
            for (const methodPath of annDetail.paths) { // Iterate through raw paths from the annotation
                const fullPath = combinePaths(basePath, methodPath); // Combine with class base path
                allClassEndpoints.push({
                    method: annDetail.httpMethod,
                    path: fullPath, // Use the combined path
                    handlerMethodName: annDetail.handlerMethodName,
                    methodNameLine: annDetail.methodNameLine,
                    methodNameChar: annDetail.methodNameChar,
                    actualAnnotationGlobalStartLine: annDetail.actualAnnotationGlobalStartLine,
                    methodBodyEndLine: methodSymbolData.range.end.line, // From the current method's symbol
                });
            }
        }
    }
    return allClassEndpoints;
}

/**
 * Finds endpoint information within a given controller class symbol.
 * (Wrapper around internal logic function)
 */
export async function findEndpointsInClass(
    document: vscode.TextDocument,
    classSymbol: vscode.DocumentSymbol,
    basePath: string,
    token: vscode.CancellationToken
): Promise<EndpointInfo[]> {
    // 1. Convert vscode types to simple data structures
     const simpleDoc: SimpleTextDocumentData = {
        uriFsPath: document.uri.fsPath,
        getText: (range?: SimpleRange) => {
            if (!range) return document.getText();
            const vscodeRange = new vscode.Range(
                new vscode.Position(range.start.line, range.start.character),
                new vscode.Position(range.end.line, range.end.character)
            );
            return document.getText(vscodeRange);
        }
    };

    function convertSingleSymbol(s: vscode.DocumentSymbol): SimpleDocumentSymbolData {
        return {
            name: s.name,
            kind: s.kind,
            range: {
                start: { line: s.range.start.line, character: s.range.start.character },
                end: { line: s.range.end.line, character: s.range.end.character }
            },
            selectionRange: {
                start: { line: s.selectionRange.start.line, character: s.selectionRange.start.character },
                end: { line: s.selectionRange.end.line, character: s.selectionRange.end.character }
            },
            children: (s.children || []).map(convertSingleSymbol) // Recursively convert children
        };
    }
    const simpleClassSymbol = convertSingleSymbol(classSymbol);

    // 2. Call the internal logic function
    const internalResult: ExtendedProcessedMethodEndpoint[] = internalFindEndpointsInClassLogic(simpleDoc, simpleClassSymbol, basePath, token);

    // 3. Convert result back to EndpointInfo[] (requires vscode.Uri and vscode.Position)
    const finalEndpoints: EndpointInfo[] = internalResult.map(extProcEp => ({
        method: extProcEp.method,
        path: extProcEp.path,
        uri: document.uri, // Use original vscode.Uri
        position: new vscode.Position(extProcEp.methodNameLine, extProcEp.methodNameChar), // Create vscode.Position for method name
        handlerMethodName: extProcEp.handlerMethodName,
        startLine: extProcEp.actualAnnotationGlobalStartLine, // NEW field
        endLine: extProcEp.methodBodyEndLine,   // NEW field
    }));

    return finalEndpoints;
}

// --- VSCode Service Abstractions for Decoupling Unit Tests ---
export interface VscodeDocumentProvider {
    openTextDocument(uri: vscode.Uri): Promise<vscode.TextDocument | undefined>;
}

export interface VscodeSymbolProvider {
    executeDocumentSymbolProvider(uri: vscode.Uri): Promise<vscode.DocumentSymbol[] | undefined>;
}

export interface VscodeFileSystemProvider { // New interface
    findFiles(include: vscode.GlobPattern, exclude?: vscode.GlobPattern | null, maxResults?: number, token?: vscode.CancellationToken): Thenable<vscode.Uri[]>;
}
// --- End VSCode Service Abstractions ---

/**
 * Processes a single Java file URI to find REST endpoints.
 *
 * @param uri The URI of the Java file.
 * @param token A cancellation token.
 * @returns A promise resolving to an array of EndpointInfo found in the file.
 */
export async function processJavaFileForEndpoints(
    uri: vscode.Uri,
    token: vscode.CancellationToken,
    documentProvider: VscodeDocumentProvider,
    symbolProvider: VscodeSymbolProvider
): Promise<EndpointInfo[]> {
    let fileEndpoints: EndpointInfo[] = [];
    try {
        const document = await documentProvider.openTextDocument(uri);
        if (!document) return [];

        const symbols = await symbolProvider.executeDocumentSymbolProvider(uri);
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
export async function discoverEndpoints(
    token: vscode.CancellationToken,
    documentProvider?: VscodeDocumentProvider,
    symbolProvider?: VscodeSymbolProvider,
    fileSystemProvider?: VscodeFileSystemProvider,
    // New parameter for injecting the processor function for testing
    processFunc?: (uri: vscode.Uri, token: vscode.CancellationToken, docProvider: VscodeDocumentProvider, symProvider: VscodeSymbolProvider) => Promise<EndpointInfo[]>
): Promise<EndpointInfo[]> {
    let allEndpoints: EndpointInfo[] = [];

    // Create default providers if not injected
    const actualFileSystemProvider = fileSystemProvider || {
        findFiles: (include, exclude, maxResults, token) => vscode.workspace.findFiles(include, exclude, maxResults, token)
    };
    const actualDocumentProvider = documentProvider || {
        openTextDocument: async (uri: vscode.Uri): Promise<vscode.TextDocument | undefined> => {
            try {
                return await vscode.workspace.openTextDocument(uri);
            } catch (e) {
                console.error(`[discoverEndpoints] Error opening document ${uri.fsPath}:`, e);
                return undefined;
            }
        }
    };
    const actualSymbolProvider = symbolProvider || {
        executeDocumentSymbolProvider: async (uri: vscode.Uri): Promise<vscode.DocumentSymbol[] | undefined> => {
            try {
                return await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri);
            } catch (e) {
                console.error(`[discoverEndpoints] Error executing document symbol provider for ${uri.fsPath}:`, e);
                return undefined;
            }
        }
    };

    const javaFiles = await actualFileSystemProvider.findFiles('**/*.java', '**/node_modules/**', undefined, token);

    console.log(`[discoverEndpoints] Found ${javaFiles.length} Java files.`);

    // Determine the actual processor function to use
    const actualProcessJavaFileForEndpoints = processFunc || processJavaFileForEndpoints; // Default to the actual function

    for (const uri of javaFiles) {
        if (token.isCancellationRequested) {
            console.log('[discoverEndpoints] Cancellation requested.');
            break;
        }
        // Pass the providers to the determined processor function
        const fileEndpoints = await actualProcessJavaFileForEndpoints(uri, token, actualDocumentProvider, actualSymbolProvider);
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