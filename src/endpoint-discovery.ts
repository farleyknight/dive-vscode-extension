import * as vscode from 'vscode';
import { TextDecoder } from 'util'; // Node.js util
import { IUri, IPosition, IRange, ICancellationToken } from './adapters/vscodeTypes'; // Import our interfaces
import { toIUri, toIPosition, toIRange, fromIUri, fromIPosition, fromIRange } from './adapters/vscodeUtils'; // Import conversion functions

/**
 * Represents information about a discovered REST endpoint.
 */
export interface EndpointInfo {
    method: string; // e.g., 'GET', 'POST'
    path: string; // e.g., '/api/users', '/api/users/{id}'
    uri: IUri; // Changed from vscode.Uri
    position: IPosition; // Changed from vscode.Position - position of method name
    handlerMethodName: string; // Name of the Java method handling the endpoint
    description?: string; // Optional description from Javadoc/comments
    startLine: number; // 0-indexed, actual start line of the mapping annotation
    endLine: number;   // 0-indexed, end of method body
    // Note: If EndpointInfo previously used a full vscode.Range for something,
    // and IPosition is not enough, we might need to add an IRange field here.
    // For now, assuming `position` refers to a single point (like start of method name)
    // and `startLine`/`endLine` cover the broader span if needed for other purposes.
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
        return normMethod || '/'; // If base is root, use method path (or root if method is empty)
    }
    if (normMethod === '/' || normMethod === '') {
        return normBase || '/'; // If method is root or empty, use base path (or root if base is empty)
    }

    // Ensure no double slashes when combining non-root paths
    const methodPart = normMethod.startsWith('/') ? normMethod.substring(1) : normMethod;
    return `${normBase}/${methodPart}`;
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
    for (const symbol of simpleSymbols) {
        if (symbol.kind === vscode.SymbolKind.Class) {
            const classAnnotationText = simpleDoc.getText({
                start: { line: symbol.range.start.line, character: 0 },
                // Read a bit more to catch annotations that might be on separate lines before class declaration
                // or be multi-line. This might need adjustment.
                end: { line: symbol.selectionRange.start.line + 1, character: 0 }
            });
            const controllerDetails = getControllerDetailsFromClassAnnotationText(classAnnotationText);
            if (controllerDetails.isController) {
                controllers.push({ classSymbolData: symbol, basePath: controllerDetails.basePath });
            }
        }
        // Recursively search in children if structure allows (e.g. namespaces/modules)
        // However, for Java, controllers are typically top-level classes or nested if supported by framework.
        // For now, not recursing here for controllers, assuming they are found at the level `simpleSymbols` represents.
    }
    return controllers;
}

/**
 * Converts a single vscode.DocumentSymbol to SimpleDocumentSymbolData
 */
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

/**
 * Converts vscode.DocumentSymbol[] to SimpleDocumentSymbolData[]
 */
function convertSymbols(vscodeSymbols: vscode.DocumentSymbol[]): SimpleDocumentSymbolData[] {
    return vscodeSymbols.map(convertSingleSymbol);
}

/**
 * Finds potential Spring controller classes within a document using symbols and annotation checks.
 * (Wrapper around internal logic function)
 */
export async function findControllerClasses(
    document: vscode.TextDocument,
    symbols: vscode.DocumentSymbol[]
): Promise<PotentialController[]> {
    const potentialControllers: PotentialController[] = [];

    function findRecursively(currentSymbols: vscode.DocumentSymbol[]) {
        for (const symbol of currentSymbols) {
            if (symbol.kind === vscode.SymbolKind.Class) {
                const classStartLine = symbol.range.start.line;
                const lookAboveLines = 5;
                const annotationScanStartLine = Math.max(0, classStartLine - lookAboveLines);

                const rangeForAnnotations = new vscode.Range(
                    new vscode.Position(annotationScanStartLine, 0),
                    symbol.selectionRange.start
                );
                const classAnnotationsText = document.getText(rangeForAnnotations);

                const controllerDetails = getControllerDetailsFromClassAnnotationText(classAnnotationsText);

                if (controllerDetails.isController) {
                    potentialControllers.push({
                        classSymbol: symbol,
                        basePath: controllerDetails.basePath,
                        isRestController: /@RestController/.test(classAnnotationsText)
                    });
                }
            }
            if (symbol.children && symbol.children.length > 0) {
                findRecursively(symbol.children);
            }
        }
    }

    findRecursively(symbols);
    return potentialControllers;
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
    const parsedAnnotation = parseMappingAnnotations(params.methodAnnotationText);
    if (!parsedAnnotation || !parsedAnnotation.httpMethod || parsedAnnotation.paths.length === 0) {
        return [];
    }

    // Calculate the global start line of the specific annotation found
    // params.annotationBlockStartLine is the start of the text block searched
    // parsedAnnotation.annotationStartIndex is the index *within* that block
    // We need to count newlines from annotationBlockStartLine up to annotationStartIndex
    let actualAnnotationLineOffset = 0;
    if (parsedAnnotation.annotationStartIndex !== undefined) {
        const textBeforeAnnotation = params.methodAnnotationText.substring(0, parsedAnnotation.annotationStartIndex);
        actualAnnotationLineOffset = (textBeforeAnnotation.match(/\n/g) || []).length;
    }
    const actualAnnotationGlobalStartLine = params.annotationBlockStartLine + actualAnnotationLineOffset;

    return [
        {
            httpMethod: parsedAnnotation.httpMethod,
            paths: parsedAnnotation.paths, // These are raw paths from annotation
            handlerMethodName: params.methodName,
            methodNameLine: params.methodNameStartLine,
            methodNameChar: params.methodNameStartChar,
            actualAnnotationGlobalStartLine: actualAnnotationGlobalStartLine,
        }
    ];
}

