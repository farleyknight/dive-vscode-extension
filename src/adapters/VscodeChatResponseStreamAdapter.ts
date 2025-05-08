import * as vscode from 'vscode';
import { IChatResponseStream } from './vscodeTypes';

export class VscodeChatResponseStreamAdapter implements IChatResponseStream {
    constructor(private readonly vscodeStream: vscode.ChatResponseStream) {}

    progress(message: string): void {
        this.vscodeStream.progress(message);
    }

    markdown(value: string | vscode.MarkdownString): void {
        this.vscodeStream.markdown(value);
    }

    button(command: vscode.Command): void {
        this.vscodeStream.button(command);
    }
}