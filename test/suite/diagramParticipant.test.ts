import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { handleRestEndpoint } from '../../src/diagramParticipant';
import { EndpointInfo } from '../../src/endpoint-discovery';
import * as endpointDiscovery from '../../src/endpoint-discovery';
import * as endpointDisambiguation from '../../src/endpoint-disambiguation';
import * as callHierarchy from '../../src/call-hierarchy'; // Import the new module
import { CustomHierarchyNode } from '../../src/call-hierarchy'; // Import type directly
import * as mermaidTranslator from '../../src/mermaid-sequence-translator'; // Import the new module
// Abstracted types
import { IPosition, IUri, IRange, VSCodeSymbolKind, ICallHierarchyItem, ICancellationToken, IExtensionContext, IChatResponseStream } from '../../src/adapters/vscodeTypes';
import { ILogger } from '../../src/adapters/iLogger'; // Added ILogger
import { ILanguageModelAdapter } from '../../src/llm/iLanguageModelAdapter'; // Added
import { toVscodePosition, toVscodeUri, toVscodeRange, toVscodeCallHierarchyItem, fromVscodeCallHierarchyItem } from '../../src/adapters/vscodeUtils';

suite('Diagram Participant - handleRestEndpoint', () => {
    let sandbox: sinon.SinonSandbox;
    let mockStream: sinon.SinonStubbedInstance<IChatResponseStream>; // Typed
    let mockLogger: sinon.SinonStubbedInstance<ILogger>; // Typed
    let mockLm: any; // Keep as any for simplicity if only request.model is needed
    let mockLmAdapter: sinon.SinonStubbedInstance<ILanguageModelAdapter>; // Typed
    let mockToken: ICancellationToken; // Typed
    let mockExtensionContext: IExtensionContext; // Typed
    let mockContext: vscode.ChatContext;
    let mockRequest: vscode.ChatRequest;
    let buildCallHierarchyTreeStub: sinon.SinonStub;
    let generateMermaidSequenceDiagramStub: sinon.SinonStub;
    let createWebviewPanelStub: sinon.SinonStub;
    let mockWebviewPanel: any;
    let validateMermaidSyntaxStub: sinon.SinonStub; // Will need to figure out how to stub this if it's not exported

    setup(() => {
        sandbox = sinon.createSandbox();

        sandbox.stub(vscode.commands, 'executeCommand');
        sandbox.stub(endpointDiscovery, 'discoverEndpoints');
        sandbox.stub(endpointDisambiguation, 'disambiguateEndpoint');
        buildCallHierarchyTreeStub = sandbox.stub(callHierarchy, 'buildCallHierarchyTree');
        generateMermaidSequenceDiagramStub = sandbox.stub(mermaidTranslator, 'generateMermaidSequenceDiagram');

        // Mock the webview creation process
        mockWebviewPanel = {
            webview: {
                html: '',
                onDidReceiveMessage: sandbox.stub(), // Stub this
                asWebviewUri: sandbox.stub().callsFake((uri: vscode.Uri) => uri) // Simple pass-through
            },
            onDidDispose: sandbox.stub(),
            reveal: sandbox.stub(),
            dispose: sandbox.stub(),
            title: '',
            iconPath: undefined,
            options: {},
            viewColumn: undefined,
            viewType: 'string',
            visible: true,
            active: true,
            onDidChangeViewState: sandbox.stub(),
        };
        createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockWebviewPanel);

        // Since validateMermaidSyntax is local, we can't directly stub it from here in the same way.
        // We will assume it's called by createAndShowDiagramWebview. If it fails, createAndShowDiagramWebview should return false.
        // For the success case, we'll assume it passes by not having it throw or return false if we could control it.
        // For now, we can't stub it directly without refactoring diagramParticipant.ts to make it stubbable.
        // Let's proceed by checking the call to createWebviewPanelStub as an indication that createAndShowDiagramWebview was invoked.

        mockStream = {
            progress: sandbox.stub(),
            markdown: sandbox.stub(),
            button: sandbox.stub(),
        } as sinon.SinonStubbedInstance<IChatResponseStream>;

        mockLogger = {
            logUsage: sandbox.stub(),
            logError: sandbox.stub(),
            logInfo: sandbox.stub(), // Added
            logDebug: sandbox.stub(), // Added
            logWarning: sandbox.stub(), // Added
        } as sinon.SinonStubbedInstance<ILogger>;

        mockLm = { sendRequest: sandbox.stub() };
        mockLmAdapter = { sendRequest: sandbox.stub() } as sinon.SinonStubbedInstance<ILanguageModelAdapter>;

        mockToken = {
            isCancellationRequested: false,
            onCancellationRequested: sandbox.stub().returns({ dispose: () => {} })
        };
        mockExtensionContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/mock/extension/path', scheme: 'file' }, // Added scheme for consistency
        };
        mockContext = {} as any;
        mockRequest = { model: mockLm } as any;
    });

    teardown(() => {
        sandbox.restore();
    });

    test('should handle no endpoints found by discoverEndpoints', async () => {
        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([]);
        const params = { request: mockRequest, context: mockContext, stream: mockStream, token: mockToken, extensionContext: mockExtensionContext, logger: mockLogger, codeContext: '', lmAdapter: mockLmAdapter };
        await handleRestEndpoint(params, 'show test endpoint');
        assert.ok((endpointDiscovery.discoverEndpoints as sinon.SinonStub).calledOnce, 'discoverEndpoints should be called');
        assert.ok(buildCallHierarchyTreeStub.notCalled, 'buildCallHierarchyTree should not be called if no endpoints');
        assert.ok(mockStream.markdown.calledWith('No REST endpoints found in the current workspace. Ensure your project uses common annotations like @RestController, @GetMapping, etc.'), 'No endpoints message should be streamed');
        assert.ok(mockLogger.logUsage.calledWith('[restEndpoint] discoverEndpoints', sinon.match({ status: 'no_endpoints_found' })), 'logUsage should indicate no_endpoints_found');
    });

    test('should handle disambiguation failure', async () => {
        const fakeUri: IUri = { fsPath: '/test/file.java', scheme: 'file' };
        const fakePosition: IPosition = { line: 10, character: 5 };
        const anEndpoint: EndpointInfo = { uri: fakeUri, position: fakePosition, path: '/api/some', method: 'GET', handlerMethodName: 'getSome', startLine: 9, endLine: 15 };
        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([anEndpoint]);
        (endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).resolves(undefined);
        const params = { request: mockRequest, context: mockContext, stream: mockStream, token: mockToken, extensionContext: mockExtensionContext, logger: mockLogger, codeContext: '', lmAdapter: mockLmAdapter };
        await handleRestEndpoint(params, 'show a very ambiguous endpoint');
        assert.ok((endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).calledOnce, 'disambiguateEndpoint should be called');
        assert.ok(buildCallHierarchyTreeStub.notCalled, 'buildCallHierarchyTree should not be called if disambiguation fails');
        assert.ok(mockLogger.logUsage.calledWith('[restEndpoint] disambiguateEndpoint', sinon.match({ status: 'no_target_endpoint' })), 'logUsage should indicate no_target_endpoint');
    });

    // New tests for handleRestEndpoint's interaction with buildCallHierarchyTree
    test('should call buildCallHierarchyTree and display diagram if tree is built', async () => {
        const fakeUri: IUri = { fsPath: '/test/Controller.java', scheme: 'file' };
        const fakePosition: IPosition = { line: 15, character: 10 };
        const targetEndpoint: EndpointInfo = { uri: fakeUri, position: fakePosition, path: '/api/data', method: 'GET', handlerMethodName: 'getData', startLine: 14, endLine: 20 };

        // Define mock hierarchy item using abstract types
        const mockHierarchyItemData: ICallHierarchyItem = {
            name: 'getData',
            kind: VSCodeSymbolKind.Method,
            uri: fakeUri,
            range: { start: { line: 14, character: 0 }, end: { line: 20, character: 1 } },
            selectionRange: { start: { line: 15, character: 10 }, end: { line: 15, character: 17 } },
            detail: 'detail'
        };
        const mockVscodeHierarchyItem = toVscodeCallHierarchyItem(mockHierarchyItemData);
        // CustomHierarchyNode still expects vscode.CallHierarchyItem
        const mockHierarchyRoot: CustomHierarchyNode = { item: mockVscodeHierarchyItem, children: [], parents: [] };
        const fakeMermaidSyntax = 'sequenceDiagram\n    participant A\n    A->>B: test';

        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([targetEndpoint]);
        (endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).resolves(targetEndpoint);
        // Stub buildCallHierarchyTree to expect the IUri/IPosition/ICancellationToken passed from handleRestEndpoint
        buildCallHierarchyTreeStub.withArgs(sinon.match.any, fakeUri, fakePosition, mockLogger, mockToken).resolves(mockHierarchyRoot);
        generateMermaidSequenceDiagramStub.withArgs(mockHierarchyRoot).returns(fakeMermaidSyntax);

        // We need to ensure that the local validateMermaidSyntax function within diagramParticipant.ts would return true.
        // Since we can't easily stub it from outside, we're testing the path where it *would* succeed.
        // For this test, the critical check is that createWebviewPanel is called.

        const params = { request: mockRequest, context: mockContext, stream: mockStream, token: mockToken, extensionContext: mockExtensionContext, logger: mockLogger, codeContext: '', lmAdapter: mockLmAdapter };
        await handleRestEndpoint(params, 'get data endpoint');

        // Assert buildCallHierarchyTree called with abstract types
        assert.ok(buildCallHierarchyTreeStub.calledOnceWith(sinon.match.any, fakeUri, fakePosition, mockLogger, mockToken), 'buildCallHierarchyTree should be called with correct IUri/IPosition/ICancellationToken args');
        assert.ok(generateMermaidSequenceDiagramStub.calledOnceWith(mockHierarchyRoot), 'generateMermaidSequenceDiagramStub should be called with the hierarchy root');
        assert.ok(mockLogger.logUsage.calledWith('[restEndpoint] buildCallHierarchyTree', sinon.match({ status: 'success' })), 'Log should indicate buildCallHierarchyTree success status');
        assert.ok(mockStream.progress.calledWith('Generating sequence diagram...'), 'Progress should indicate diagram generation');

        // Check that createWebviewPanel was called, which implies createAndShowDiagramWebview was invoked and validation (implicitly) passed.
        assert.ok(createWebviewPanelStub.calledOnce, 'vscode.window.createWebviewPanel should be called');
        // Verify some key parameters passed to createWebviewPanel if needed
        const panelArgs = createWebviewPanelStub.firstCall.args;
        assert.strictEqual(panelArgs[0], 'restEndpointSequenceDiagram', 'Panel ID is incorrect');
        assert.strictEqual(panelArgs[1], 'Sequence: getData', 'Panel title is incorrect');

        // Ensure no old success markdown message is sent
        assert.ok(mockStream.markdown.neverCalledWith(sinon.match(/Successfully built call hierarchy for getData/)), 'Old success markdown should not be called');
    });

    test('should handle buildCallHierarchyTree returning null', async () => {
        const fakeUri: IUri = { fsPath: '/test/Controller.java', scheme: 'file' };
        const fakePosition: IPosition = { line: 15, character: 10 };
        const targetEndpoint: EndpointInfo = { uri: fakeUri, position: fakePosition, path: '/api/data', method: 'GET', handlerMethodName: 'getData', startLine: 14, endLine: 20 };

        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([targetEndpoint]);
        (endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).resolves(targetEndpoint);
        buildCallHierarchyTreeStub.withArgs(sinon.match.any, fakeUri, fakePosition, mockLogger, mockToken).resolves(null);

        const params = { request: mockRequest, context: mockContext, stream: mockStream, token: mockToken, extensionContext: mockExtensionContext, logger: mockLogger, codeContext: '', lmAdapter: mockLmAdapter };
        await handleRestEndpoint(params, 'get data endpoint');

        assert.ok(buildCallHierarchyTreeStub.calledOnce, 'buildCallHierarchyTree should be called');
        assert.ok(mockStream.markdown.calledWith('Could not build the call hierarchy for the selected endpoint. The endpoint might not have any outgoing calls or there might have been an issue processing it.'), 'Markdown should report failure');
        assert.ok(mockLogger.logUsage.calledWith('[restEndpoint] buildCallHierarchyTree', sinon.match({ status: 'no_root' })), 'Log should indicate no_root status');
    });

    // Cancellation test (optional, but good if your buildCallHierarchyTree handles cancellation actively)
    test('should log cancellation if token is cancelled during buildCallHierarchyTree', async () => {
        const fakeUri: IUri = { fsPath: '/test/Controller.java', scheme: 'file' };
        const fakePosition: IPosition = { line: 15, character: 10 };
        const targetEndpoint: EndpointInfo = { uri: fakeUri, position: fakePosition, path: '/api/data', method: 'GET', handlerMethodName: 'getData', startLine: 14, endLine: 20 };

        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([targetEndpoint]);
        (endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).resolves(targetEndpoint);

        // Simulate cancellation *during* buildCallHierarchyTree execution, causing it to return null
        // AND ensuring the token state reflects cancellation when checked *after* the call returns.
        buildCallHierarchyTreeStub.callsFake(async (commandExecutor, uri, position, logger, tokenArg) => {
            (mockToken as any).isCancellationRequested = true; // Update the shared mock token state
            return null; // Simulate null return due to cancellation
        });

        const params = { request: mockRequest, context: mockContext, stream: mockStream, token: mockToken, extensionContext: mockExtensionContext, logger: mockLogger, codeContext: '', lmAdapter: mockLmAdapter };

        // Call the handler and expect it to complete without throwing an error
        await assert.doesNotReject(
            async () => handleRestEndpoint(params, 'get data endpoint'),
            'handleRestEndpoint should not reject when cancelled after buildCallHierarchyTree'
        );

        // Assert that buildCallHierarchyTree was called
        assert.ok(buildCallHierarchyTreeStub.calledOnce, 'buildCallHierarchyTree should be called');

        // Assert that the handler returned early and did *not* log 'no_root' or 'success'
        assert.ok(mockLogger.logUsage.neverCalledWith('[restEndpoint] buildCallHierarchyTree', sinon.match({ status: 'no_root' })), 'Should not log no_root when cancelled just after buildCallHierarchyTree');
        assert.ok(mockLogger.logUsage.neverCalledWith('[restEndpoint] buildCallHierarchyTree', sinon.match({ status: 'success' })), 'Should not log success when cancelled just after buildCallHierarchyTree');
        // We cannot easily assert that *no* log was made for buildCallHierarchyTree if internal logs happen,
        // but we can assert the specific outcome statuses were not logged by the handler itself.
    });

});