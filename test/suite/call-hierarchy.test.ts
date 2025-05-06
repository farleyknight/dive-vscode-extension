import * as assert from 'assert';
import * as sinon from 'sinon';
// Note: No 'import * as vscode from 'vscode';'

// Assuming findCallers and its dependent types (CallLocation, CallHierarchyResult, EndpointInfo)
// will be modified or understood to work with either real vscode types (in src)
// or compatible plain objects (in tests).
// For testing, we'll assume that the types imported from '../../src/call-hierarchy'
// (like CallLocation) will expect objects compatible with vscode types, but we will
// construct these using our mocks.
import * as callHierarchy from '../../src/call-hierarchy';
import { EndpointInfo } from '../../src/endpoint-discovery'; // This might also need to use MockUri/Position if it's used deeply in mocks

// --- Test-Local Mock Types ---
interface MockUri {
    fsPath: string;
    scheme: string;
    path: string;
    // Define 'with' and 'toString' if they are critically used by the logic under test,
    // otherwise, keep it simple. For fsPath comparisons, this is often enough.
    with: (change: { scheme?: string; path?: string }) => MockUri;
    toString: (skipEncoding?: boolean) => string;
}

function createMockUri(filePath: string): MockUri {
    const path = filePath.startsWith('/') ? filePath : '/' + filePath;
    const newUri: MockUri = {
        fsPath: path,
        scheme: 'file',
        path: path,
        with: (change: { scheme?: string; path?: string }): MockUri => {
            return createMockUri(change.path !== undefined ? change.path : newUri.path);
        },
        toString: (skipEncoding?: boolean): string => `file://${newUri.path}`
    };
    return newUri;
}

interface MockPosition {
    line: number;
    character: number;
    translate: (lineDelta?: number, characterDelta?: number) => MockPosition;
}

function createMockPosition(line: number, character: number): MockPosition {
    return {
        line,
        character,
        translate: (lineDelta: number = 0, characterDelta: number = 0): MockPosition => {
            return createMockPosition(line + lineDelta, character + characterDelta);
        }
    };
}

interface MockRange {
    start: MockPosition;
    end: MockPosition;
}

function createMockRange(startLine: number, startChar: number, endLine: number, endChar: number): MockRange {
    return {
        start: createMockPosition(startLine, startChar),
        end: createMockPosition(endLine, endChar),
    };
}

// This represents what the *internal* search and line-reading helpers might return.
// findCallers will consume this from the stubs.
interface MockProcessedMatch {
    uri: MockUri;
    range: MockRange; // The precise range of the searchTerm in the line
    lineText: string; // Full text of the line where the match was found
    // No need for 'preview' from TextSearchResult as we assume our internal helper gives us the line
}


