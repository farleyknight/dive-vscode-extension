import * as assert from 'assert';
import * as sinon from 'sinon';
import { basename } from 'path';
// import * as vscode from 'vscode'; // Keep vscode for stubs if showQuickPick is part of it - Commenting out as direct vscode usage should be minimized
import { disambiguateEndpoint } from '../../src/endpoint-disambiguation';
import { EndpointInfo } from '../../src/endpoint-discovery';
import { ILanguageModelAdapter, LanguageModelAdapterChatMessage, LanguageModelAdapterChatRole, AdapterCancellationToken, LanguageModelResponsePart } from '../../src/llm/iLanguageModelAdapter';
import { ICancellationToken, IChatResponseStream, IUri, IPosition } from '../../src/adapters/vscodeTypes'; // Added IChatResponseStream and updated ICancellationToken path
import * as path from 'path';
import { ILogger } from '../../src/adapters/iLogger'; // Corrected path
// import { IUri, IRange, IPosition } from '../../src/adapters/vscodeTypes'; // Already imported IUri, IPosition above, IRange not used directly in mocks here

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

// interface MockCancellationToken { isCancellationRequested: boolean; onCancellationRequested: sinon.SinonStub; } // Replaced by ICancellationToken typing
// --- End Mock Setup ---

// Helper function to create a mock EndpointInfo
const createMockEndpoint = (method: string, pathStr: string, handlerMethodName: string = '', uriPath: string = '', handlerLine: number = 0, handlerChar: number = 0, startLine: number = 0, endLine: number = 0): EndpointInfo => {
    return {
        method: method,
        path: pathStr,
        handlerMethodName: handlerMethodName,
        uri: {
            fsPath: uriPath,
            scheme: 'file',
            authority:'',
            path: uriPath,
            query:'',
            fragment:''
        } as IUri,
        position: { line: handlerLine, character: handlerChar } as IPosition, // Set position
        startLine: startLine || handlerLine, // Default startLine to handlerLine if not provided
        endLine: endLine || handlerLine + 5, // Default endLine if not provided (e.g., handlerLine + 5 lines)
        description: `Mock endpoint for ${method} ${pathStr}`
    };
};

// Helper function to create a mock logger
const createMockLogger = (sandbox: sinon.SinonSandbox): sinon.SinonStubbedInstance<ILogger> => {
    return {
        logUsage: sandbox.stub(),
        logError: sandbox.stub(),
        logInfo: sandbox.stub(),
        logDebug: sandbox.stub(),
        logWarning: sandbox.stub(),
    } as sinon.SinonStubbedInstance<ILogger>;
};

