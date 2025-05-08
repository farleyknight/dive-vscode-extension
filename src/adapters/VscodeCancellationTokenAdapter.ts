import * as vscode from 'vscode';
import { ICancellationToken } from './vscodeTypes';

export class VscodeCancellationTokenAdapter implements ICancellationToken {
    constructor(private readonly vscodeToken: vscode.CancellationToken) {}

    get isCancellationRequested(): boolean {
        return this.vscodeToken.isCancellationRequested;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get onCancellationRequested(): (listener: (e: any) => any, thisArgs?: any, disposables?: { dispose(): any }[]) => { dispose(): any } {
        return this.vscodeToken.onCancellationRequested;
    }
}