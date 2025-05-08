import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import * as path from 'path'; // Import path module
import { TextDecoder } from 'util'; // Import TextDecoder for Uint8Array conversion
import { getMermaidWebviewHtml } from './views/mermaid-webview-template'; // Added import
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { EndpointInfo, discoverEndpoints } from './endpoint-discovery'; // Corrected: discoverEndpoints and EndpointInfo from here
import { disambiguateEndpoint } from './endpoint-disambiguation'; // Corrected: disambiguateEndpoint from here
import { buildCallHierarchyTree, CustomHierarchyNode } from './call-hierarchy'; // Import from new module
import { generateMermaidSequenceDiagram, EndpointDiagramDetails } from '../src/mermaid-sequence-translator'; // Added import, EndpointDiagramDetails
import { ILanguageModelAdapter } from './llm/iLanguageModelAdapter'; // Added for lmAdapter
import { VscodeLanguageModelAdapter } from './llm/vscodeLanguageModelAdapter'; // Added for instantiating
import { VscodeCommandExecutor, ICommandExecutor } from './adapters/vscodeExecution'; // Added ICommandExecutor
// Removed import for MermaidService as it's unused.
// Removed import for TelemetryService and related types as they are unused.
// Removed import for Logger as vscode.TelemetryLogger is used.
// Removed import for DiveLanguageModel and LanguageModelService as they are unused.
// Import new types
import { ICancellationToken, IExtensionContext, IUri, IPosition, IChatResponseStream } from './adapters/vscodeTypes'; // Added IChatResponseStream
import { ILogger } from './adapters/iLogger'; // Added ILogger
// Import converters needed for fixes
import { toVscodeUri, fromVscodeUri, fromVscodePosition } from './adapters/vscodeUtils';
// Import Webview interfaces and provider
import { IWebviewPanelProvider, IWebviewPanel, IWebview } from './adapters/vscodeUi';
// Import adapters
import { VscodeChatResponseStreamAdapter } from './adapters/VscodeChatResponseStreamAdapter';
import { VscodeTelemetryLoggerAdapter } from './adapters/VscodeTelemetryLoggerAdapter';
import { VscodeCancellationTokenAdapter } from './adapters/VscodeCancellationTokenAdapter';

// Define constants locally
const DIAGRAM_NAMES_COMMAND_ID = 'diagram.namesInEditor';
const DIAGRAM_PARTICIPANT_ID = 'dive.diagram';

// Keep original for non-tool command results
interface IChatResult extends vscode.ChatResult {
    metadata: {
        command: string;
    }
}

// Common parameters for handler functions
interface CommandHandlerParams {
    request: vscode.ChatRequest;
    context: vscode.ChatContext;
    stream: IChatResponseStream;
    token: ICancellationToken;
    extensionContext: IExtensionContext;
    logger: ILogger;
    codeContext: string;
    lm?: vscode.LanguageModelChat;
    lmAdapter?: ILanguageModelAdapter;
}

