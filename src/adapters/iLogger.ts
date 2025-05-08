export interface ILogger {
    logUsage(eventName: string, data?: any): void;
    logError(error: Error | any, data?: any): void;
    logInfo(message: string, data?: any): void;
    logDebug(message: string, data?: any): void;
    logWarning(message: string, data?: any): void;
}