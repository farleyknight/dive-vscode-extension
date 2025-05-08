import * as vscode from 'vscode';

/**
 * Interface for executing VS Code commands.
 * This allows for decoupling from the direct `vscode.commands` API for better testability.
 */
export interface ICommandExecutor {
    /**
     * Executes the command denoted by the given command identifier.
     *
     * @param command Identifier of the command to execute.
     * @param rest Parameters passed to the command function.
     * @return A thenable that resolves to the result of the command.
     */
    executeCommand<T>(command: string, ...rest: any[]): Thenable<T | undefined>;
}

/**
 * Concrete implementation of ICommandExecutor that uses the `vscode.commands` API.
 */
export class VscodeCommandExecutor implements ICommandExecutor {
    public executeCommand<T>(command: string, ...rest: any[]): Thenable<T | undefined> {
        return vscode.commands.executeCommand<T>(command, ...rest);
    }
}