// Placeholder for getNonce if not defined elsewhere
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Helper function to generate Mermaid syntax from code via LLM and display it
async function generateAndDisplayDiagramFromCode(
    params: CommandHandlerParams,
    llmPromptTemplate: string, // Prompt template expecting {languageId} and {fileContent} placeholders
    panelId: string,
    panelTitle: string,
    commandName: string
): Promise<void> { // Returns void as success/failure is handled internally or via exceptions
    const { request, context, stream, token, extensionContext, logger } = params;

    stream.progress(`Analyzing code for ${commandName}...`);

    const document = vscode.window.activeTextEditor?.document;
    if (!document) {
        stream.markdown('No active editor found. Please open a file first.');
        return; // Exit early
    }

    const fileContent = document.getText();
    if (!fileContent) {
        stream.markdown('The current file is empty. Please add some code first.');
        return; // Exit early
    }

    // Construct the final prompt
    const languageId = document.languageId || '';
    // Ensure backticks within the template are properly escaped for template literals
    const prompt = llmPromptTemplate
        .replace('{languageId}', languageId)
        .replace('{fileContent}', fileContent);

    const messages = [
        vscode.LanguageModelChatMessage.User(`You are an AI assistant that generates Mermaid diagrams from code based on specific instructions. Return ONLY the Mermaid syntax, ensuring it is valid.`), // Generic system message
        vscode.LanguageModelChatMessage.User(prompt)
    ];

    // Send request to the model
    let chatResponse: vscode.LanguageModelChatResponse | undefined; // Ensure type safety
    try {
        chatResponse = await request.model.sendRequest(messages, {}, token);
    } catch (err) {
        // Catch LLM request errors specifically
        handleError(logger, err, stream); // Use existing error handler
        logger.logUsage('request', { kind: commandName, status: 'llm_error' });
        return; // Stop execution for this command
    }

    // Ensure chatResponse is defined before accessing stream
    if (!chatResponse) {
         stream.markdown('Failed to get a response from the language model.');
         logger.logUsage('request', { kind: commandName, status: 'llm_no_response' });
         return;
    }


    // Collect the Mermaid syntax from the response
    let mermaidSyntax = '';
    try {
        for await (const fragment of chatResponse.stream) {
             // Check the type of fragment before appending
             if (fragment instanceof vscode.LanguageModelTextPart) {
                 mermaidSyntax += fragment.value;
             } else if (typeof fragment === 'string') { // Fallback if needed
                 mermaidSyntax += fragment;
             }
            // Add more checks here if other fragment types are possible
         }
    } catch (err) {
        // Handle potential errors during stream processing
        handleError(logger, err, stream); // Use existing error handler
        logger.logUsage('request', { kind: commandName, status: 'stream_error' });
        return; // Stop execution
    }


    // Clean up potential markdown fences or extra whitespace using a more robust regex
    const match = mermaidSyntax.match(/```(?:mermaid)?\s*([\s\S]*?)\s*```/);
    mermaidSyntax = match ? match[1].trim() : mermaidSyntax.trim();

    if (!mermaidSyntax) {
        stream.markdown('No diagram syntax was generated Merby the model. The code might be too complex or the request unclear.');
        logger.logUsage('request', { kind: commandName, status: 'empty_syntax' });
        return; // Exit early
    }

    // Show the raw Mermaid syntax in the chat *before* validation
    // Use template literals for easier string formatting
    stream.markdown(`Here is the generated Mermaid diagram syntax:\n\`\`\`mermaid\n${mermaidSyntax}\n\`\`\``);

    // Use the existing helper to validate and show the webview
    // This function now returns a boolean indicating success
    const webviewShown = await createAndShowDiagramWebview(
        extensionContext,
        logger,
        stream,
        mermaidSyntax,
        panelId,
        panelTitle,
        commandName
    );

    if (!webviewShown) {
         logger.logUsage('request', { kind: commandName, status: 'webview_failed' });
         // Error/validation message is handled within createAndShowDiagramWebview
    } else {
        // Log final success *only* if webview was shown successfully
        logger.logUsage('request', { kind: commandName, status: 'processed' });
    }
    // The createAndShowDiagramWebview function handles further user notifications
}

// Handler for /simpleUML command
async function handleSimpleUML(params: CommandHandlerParams): Promise<IChatResult> {
    try {
        // Define the specific prompt template for simpleUML
        // Use template literals and ensure backticks are escaped correctly
        const llmPromptTemplate = `Analyze the following code and generate a SIMPLE Mermaid diagram representing its structure or logic. Return ONLY the Mermaid syntax, nothing else.

Code:
\\\`\\\`\\\`{languageId}
{fileContent}
\\\`\\\`\\\`

Please generate a SIMPLE Mermaid diagram that represents this code structure. You should:
1. Analyze the code to understand its basic structure
2. Create a SIMPLE diagram using basic Mermaid syntax (preferably a flowchart or class diagram)
3. Keep it minimal - only show the most important elements
4. Use basic Mermaid syntax that is guaranteed to work
5. Return ONLY the Mermaid syntax, nothing else
6. LIMIT the diagram to exactly 10 lines of Mermaid syntax
7. Use ONLY the following valid Mermaid syntax elements:
   - For flowcharts: flowchart TD, -->, [text], (text), {text}
   - For class diagrams: classDiagram, class ClassName, +method(), -field, <|--
   - For sequence diagrams: sequenceDiagram, participant, ->, -->, ->>, -->>

Example of a simple valid Mermaid syntax (10 lines):
\\\`\\\`\\\`mermaid
flowchart TD
    A[Start] --> B[Process]
    B --> C[End]
    C --> D[Start]
    D --> E[Process]
    E --> F[End]
    F --> G[Start]
    G --> H[Process]
    H --> I[End]
\\\`\\\`\\\`

Be sure to use only basic Mermaid syntax and keep the diagram very simple.`;

        // Call the helper function to handle generation and display
        await generateAndDisplayDiagramFromCode(
            params, // Pass the whole params object
            llmPromptTemplate,
            'mermaidDiagram',        // panelId
            'Generated Diagram',     // panelTitle
            'simpleUML'            // commandName
        );

        // Logging for success/failure is now handled within generateAndDisplayDiagramFromCode

    } catch (err) {
        // Catch any unexpected errors not caught by the helper
        // Ensure logger and stream are available from params
        handleError(params.logger, err, params.stream);
        params.logger.logUsage('request', { kind: 'simpleUML', status: 'unexpected_error' });
    }

    // Return metadata regardless of diagram success, unless a critical error occurred before return
    return { metadata: { command: 'simpleUML' } };
}

