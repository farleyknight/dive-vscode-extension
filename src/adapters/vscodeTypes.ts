// Purpose: Define simple, VSCode-independent types or enums that can be used\
//          as abstractions over vscode.* types, particularly for testing.

/**
 * Mirrors vscode.SymbolKind for use in tests without direct vscode dependency.
 */
export enum VSCodeSymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25
}

// --- Interfaces for vscode basic types ---

/**
 * VSCode-independent representation of a position in a text document.
 */
export interface IPosition {
    line: number;
    character: number;
}

/**
 * VSCode-independent representation of a range in a text document.
 */
export interface IRange {
    start: IPosition;
    end: IPosition;
}

/**
 * VSCode-independent representation of a URI.
 * Includes common URI components for better compatibility with vscode.Uri.
 */
export interface IUri {
    fsPath: string;     // The string path of this Uri on disk.
    scheme?: string;    // The string scheme of this Uri, e.g., 'file', 'http'.
    authority?: string; // The string authority of this Uri, e.g., 'www.example.com'.
    path?: string;      // The string path of this Uri, e.g., '/users/me'.
    query?: string;     // The string query component of this Uri, e.g., 'name=myquery'.
    fragment?: string;  // The string fragment component of this Uri, e.g., 'L10'.
}

/**
 * VSCode-independent representation of a CallHierarchyItem.
 */
export interface ICallHierarchyItem {
    name: string;
    kind: VSCodeSymbolKind;
    uri: IUri;
    range: IRange;
    selectionRange: IRange;
    detail?: string;
}

/**
 * VSCode-independent representation of a CancellationToken.
 */
export interface ICancellationToken {
    isCancellationRequested: boolean;
    // onCancellationRequested: vscode.Event<any>; // Keep Event type for simplicity?
    // Or define a simple callback mechanism if Event is too vscode-specific
    onCancellationRequested: (listener: (e: any) => any, thisArgs?: any, disposables?: { dispose(): any }[]) => { dispose(): any };
}

/**
 * VSCode-independent representation of ExtensionContext.
 */
export interface IExtensionContext {
    extensionUri: IUri;
    subscriptions: { dispose(): any }[];
    // Add other properties if needed: extensionPath, storageUri, globalStorageUri, logUri, etc.
}

/**
 * VSCode-independent representation of a ChatResponseStream.
 * Mimics the necessary methods from vscode.ChatResponseStream.
 */
export interface IChatResponseStream {
    /**
     * Report progress in the chat response.
     * @param message A message to display.
     */
    progress(message: string): void;

    /**
     * Append a markdown string to the chat response.
     * @param value A markdown string. Can be a {@link vscode.MarkdownString} or a string.
     */
    markdown(value: string | any /* vscode.MarkdownString */): void; // Using 'any' for MarkdownString to avoid direct vscode dependency if possible

    /**
     * Adds a button to the response.
     * @param command A command to be executed when the button is clicked.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    button(command: any /* vscode.Command */): void; // Using 'any' for Command
}