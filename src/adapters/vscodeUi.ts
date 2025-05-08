import { IUri, ICancellationToken } from './vscodeTypes';
import * as vscode from 'vscode'; // Needed for Disposable, Event, ViewColumn, WebviewOptions, WebviewPanelOptions

/**
 * Represents the content and capabilities of a VS Code Webview.
 */
export interface IWebview {
    html: string;
    options: vscode.WebviewOptions;
    onDidReceiveMessage: vscode.Event<any>;
    postMessage(message: any): Thenable<boolean>;
    asWebviewUri(localResource: IUri): IUri; // Use IUri
}

/**
 * Represents a VS Code Webview Panel.
 */
export interface IWebviewPanel extends vscode.Disposable {
    readonly viewType: string;
    title: string;
    readonly webview: IWebview;
    readonly options: vscode.WebviewPanelOptions;
    viewColumn?: vscode.ViewColumn | undefined;
    readonly active: boolean;
    readonly visible: boolean;
    readonly onDidDispose: vscode.Event<void>;
    readonly onDidChangeViewState: vscode.Event<vscode.WebviewPanelOnDidChangeViewStateEvent>;
    reveal(viewColumn?: vscode.ViewColumn, preserveFocus?: boolean): void;
}

/**
 * Provides an abstraction for creating Webview Panels.
 */
export interface IWebviewPanelProvider {
    createWebviewPanel(
        viewType: string,
        title: string,
        showOptions: vscode.ViewColumn | { readonly viewColumn: vscode.ViewColumn; readonly preserveFocus?: boolean },
        options?: vscode.WebviewPanelOptions & vscode.WebviewOptions
    ): IWebviewPanel;
}