// Handler for /relationUML command
async function handleRelationUML(params: CommandHandlerParams): Promise<IChatResult> {
	params.logger.logUsage('request', { kind: 'relationUML', status: 'started' });
	const startTime = Date.now();

	// 1. Prepare Prompt
	// Define the specific prompt template for relationUML
	const promptMessages = [
		vscode.LanguageModelChatMessage.User(`
You are an expert software engineer specializing in analyzing code and generating UML diagrams using Mermaid syntax.
Your task is to analyze the following code snippet and create a Mermaid diagram that illustrates the relationships between classes and objects within the code. Focus specifically on showing connections like inheritance, composition, aggregation, and usage.

Code:
\`\`\`
${params.codeContext}
\`\`\`

Please generate only the Mermaid diagram syntax representing these relationships. Do not include explanations or any other text outside the Mermaid code block. Respond inside a markdown code block like \`\`\`mermaid ... \`\`\`. Prioritize clarity and accuracy in representing the connections. If no clear relationships suitable for a UML diagram are found, respond with "No specific class or object relationships found to diagram." inside a normal markdown block.
`),
	];

	// 2. Send Request to LLM
	let response: vscode.LanguageModelChatResponse | undefined;
	try {
        if (!params.lm) { // Guard against missing lm if called incorrectly
            params.stream.markdown('Error: Language model (lm) not available for handleRelationUML.');
            params.logger.logError(new Error('params.lm is undefined in handleRelationUML'), { kind: 'relationUML' });
            return { metadata: { command: 'relationUML' } };
        }
		response = await params.lm.sendRequest(promptMessages, {}, params.token);
	} catch (err: any) {
		params.logger.logUsage('request', { kind: 'relationUML', status: 'llm_error', error: err });
		const errorMessage = `LLM request failed: ${err instanceof Error ? err.message : JSON.stringify(err)}`;
		params.stream.markdown(errorMessage + '\n');
		return { metadata: { command: 'relationUML' } };
	}

	// Check if response is still undefined after try-catch (shouldn't happen if error handling is correct, but good practice)
	if (!response) {
		params.logger.logError(new Error('LLM response was unexpectedly undefined after successful try-catch block.'), { kind: 'relationUML' });
		params.stream.markdown("An unexpected error occurred while contacting the language model.\n");
		return { metadata: { command: 'relationUML' } };
	}

	// 3. Process Response Stream and Extract Mermaid Syntax
	let mermaidSyntax = '';
	let fullResponse = '';
	try {
		for await (const fragment of response.stream) {
			if (params.token.isCancellationRequested) {
				params.logger.logUsage('request', { kind: 'relationUML', status: 'cancelled' });
				break;
			}
			if (fragment instanceof vscode.LanguageModelTextPart) {
				params.stream.markdown(fragment.value);
				fullResponse += fragment.value;
			}
		}

		// Extract mermaid syntax from the full response
		const mermaidMatch = fullResponse.match(/```mermaid\n?([\s\S]*?)\n?```/);
		if (mermaidMatch && mermaidMatch[1]) {
			mermaidSyntax = mermaidMatch[1].trim();
		} else {
			// No mermaid block found - likely the "No specific class..." message or other text
			// The message should already be streamed, so just log and finish
			params.logger.logUsage('request', { kind: 'relationUML', status: 'no_mermaid_found' });
			return { metadata: { command: 'relationUML' } };
		}
	} catch (error) {
		// Handle errors during response streaming/processing
		params.logger.logUsage('request', { kind: 'relationUML', status: 'response_processing_error', error: error });
		params.stream.markdown(`An error occurred while processing the LLM response: ${error instanceof Error ? error.message : JSON.stringify(error)}\n`);
		return { metadata: { command: 'relationUML' } };
	}

	if (params.token.isCancellationRequested) {
		return { metadata: { command: 'relationUML' } }; // Return early if cancelled
	}

	// 4. Validate and Display Diagram
	try {
		// Use the shared helper function to validate and display
		const success = await createAndShowDiagramWebview(
			params.extensionContext,
			params.logger,
			params.stream,
			mermaidSyntax,
			'relationUMLDiagram', // panelId
			'Object Relationships Diagram', // panelTitle
			'relationUML', // commandName for logging/context
		);

		if (success) {
			// Log successful generation
			const duration = Date.now() - startTime;
			params.logger.logUsage('request', { kind: 'relationUML', status: 'success', duration });
		}
		// If validation/display fails, errors/logs are handled within createAndShowDiagramWebview

	} catch (error) {
		// Handle unexpected errors during validation/display phase
		params.logger.logUsage('request', { kind: 'relationUML', status: 'webview_error', error: error });
		params.stream.markdown(`An error occurred while displaying the diagram: ${error instanceof Error ? error.message : JSON.stringify(error)}\n`);
	}

	// Indicate completion (even if errors occurred during processing)
	return { metadata: { command: 'relationUML' } };
}

