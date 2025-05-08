import * as vscode from 'vscode';
import { ICancellationToken } from './vscodeTypes';

export class VscodeCancellationTokenAdapter implements ICancellationToken {
    constructor(public readonly originalToken: vscode.CancellationToken) {}

    get isCancellationRequested(): boolean {
        return this.originalToken.isCancellationRequested;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get onCancellationRequested(): (listener: (e: any) => any, thisArgs?: any, disposables?: { dispose(): any }[]) => { dispose(): any } {
        return this.originalToken.onCancellationRequested;
    }
}