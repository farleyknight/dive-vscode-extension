import * as vscode from 'vscode';
import { IPosition, IUri, IRange, VSCodeSymbolKind, ICallHierarchyItem } from './vscodeTypes';

/**
 * Converts an IPosition to a vscode.Position.
 */
export function toVscodePosition(position: IPosition): vscode.Position {
    return new vscode.Position(position.line, position.character);
}

/**
 * Converts an IUri to a vscode.Uri.
 * Assumes the IUri's fsPath is a file path.
 */
export function toVscodeUri(uri: IUri): vscode.Uri {
    return vscode.Uri.file(uri.fsPath);
}

/**
 * Converts an IRange to a vscode.Range.
 */
export function toVscodeRange(range: IRange): vscode.Range {
    return new vscode.Range(toVscodePosition(range.start), toVscodePosition(range.end));
}

/**
 * Converts an ICallHierarchyItem to a vscode.CallHierarchyItem.
 * Requires vscode to be available.
 */
export function toVscodeCallHierarchyItem(item: ICallHierarchyItem): vscode.CallHierarchyItem {
    return new vscode.CallHierarchyItem(
        item.kind as number, // VSCodeSymbolKind is a subset of vscode.SymbolKind
        item.name,
        item.detail || '',
        toVscodeUri(item.uri),
        toVscodeRange(item.range),
        toVscodeRange(item.selectionRange)
    );
}

// --- From VSCode types to IType ---

export function fromVscodeUri(uri: vscode.Uri): IUri {
    return { fsPath: uri.fsPath };
}

export function fromVscodePosition(position: vscode.Position): IPosition {
    return { line: position.line, character: position.character };
}

export function fromVscodeRange(range: vscode.Range): IRange {
    return {
        start: fromVscodePosition(range.start),
        end: fromVscodePosition(range.end),
    };
}

export function fromVscodeSymbolKind(kind: vscode.SymbolKind): VSCodeSymbolKind {
    // This handles the direct numeric mapping if VSCodeSymbolKind enum values match vscode.SymbolKind
    if (VSCodeSymbolKind[kind]) {
        return kind as unknown as VSCodeSymbolKind; // Bypassing type check if numeric values align
    }
    // Add more sophisticated mapping if needed, or default
    // console.warn(`Unmapped vscode.SymbolKind: ${kind}`);
    return VSCodeSymbolKind.File; // Default or throw error
}

export function fromVscodeCallHierarchyItem(item: vscode.CallHierarchyItem): ICallHierarchyItem {
    return {
        name: item.name,
        kind: fromVscodeSymbolKind(item.kind),
        uri: fromVscodeUri(item.uri),
        range: fromVscodeRange(item.range),
        selectionRange: fromVscodeRange(item.selectionRange),
        detail: item.detail,
    };
}

// If we need to convert from vscode types to IType, those would go here too.
// For example:
// export function fromVscodeUri(uri: vscode.Uri): IUri {
//     return { fsPath: uri.fsPath };
// }
// export function fromVscodePosition(position: vscode.Position): IPosition {
//     return { line: position.line, character: position.character };
// }

// Uri conversions
export function toIUri(uri: vscode.Uri): IUri {
    if (!uri) return undefined as any;
    return {
        scheme: uri.scheme,
        authority: uri.authority,
        path: uri.path,
        query: uri.query,
        fragment: uri.fragment,
        fsPath: uri.fsPath,
    };
}

export function fromIUri(iUri: IUri): vscode.Uri {
    if (!iUri) return undefined as any;

    // If it looks like a complete URI that can be parsed directly from its components
    if (iUri.scheme && iUri.path) { // Authority can be empty for file URIs
        // Prefer vscode.Uri.from components if that API were readily available and safe.
        // Since it's not (new vscode.Uri is not public), string reconstruction and parse is common.
        // For file URIs, vscode.Uri.file is robust.
        if (iUri.scheme === 'file') {
            // For file URIs, fsPath is the most reliable source if available.
            // If path is also there, ensure it's consistent or prefer fsPath.
            return vscode.Uri.file(iUri.fsPath || iUri.path!); // Use fsPath, fallback to path if fsPath is missing.
        }

        // For non-file URIs, reconstruct the string and parse.
        let uriString = `${iUri.scheme}:`;
        if (iUri.authority !== undefined) { // Check for undefined to allow empty authority
             uriString += `//${iUri.authority}`;
        }
        uriString += iUri.path; // Path should always be present
        if (iUri.query) uriString += `?${iUri.query}`;
        if (iUri.fragment) uriString += `#${iUri.fragment}`;

        try {
            return vscode.Uri.parse(uriString, true); // true for strict parsing
        } catch (e) {
            console.error("Error parsing IUri back to vscode.Uri from string: ", uriString, e);
            // Fallback: if fsPath exists, and it might be a file, try that.
            if (iUri.fsPath && iUri.scheme === 'file') {
                return vscode.Uri.file(iUri.fsPath);
            }
            // If all else fails and we must return a Uri, return a placeholder or throw
            console.warn("fromIUri: Could not parse URI string, returning placeholder for:", iUri);
            return vscode.Uri.parse(`unknown:///error?uri=${encodeURIComponent(JSON.stringify(iUri))}`, true);
        }
    } else if (iUri.fsPath) {
        // If only fsPath is available, assume it's a file URI.
        return vscode.Uri.file(iUri.fsPath);
    } else {
        console.warn("fromIUri: Not enough information to create vscode.Uri from IUri:", iUri);
        return vscode.Uri.parse(`unknown:///incomplete?uri=${encodeURIComponent(JSON.stringify(iUri))}`, true);
    }
}

// Position conversions
export function toIPosition(position: vscode.Position): IPosition {
    if (!position) return undefined as any;
    return {
        line: position.line,
        character: position.character,
    };
}

export function fromIPosition(iPosition: IPosition): vscode.Position {
    if (!iPosition) return undefined as any;
    return new vscode.Position(iPosition.line, iPosition.character);
}

// Range conversions
export function toIRange(range: vscode.Range): IRange {
    if (!range) return undefined as any;
    return {
        start: toIPosition(range.start),
        end: toIPosition(range.end),
    };
}

export function fromIRange(iRange: IRange): vscode.Range {
    if (!iRange) return undefined as any;
    return new vscode.Range(fromIPosition(iRange.start), fromIPosition(iRange.end));
}

// CancellationToken conversion (if needed, though often just passing the interface is enough)
// export function toICancellationToken(token: vscode.CancellationToken): ICancellationToken {
//     return {
//         isCancellationRequested: token.isCancellationRequested,
//         onCancellationRequested: token.onCancellationRequested
//     };
// }

// export function fromICancellationToken(iToken: ICancellationToken): vscode.CancellationToken {
//     // This is tricky because vscode.CancellationToken is an interface and often comes from an event emitter.
//     // Direct conversion might not be possible or meaningful unless you're mocking.
//     // For now, let's assume this is not generally needed.
//     return {
//         isCancellationRequested: iToken.isCancellationRequested,
//         onCancellationRequested: iToken.onCancellationRequested
//     } as vscode.CancellationToken;
// }