// Handler for /sequence command
async function handleSequenceDiagram(params: CommandHandlerParams): Promise<IChatResult> {
    try {
        // Define the specific prompt template for sequence diagrams
        const llmPromptTemplate = `Analyze the following code and generate a Mermaid sequence diagram representing the interactions between functions or methods. Return ONLY the Mermaid syntax, nothing else.

Code:
\\\`\\\`\\\`{languageId}
{fileContent}
\\\`\\\`\\\`

Please generate a Mermaid sequence diagram (\`sequenceDiagram\`) showing the call flow or interactions in this code.
1. Analyze the code to understand function/method calls and interactions.
2. Create a sequence diagram using Mermaid syntax starting with \`sequenceDiagram\`.
3. Clearly label participants (e.g., functions, classes, modules).
4. Show the sequence of calls and potential return values.
5. Return ONLY the Mermaid \`sequenceDiagram\` syntax, enclosed in a markdown code block like \\\`\\\`\\\`mermaid ... \\\`\\\`\\\`.
6. If no significant interactions are found, respond with "No clear sequence of interactions found to diagram." inside a normal markdown block.`;

        // Call the helper function to handle generation and display
        await generateAndDisplayDiagramFromCode(
            params, // Pass the whole params object
            llmPromptTemplate,
            'sequenceDiagramPanel',   // panelId
            'Sequence Diagram',       // panelTitle
            'sequence',               // commandName
        );

    } catch (err) {
        // Catch any unexpected errors not caught by the helper
        handleError(params.logger, err, params.stream);
        params.logger.logUsage('request', { kind: 'sequence', status: 'unexpected_error' });
    }

    // Return metadata regardless of diagram success
    return { metadata: { command: 'sequence' } };
}

