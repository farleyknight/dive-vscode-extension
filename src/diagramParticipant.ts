import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import * as path from 'path'; // Import path module
import { TextDecoder } from 'util'; // Import TextDecoder for Uint8Array conversion
import { getMermaidWebviewHtml } from './views/mermaid-webview-template'; // Added import
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { EndpointInfo, discoverEndpoints } from './endpoint-discovery'; // Corrected: discoverEndpoints and EndpointInfo from here
import { disambiguateEndpoint } from './endpoint-disambiguation'; // Corrected: disambiguateEndpoint from here
// Removed import for MermaidService as it's unused.
// Removed import for TelemetryService and related types as they are unused.
// Removed import for Logger as vscode.TelemetryLogger is used.
// Removed import for DiveLanguageModel and LanguageModelService as they are unused.

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
    stream: vscode.ChatResponseStream;
    token: vscode.CancellationToken;
    extensionContext: vscode.ExtensionContext;
    logger: vscode.TelemetryLogger;
    codeContext: string;
    lm: vscode.LanguageModelChat;
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
			'relationUML-diagram' // exportFileNameBase
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
    const { stream, token, logger } = params;
    logger.logUsage('request', { kind: 'restEndpoint', status: 'started', query: naturalLanguageQuery });
    const startTime = Date.now();

    try {
        stream.progress("Discovering REST endpoints...");
        const allEndpoints = await discoverEndpoints(token); // Call discovery function

        // Report discovered endpoints immediately
        if (allEndpoints && allEndpoints.length > 0) {
            let message = `I found ${allEndpoints.length} REST endpoints:\n\n`;
            for (const ep of allEndpoints) {
                const fileName = path.basename(ep.uri.fsPath);
                // Format with 1-based line numbers for display
                message += `- ${ep.method} ${ep.path} in ${fileName} (lines ${ep.startLine + 1}-${ep.endLine + 1})\n`;
            }
            stream.markdown(message);
        }
        // Keep the original "no endpoints" check later for cases where discovery succeeds but finds nothing

        if (token.isCancellationRequested) {
            logger.logUsage('request', { kind: 'restEndpoint', status: 'cancelled', duration: Date.now() - startTime });
            return { metadata: { command: 'restEndpoint' } };
        }

        if (!allEndpoints || allEndpoints.length === 0) {
            // Message is handled within discoverEndpoints or disambiguateEndpoint if it returns early
             if (allEndpoints && allEndpoints.length === 0) { // Only log if discovery succeeded but found nothing
                stream.markdown("I couldn't find any REST endpoints in this workspace.");
            }
            logger.logUsage('request', { kind: 'restEndpoint', status: 'no_endpoints_found', duration: Date.now() - startTime });
            return { metadata: { command: 'restEndpoint' } };
        }

        stream.progress(`Found ${allEndpoints.length} endpoints. Identifying target...`);

        // Call disambiguation function
        const targetEndpoint = await disambiguateEndpoint(
            naturalLanguageQuery,
            allEndpoints,
            stream,
            token,
            params.lm,      // Pass lm
            params.logger   // Pass logger
        );

        if (token.isCancellationRequested) {
            logger.logUsage('request', { kind: 'restEndpoint', status: 'cancelled', duration: Date.now() - startTime });
            return { metadata: { command: 'restEndpoint' } };
        }

        if (!targetEndpoint) {
            // Message handled within disambiguateEndpoint
            logger.logUsage('request', { kind: 'restEndpoint', status: 'disambiguation_failed', duration: Date.now() - startTime });
            return { metadata: { command: 'restEndpoint' } };
        }

        stream.progress(`Target endpoint identified: ${targetEndpoint.method} ${targetEndpoint.path}. Analyzing call hierarchy...`);

        // TODO: Implement Step 3: Java LSP Call Hierarchy Integration using targetEndpoint.uri and targetEndpoint.position
        stream.markdown(`Okay, I've identified the endpoint: \`${targetEndpoint.method} ${targetEndpoint.path}\` in \`${path.basename(targetEndpoint.uri.fsPath)}\`.`);
        // stream.markdown("Next steps would involve using the Java LSP to find its call hierarchy and generate the sequence diagram. This part is not yet implemented.");

        // Attempt to show Call Hierarchy using the Java extension's command
        try {
            await vscode.commands.executeCommand('java.showCallHierarchy', targetEndpoint.uri, targetEndpoint.position);
            stream.markdown("Attempted to display call hierarchy. Please check the standard VS Code Call Hierarchy view.");
            logger.logUsage('request', { kind: 'restEndpoint', status: 'call_hierarchy_invoked', duration: Date.now() - startTime });
        } catch (chError) {
            const errorMessage = chError instanceof Error ? chError.message : String(chError);
            logger.logError(chError instanceof Error ? chError : new Error(String(chError)), { kind: 'restEndpoint', stage: 'call_hierarchy_command' });
            stream.markdown(`Failed to invoke call hierarchy: ${errorMessage}`);
            logger.logUsage('request', { kind: 'restEndpoint', status: 'call_hierarchy_error', duration: Date.now() - startTime, error: errorMessage });
        }

        // logger.logUsage('request', { kind: 'restEndpoint', status: 'processed_stub', duration: Date.now() - startTime });

    } catch (err) {
        handleError(logger, err, stream);
        logger.logUsage('request', { kind: 'restEndpoint', status: 'error', duration: Date.now() - startTime, error: err instanceof Error ? err.message : String(err) });
    }

    return { metadata: { command: 'restEndpoint' } };
}

