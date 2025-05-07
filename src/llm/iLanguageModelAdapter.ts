// Defines the interface for a language model adapter and its associated types.
// This abstraction facilitates testability and flexibility in using different LLM backends.

/**
 * Represents a simplified response part from the language model stream.
 * This can be a piece of text or a structured function call.
 */
export type LanguageModelResponsePart =
  | { type: 'text'; value: string }
  | { type: 'functionCall'; name: string; arguments: string };

/**
 * Defines the structure of the response from the adapter's sendRequest method.
 * It contains an asynchronously iterable stream of response parts.
 */
export interface LanguageModelAdapterResponse {
  stream: AsyncIterable<LanguageModelResponsePart>;
}

/**
 * Enumerates the possible roles in a chat message, aligning with common LLM patterns.
 */
export enum LanguageModelAdapterChatRole {
  System,
  User,
  Assistant,
  Function, // Represents a message containing the result of a function call
}

/**
 * Represents a single message in a chat conversation for the adapter.
 */
export interface LanguageModelAdapterChatMessage {
  role: LanguageModelAdapterChatRole;
  content: string;
  name?: string; // Optional: Used for 'Function' role (function name) or 'Assistant' role if it's a function call.
}

/**
 * Defines common request options for the language model adapter.
 */
export interface LanguageModelAdapterChatRequestOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  // Additional generic options can be added here if needed.
}

/**
 * A minimal CancellationToken interface for the adapter.
 * This allows the adapter user to signal cancellation without directly depending on
 * a specific CancellationToken implementation like `vscode.CancellationToken`.
 */
export interface AdapterCancellationToken {
  /**
   * A flag signalling if cancellation has been requested.
   */
  readonly isCancellationRequested: boolean;

  /**
   * An event which fires when cancellation is requested.
   * The listener function is called when the token is cancelled.
   * The returned disposable can be used to remove the listener.
   * @param listener The function to call when cancellation is requested.
   * @param thisArgs Optional. The `this` context to use when calling the listener.
   * @param disposables Optional. An array to which a disposable should be added.
   * @returns A disposable object that removes the listener when disposed.
   */
  onCancellationRequested: (listener: (e: any) => any, thisArgs?: any, disposables?: { dispose(): any }[]) => { dispose(): any };
}

/**
 * Interface for an adapter that abstracts interactions with a language model.
 * This allows for decoupling from specific LLM implementations (e.g., `vscode.LanguageModelChat`)
 * and facilitates easier testing and mocking.
 */
export interface ILanguageModelAdapter {
  /**
   * Sends a request to the language model.
   *
   * @param messages An array of messages forming the conversation history and current prompt.
   * @param options Optional parameters for the request, like temperature or max tokens.
   * @param token A cancellation token to signal if the request should be aborted.
   * @returns A promise that resolves to an object containing a stream of simplified
   *          response parts from the language model.
   */
  sendRequest(
    messages: LanguageModelAdapterChatMessage[],
    options: LanguageModelAdapterChatRequestOptions | undefined,
    token: AdapterCancellationToken,
  ): Promise<LanguageModelAdapterResponse>;
}