// Handler for /restEndpoint command
export async function handleRestEndpoint(params: CommandHandlerParams, naturalLanguageQuery: string): Promise<IChatResult> {
    const { request, context, stream, token, extensionContext, logger, lmAdapter } = params;
    const commandName = '[restEndpoint]'; // For logging
    logger.logUsage(commandName, { status: 'started', query: naturalLanguageQuery });

    // VscodeCommandExecutor is used by buildCallHierarchyTree later.
    const commandExecutor: ICommandExecutor = new VscodeCommandExecutor();

    // 1. Discover all endpoints in the workspace
    stream.progress('Discovering REST endpoints...');
    // Pass params.token (ICancellationToken) directly.
    // Pass undefined for optional providers to use defaults within discoverEndpoints.
    const allEndpoints = await discoverEndpoints(token, undefined, undefined, undefined);
    if (token.isCancellationRequested) { return { metadata: { command: commandName } }; }

    if (!allEndpoints || allEndpoints.length === 0) {
        stream.markdown('No REST endpoints found in the current workspace. Ensure your project uses common annotations like @RestController, @GetMapping, etc.');
        logger.logUsage(`${commandName} discoverEndpoints`, { status: 'no_endpoints_found' });
        return { metadata: { command: commandName } };
    }
    logger.logUsage(`${commandName} discoverEndpoints`, { status: 'success', count: allEndpoints.length });

    // 2. Disambiguate to find the target endpoint based on the natural language query
    stream.progress('Figuring out which endpoint you mean...');
    // Arguments: query, endpoints, stream, token (ICancellationToken), lmAdapter, logger
    const targetEndpoint = await disambiguateEndpoint(
        naturalLanguageQuery,
        allEndpoints,
        stream,
        token,
        lmAdapter!,
        logger
    );
    if (token.isCancellationRequested) { return { metadata: { command: commandName } }; }

    if (!targetEndpoint) {
        // disambiguateEndpoint will have already streamed a message to the user
        logger.logUsage(`${commandName} disambiguateEndpoint`, { status: 'no_target_endpoint' });
        return { metadata: { command: commandName } };
    }
    logger.logUsage(`${commandName} disambiguateEndpoint`, { status: 'success', path: targetEndpoint.path, method: targetEndpoint.method });

    // 3. Build Call Hierarchy
    stream.progress(`Building call hierarchy for ${targetEndpoint.handlerMethodName}...`);
    // commandExecutor is an ICommandExecutor; token is an ICancellationToken.
    const hierarchyRoot = await buildCallHierarchyTree(
        commandExecutor,
        targetEndpoint.uri,
        targetEndpoint.position,
        logger,
        token
    );
    if (token.isCancellationRequested) { return { metadata: { command: commandName } }; }

    if (!hierarchyRoot) {
        stream.markdown('Could not build the call hierarchy for the selected endpoint. The endpoint might not have any outgoing calls or there might have been an issue processing it.');
        logger.logUsage(`${commandName} buildCallHierarchyTree`, { status: 'no_root' });
        return { metadata: { command: commandName } };
    }
    logger.logUsage(`${commandName} buildCallHierarchyTree`, { status: 'success', root: hierarchyRoot.item.name });

    // 4. Generate Mermaid Diagram
    stream.progress('Generating sequence diagram...');
    const endpointDetails: EndpointDiagramDetails = {
        path: targetEndpoint.path,
        method: targetEndpoint.method,
        handlerName: targetEndpoint.handlerMethodName
    };
    const mermaidDiagram = generateMermaidSequenceDiagram(hierarchyRoot, endpointDetails);

    if (!mermaidDiagram) {
        stream.markdown('Failed to generate the Mermaid sequence diagram from the call hierarchy.');
        logger.logUsage(`${commandName} generateMermaidSequenceDiagram`, { status: 'generation_failed' });
        return { metadata: { command: commandName } };
    }
    logger.logUsage(`${commandName} generateMermaidSequenceDiagram`, { status: 'success' });

    // Display Diagram
    const panelTitle = `Sequence: ${targetEndpoint.handlerMethodName}`;
    const exportFileNameBase = `sequence_${targetEndpoint.handlerMethodName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    console.log(`[Debug][${commandName}] About to call createAndShowDiagramWebview`); // DEBUG
    const webviewShown = await createAndShowDiagramWebview(
        extensionContext,
        logger,
        stream,
        mermaidDiagram,
        'restEndpointSequenceDiagram',
        panelTitle,
        commandName
    );
    console.log(`[Debug][${commandName}] createAndShowDiagramWebview returned: ${webviewShown}`); // DEBUG

    if (webviewShown) {
        logger.logUsage(`${commandName} createAndShowDiagramWebview`, { status: 'success' });
    } else {
        logger.logUsage(`${commandName} createAndShowDiagramWebview`, { status: 'failure' });
    }

    console.log(`[Debug][${commandName}] Reached end of handler`); // DEBUG
    return { metadata: { command: commandName } };
}

// Helper function to create and show the diagram webview panel
async function createAndShowDiagramWebview(
    extensionContext: IExtensionContext,
    logger: ILogger,
    stream: IChatResponseStream,
    mermaidSyntax: string,
    panelId: string,
    panelTitle: string,
    commandName: string
): Promise<boolean> {
    const logPrefix = `[${commandName}] createAndShowDiagramWebview`;
    logger.logUsage(logPrefix, { status: 'started', syntaxLength: mermaidSyntax.length });

    const isValid = await validateMermaidSyntax(mermaidSyntax, stream, logger, commandName);
    if (!isValid) {
        logger.logUsage(logPrefix, { status: 'validation_failed' });
        // validateMermaidSyntax already sent message to stream
        return false;
    }
    logger.logUsage(logPrefix, { status: 'validation_success' });

    const column = vscode.window.activeTextEditor?.viewColumn;

    // Use actual vscode API here
    const panel = vscode.window.createWebviewPanel(
        panelId,
        panelTitle,
        column || vscode.ViewColumn.One,
        getWebviewOptions(extensionContext.extensionUri) // Pass IUri here
    );

    // Store panel (Need to define currentPanels)
    // currentPanels[panelId] = panel;

    const updateWebviewContent = (theme: string) => {
        // Use IUri for extensionUri path construction
        const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(toVscodeUri(extensionContext.extensionUri), 'dist', 'webview', 'mermaid.min.js'));
        const nonce = getNonce();
        panel.webview.html = getMermaidWebviewHtml(mermaidSyntax, theme);
    };

    updateWebviewContent('default');

    panel.onDidDispose(() => {
        logger.logUsage(logPrefix, { status: 'panel_disposed' });
        // delete currentPanels[panelId];
    }, null, extensionContext.subscriptions);

    panel.webview.onDidReceiveMessage(
        message => { /* ... */ },
        null,
        extensionContext.subscriptions
    );

    logger.logUsage(logPrefix, { status: 'panel_created_shown' });
    return true;
}

/**
 * Helper function to get webview options.
 * This is kept separate as it might need adjustment based on security policies.
 */
function getWebviewOptions(extensionUri: IUri): vscode.WebviewOptions & vscode.WebviewPanelOptions {
    const vscodeExtensionUri = toVscodeUri(extensionUri);
    return {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(vscodeExtensionUri, 'dist')]
    };
}

// Need to define currentPanels somewhere accessible
const currentPanels: { [key: string]: vscode.WebviewPanel } = {};

// --- Helper Function for Export Request Handling ---
async function handleExportRequest(format: 'svg' | 'png', data: string, defaultFileName: string, logger: ILogger) {
    logger.logUsage('handleExportRequest', { format: format });
    let saveData: Buffer;
    let filters: { [name: string]: string[] } = {};

    if (format === 'svg') {
        saveData = Buffer.from(data, 'utf8');
        filters['Scalable Vector Graphics (.svg)'] = ['svg'];
    } else if (format === 'png') {
        // Data is a base64 data URL (e.g., "data:image/png;base64,iVBOR...")
        const base64Data = data.split(',')[1]; // Get the base64 part
        if (!base64Data) {
            vscode.window.showErrorMessage('Invalid PNG data received from webview.');
            logger.logError(new Error('Invalid PNG data URL received'), { format: 'png' });
            return;
        }
        saveData = Buffer.from(base64Data, 'base64');
        filters['Portable Network Graphics (.png)'] = ['png'];
    } else {
        vscode.window.showErrorMessage(`Unsupported export format received: ${format}`);
        logger.logError(new Error(`Unsupported export format received: ${format}`), { format: format });
        return;
    }

    const defaultUri = vscode.workspace.workspaceFolders
        ? vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, `${defaultFileName}.${format}`)
        : undefined;

    try {
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: defaultUri,
            filters: filters,
            saveLabel: `Export Diagram as ${format.toUpperCase()}`
        });

        if (saveUri) {
            await vscode.workspace.fs.writeFile(saveUri, saveData);
            vscode.window.showInformationMessage(`Diagram successfully exported as ${format.toUpperCase()} to: ${saveUri.fsPath}`);
            logger.logUsage('exportHandled', { format: format, status: 'success' });
        } else {
            // User cancelled the save dialog
            logger.logUsage('exportHandled', { format: format, status: 'cancelled' });
        }
    } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to save ${format.toUpperCase()} diagram: ${err.message}`);
        logger.logError(new Error(`Save ${format.toUpperCase()} error: ${err.message}`), { format: format, error: err });
    }
}