// Helper function to create and show the diagram webview panel
async function createAndShowDiagramWebview(
    extensionContext: vscode.ExtensionContext,
    logger: vscode.TelemetryLogger,
    stream: vscode.ChatResponseStream,
    mermaidSyntax: string,
    panelId: string,
    panelTitle: string,
    commandName: string, // For logging context
    exportFileNameBase?: string // Optional base filename for export
): Promise<boolean> { // Returns true if successful, false otherwise

    // Validate the syntax first
    const isValid = await validateMermaidSyntax(mermaidSyntax, stream, logger, commandName);
    if (!isValid) {
        // Validation failed, message already sent by validator
        return false;
    }

    const panel = vscode.window.createWebviewPanel(
        panelId,
        panelTitle,
        vscode.ViewColumn.Beside, // Show in a side column
        {
            enableScripts: true, // IMPORTANT: Allow scripts to run
            retainContextWhenHidden: true // Keep state when tab is not visible
        }
    );

    // Initial default theme
    let currentTheme = 'dark'; // Match default in template

    // Function to update webview content
    const updateWebviewContent = (theme: string) => {
        panel.webview.html = getMermaidWebviewHtml(mermaidSyntax, theme);
    };

    // Set initial content
    updateWebviewContent(currentTheme);

    // Add the "Save As..." button to the chat (for MMD/MD)
    stream.button({
        command: 'diagram.saveAs', // Use the registered command
        arguments: [mermaidSyntax, exportFileNameBase || commandName], // Pass syntax and default filename
        title: vscode.l10n.t('Save Diagram As (.mmd, .md)...')
    });

    // Listen for messages from the webview
    panel.webview.onDidReceiveMessage(
        async message => {
            logger.logUsage('webviewMessage', { command: message.command, format: message.format });
            switch (message.command) {
                case 'themeChange': // Although theme change is handled client-side, keep this for potential future use or logging
                    currentTheme = message.theme;
                    // No need to re-render HTML here, client-side handles it
                    console.log("Theme changed in webview (client-side):", currentTheme);
                    return;

                case 'error': // Handle errors reported from webview script
                    vscode.window.showErrorMessage(`Webview Error: ${message.message}`);
                    logger.logError(new Error(`Webview Error: ${message.message}`), { commandName: commandName });
                    return;

                case 'exportData': // Handle export requests from the webview
                    await handleExportRequest(message.format, message.data, exportFileNameBase || commandName, logger);
                    return;
            }
        },
        undefined, // thisArg
        extensionContext.subscriptions // Dispose listener when extension deactivates
    );

    // Optional: Handle panel disposal
    panel.onDidDispose(
        () => {
            // Clean up resources if needed
            console.log('Mermaid webview panel disposed');
        },
        null,
        extensionContext.subscriptions
    );

    return true; // Indicate success
}