/**
 * NEW: Internal logic for finding endpoints within a class from simple data.
 */
function internalFindEndpointsInClassLogic(
    simpleDoc: SimpleTextDocumentData,
    simpleClassSymbol: SimpleDocumentSymbolData,
    basePath: string,
    token: ICancellationToken
): ExtendedProcessedMethodEndpoint[] {
    if (token.isCancellationRequested) {
        return [];
    }
    const methodSymbols = simpleClassSymbol.children.filter(
        (child) => child.kind === vscode.SymbolKind.Method || child.kind === vscode.SymbolKind.Function
    );
    let endpoints: ExtendedProcessedMethodEndpoint[] = [];

    // Sort methods by start line to correctly determine annotation blocks
    methodSymbols.sort((a, b) => a.range.start.line - b.range.start.line);

    for (let i = 0; i < methodSymbols.length; i++) {
        const methodSymbolData = methodSymbols[i];
        if (token.isCancellationRequested) break;

        const methodName = methodSymbolData.name;
        const selectionRange = methodSymbolData.selectionRange;
        const methodBodyRange = methodSymbolData.range;

        let annotationBlockStartLine = 0;
        if (i > 0) {
            annotationBlockStartLine = methodSymbols[i - 1].range.end.line + 1;
        } else {
            annotationBlockStartLine = simpleClassSymbol.range.start.line + 1;
        }
        annotationBlockStartLine = Math.min(annotationBlockStartLine, methodBodyRange.start.line);

        const methodAnnotationText = simpleDoc.getText({
            start: { line: annotationBlockStartLine, character: 0 },
            end: { line: methodBodyRange.start.line, character: 0 }
        });

        if (token.isCancellationRequested) break;

        const processedAnnotations = processMethodAnnotationsAndCreateEndpoints({
            methodAnnotationText,
            basePath,
            methodName,
            methodNameStartLine: selectionRange.start.line,
            methodNameStartChar: selectionRange.start.character,
            annotationBlockStartLine,
        });

        for (const pa of processedAnnotations) {
            if (token.isCancellationRequested) break;
            // Ensure paths are handled correctly (e.g. if multiple paths in annotation)
            for (const rawPath of pa.paths) {
                const combinedPath = combinePaths(basePath, rawPath);
                endpoints.push({
                    method: pa.httpMethod,
                    path: combinedPath,
                    handlerMethodName: pa.handlerMethodName,
                    methodNameLine: pa.methodNameLine,
                    methodNameChar: pa.methodNameChar,
                    actualAnnotationGlobalStartLine: pa.actualAnnotationGlobalStartLine,
                    methodBodyEndLine: methodBodyRange.end.line,
                });
            }
        }
        if (token.isCancellationRequested) break;
    }
    return endpoints;
}

/**
 * Finds endpoint information within a given controller class symbol.
 * (Wrapper around internal logic function)
 */