// Helper function to validate Mermaid syntax in Node.js using JSDOM
async function validateMermaidSyntax(
    syntax: string,
    stream: IChatResponseStream,
    logger: ILogger,
    commandName: string // Added for better logging
): Promise<boolean> {
    logger.logUsage('debug', { point: 'validateMermaidSyntax.start', syntaxLength: syntax?.length }); // DEBUG
    // Keep track of original global properties to restore them
    const originalWindow = global.window;
    const originalDocument = global.document;
    const originalDOMPurify = (global.window as any)?.DOMPurify; // Cast to any to access potential DOMPurify
    const originalHTMLElement = global.HTMLElement;
    const originalElement = global.Element;
    const originalNavigator = global.navigator;

    try {
        // 1. Create a JSDOM instance
        logger.logUsage('debug', { point: 'validateMermaidSyntax.beforeJSDOM' }); // DEBUG
        const dom = new JSDOM('');
        const { window } = dom;
        logger.logUsage('debug', { point: 'validateMermaidSyntax.afterJSDOM' }); // DEBUG

        // 2. Create and attach DOMPurify to the JSDOM window
        logger.logUsage('debug', { point: 'validateMermaidSyntax.beforeDOMPurify' }); // DEBUG
        const purify = createDOMPurify(window as any); // Cast window to any for DOMPurify compatibility
        (window as any).DOMPurify = purify;
        logger.logUsage('debug', { point: 'validateMermaidSyntax.afterDOMPurify' }); // DEBUG

        // 3. Make JSDOM environment global (temporarily)
        // Mermaid expects certain global properties
        logger.logUsage('debug', { point: 'validateMermaidSyntax.beforeSetGlobals' }); // DEBUG
        (global as any).window = window;
        (global as any).document = window.document;
        (global as any).navigator = window.navigator;
        (global as any).HTMLElement = window.HTMLElement;
        (global as any).Element = window.Element;
        logger.logUsage('debug', { point: 'validateMermaidSyntax.afterSetGlobals' }); // DEBUG


        // 4. Dynamically import Mermaid - it should now find the global JSDOM/DOMPurify
        logger.logUsage('debug', { point: 'validateMermaidSyntax.beforeImportMermaid' }); // DEBUG
        const mermaid = await import('mermaid');
        logger.logUsage('debug', { point: 'validateMermaidSyntax.afterImportMermaid' }); // DEBUG

        // 5. Initialize and Parse
        // We might need to initialize explicitly within this simulated env
        logger.logUsage('debug', { point: 'validateMermaidSyntax.beforeInitialize' }); // DEBUG
        await mermaid.default.initialize({
            startOnLoad: false,
            // Potentially set theme/config if parse depends on it, though unlikely
             securityLevel: 'loose' // Keep loose for consistency
        });
        logger.logUsage('debug', { point: 'validateMermaidSyntax.afterInitialize' }); // DEBUG
        logger.logUsage('debug', { point: 'validateMermaidSyntax.beforeParse' }); // DEBUG
        await mermaid.default.parse(syntax);
        logger.logUsage('debug', { point: 'validateMermaidSyntax.afterParse' }); // DEBUG

        return true;
    } catch (err: any) {
        logger.logUsage('debug', { point: 'validateMermaidSyntax.catchBlock', error: err?.message }); // DEBUG
        const errorMessage = err.message || String(err);
        stream.markdown(`\n**Mermaid Syntax Validation Error (Node.js):**\n\n${errorMessage}\n\nPlease check the generated syntax.`);
        logger.logError(new Error('Mermaid Syntax Error (Node.js)'), { command: commandName, error: errorMessage, syntax });
        return false;
    } finally {
        // 6. IMPORTANT: Clean up globals to avoid side effects
        logger.logUsage('debug', { point: 'validateMermaidSyntax.finallyBlock' }); // DEBUG
        if (originalWindow) {
            (global as any).window = originalWindow;
        } else {
            delete (global as any).window;
        }
         if (originalDocument) {
            (global as any).document = originalDocument;
        } else {
            delete (global as any).document;
        }
        if (originalNavigator) {
             (global as any).navigator = originalNavigator;
         } else {
             delete (global as any).navigator;
         }
        if (originalHTMLElement) {
             (global as any).HTMLElement = originalHTMLElement;
         } else {
             delete (global as any).HTMLElement;
         }
         if (originalElement) {
             (global as any).Element = originalElement;
         } else {
             delete (global as any).Element;
         }
        // Restore DOMPurify if it existed, otherwise ensure it's removed from any temporary global window
        if (originalDOMPurify) {
             (global.window as any).DOMPurify = originalDOMPurify;
         } else if (global.window) {
             delete (global.window as any).DOMPurify;
         }
    }
}