// --- Helper Function for Export Request Handling ---
async function handleExportRequest(format: 'svg' | 'png', data: string, defaultFileName: string, logger: vscode.TelemetryLogger) {
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
    stream: vscode.ChatResponseStream,
    logger: vscode.TelemetryLogger,
    commandName: string // Added for better logging
): Promise<boolean> {
    // Keep track of original global properties to restore them
    const originalWindow = global.window;
    const originalDocument = global.document;
    const originalDOMPurify = (global.window as any)?.DOMPurify; // Cast to any to access potential DOMPurify
    const originalHTMLElement = global.HTMLElement;
    const originalElement = global.Element;
    const originalNavigator = global.navigator;

    try {
        // 1. Create a JSDOM instance
        const dom = new JSDOM('');
        const { window } = dom;

        // 2. Create and attach DOMPurify to the JSDOM window
        const purify = createDOMPurify(window as any); // Cast window to any for DOMPurify compatibility
        (window as any).DOMPurify = purify;

        // 3. Make JSDOM environment global (temporarily)
        // Mermaid expects certain global properties
        (global as any).window = window;
        (global as any).document = window.document;
        (global as any).navigator = window.navigator;
        (global as any).HTMLElement = window.HTMLElement;
        (global as any).Element = window.Element;


        // 4. Dynamically import Mermaid - it should now find the global JSDOM/DOMPurify
        const mermaid = await import('mermaid');

        // 5. Initialize and Parse
        // We might need to initialize explicitly within this simulated env
        await mermaid.default.initialize({
            startOnLoad: false,
            // Potentially set theme/config if parse depends on it, though unlikely
             securityLevel: 'loose' // Keep loose for consistency
        });
        await mermaid.default.parse(syntax);

        return true;
    } catch (err: any) {
        const errorMessage = err.message || String(err);
        stream.markdown(`\n**Mermaid Syntax Validation Error (Node.js):**\n\n${errorMessage}\n\nPlease check the generated syntax.`);
        logger.logError(new Error('Mermaid Syntax Error (Node.js)'), { command: commandName, error: errorMessage, syntax });
        return false;
    } finally {
        // 6. IMPORTANT: Clean up globals to avoid side effects
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

// Default handler for unrecognized commands
async function handleDefaultCommand({ stream, logger }: Pick<CommandHandlerParams, 'stream' | 'logger'>): Promise<IChatResult> {
    stream.markdown("I can help generate diagrams from code. Try selecting some code and asking me to diagram it, or use `/simpleUML`, `/relationUML`, or `/sequence`.");
    logger.logUsage('request', { kind: 'default' });
    return { metadata: { command: 'default' } };
}

export function registerSimpleParticipant(extensionContext: vscode.ExtensionContext) {

    // Define logger within the registration function scope, accessible by handler and feedback listeners
    const logger = vscode.env.createTelemetryLogger({
        sendEventData(eventName, data) { console.log(`Event: ${eventName}`, data); },
        sendErrorData(error, data) { console.error(`Error: ${error}`, data); }
    });

    // Update return type - remove ChatAgentResult as we are not manually handling tool results here
    const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken): Promise<IChatResult> => {
        let codeContext = '';
        let lm: vscode.LanguageModelChat | undefined;

        try {
            // Attempt to get the language model - Use Claude 3.5 Sonnet
            const models = await vscode.lm.selectChatModels({ family: 'claude-3.5-sonnet' }); // Await the promise
            lm = models[0]; // Access the first model
            if (!lm) {
                // Attempt to fall back to GPT-4o if Sonnet is not available
                stream.markdown("Claude 3.5 Sonnet not found, trying GPT-4o...\n");
                const gptModels = await vscode.lm.selectChatModels({ family: 'gpt-4o' });
                lm = gptModels[0];
                if (!lm) {
                    // If neither is found, report error
                    stream.markdown("Unable to access a suitable language model (Claude 3.5 Sonnet or GPT-4o).\n");
                    return { metadata: { command: request.command || 'error' } };
                }
            }

            // Get code context directly from the active editor
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.selection;
                if (!selection.isEmpty) {
                    codeContext = editor.document.getText(selection);
                } else {
                    codeContext = editor.document.getText();
                }
            } else {
                // Handle case where no editor is active, maybe needed for some commands?
                // For commands requiring code, they should handle the empty codeContext gracefully.
                logger.logUsage('request', { kind: request.command || 'unknown', status: 'no_active_editor' });
            }

            // Construct the full params object
            const params: CommandHandlerParams = {
                request,
                context,
                stream,
                token,
                extensionContext,
                logger,
                codeContext, // Include codeContext
                lm, // Include lm
            };

            // Route to the appropriate handler based on the command
            if (request.command === 'simpleUML') {
                return handleSimpleUML(params);
            } else if (request.command === 'relationUML') {
                return handleRelationUML(params); // Pass the full params
            } else if (request.command === 'sequence') {
                return handleSequenceDiagram(params); // Add routing for sequence
            } else if (request.command === 'restEndpoint') {
                // Extract the natural language query after the command
                // Assumes format: /restEndpoint Some natural language query
                const naturalLanguageQuery = request.prompt.trim();
                if (!naturalLanguageQuery) {
                    stream.markdown('Please provide a query after the `/restEndpoint` command. For example: `/restEndpoint Show the user creation flow`');
                    return { metadata: { command: 'restEndpoint' } };
                } else {
                    return handleRestEndpoint(params, naturalLanguageQuery);
                }
            } else {
                // Default handler might only need stream/logger
                return handleDefaultCommand({ stream, logger });
            }
        } catch (err) {
            handleError(logger, err, stream);
            return { metadata: { command: request.command || 'unknown_error' } };
        }
    };

    // Chat participants appear as top-level options in the chat input
    // when you type `@`, and can contribute sub-commands in the chat input
    // that appear when you type `/`.
    const participant = vscode.chat.createChatParticipant(DIAGRAM_PARTICIPANT_ID, handler);

    participant.iconPath = new vscode.ThemeIcon('symbol-keyword');
    participant.followupProvider = {
        provideFollowups(_result: IChatResult, _context: vscode.ChatContext, _token: vscode.CancellationToken) {
            // Logger is now accessible here
            return [{
                prompt: 'Create a simple UML diagram',
                label: vscode.l10n.t('Generate Simple UML'),
                command: 'simpleUML'
            }, {
                prompt: 'Show relationships between classes/objects',
                label: vscode.l10n.t('Generate Relation UML'),
                command: 'relationUML'
            },{
                prompt: 'Generate a sequence diagram',
                label: vscode.l10n.t('Generate Sequence Diagram'),
                command: 'sequence'
            } satisfies vscode.ChatFollowup];
        }
    };

    extensionContext.subscriptions.push(participant.onDidReceiveFeedback((feedback: vscode.ChatResultFeedback) => {
        // Log chat result feedback - logger is accessible here
        logger.logUsage('chatResultFeedback', {
            kind: feedback.kind
        });
    }));

    // Register the command handler for the followup
    extensionContext.subscriptions.push(
        participant,
        vscode.commands.registerTextEditorCommand(DIAGRAM_NAMES_COMMAND_ID, async (textEditor: vscode.TextEditor) => {
            // Replace all variables in active editor with diagram-related names? Or keep generic?
            const text = textEditor.document.getText();

            let chatResponse: vscode.LanguageModelChatResponse | undefined;
            try {
                // Use gpt-4o since it is fast and high quality.
                const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
                if (!model) {
                    console.log('Model not found. Please make sure the GitHub Copilot Chat extension is installed and enabled.');
                    return;
                }

                const messages = [
                    vscode.LanguageModelChatMessage.User(`You are an AI assistant! Think carefully and step by step.
                    Your job is to replace all variable names in the following code with diagram-related variable names. Be creative. IMPORTANT respond just with code. Do not use markdown!`),
                    vscode.LanguageModelChatMessage.User(text)
                ];
                chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

            } catch (err) {
                if (err instanceof vscode.LanguageModelError) {
                    console.log(err.message, err.code, err.cause);
                } else {
                    throw err;
                }
                return;
            }

            // Clear the editor content before inserting new content
            await textEditor.edit(edit => {
                const start = new vscode.Position(0, 0);
                const end = new vscode.Position(textEditor.document.lineCount - 1, textEditor.document.lineAt(textEditor.document.lineCount - 1).text.length);
                edit.delete(new vscode.Range(start, end));
            });

            // Stream the code into the editor as it is coming in from the Language Model
            try {
                for await (const fragment of chatResponse.text) {
                    await textEditor.edit(edit => {
                        const lastLine = textEditor.document.lineAt(textEditor.document.lineCount - 1);
                        const position = new vscode.Position(lastLine.lineNumber, lastLine.text.length);
                        edit.insert(position, fragment);
                    });
                }
            } catch (err) {
                // async response stream may fail, e.g network interruption or server side error
                await textEditor.edit(edit => {
                    const lastLine = textEditor.document.lineAt(textEditor.document.lineCount - 1);
                    const position = new vscode.Position(lastLine.lineNumber, lastLine.text.length);
                    edit.insert(position, (err as Error).message);
                });
            }
        }),
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleError(logger: vscode.TelemetryLogger, err: any, stream: vscode.ChatResponseStream): void {
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