export async function findEndpointsInClass(
    document: vscode.TextDocument,
    classSymbol: vscode.DocumentSymbol,
    basePath: string,
    token: ICancellationToken
): Promise<EndpointInfo[]> {
    console.log(`[Debug] findEndpointsInClass called for: ${classSymbol.name} with basePath: ${basePath}`); // DEBUG
    const endpoints: EndpointInfo[] = [];
    if (!classSymbol.children) {
        console.log(`[Debug] Class ${classSymbol.name} has no children symbols.`); // DEBUG
        return [];
    }

    console.log(`[Debug] Iterating over ${classSymbol.children.length} children of ${classSymbol.name}`); // DEBUG
    for (const methodSymbol of classSymbol.children) {
        console.log(`[Debug] Checking child symbol: ${methodSymbol.name}, kind: ${methodSymbol.kind}`); // DEBUG
        if (token.isCancellationRequested) {
            console.log(`[Debug] Cancellation requested during method iteration.`); // DEBUG
            break;
        }
        // Only process methods/functions
        if (methodSymbol.kind !== vscode.SymbolKind.Method && methodSymbol.kind !== vscode.SymbolKind.Function) {
            console.log(`[Debug] Skipping non-method/function symbol: ${methodSymbol.name}`); // DEBUG
            continue;
        }
        console.log(`[Debug] Processing method symbol: ${methodSymbol.name}`); // DEBUG

        const methodStartLine = methodSymbol.range.start.line;
        const lookAboveLines = 5;
        const annotationScanStartLine = Math.max(0, methodStartLine - lookAboveLines);

        const annotationRange = new vscode.Range(
            new vscode.Position(annotationScanStartLine, 0),
            methodSymbol.selectionRange.start
        );
        const methodAnnotationText = document.getText(annotationRange);
        console.log(`[Debug] Extracted methodAnnotationText for ${methodSymbol.name} (lines ${annotationScanStartLine}-${methodSymbol.selectionRange.start.line}):\n${methodAnnotationText.substring(0, 300).replace(/\n/g, '\n')}...`); // DEBUG

        const annotationBlockGlobalStartLine = annotationRange.start.line;

        const params: MethodProcessingParams = {
            methodAnnotationText,
            basePath,
            methodName: methodSymbol.name,
            methodNameStartLine: methodSymbol.selectionRange.start.line,
            methodNameStartChar: methodSymbol.selectionRange.start.character,
            annotationBlockStartLine: annotationBlockGlobalStartLine
        };

        const processedAnnotations = processMethodAnnotationsAndCreateEndpoints(params);
        console.log(`[Debug] processMethodAnnotationsAndCreateEndpoints returned for ${methodSymbol.name}:`, JSON.stringify(processedAnnotations)); // DEBUG

        for (const processedInfo of processedAnnotations) {
            if (token.isCancellationRequested) break;
            for (const specificPath of processedInfo.paths) {
                const combinedPath = combinePaths(basePath, specificPath);
                console.log(`[Debug] Combined path for ${methodSymbol.name}: ${combinedPath} (base: ${basePath}, specific: ${specificPath})`); // DEBUG
                endpoints.push({
                    method: processedInfo.httpMethod,
                    path: combinedPath,
                    uri: toIUri(document.uri),
                    position: toIPosition(new vscode.Position(processedInfo.methodNameLine, processedInfo.methodNameChar)),
                    handlerMethodName: processedInfo.handlerMethodName,
                    startLine: processedInfo.actualAnnotationGlobalStartLine,
                    endLine: methodSymbol.range.end.line
                });
            }
        }
    }
    console.log(`[Debug] findEndpointsInClass for ${classSymbol.name} returning ${endpoints.length} endpoints`); // DEBUG
    return endpoints;
}

// VscodeDocumentProvider, VscodeSymbolProvider, VscodeFileSystemProvider need to use IUri and ICancellationToken
export interface IDocumentProvider {
    openTextDocument(uri: IUri): Promise<vscode.TextDocument | undefined>; // Takes IUri, returns vscode.TextDocument for now
}

export interface ISymbolProvider {
    executeDocumentSymbolProvider(uri: IUri): Promise<vscode.DocumentSymbol[] | undefined>; // Takes IUri, returns vscode.DocumentSymbol[] for now
}

export interface IFileSystemProvider {
    findFiles(include: string, exclude?: string | null, maxResults?: number, token?: ICancellationToken): Promise<IUri[]>; // Takes/returns IUri, ICancellationToken
}