// Helper function to get code context (similar to what might have been in simple.ts)
async function getCodeContext(logger: ILogger, token: ICancellationToken): Promise<string> {
    if (token.isCancellationRequested) { return ''; }
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        logger.logUsage('getCodeContext', { status: 'no_active_editor' });
        return '';
    }
    const document = editor.document;
    const selection = editor.selection;
    if (selection && !selection.isEmpty) {
        logger.logUsage('getCodeContext', { status: 'selection_present' });
        return document.getText(selection);
    }
    logger.logUsage('getCodeContext', { status: 'full_document' });
    return document.getText();
}

// Default command handler
async function handleDefaultCommand({ stream, logger }: Pick<CommandHandlerParams, 'stream' | 'logger'>): Promise<IChatResult> {
    logger.logUsage('request', { kind: 'default', status: 'started' });
    stream.markdown("I can help generate diagrams from code. Try selecting some code and asking me to diagram it, or use `/simpleUML`, `/relationUML`, or `/sequence`.");
    logger.logUsage('request', { kind: 'default' });
    return { metadata: { command: 'default' } };
}

// Minimal TelemetrySender for vscode.env.createTelemetryLogger
const minimalTelemetrySender: vscode.TelemetrySender = {
    sendEventData: (eventName: string, data?: Record<string, any>) => {
        console.log(`[TelemetryEvent] ${eventName}:`, data);
    },
    sendErrorData: (error: Error, data?: Record<string, any>) => {
        console.error(`[TelemetryError] ${error.name}: ${error.message}`, data);
    }
};