suite('disambiguateEndpoint Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let mockStream: sinon.SinonStubbedInstance<IChatResponseStream>; // Typed with IChatResponseStream
    let mockLmAdapter: sinon.SinonStubbedInstance<ILanguageModelAdapter>;
    let mockToken: ICancellationToken; // Typed with ICancellationToken
    let mockLoggerInstance: sinon.SinonStubbedInstance<ILogger>;

    const sampleEndpoints: EndpointInfo[] = [
        createMockEndpoint('GET', '/api/users', 'getAllUsers', '/src/controllers/userController.ts', 10, 0, 10, 15),
        createMockEndpoint('POST', '/api/users', 'createUser', '/src/controllers/userController.ts', 20, 0, 20, 25),
        createMockEndpoint('GET', '/api/items/{id}', 'getItemById', '/src/controllers/itemController.ts', 5, 0, 5, 12),
    ];

    const genericQueryForLlm = "find user endpoint";
    const endpointsForLlmTest: EndpointInfo[] = [
        createMockEndpoint('GET', '/api/user/profile', 'getUserProfile', '/test/file1.ts', 1, 0, 1, 6),
        createMockEndpoint('POST', '/api/user/settings', 'updateUserSettings', '/test/file2.ts', 2, 0, 2, 8),
    ];

    setup(() => {
        sandbox = sinon.createSandbox();
        mockStream = {
            progress: sandbox.stub<[string], void>(),
            markdown: sandbox.stub<[string | any], void>(), // Allow 'any' for MarkdownString as in interface
            button: sandbox.stub<[any], void>(),          // Allow 'any' for Command as in interface
        } as sinon.SinonStubbedInstance<IChatResponseStream>; // Cast to stubbed instance

        mockLmAdapter = sandbox.createStubInstance(class MockLmAdapter implements ILanguageModelAdapter {
            sendRequest(messages: LanguageModelAdapterChatMessage[], options: any, token: AdapterCancellationToken): Promise<{ stream: AsyncIterable<LanguageModelResponsePart>; }> {
                // This implementation will be overridden by stubs in tests
                throw new Error('Method not implemented.');
            }
        } as any);
        mockToken = {
            isCancellationRequested: false,
            onCancellationRequested: sandbox.stub().returns({ dispose: sandbox.stub() }) as any, // Cast to any to satisfy the complex listener signature for now
        };
        mockLoggerInstance = createMockLogger(sandbox);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('should return null if no endpoints provided', async () => {
        const result = await disambiguateEndpoint('any query', [], mockStream, mockToken, mockLmAdapter, mockLoggerInstance);
        assert.strictEqual(result, null);
        sinon.assert.calledWith(mockLoggerInstance.logUsage, 'disambiguateEndpoint', sinon.match({ status: 'no_endpoints_provided' }));
    });

    test('should return the endpoint if only one is provided', async () => {
        const endpoints = [sampleEndpoints[0]];
        const result = await disambiguateEndpoint('any query', endpoints, mockStream, mockToken, mockLmAdapter, mockLoggerInstance);
        assert.deepStrictEqual(result, sampleEndpoints[0]);
        sinon.assert.calledWith(mockLoggerInstance.logUsage, 'disambiguateEndpoint', sinon.match({ status: 'single_endpoint_returned' }));
    });

    test('should return null if cancellation is requested early (before heuristics)', async () => {
        const endpoints = [
            createMockEndpoint('GET', '/api/a'),
            createMockEndpoint('POST', '/api/b'),
            createMockEndpoint('PUT', '/api/c')
        ];
        mockToken.isCancellationRequested = true;
        const result = await disambiguateEndpoint('any query', endpoints, mockStream, mockToken, mockLmAdapter, mockLoggerInstance);
        assert.strictEqual(result, null);
        assert.ok(mockLoggerInstance.logUsage.calledWith('disambiguateEndpoint', sinon.match({ status: 'cancelled_early' })));
    });

    suite('Heuristic Checks', () => {
        test('should return direct match if query is method and path', async () => {
            const query = 'GET /api/users';
            const result = await disambiguateEndpoint(query, sampleEndpoints, mockStream, mockToken, mockLmAdapter, mockLoggerInstance);
            assert.deepStrictEqual(result, sampleEndpoints[0]);
            sinon.assert.calledWith(mockLoggerInstance.logUsage, 'disambiguateEndpoint', sinon.match({ phase: 'heuristic_check', status: 'direct_match_found' }));
            sinon.assert.notCalled(mockLmAdapter.sendRequest);
        });

        test('should return unique keyword match on path', async () => {
            const query = '/api/items/{id}';
            const result = await disambiguateEndpoint(query, sampleEndpoints, mockStream, mockToken, mockLmAdapter, mockLoggerInstance);
            assert.deepStrictEqual(result, sampleEndpoints[2]);
            sinon.assert.calledWith(mockLoggerInstance.logUsage, 'disambiguateEndpoint', sinon.match({ phase: 'heuristic_check', status: 'unique_keyword_match_found' }));
            sinon.assert.notCalled(mockLmAdapter.sendRequest);
        });

        test('should return unique keyword match on handlerMethodName', async () => {
            const query = 'getItemById';
            const result = await disambiguateEndpoint(query, sampleEndpoints, mockStream, mockToken, mockLmAdapter, mockLoggerInstance);
            assert.deepStrictEqual(result, sampleEndpoints[2]);
            sinon.assert.calledWith(mockLoggerInstance.logUsage, 'disambiguateEndpoint', sinon.match({ phase: 'heuristic_check', status: 'unique_keyword_match_found' }));
            sinon.assert.notCalled(mockLmAdapter.sendRequest);
        });

        test('should proceed to LLM if keyword match is not unique', async () => {
            const query = '/api/users'; // Matches two endpoints by path
            mockLmAdapter.sendRequest.resolves({ stream: (async function*() { yield { type: 'text', value: "0" } as LanguageModelResponsePart; })() }); // LLM picks one
            await disambiguateEndpoint(query, sampleEndpoints, mockStream, mockToken, mockLmAdapter, mockLoggerInstance);
            sinon.assert.calledWith(mockLoggerInstance.logUsage, 'disambiguateEndpoint', sinon.match({ phase: 'heuristic_check', status: 'no_unique_heuristic_match', keywordMatchCount: 2 }));
            sinon.assert.calledOnce(mockLmAdapter.sendRequest);
        });
    });

    suite('LLM Interaction Tests', () => {
        test('LLM successfully selects an endpoint', async () => {
            mockLmAdapter.sendRequest.resolves({
                stream: (async function*() { yield { type: 'text', value: "0" } as LanguageModelResponsePart; })()
            });
            const result = await disambiguateEndpoint(genericQueryForLlm, endpointsForLlmTest, mockStream, mockToken, mockLmAdapter, mockLoggerInstance);
            assert.ok(result, "Result should not be null when LLM selects");
            assert.strictEqual(result?.path, endpointsForLlmTest[0].path);
            sinon.assert.calledOnce(mockLmAdapter.sendRequest);
        });

        test('LLM responds with "None", proceeds to chat clarification', async () => {
            mockLmAdapter.sendRequest.resolves({
                stream: (async function*() { yield { type: 'text', value: "None" } as LanguageModelResponsePart; })()
            });
            const result = await disambiguateEndpoint(genericQueryForLlm, endpointsForLlmTest, mockStream, mockToken, mockLmAdapter, mockLoggerInstance);
            assert.strictEqual(result, null);
            sinon.assert.calledOnce(mockLmAdapter.sendRequest);
            const logCalls = mockLoggerInstance.logUsage.getCalls();
            const llmSaidNoneCall = logCalls.find((call: sinon.SinonSpyCall) => call.args[1]?.phase === 'llm_disambiguation' && call.args[1]?.status === 'llm_said_none');
            assert.ok(llmSaidNoneCall, "Expected logUsage call for llm_said_none");
        });

        test('LLM responds with invalid index, proceeds to chat clarification', async () => {
            mockLmAdapter.sendRequest.resolves({
                stream: (async function*() { yield { type: 'text', value: "invalid_text_index" } as LanguageModelResponsePart; })()
            });
            const result = await disambiguateEndpoint(genericQueryForLlm, endpointsForLlmTest, mockStream, mockToken, mockLmAdapter, mockLoggerInstance);
            assert.strictEqual(result, null);
            sinon.assert.calledOnce(mockLmAdapter.sendRequest);
            const logCalls = mockLoggerInstance.logUsage.getCalls();
            const invalidIndexCall = logCalls.find((call: sinon.SinonSpyCall) => call.args[1]?.phase === 'llm_disambiguation' && call.args[1]?.status === 'llm_invalid_index');
            assert.ok(invalidIndexCall, "Expected logUsage call for llm_invalid_index");
        });

        test('LLM sendRequest throws an error, proceeds to chat clarification', async () => {
            const testError = new Error('LLM API Error');
            mockLmAdapter.sendRequest.rejects(testError);
            const result = await disambiguateEndpoint(genericQueryForLlm, endpointsForLlmTest, mockStream, mockToken, mockLmAdapter, mockLoggerInstance);
            assert.strictEqual(result, null);
            sinon.assert.calledOnce(mockLmAdapter.sendRequest);
            sinon.assert.calledWith(mockLoggerInstance.logError, testError, sinon.match({ phase: 'llm_disambiguation', status: 'llm_request_failed' }));
            sinon.assert.calledWith(mockStream.markdown, `Error during AI assistance: ${testError.message}. Please choose from the list.`);
        });
    });

    suite('Fallback to Chat Clarification Tests', () => {
        test('should fallback to chat clarification if multiple heuristic matches and LLM says None', async () => {
            const query = "users"; // Matches sampleEndpoints[0] and sampleEndpoints[1]
            mockLmAdapter.sendRequest.resolves({
                stream: (async function*() { yield { type: 'text', value: "None" } as LanguageModelResponsePart; })()
            });
            const result = await disambiguateEndpoint(query, sampleEndpoints, mockStream, mockToken, mockLmAdapter, mockLoggerInstance);
            assert.strictEqual(result, null);
            sinon.assert.calledOnce(mockLmAdapter.sendRequest);
            // Assert markdown was called for clarification, not buttons
            sinon.assert.calledWith(mockStream.markdown, sinon.match('I found several potential endpoints'));
            sinon.assert.neverCalledWith(mockStream.button, sinon.match.any);
        });

        test('should fallback to chat clarification if multiple heuristic matches and LLM errors', async () => {
            const query = "users"; // Matches sampleEndpoints[0] and sampleEndpoints[1]
            const testError = new Error("LLM Test Error For Fallback");
            mockLmAdapter.sendRequest.rejects(testError);
            const result = await disambiguateEndpoint(query, sampleEndpoints, mockStream, mockToken, mockLmAdapter, mockLoggerInstance);
            assert.strictEqual(result, null);
            sinon.assert.calledOnce(mockLmAdapter.sendRequest);
            // Assert markdown was called for clarification after error, not buttons
            // The error message might be shown first, then clarification
            sinon.assert.calledWith(mockStream.markdown, sinon.match('Error during AI assistance:'));
            sinon.assert.calledWith(mockStream.markdown, sinon.match('I found several potential endpoints'));
            sinon.assert.neverCalledWith(mockStream.button, sinon.match.any);
        });
    });
});