suite('Call Hierarchy Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let internalSearchStub: sinon.SinonStub;
    let getLineTextStub: sinon.SinonStub; // To mock fetching line text for comment checks etc.

    setup(() => {
        sandbox = sinon.createSandbox();
        // Stub the helper functions on the exported 'internalHelpers' object
        internalSearchStub = sandbox.stub(callHierarchy.internalHelpers, '_performInternalSearchAndResolve');
        getLineTextStub = sandbox.stub(callHierarchy.internalHelpers, '_getLineTextForCheck');
    });

    teardown(() => {
        sandbox.restore();
    });

    // Cast to 'any' for EndpointInfo to satisfy type checks when using MockUri/MockPosition,
    // or adjust EndpointInfo definition if it's tightly coupled.
    // For now, we assume findCallers can handle these shapes for its 'endpoint' param.
    const sampleEndpoint: EndpointInfo = {
        method: 'GET',
        path: '/api/test',
        uri: createMockUri('/src/TestController.java') as any,
        position: createMockPosition(10, 20) as any, // Position of 'getTestData' in its declaration
        handlerMethodName: 'getTestData',
        startLine: 10, // Line where 'public String getTestData() {' starts
        endLine: 15,  // Line where the method block ends with '}'
    };

    test('should return null if endpoint is null or handlerMethodName is missing', async () => {
        assert.strictEqual(await callHierarchy.findCallers(null as any), null, 'Should return null for null endpoint');
        const endpointWithoutHandler: EndpointInfo = { ...sampleEndpoint, handlerMethodName: undefined as any };
        assert.strictEqual(await callHierarchy.findCallers(endpointWithoutHandler), null, 'Should return null if handlerMethodName is undefined');
    });

    test('should return empty callers array if internal search finds no matches', async () => {
        internalSearchStub.resolves([]);
        const result = await callHierarchy.findCallers(sampleEndpoint);
        assert.ok(result, 'Result should not be null');
        assert.deepStrictEqual(result?.targetFunction, sampleEndpoint as any);
        assert.strictEqual(result?.callers.length, 0);
        sinon.assert.calledOnce(internalSearchStub);
        // Check arguments individually if calledOnceWithExactly is problematic
        const callArgs = internalSearchStub.firstCall.args;
        assert.strictEqual(callArgs[0], sampleEndpoint.handlerMethodName, "Arg 0 (searchTerm) mismatch");
        assert.strictEqual(callArgs[1], sampleEndpoint.uri.fsPath, "Arg 1 (excludeFilePath) mismatch");
        assert.strictEqual(callArgs[2], sampleEndpoint.startLine, "Arg 2 (excludeStartLine) mismatch");
        assert.strictEqual(callArgs[3], sampleEndpoint.endLine, "Arg 3 (excludeEndLine) mismatch");
    });

    test('should find a single direct caller', async () => {
        const callerFileUri = createMockUri('/src/AnotherService.java');
        const callerRange = createMockRange(5, 10, 5, 21); // Assuming "getTestData" is at col 10
        const mockMatches: MockProcessedMatch[] = [
            {
                uri: callerFileUri,
                range: callerRange,
                lineText: '  someObject.getTestData();'
            }
        ];
        internalSearchStub.resolves(mockMatches);
        // getLineTextStub might be called by findCallers to double-check comments or context.
        // If findCallers uses lineText from MockProcessedMatch directly for comment checks, this might not be needed.
        getLineTextStub.withArgs(callerFileUri, 5).resolves('  someObject.getTestData();');


        const result = await callHierarchy.findCallers(sampleEndpoint);
        assert.ok(result);
        assert.strictEqual(result.callers.length, 1);
        assert.strictEqual(result.callers[0].uri.fsPath, callerFileUri.fsPath);
        assert.deepStrictEqual(result.callers[0].range, callerRange as any);
    });

    test('should ignore the definition of the function itself (handled by _performInternalSearchAndResolve)', async () => {
        // _performInternalSearchAndResolve is now responsible for filtering out the definition.
        // So, it should return an empty array if the only "match" was the definition.
        internalSearchStub.resolves([]); // Simulate that the internal search already filtered it.

        const result = await callHierarchy.findCallers(sampleEndpoint);
        assert.ok(result);
        assert.strictEqual(result.callers.length, 0, "Callers array should be empty if only definition was found by internal search");
        sinon.assert.calledOnce(internalSearchStub);
        const callArgs = internalSearchStub.firstCall.args;
        assert.strictEqual(callArgs[0], sampleEndpoint.handlerMethodName, "Arg 0 (searchTerm) mismatch");
        assert.strictEqual(callArgs[1], sampleEndpoint.uri.fsPath, "Arg 1 (excludeFilePath) mismatch");
        assert.strictEqual(callArgs[2], sampleEndpoint.startLine, "Arg 2 (excludeStartLine) mismatch");
        assert.strictEqual(callArgs[3], sampleEndpoint.endLine, "Arg 3 (excludeEndLine) mismatch");
    });

    test('should ignore calls within line comments', async () => {
        const callerFileUri = createMockUri('/src/CommentLineCaller.java');
        const commentedRange = createMockRange(7, 18, 7, 29); // Range of "getTestData" in the commented line
        const mockMatches: MockProcessedMatch[] = [
            {
                uri: callerFileUri,
                range: commentedRange,
                lineText: '// otherObject.getTestData();'
            }
        ];
        internalSearchStub.resolves(mockMatches);
        // If findCallers relies on _getLineTextForCheck for comment status
        getLineTextStub.withArgs(callerFileUri, 7).resolves('// otherObject.getTestData();');


        const result = await callHierarchy.findCallers(sampleEndpoint);
        assert.ok(result);
        assert.strictEqual(result.callers.length, 0, "Should ignore commented out calls");
    });

    test('should ignore calls within block comments', async () => {
        const callerFileUri = createMockUri('/src/BlockCommentCaller.java');
        const mockMatches: MockProcessedMatch[] = [
            { // Match inside a single-line block comment
                uri: callerFileUri,
                range: createMockRange(9, 17, 9, 28), // Range of getTestData
                lineText: '  /* controller.getTestData(); */'
            },
            { // Match on a line that is part of a multi-line block comment
                uri: callerFileUri,
                range: createMockRange(10, 12, 10, 23),
                lineText: '   * another.getTestData();'
            }
        ];
        internalSearchStub.resolves(mockMatches);
        getLineTextStub.withArgs(callerFileUri, 9).resolves('  /* controller.getTestData(); */');
        getLineTextStub.withArgs(callerFileUri, 10).resolves('   * another.getTestData();');


        const result = await callHierarchy.findCallers(sampleEndpoint);
        assert.ok(result);
        assert.strictEqual(result.callers.length, 0, "Should ignore calls in block comments");
    });

    // Add more tests:
    // - Multiple callers in same/different files
    // - Cases where lineText from search result is sufficient vs. needing getLineTextStub
    // - Complex scenarios, different syntaxes (if the search/parse logic aims to handle them)
});