export function registerSimpleParticipant(extensionContext: IExtensionContext) {
    const vsCodeLogger = vscode.env.createTelemetryLogger(minimalTelemetrySender, { ignoreBuiltInCommonProperties: true });
    const actualLogger: ILogger = new VscodeTelemetryLoggerAdapter(vsCodeLogger);

    const participantHandler: vscode.ChatRequestHandler = async (request, context, rawStream, rawToken) => {
        const stream = new VscodeChatResponseStreamAdapter(rawStream);
        const token = new VscodeCancellationTokenAdapter(rawToken);
        const lmAdapter = request.model ? new VscodeLanguageModelAdapter(request.model, request.model.id, "Dive") : undefined;
        // Assuming extensionContext is the IExtensionContext from the outer function scope
        const codeCtx = await getCodeContext(actualLogger, token);

        const params: CommandHandlerParams = {
            request,
            context,
            stream,
            token,
            extensionContext, // This is the IExtensionContext passed to registerSimpleParticipant
            logger: actualLogger,
            codeContext: codeCtx,
            lm: request.model, // Keep raw model if needed by handlers directly
            lmAdapter
        };

        const { command, prompt } = request;
        let result: Promise<IChatResult>;

        switch (command) {
            case 'simpleUML':
                result = handleSimpleUML(params);
                break;
            case 'relationUML':
                result = handleRelationUML(params);
                break;
            case 'sequenceDiagram':
                result = handleSequenceDiagram(params);
                break;
            case 'restEndpoint':
                const query = prompt.substring(command.length + 1).trim();
                if (!query) {
                    stream.markdown('Please provide a natural language query for the REST endpoint.');
                    result = Promise.resolve({ metadata: { command: 'restEndpoint' } });
                } else {
                    result = handleRestEndpoint(params, query);
                }
                break;
            default:
                result = handleDefaultCommand(params);
        }
        return result;
    };

    const participant = vscode.chat.createChatParticipant(DIAGRAM_PARTICIPANT_ID, participantHandler);

    participant.iconPath = new vscode.ThemeIcon('diagram');
    // participant.description = ...;
    // participant.sampleRequest = ...;
    // participant.isSticky = ...;

    // Optional: Followup provider
    participant.followupProvider = {
        provideFollowups(result: IChatResult, context: vscode.ChatContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ChatFollowup[]> {
            // Example: return [{ prompt: 'Explain the diagram', label: 'Explain Diagram', command: 'explainDiagram' }];
            return [];
        }
    };

    extensionContext.subscriptions.push(participant);
}

// Ensure all other functions (handleSimpleUML, handleRestEndpoint, createAndShowDiagramWebview, etc.)
// correctly use the types from CommandHandlerParams (IChatResponseStream, ICancellationToken, ILogger).
// The file read indicated these were already partially updated, but they need to be consistent.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleError(logger: ILogger, err: any, stream: IChatResponseStream): void {
    // making the chat request might fail because
    // - model does not exist
    // - user consent not given
    // - quote limits exceeded
    logger.logError(err);
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
    const fallbackMessage = vscode.l10n.t('Sorry, something went wrong: {0}', errorMessage);

    if (err instanceof vscode.LanguageModelError) {
        console.log(err.message, err.code, err.cause);
        if (err.cause instanceof Error && err.cause.message.includes('off_topic')) {
            stream.markdown(vscode.l10n.t("I'm sorry, I can only explain computer science concepts."));
        } else {
            // Send a generic message for other LanguageModelErrors
            stream.markdown(fallbackMessage);
        }
    } else {
        // Send a message for non-LanguageModelErrors before re-throwing,
        // just in case re-throwing doesn't display nicely.
        stream.markdown(fallbackMessage);
        // re-throw other errors so they show up in the UI
        throw err;
    }
}
