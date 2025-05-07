import * as vscode from 'vscode';
import {
  AdapterCancellationToken,
  ILanguageModelAdapter,
  LanguageModelAdapterChatMessage,
  LanguageModelAdapterChatRequestOptions,
  LanguageModelAdapterChatRole,
  LanguageModelAdapterResponse,
  LanguageModelResponsePart,
} from './iLanguageModelAdapter';

/**
 * An implementation of `ILanguageModelAdapter` that uses the `vscode.LanguageModelChat` API.
 * It transforms requests and responses between the generic adapter interface types and
 * the VS Code specific types.
 */
export class VscodeLanguageModelAdapter implements ILanguageModelAdapter {
  private readonly logger: vscode.OutputChannel;

  /**
   * Creates an instance of VscodeLanguageModelAdapter.
   * @param chatModel The underlying `vscode.LanguageModelChat` instance to use.
   * @param modelId The identifier of the chat model, used for logging purposes.
   * @param extensionDisplayName A human-readable name for the extension, used in the justification.
   */
  constructor(
    private readonly chatModel: vscode.LanguageModelChat,
    modelId: string,
    private readonly extensionDisplayName: string = "This extension"
  ) {
    this.logger = vscode.window.createOutputChannel(`VS Code LLM Adapter (${modelId})`);
    this.logger.appendLine(`[INFO] [VscodeLanguageModelAdapter] Initialized for model ID: ${modelId}`);
  }

  private transformToVscodeMessages(adapterMessages: LanguageModelAdapterChatMessage[]): vscode.LanguageModelChatMessage[] {
    return adapterMessages.map(msg => {
      let vscodeRole: vscode.LanguageModelChatMessageRole;
      let content: string | vscode.LanguageModelToolCallPart | vscode.LanguageModelToolResultPart = msg.content;

      switch (msg.role) {
        case LanguageModelAdapterChatRole.System:
          // Assuming vscode.LanguageModelChatMessageRole.System does not exist based on linter errors.
          // Mapping System role to User role. System instructions should be formatted accordingly.
          this.logger.appendLine("[WARN] [VscodeLanguageModelAdapter] Mapping System role to User role as vscode.LanguageModelChatMessageRole.System is likely unavailable.");
          vscodeRole = vscode.LanguageModelChatMessageRole.User;
          break;
        case LanguageModelAdapterChatRole.User:
          vscodeRole = vscode.LanguageModelChatMessageRole.User;
          break;
        case LanguageModelAdapterChatRole.Assistant:
          vscodeRole = vscode.LanguageModelChatMessageRole.Assistant;
          break;
        case LanguageModelAdapterChatRole.Function:
          if (!msg.name) {
            const warningMsg = `[WARN] [VscodeLanguageModelAdapter] Message with role 'Function' is missing 'name' (function/tool name). Treating as User message. Content: ${msg.content}`;
            this.logger.appendLine(warningMsg);
            vscodeRole = vscode.LanguageModelChatMessageRole.User;
          } else {
            vscodeRole = vscode.LanguageModelChatMessageRole.User;
            content = `Function Result for ${msg.name}: ${msg.content}`;
            this.logger.appendLine(`[INFO] [VscodeLanguageModelAdapter] Formatting function/tool result for '${msg.name}' as plain text user message.`);
          }
          break;
        default:
          const errorMsg = `[ERROR] [VscodeLanguageModelAdapter] Unknown adapter message role: ${(msg as any).role}. Defaulting to User.`;
          this.logger.appendLine(errorMsg);
          vscodeRole = vscode.LanguageModelChatMessageRole.User;
      }
      return new vscode.LanguageModelChatMessage(vscodeRole, content);
    });
  }

  private transformToVscodeOptions(
    _adapterOptions: LanguageModelAdapterChatRequestOptions | undefined
  ): vscode.LanguageModelChatRequestOptions {
    const justification = `${this.extensionDisplayName} is using the language model to process your request and provide intelligent features.`;
    this.logger.appendLine(`[DEBUG] [VscodeLanguageModelAdapter] Using justification: "${justification}"`);
    return { justification };
  }

