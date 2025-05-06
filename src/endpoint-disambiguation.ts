import * as vscode from 'vscode';
import { basename } from 'path'; // Specifically import basename
import { EndpointInfo } from './endpoint-discovery'; // Assuming EndpointInfo will remain in endpoint-discovery.ts or be moved to a shared types file

/**
 * Placeholder for endpoint disambiguation logic.
 * Tries to match the user query against the list of discovered endpoints.
 * Asks for clarification if needed.
 */
export async function disambiguateEndpoint(
    query: string,
    endpoints: EndpointInfo[],
    stream: vscode.ChatResponseStream, // stream is kept for messages, but not for quick pick
    token: vscode.CancellationToken,
    lm: vscode.LanguageModelChat,
    logger: vscode.TelemetryLogger
): Promise<EndpointInfo | null> {
    console.log(`[disambiguateEndpoint] Entry - Query: "${query}", Endpoints: ${endpoints.length}`); // DEBUG
    if (token.isCancellationRequested) {
        console.log("[disambiguateEndpoint] Cancelled early."); // DEBUG
        logger.logUsage('disambiguateEndpoint', { phase: 'start', status: 'cancelled_early', query });
        return null;
    }

    if (!endpoints || endpoints.length === 0) {
        console.log("[disambiguateEndpoint] No endpoints provided."); // DEBUG
        logger.logUsage('disambiguateEndpoint', { phase: 'start', status: 'no_endpoints_provided', query });
        return null;
    }

    if (endpoints.length === 1) {
        console.log("[disambiguateEndpoint] Single endpoint, returning."); // DEBUG
        logger.logUsage('disambiguateEndpoint', { phase: 'result', status: 'single_endpoint_returned', query, chosenPath: endpoints[0].path });
        return endpoints[0];
    }

    // --- Simple Heuristic Check (Initial Pass) ---
    console.log("[disambiguateEndpoint] Starting heuristic check."); // DEBUG
    logger.logUsage('disambiguateEndpoint', { phase: 'heuristic_check', status: 'started', query, count: endpoints.length });
    // 1. Attempt direct match (e.g., "GET /api/users")
    const queryParts = query.trim().split(' ');
    let directMatch: EndpointInfo | undefined;
    if (queryParts.length >= 2) {
        const potentialMethod = queryParts[0].toUpperCase();
        const potentialPath = queryParts.slice(1).join(' ');
        directMatch = endpoints.find(ep =>
            ep.method.toUpperCase() === potentialMethod && ep.path === potentialPath
        );
        console.log(`[disambiguateEndpoint] Direct match check - Method: ${potentialMethod}, Path: "${potentialPath}", Found: ${!!directMatch}`); // DEBUG
        if (directMatch) {
            logger.logUsage('disambiguateEndpoint', { phase: 'heuristic_check', status: 'direct_match_found', query, chosenPath: directMatch.path });
            console.log("[disambiguateEndpoint] Returning direct match.", directMatch.path); // DEBUG
            return directMatch;
        }
    }

    // 2. Attempt simple keyword matching on path and handler method name
    const lowerQuery = query.toLowerCase();
    const keywordMatches = endpoints.filter(ep =>
        ep.path.toLowerCase().includes(lowerQuery) ||
        ep.handlerMethodName.toLowerCase().includes(lowerQuery)
    );
    console.log(`[disambiguateEndpoint] Keyword match check - Query: "${lowerQuery}", Matches found: ${keywordMatches.length}`); // DEBUG

    if (keywordMatches.length === 1) {
        logger.logUsage('disambiguateEndpoint', { phase: 'heuristic_check', status: 'unique_keyword_match_found', query, chosenPath: keywordMatches[0].path });
        console.log("[disambiguateEndpoint] Returning unique keyword match.", keywordMatches[0].path); // DEBUG
        return keywordMatches[0];
    }
    logger.logUsage('disambiguateEndpoint', { phase: 'heuristic_check', status: 'no_unique_heuristic_match', query, keywordMatchCount: keywordMatches.length });

    // If heuristics didn't find a unique match, and we still have multiple candidates, try LLM.
    // Use the result of keywordMatches if it narrowed down the list, otherwise use all endpoints.
    const candidatesForLLM = keywordMatches.length > 1 ? keywordMatches : endpoints;
    console.log(`[disambiguateEndpoint] Proceeding to LLM check. Candidates: ${candidatesForLLM.length}`); // DEBUG

    if (candidatesForLLM.length > 1) {
        logger.logUsage('disambiguateEndpoint', { phase: 'llm_disambiguation', status: 'started', query, initial_candidate_count: candidatesForLLM.length });
        console.log("[disambiguateEndpoint] Calling stream.progress for LLM."); // DEBUG
        stream.progress('Multiple endpoints found. Asking AI to help select the best match...');

        const endpointListForLLM = candidatesForLLM.map((ep, index) =>
            `Index: ${index}\nMethod: ${ep.method}\nPath: ${ep.path}\nHandler: ${ep.handlerMethodName}\nFile: ${basename(ep.uri.fsPath)}`
        ).join('\n\n');

        const prompt = `The user provided the query: "${query}"\n\nI found the following REST API endpoints. Which one is the best match for the user's query?\n\n${endpointListForLLM}\n\nPlease respond with only the numeric index of the best matching endpoint. For example, if the best match is the first endpoint, respond with "0". If you cannot determine a single best match, respond with "None".`;
        console.log("[disambiguateEndpoint] Sending request to LLM."); // DEBUG
        logger.logUsage('disambiguateEndpoint', { phase: 'llm_disambiguation', status: 'sending_prompt', query, prompt_length: prompt.length, candidate_count: candidatesForLLM.length });

        try {
            const messages = [vscode.LanguageModelChatMessage.User(prompt)];
            const chatResponse = await lm.sendRequest(messages, {}, token);

            let llmResponseText = '';
            // Note: LM response might be streamed.
            // It's crucial to collect the full response before parsing.
            console.log("[disambiguateEndpoint] Starting LLM stream processing."); // DEBUG
            for await (const fragment of chatResponse.stream) {
                 console.log("[disambiguateEndpoint] LLM Stream fragment:", fragment); // DEBUG
                 if (fragment instanceof vscode.LanguageModelTextPart) {
                    llmResponseText += fragment.value;
                 } else if (typeof fragment === 'string') { // Fallback for older/different API versions
                    llmResponseText += fragment;
                 }
            }
            llmResponseText = llmResponseText.trim();
            console.log(`[disambiguateEndpoint] LLM Response (trimmed): "${llmResponseText}"`); // DEBUG

            logger.logUsage('disambiguateEndpoint', { phase: 'llm_disambiguation', status: 'received_response', query, llm_response: llmResponseText });

            if (llmResponseText.toLowerCase() !== 'none') {
                const chosenIndex = parseInt(llmResponseText, 10);
                console.log(`[disambiguateEndpoint] Parsed LLM index: ${chosenIndex}`); // DEBUG
                const isValidIndex = !isNaN(chosenIndex) && chosenIndex >= 0 && chosenIndex < candidatesForLLM.length;
                console.log(`[disambiguateEndpoint] Is valid index? ${isValidIndex}`); // DEBUG
                if (isValidIndex) {
                    const chosenEndpoint = candidatesForLLM[chosenIndex];
                    logger.logUsage('disambiguateEndpoint', { phase: 'llm_disambiguation', status: 'llm_selected_endpoint', query, chosenPath: chosenEndpoint.path, llm_response: llmResponseText });
                    console.log("[disambiguateEndpoint] LLM selected endpoint. Calling stream.markdown and returning.", chosenEndpoint.path); // DEBUG
                    stream.markdown(`AI suggested: ${chosenEndpoint.method} ${chosenEndpoint.path}`);
                    return chosenEndpoint;
                } else {
                    logger.logUsage('disambiguateEndpoint', { phase: 'llm_disambiguation', status: 'llm_invalid_index', query, llm_response: llmResponseText });
                    console.log("[disambiguateEndpoint] LLM index invalid. Calling stream.markdown."); // DEBUG
                    stream.markdown('AI assistant gave an unclear answer. Please choose from the list.');
                }
            } else {
                logger.logUsage('disambiguateEndpoint', { phase: 'llm_disambiguation', status: 'llm_said_none', query, llm_response: llmResponseText });
                console.log("[disambiguateEndpoint] LLM said None. Calling stream.markdown."); // DEBUG
                stream.markdown('AI assistant could not determine a single best match. Please choose from the list.');
            }
        } catch (error: any) {
            console.error("[disambiguateEndpoint] LLM request failed:", error); // DEBUG
            logger.logError(error, { phase: 'llm_disambiguation', status: 'llm_request_failed', query });
            console.log("[disambiguateEndpoint] LLM error. Calling stream.markdown."); // DEBUG
            stream.markdown(`Error during AI assistance: ${error.message || 'Unknown error'}. Please choose from the list.`);
        }
    }

    // --- Fallback: Ask for Clarification in Chat ---
    console.log("[disambiguateEndpoint] Entering fallback clarification."); // DEBUG
    logger.logUsage('disambiguateEndpoint', { phase: 'fallback', status: 'asking_user_clarification', query, count: candidatesForLLM.length });

    // Construct the message listing ambiguous endpoints
    const endpointListText = candidatesForLLM.map(ep =>
        `- \`${ep.method} ${ep.path}\` (in ${basename(ep.uri.fsPath)})`
    ).join('\n');

    const clarificationMessage = `I found several potential endpoints matching your query "${query}":\n\n${endpointListText}\n\nCould you please clarify which one you meant? You can specify the method and path (e.g., 'POST /api/users') or provide more details about the functionality.`;

    console.log("[disambiguateEndpoint] Calling stream.markdown for fallback."); // DEBUG
    stream.markdown(clarificationMessage);

    // Return null to indicate disambiguation failed for this turn, waiting for user response.
    console.log("[disambiguateEndpoint] Returning null (fallback)."); // DEBUG
    return null;
}