export async function processJavaFileForEndpoints(
    uri: IUri, // Changed to IUri
    token: ICancellationToken, // Changed to ICancellationToken
    documentProvider: IDocumentProvider,
    symbolProvider: ISymbolProvider
): Promise<EndpointInfo[]> {
    // console.log(`[processJavaFileForEndpoints] Processing URI: ${uri.fsPath}`); // DEBUG

    // 1. Open the text document using the document provider
    const document = await documentProvider.openTextDocument(uri);
    if (!document) {
        // console.warn(`[processJavaFileForEndpoints] Could not open document: ${uri.fsPath}`);
        return [];
    }
    if (token.isCancellationRequested) { return []; }

    // 2. Get document symbols using the symbol provider
    // Use the original IUri 'uri' that was passed in, as executeDocumentSymbolProvider expects an IUri.
    // document.uri is a vscode.Uri.
    const symbols = await symbolProvider.executeDocumentSymbolProvider(uri);
    if (!symbols || symbols.length === 0) {
        // console.warn(`[processJavaFileForEndpoints] No symbols found in document: ${uri.fsPath}`);
        return [];
    }
    if (token.isCancellationRequested) { return []; }

    // 3. Find potential controller classes from the symbols
    // findControllerClasses expects a vscode.TextDocument and vscode.DocumentSymbol[]
    const potentialControllers = await findControllerClasses(document, symbols);
    if (potentialControllers.length === 0) {
        // console.log(`[processJavaFileForEndpoints] No potential controller classes found in: ${uri.fsPath}`);
        return [];
    }
    // console.log(`[processJavaFileForEndpoints] Found ${potentialControllers.length} potential controllers in ${uri.fsPath}.`);


    // 4. For each potential controller, find its endpoints
    const endpointsForFile: EndpointInfo[] = (await Promise.all(
        potentialControllers.map(async (pController) => {
            if (token.isCancellationRequested) { return []; }
            // findEndpointsInClass expects a vscode.TextDocument, vscode.DocumentSymbol, and our ICancellationToken
            return findEndpointsInClass(document, pController.classSymbol, pController.basePath, token);
        })
    )).flat();

    // console.log(`[processJavaFileForEndpoints] Found ${endpointsForFile.length} endpoints in ${uri.fsPath}.`);
    return endpointsForFile;
}

export async function discoverEndpoints(
    token: ICancellationToken, // Changed to ICancellationToken
    documentProvider?: IDocumentProvider,
    symbolProvider?: ISymbolProvider,
    fileSystemProvider?: IFileSystemProvider,
    processFunc?: (
        uri: IUri, // Changed to IUri
        token: ICancellationToken, // Changed to ICancellationToken
        docProvider: IDocumentProvider,
        symProvider: ISymbolProvider
    ) => Promise<EndpointInfo[]>
): Promise<EndpointInfo[]> {
    if (token.isCancellationRequested) return [];

    const defaultDocProvider: IDocumentProvider = documentProvider || {
        openTextDocument: async (iUriToOpen: IUri) => vscode.workspace.openTextDocument(fromIUri(iUriToOpen)) // Convert IUri to vscode.Uri
    };
    const defaultSymbolProvider: ISymbolProvider = symbolProvider || {
        executeDocumentSymbolProvider: async (iUriToScan: IUri) => vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', fromIUri(iUriToScan)) // Convert IUri to vscode.Uri
    };
    const defaultFileSystemProvider: IFileSystemProvider = fileSystemProvider || {
        findFiles: async (include: string, exclude?: string | null, maxResults?: number, findToken?: ICancellationToken) => {
            const vscodeCancellationToken = findToken ? {
                isCancellationRequested: findToken.isCancellationRequested, // Corrected property name
                onCancellationRequested: findToken.onCancellationRequested
                // Cast to vscode.CancellationToken as the structure matches
            } as vscode.CancellationToken : undefined;
            const vscodeUris = await vscode.workspace.findFiles(include, exclude, maxResults, vscodeCancellationToken);
            return vscodeUris.map(toIUri); // Convert vscode.Uri[] to IUri[]
        }
    };
    const processor = processFunc || processJavaFileForEndpoints;

    let allEndpoints: EndpointInfo[] = [];
    // findFiles now takes ICancellationToken and returns IUri[]
    const javaFiles = await defaultFileSystemProvider.findFiles('**/*.java', '**/test/**', undefined, token);

    if (token.isCancellationRequested) return [];

    for (const fileIUri of javaFiles) { // Iterate over IUri
        if (token.isCancellationRequested) {
            console.log("[discoverEndpoints] Cancellation requested during file processing.");
            break;
        }
        try {
            // processor now takes IUri and ICancellationToken
            const endpointsFromFile = await processor(fileIUri, token, defaultDocProvider, defaultSymbolProvider);
            allEndpoints = allEndpoints.concat(endpointsFromFile);
        } catch (error) {
            console.error(`Error processing file ${fileIUri.fsPath}:`, error);
        }
    }
    return allEndpoints;
}