  async sendRequest(
    messages: LanguageModelAdapterChatMessage[],
    options: LanguageModelAdapterChatRequestOptions | undefined,
    token: AdapterCancellationToken,
  ): Promise<LanguageModelAdapterResponse> {
    this.logger.appendLine(`[INFO] [VscodeLanguageModelAdapter] sendRequest received. Messages: ${messages.length}, Options: ${options ? JSON.stringify(options) : 'undefined'}`);

    const vscodeMessages = this.transformToVscodeMessages(messages);

    const loggableMessages = vscodeMessages.map(m => {
        let contentLog: string;
        if (typeof m.content === 'string') {
            // Explicitly assign to a string-typed variable to help linter
            const textContent: string = m.content;
            contentLog = textContent.length > 100 ? textContent.substring(0, 97) + '...' : textContent;
        } else if (m.content && typeof (m.content as any).toolCallId === 'string') {
            contentLog = `[LanguageModelToolResultPart toolCallId: ${(m.content as any).toolCallId}]`;
        } else if (m.content && typeof (m.content as any).name === 'string') {
            contentLog = `[LanguageModelToolCallPart name: ${(m.content as any).name}]`;
        }
         else {
            contentLog = '[Structured Content]';
        }
        return { role: m.role, content: contentLog };
    });
    this.logger.appendLine(`[DEBUG] [VscodeLanguageModelAdapter] Transformed VS Code request messages: ${JSON.stringify(loggableMessages)}`);

    const vscodeOptions = this.transformToVscodeOptions(options);
    this.logger.appendLine(`[DEBUG] [VscodeLanguageModelAdapter] VS Code request options: ${JSON.stringify(vscodeOptions)}`);

    const vscodeCancellationToken: vscode.CancellationToken = token;
    let responseStream: vscode.LanguageModelChatResponse['stream'];

    try {
      this.logger.appendLine(`[INFO] [VscodeLanguageModelAdapter] Sending request to vscode.LanguageModelChat API...`);
      const rawResponse = await this.chatModel.sendRequest(
        vscodeMessages,
        vscodeOptions,
        vscodeCancellationToken
      );
      responseStream = rawResponse.stream;
      this.logger.appendLine(`[INFO] [VscodeLanguageModelAdapter] Received response from vscode.LanguageModelChat.sendRequest. Preparing to stream.`);
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      this.logger.appendLine(`[ERROR] [VscodeLanguageModelAdapter] Error calling chatModel.sendRequest: ${errorMessage}`);
      if (error?.stack) {
        this.logger.appendLine(`[DEBUG] [VscodeLanguageModelAdapter] Stack trace for sendRequest error: ${error.stack}`);
      }
      throw error;
    }

    const logger = this.logger;

    async function* transformedStream(): AsyncIterable<LanguageModelResponsePart> {
      logger.appendLine(`[INFO] [VscodeLanguageModelAdapter] Starting to stream and transform response parts.`);
      let partCounter = 0;
      try {
        for await (const part of responseStream) {
          partCounter++;
          let rawPartType = "Unknown";
          let rawPartDetails = JSON.stringify(part);

          if (part instanceof vscode.LanguageModelTextPart) {
            rawPartType = "LanguageModelTextPart";
          } else if (part instanceof vscode.LanguageModelToolCallPart) {
            rawPartType = "LanguageModelToolCallPart";
          }
          logger.appendLine(`[DEBUG] [VscodeLanguageModelAdapter] Received VS Code part #${partCounter} (type: ${rawPartType}): ${rawPartDetails}`);

          if (part instanceof vscode.LanguageModelTextPart) {
            const transformedPart: LanguageModelResponsePart = { type: 'text', value: part.value };
            yield transformedPart;
          } else if (part instanceof vscode.LanguageModelToolCallPart) {
            let extractedArguments: string = '';
            // Try common property names for tool arguments, ensuring it's a string.
            if (typeof (part as any).args === 'string') {
              extractedArguments = (part as any).args;
            } else if (typeof (part as any).input === 'string') {
              extractedArguments = (part as any).input;
            } else if (typeof (part as any).arguments === 'string') { // Previous attempts showed this might not exist or not be a string
              extractedArguments = (part as any).arguments;
            } else {
              // If a non-string value is found for these properties, try to stringify it.
              const potentialArgs = (part as any).args ?? (part as any).input ?? (part as any).arguments;
              if (potentialArgs !== undefined) {
                logger.appendLine(`[WARN] [VscodeLanguageModelAdapter] Tool call part for '${part.name}' had arguments that were not a string. Attempting to JSON.stringify. Found type: ${typeof potentialArgs}`);
                try {
                  extractedArguments = JSON.stringify(potentialArgs);
                } catch (e: any) {
                  logger.appendLine(`[ERROR] [VscodeLanguageModelAdapter] Could not stringify tool arguments for '${part.name}': ${e?.message}`);
                  extractedArguments = ''; // Default to empty if stringification fails
                }
              }
            }
            const transformedPart: LanguageModelResponsePart = { type: 'functionCall', name: part.name, arguments: extractedArguments };
            yield transformedPart;
          } else {
            logger.appendLine(`[WARN] [VscodeLanguageModelAdapter] Received unknown response part type #${partCounter} from VS Code stream. Part: ${rawPartDetails}. Skipping.`);
          }
        }
        logger.appendLine(`[INFO] [VscodeLanguageModelAdapter] Finished streaming all response parts (${partCounter} parts).`);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        logger.appendLine(`[ERROR] [VscodeLanguageModelAdapter] Error during response stream processing (after ${partCounter} parts): ${errorMessage}`);
        if (error?.stack) {
            logger.appendLine(`[DEBUG] [VscodeLanguageModelAdapter] Stream error stack: ${error.stack}`);
        }
        throw error;
      }
    }
    return { stream: transformedStream() };
  }
}