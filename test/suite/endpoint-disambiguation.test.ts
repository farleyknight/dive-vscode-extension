import * as assert from 'assert';
import * as sinon from 'sinon';
import { basename } from 'path';
import * as vscode from 'vscode'; // Keep vscode for stubs if showQuickPick is part of it
import { disambiguateEndpoint } from '../../src/endpoint-disambiguation';
import { EndpointInfo } from '../../src/endpoint-discovery'; // Assuming EndpointInfo is here

// --- Test-Local Mock Types (Copied from endpoint-discovery.test.ts) ---
interface MockUri {
    fsPath: string; scheme: string; path: string; authority: string; query: string; fragment: string;
    toString(): string;
    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): MockUri;
    toJSON(): any;
}
function createMockUri(filePath: string): MockUri {
    const path = filePath.startsWith('/') ? filePath : '/' + filePath;
    const newUri: MockUri = {
        fsPath: path, scheme: 'file', path: path, authority: '', query: '', fragment: '',
        toString: () => `file://${path.startsWith('//') ? path.substring(2) : (path.startsWith('/') ? path.substring(1) : path)}`,
        with: (change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): MockUri => {
            const mergedFsPath = change.path !== undefined ? change.path : newUri.path;
            const tempUriForMerged = createMockUri(mergedFsPath);
            return {
                ...tempUriForMerged,
                scheme: change.scheme !== undefined ? change.scheme : newUri.scheme,
                authority: change.authority !== undefined ? change.authority : newUri.authority,
                query: change.query !== undefined ? change.query : newUri.query,
                fragment: change.fragment !== undefined ? change.fragment : newUri.fragment,
            };
        },
        toJSON: () => ({ $mid: 1, fsPath: newUri.fsPath, external: newUri.toString(), path: newUri.path, scheme: newUri.scheme, authority: newUri.authority, query: newUri.query, fragment: newUri.fragment })
    }; return newUri;
}

interface MockPosition {
    line: number; character: number;
    isBefore(other: MockPosition): boolean; isBeforeOrEqual(other: MockPosition): boolean;
    isAfter(other: MockPosition): boolean; isAfterOrEqual(other: MockPosition): boolean;
    isEqual(other: MockPosition): boolean; compareTo(other: MockPosition): number;
    translate(lineDelta?: number, characterDelta?: number): MockPosition;
    translate(change: { lineDelta?: number; characterDelta?: number }): MockPosition;
    with(line?: number, character?: number): MockPosition;
    with(change: { line?: number; character?: number }): MockPosition;
}
function createMockPosition(line: number, character: number): MockPosition {
    const pos = { line, character } as any; // Use `as any` initially for easier method assignment
    pos.isBefore = (other: MockPosition): boolean => pos.line < other.line || (pos.line === other.line && pos.character < other.character);
    pos.isBeforeOrEqual = (other: MockPosition): boolean => pos.line < other.line || (pos.line === other.line && pos.character <= other.character);
    pos.isAfter = (other: MockPosition): boolean => pos.line > other.line || (pos.line === other.line && pos.character > other.character);
    pos.isAfterOrEqual = (other: MockPosition): boolean => pos.line > other.line || (pos.line === other.line && pos.character >= other.character);
    pos.isEqual = (other: MockPosition): boolean => pos.line === other.line && pos.character === other.character;
    pos.compareTo = (other: MockPosition): number => {
        if (pos.line < other.line) return -1; if (pos.line > other.line) return 1;
        if (pos.character < other.character) return -1; if (pos.character > other.character) return 1;
        return 0;
    };
    pos.translate = function(this: MockPosition, lineDeltaOrChange?: number | { lineDelta?: number; characterDelta?: number }, characterDeltaInput?: number): MockPosition {
        let lineDelta = 0; let charDelta = 0;
        if (typeof lineDeltaOrChange === 'object') { lineDelta = lineDeltaOrChange.lineDelta ?? 0; charDelta = lineDeltaOrChange.characterDelta ?? 0; }
        else { lineDelta = lineDeltaOrChange ?? 0; charDelta = characterDeltaInput ?? 0; }
        return createMockPosition(this.line + lineDelta, this.character + charDelta);
    };
    pos.with = function(this: MockPosition, lineOrChange?: number | { line?: number; character?: number }, characterInput?: number): MockPosition {
        let newLine = this.line; let newChar = this.character;
        if (typeof lineOrChange === 'object') { newLine = lineOrChange.line ?? this.line; newChar = lineOrChange.character ?? this.character; }
        else { newLine = lineOrChange ?? this.line; newChar = characterInput ?? this.character; }
        return createMockPosition(newLine, newChar);
    };
    return pos as MockPosition;
}

