import * as vscode from 'vscode';
import { ILogger } from './iLogger';

export class VscodeTelemetryLoggerAdapter implements ILogger {
    constructor(private readonly vscodeLogger: vscode.TelemetryLogger) {}

    logUsage(eventName: string, data?: any): void {
        this.vscodeLogger.logUsage(eventName, data);
    }

    logError(error: Error | any, data?: any): void {
        // vscode.TelemetryLogger.logError can take (eventName: string, data?: object) or (error: Error, data?: object)
        // We need to ensure the call signature matches. If error is an Error object, it's fine.
        // If it's a string (from old usage perhaps), we might pass it as eventName.
        if (typeof error === 'string') {
            this.vscodeLogger.logError(error, data);
        } else {
            this.vscodeLogger.logError(error, data);
        }
    }

    logInfo(message: string, data?: any): void {
        // vscode.TelemetryLogger doesn't have a direct logInfo.
        // For now, console.log, or consider sending as a generic telemetry event.
        console.info(`[INFO] ${message}`, data || '');
        // Example: this.vscodeLogger.logUsage('info', { message, ...data });
    }

    logDebug(message: string, data?: any): void {
        // vscode.TelemetryLogger doesn't have a direct logDebug.
        console.debug(`[DEBUG] ${message}`, data || '');
        // Example: this.vscodeLogger.logUsage('debug', { message, ...data });
    }

    logWarning(message: string, data?: any): void {
        // vscode.TelemetryLogger doesn't have a direct logWarning.
        console.warn(`[WARN] ${message}`, data || '');
        // Example: this.vscodeLogger.logUsage('warning', { message, ...data });
    }
}