interface MockCancellationToken { isCancellationRequested: boolean; onCancellationRequested: sinon.SinonStub; }
// --- End Mock Setup ---

suite('disambiguateEndpoint Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let mockStream: { progress: sinon.SinonSpy, markdown: sinon.SinonSpy };
    let mockLm: { sendRequest: sinon.SinonStub };
    let mockLogger: { logUsage: sinon.SinonSpy, logError: sinon.SinonSpy };
    let mockToken: MockCancellationToken;
    let showQuickPickStub: sinon.SinonStub | undefined;

    const sampleEndpoints: EndpointInfo[] = [
        { method: 'GET', path: '/api/users', uri: createMockUri('/src/UserController.java') as any, position: createMockPosition(10, 1) as any, handlerMethodName: 'getAllUsers', startLine: 9, endLine: 15 },
        { method: 'POST', path: '/api/users', uri: createMockUri('/src/UserController.java') as any, position: createMockPosition(20, 1) as any, handlerMethodName: 'createUser', startLine: 19, endLine: 25 },
        { method: 'GET', path: '/api/items/{id}', uri: createMockUri('/src/ItemController.java') as any, position: createMockPosition(5, 1) as any, handlerMethodName: 'getItemById', startLine: 4, endLine: 10 },
    ];

    // A more generic endpoint that won't easily match heuristics
    const genericEndpoint: EndpointInfo = { method: 'PUT', path: '/api/generic/action', uri: createMockUri('/src/GenericController.java') as any, position: createMockPosition(1,1) as any, handlerMethodName: 'performAction', startLine: 0, endLine: 5};
    const endpointsForLlmTest: EndpointInfo[] = [...sampleEndpoints, genericEndpoint];

    setup(() => {
        sandbox = sinon.createSandbox();
        mockStream = {
            progress: sandbox.spy(),
            markdown: sandbox.spy(),
        };
        mockLm = {
            sendRequest: sandbox.stub(),
        };
        mockLogger = {
            logUsage: sandbox.spy(),
            logError: sandbox.spy(),
        };
        mockToken = { isCancellationRequested: false, onCancellationRequested: sandbox.stub().returns({ dispose: () => {} }) };

        try {
            // const vscode = require('vscode'); // No longer require vscode directly if stubbing is handled differently
            if (vscode && vscode.window && typeof vscode.window.showQuickPick === 'function') {
                showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            } else {
                // console.warn('vscode.window.showQuickPick could not be stubbed in setup.');
                showQuickPickStub = undefined;
            }
        } catch (e) {
            // console.warn('vscode module not found during setup, vscode.window.showQuickPick not stubbed.');
            showQuickPickStub = undefined;
        }
    });

    teardown(() => {
        sandbox.restore();
    });

    test('should return null if no endpoints provided', async () => {
        const result = await disambiguateEndpoint('any query', [], mockStream as any, mockToken, mockLm as any, mockLogger as any);
        assert.strictEqual(result, null);
        sinon.assert.calledWith(mockLogger.logUsage, sinon.match.any, sinon.match({ phase: 'start', status: 'no_endpoints_provided' }));
    });

    test('should return the endpoint if only one is provided', async () => {
        const endpoints = [sampleEndpoints[0]];
        const result = await disambiguateEndpoint('any query', endpoints, mockStream as any, mockToken, mockLm as any, mockLogger as any);
        assert.deepStrictEqual(result, sampleEndpoints[0]);
        sinon.assert.calledWith(mockLogger.logUsage, sinon.match.any, sinon.match({ phase: 'result', status: 'single_endpoint_returned' }));
    });

    test('should return null if cancellation is requested early (before heuristics)', async () => {
        mockToken.isCancellationRequested = true;
        const result = await disambiguateEndpoint('any query', sampleEndpoints, mockStream as any, mockToken, mockLm as any, mockLogger as any);
        assert.strictEqual(result, null);
        sinon.assert.calledWith(mockLogger.logUsage, sinon.match.any, sinon.match({ phase: 'start', status: 'cancelled_early' }));
        sinon.assert.notCalled(mockStream.markdown); // No markdown messages if cancelled early
        sinon.assert.notCalled(mockLm.sendRequest);
    });

    suite('Heuristic Checks', () => {
        test('should return direct match if query is method and path', async () => {
            const query = 'GET /api/users';
            const result = await disambiguateEndpoint(query, sampleEndpoints, mockStream as any, mockToken, mockLm as any, mockLogger as any);
            assert.deepStrictEqual(result, sampleEndpoints[0]);
            sinon.assert.calledWith(mockLogger.logUsage, sinon.match.any, sinon.match({ phase: 'heuristic_check', status: 'direct_match_found' }));
            sinon.assert.notCalled(mockLm.sendRequest);
        });

        test('should return unique keyword match on path', async () => {
            const query = '/api/items/{id}';
            const result = await disambiguateEndpoint(query, sampleEndpoints, mockStream as any, mockToken, mockLm as any, mockLogger as any);
            assert.deepStrictEqual(result, sampleEndpoints[2]);
            sinon.assert.calledWith(mockLogger.logUsage, sinon.match.any, sinon.match({ phase: 'heuristic_check', status: 'unique_keyword_match_found' }));
            sinon.assert.notCalled(mockLm.sendRequest);
        });

        test('should return unique keyword match on handlerMethodName', async () => {
            const query = 'getItemById';
            const result = await disambiguateEndpoint(query, sampleEndpoints, mockStream as any, mockToken, mockLm as any, mockLogger as any);
            assert.deepStrictEqual(result, sampleEndpoints[2]);
            sinon.assert.calledWith(mockLogger.logUsage, sinon.match.any, sinon.match({ phase: 'heuristic_check', status: 'unique_keyword_match_found' }));
            sinon.assert.notCalled(mockLm.sendRequest);
        });

        test('should proceed to LLM if keyword match is not unique', async () => {
            const query = '/api/users'; // Matches two endpoints by path
            mockLm.sendRequest.resolves({ stream: (async function*() { yield '0'; })() }); // LLM picks one
            await disambiguateEndpoint(query, sampleEndpoints, mockStream as any, mockToken, mockLm as any, mockLogger as any);
            sinon.assert.calledWith(mockLogger.logUsage, sinon.match.any, sinon.match({ phase: 'heuristic_check', status: 'no_unique_heuristic_match', keywordMatchCount: 2 }));
            sinon.assert.calledOnce(mockLm.sendRequest); // Ensure LLM was called
        });
    });

    suite('LLM Interaction Scenarios', () => {
        const genericQueryForLlm = "please find the endpoint I need"; // Query designed to not hit heuristics

        test('LLM successfully selects an endpoint', async () => {
            console.log("\n--- Running Test: LLM successfully selects an endpoint ---"); // DEBUG
            mockLm.sendRequest.resolves({
                stream: (async function*() { yield { type: 'text', value: "0" }; })() // Yield an object matching LanguageModelAdapterResponsePart
            });
            const result = await disambiguateEndpoint(genericQueryForLlm, endpointsForLlmTest, mockStream as any, mockToken, mockLm as any, mockLogger as any);
            console.log("[Test Log] Result received:", result ? { path: result.path, method: result.method } : null); // DEBUG
            console.log("[Test Log] Logger calls:", JSON.stringify(mockLogger.logUsage.getCalls().map(call => call.args[1]), null, 2)); // DEBUG
            console.log("[Test Log] Markdown calls:", JSON.stringify(mockStream.markdown.getCalls().map(call => call.args[0]))); // DEBUG

            assert.ok(result, "Result should not be null when LLM selects");
            assert.strictEqual(result?.path, endpointsForLlmTest[0].path, "Result path should match the expected endpoint path (index 0)");
            sinon.assert.calledOnce(mockLm.sendRequest);
        });

        test('LLM responds with "None", proceeds to chat clarification', async () => {
            console.log("\n--- Running Test: LLM responds with \"None\" ---"); // DEBUG
            mockLm.sendRequest.resolves({
                stream: (async function*() { yield { type: 'text', value: "None" }; })() // Correctly yield the object for "None"
            });
            const result = await disambiguateEndpoint(genericQueryForLlm, endpointsForLlmTest, mockStream as any, mockToken, mockLm as any, mockLogger as any);
            console.log("[Test Log] Result received:", result ? { path: result.path, method: result.method } : null); // DEBUG
            console.log("[Test Log] Logger calls:", JSON.stringify(mockLogger.logUsage.getCalls().map(call => call.args[1]), null, 2)); // DEBUG
            console.log("[Test Log] Markdown calls:", JSON.stringify(mockStream.markdown.getCalls().map(call => call.args[0]))); // DEBUG

            assert.strictEqual(result, null);
            sinon.assert.calledOnce(mockLm.sendRequest);
            const logCalls = mockLogger.logUsage.getCalls();
            const llmSaidNoneCall = logCalls.find(call => call.args[1]?.phase === 'llm_disambiguation' && call.args[1]?.status === 'llm_said_none');
            assert.ok(llmSaidNoneCall, "Expected logUsage call with { phase: 'llm_disambiguation', status: 'llm_said_none' }");
            sinon.assert.calledWith(mockStream.markdown, 'AI assistant could not determine a single best match. Please choose from the list.');
            sinon.assert.calledWith(mockStream.markdown, sinon.match(new RegExp(`I found several potential endpoints matching your query "${genericQueryForLlm}"`)));
            const fallbackCall = logCalls.find(call => call.args[1]?.phase === 'fallback' && call.args[1]?.status === 'asking_user_clarification');
            assert.ok(fallbackCall, "Expected logUsage call with { phase: 'fallback', status: 'asking_user_clarification' }");
        });

        test('LLM responds with invalid index, proceeds to chat clarification', async () => {
            console.log("\n--- Running Test: LLM responds with invalid index ---"); // DEBUG
            mockLm.sendRequest.resolves({
                stream: (async function*() { yield { type: 'text', value: "invalid_text_index" }; })() // Yield an object
            });
            const result = await disambiguateEndpoint(genericQueryForLlm, endpointsForLlmTest, mockStream as any, mockToken, mockLm as any, mockLogger as any);
            console.log("[Test Log] Result received:", result ? { path: result.path, method: result.method } : null); // DEBUG
            const logCalls = mockLogger.logUsage.getCalls(); // Get calls for manual check
            console.log("[Test Log] Logger calls:", JSON.stringify(logCalls.map(call => call.args[1]), null, 2)); // DEBUG
            console.log("[Test Log] Markdown calls:", JSON.stringify(mockStream.markdown.getCalls().map(call => call.args[0]))); // DEBUG

            assert.strictEqual(result, null);
            sinon.assert.calledOnce(mockLm.sendRequest);
            const invalidIndexCall = logCalls.find(call => call.args[1]?.phase === 'llm_disambiguation' && call.args[1]?.status === 'llm_invalid_index');
            assert.ok(invalidIndexCall, "Expected logUsage call with { phase: 'llm_disambiguation', status: 'llm_invalid_index' }");
            sinon.assert.calledWith(mockStream.markdown, 'AI assistant gave an unclear answer. Please choose from the list.');
            sinon.assert.calledWith(mockStream.markdown, sinon.match(new RegExp(`I found several potential endpoints matching your query "${genericQueryForLlm}"`)));
            const fallbackCall = logCalls.find(call => call.args[1]?.phase === 'fallback' && call.args[1]?.status === 'asking_user_clarification');
            assert.ok(fallbackCall, "Expected logUsage call with { phase: 'fallback', status: 'asking_user_clarification' }");
        });

        test('LLM sendRequest throws an error, proceeds to chat clarification', async () => {
            console.log("\n--- Running Test: LLM sendRequest throws an error ---"); // DEBUG
            const testError = new Error('LLM API Error');
            mockLm.sendRequest.rejects(testError);

            const result = await disambiguateEndpoint(genericQueryForLlm, endpointsForLlmTest, mockStream as any, mockToken, mockLm as any, mockLogger as any);
            console.log("[Test Log] Result received:", result ? { path: result.path, method: result.method } : null); // DEBUG
            const logCalls = mockLogger.logUsage.getCalls(); // Get calls for manual check
            console.log("[Test Log] Logger calls:", JSON.stringify(logCalls.map(call => call.args[1]), null, 2)); // DEBUG
            console.log("[Test Log] Error Logger calls:", JSON.stringify(mockLogger.logError.getCalls().map(call => call.args[1]), null, 2)); // DEBUG
            console.log("[Test Log] Markdown calls:", JSON.stringify(mockStream.markdown.getCalls().map(call => call.args[0]))); // DEBUG

            assert.strictEqual(result, null);
            sinon.assert.calledOnce(mockLm.sendRequest);
            sinon.assert.calledWith(mockLogger.logError, testError, sinon.match({ phase: 'llm_disambiguation', status: 'llm_request_failed' }));
            sinon.assert.calledWith(mockStream.markdown, `Error during AI assistance: ${testError.message}. Please choose from the list.`);
            sinon.assert.calledWith(mockStream.markdown, sinon.match(new RegExp(`I found several potential endpoints matching your query "${genericQueryForLlm}"`)));
            const fallbackCall = logCalls.find(call => call.args[1]?.phase === 'fallback' && call.args[1]?.status === 'asking_user_clarification');
            assert.ok(fallbackCall, "Expected logUsage call with { phase: 'fallback', status: 'asking_user_clarification' }");
        });
    });

    suite('QuickPick Fallback Scenarios (Legacy or Conditional)', () => {
        test('Fallback to chat when heuristics match multiple and LLM says "None"', async function() {
            console.log("\n--- Running Test: Fallback - heuristics multiple, LLM None ---"); // DEBUG
            if (showQuickPickStub) { } // This check is mainly for type safety if stub is conditional
            const queryCausesMultipleHeuristics = "users";
            mockLm.sendRequest.resolves({ stream: (async function*() { yield { type: 'text', value: "None" }; })() }); // Yield object
            const result = await disambiguateEndpoint(queryCausesMultipleHeuristics, sampleEndpoints, mockStream as any, mockToken, mockLm as any, mockLogger as any);
            console.log("[Test Log] Result received:", result ? { path: result.path, method: result.method } : null); // DEBUG
            const logCalls = mockLogger.logUsage.getCalls(); // Get calls for manual check
            console.log("[Test Log] Logger calls:", JSON.stringify(logCalls.map(call => call.args[1]), null, 2)); // DEBUG
            console.log("[Test Log] Markdown calls:", JSON.stringify(mockStream.markdown.getCalls().map(call => call.args[0]))); // DEBUG

            assert.strictEqual(result, null, "Expected null as clarification is via chat");
            const heuristicFallbackCall = logCalls.find(call => call.args[1]?.phase === 'heuristic_check' && call.args[1]?.status === 'no_unique_heuristic_match');
            assert.ok(heuristicFallbackCall, "Expected logUsage call with { phase: 'heuristic_check', status: 'no_unique_heuristic_match' }");
            sinon.assert.calledOnce(mockLm.sendRequest);
            const llmSaidNoneCall = logCalls.find(call => call.args[1]?.phase === 'llm_disambiguation' && call.args[1]?.status === 'llm_said_none');
            assert.ok(llmSaidNoneCall, "Expected logUsage call with { phase: 'llm_disambiguation', status: 'llm_said_none' }");
            sinon.assert.calledWith(mockStream.markdown, 'AI assistant could not determine a single best match. Please choose from the list.');
            sinon.assert.calledWith(mockStream.markdown, sinon.match(new RegExp(`I found several potential endpoints matching your query "${queryCausesMultipleHeuristics}"`)));
            const fallbackCall = logCalls.find(call => call.args[1]?.phase === 'fallback' && call.args[1]?.status === 'asking_user_clarification');
            assert.ok(fallbackCall, "Expected logUsage call with { phase: 'fallback', status: 'asking_user_clarification' }");
        });

        test('Fallback to chat when LLM errors after multiple heuristic matches', async function() {
            console.log("\n--- Running Test: Fallback - heuristics multiple, LLM error ---"); // DEBUG
            if (showQuickPickStub) { } // This check is mainly for type safety if stub is conditional
            const queryCausesMultipleHeuristics = "users";
            const testError = new Error("LLM Test Error For Fallback");
            mockLm.sendRequest.rejects(testError);
            const result = await disambiguateEndpoint(queryCausesMultipleHeuristics, sampleEndpoints, mockStream as any, mockToken, mockLm as any, mockLogger as any);
            console.log("[Test Log] Result received:", result ? { path: result.path, method: result.method } : null); // DEBUG
            const logCalls = mockLogger.logUsage.getCalls(); // Get calls for manual check
            console.log("[Test Log] Logger calls:", JSON.stringify(logCalls.map(call => call.args[1]), null, 2)); // DEBUG
            console.log("[Test Log] Error Logger calls:", JSON.stringify(mockLogger.logError.getCalls().map(call => call.args[1]), null, 2)); // DEBUG
            console.log("[Test Log] Markdown calls:", JSON.stringify(mockStream.markdown.getCalls().map(call => call.args[0]))); // DEBUG

            assert.strictEqual(result, null, "Expected null as clarification is via chat due to LLM error");
            const heuristicFallbackCall = logCalls.find(call => call.args[1]?.phase === 'heuristic_check' && call.args[1]?.status === 'no_unique_heuristic_match');
            assert.ok(heuristicFallbackCall, "Expected logUsage call with { phase: 'heuristic_check', status: 'no_unique_heuristic_match' }");
            sinon.assert.calledOnce(mockLm.sendRequest);
            sinon.assert.calledWith(mockLogger.logError, testError, sinon.match({ phase: 'llm_disambiguation', status: 'llm_request_failed' }));
            sinon.assert.calledWith(mockStream.markdown, `Error during AI assistance: ${testError.message}. Please choose from the list.`);
            sinon.assert.calledWith(mockStream.markdown, sinon.match(new RegExp(`I found several potential endpoints matching your query "${queryCausesMultipleHeuristics}"`)));
            const fallbackCall = logCalls.find(call => call.args[1]?.phase === 'fallback' && call.args[1]?.status === 'asking_user_clarification');
            assert.ok(fallbackCall, "Expected logUsage call with { phase: 'fallback', status: 'asking_user_clarification' }");
        });
    });
});