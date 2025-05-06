import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { handleRestEndpoint } from '../../src/diagramParticipant';
import { EndpointInfo } from '../../src/endpoint-discovery';
import * as endpointDiscovery from '../../src/endpoint-discovery';
import * as endpointDisambiguation from '../../src/endpoint-disambiguation';
import * as callHierarchy from '../../src/call-hierarchy'; // Import the new module

suite('Diagram Participant - handleRestEndpoint', () => {
    let sandbox: sinon.SinonSandbox;
    let mockStream: any;
    let mockLogger: any;
    let mockLm: any;
    let mockToken: vscode.CancellationToken;
    let mockExtensionContext: vscode.ExtensionContext;
    let mockContext: vscode.ChatContext;
    let mockRequest: vscode.ChatRequest;
    let buildCallHierarchyTreeStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();

        // Mock vscode.commands.executeCommand - still needed if other parts of handleRestEndpoint use it, but not for CH directly here
        sandbox.stub(vscode.commands, 'executeCommand');

        sandbox.stub(endpointDiscovery, 'discoverEndpoints');
        sandbox.stub(endpointDisambiguation, 'disambiguateEndpoint');

        // Stub the imported buildCallHierarchyTree function
        buildCallHierarchyTreeStub = sandbox.stub(callHierarchy, 'buildCallHierarchyTree');

        mockStream = {
            progress: sandbox.stub(),
            markdown: sandbox.stub(),
            button: sandbox.stub(),
        };
        mockLogger = {
            logUsage: sandbox.stub(),
            logError: sandbox.stub(),
        };
        mockLm = {
            sendRequest: sandbox.stub(),
        };
        mockToken = {
            isCancellationRequested: false,
            onCancellationRequested: sandbox.stub().returns({ dispose: () => {} }),
        } as any;
        mockExtensionContext = { subscriptions: [] } as any;
        mockContext = {} as any;
        mockRequest = { model: mockLm } as any;
    });

    teardown(() => {
        sandbox.restore();
    });

    test('should handle no endpoints found by discoverEndpoints', async () => {
        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([]);
        const params = { request: mockRequest, context: mockContext, stream: mockStream, token: mockToken, extensionContext: mockExtensionContext, logger: mockLogger, codeContext: '', lm: mockLm };
        await handleRestEndpoint(params, 'show test endpoint');
        assert.ok((endpointDiscovery.discoverEndpoints as sinon.SinonStub).calledOnce, 'discoverEndpoints should be called');
        assert.ok(buildCallHierarchyTreeStub.notCalled, 'buildCallHierarchyTree should not be called if no endpoints');
        assert.ok(mockStream.markdown.calledWith(sinon.match(/couldn't find any REST endpoints/)), 'No endpoints message should be streamed');
        assert.ok(mockLogger.logUsage.calledWith('request', sinon.match.has('status', 'no_endpoints_found')), 'logUsage should indicate no_endpoints_found');
    });

    test('should handle disambiguation failure', async () => {
        const fakeUri = vscode.Uri.file('/test/file.java');
        const fakePosition = new vscode.Position(10, 5);
        const anEndpoint: EndpointInfo = { uri: fakeUri, position: fakePosition, path: '/api/some', method: 'GET', handlerMethodName: 'getSome', startLine: 9, endLine: 15 };
        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([anEndpoint]);
        (endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).resolves(undefined);
        const params = { request: mockRequest, context: mockContext, stream: mockStream, token: mockToken, extensionContext: mockExtensionContext, logger: mockLogger, codeContext: '', lm: mockLm };
        await handleRestEndpoint(params, 'show a very ambiguous endpoint');
        assert.ok((endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).calledOnce, 'disambiguateEndpoint should be called');
        assert.ok(buildCallHierarchyTreeStub.notCalled, 'buildCallHierarchyTree should not be called if disambiguation fails');
        assert.ok(mockLogger.logUsage.calledWith('request', sinon.match.has('status', 'disambiguation_failed')), 'logUsage should indicate disambiguation_failed');
    });

    // New tests for handleRestEndpoint's interaction with buildCallHierarchyTree
    test('should call buildCallHierarchyTree and report success if tree is built', async () => {
        const fakeUri = vscode.Uri.file('/test/Controller.java');
        const fakePosition = new vscode.Position(15, 10);
        const targetEndpoint: EndpointInfo = { uri: fakeUri, position: fakePosition, path: '/api/data', method: 'GET', handlerMethodName: 'getData', startLine: 14, endLine: 20 };
        const mockCallHierarchyItem: vscode.CallHierarchyItem = new vscode.CallHierarchyItem(vscode.SymbolKind.Method, 'getData', 'detail', fakeUri, new vscode.Range(14,0,20,1), new vscode.Range(15,10,15,17));
        const mockHierarchyRoot: callHierarchy.CustomHierarchyNode = { item: mockCallHierarchyItem, children: [], parents: [] };

        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([targetEndpoint]);
        (endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).resolves(targetEndpoint);
        buildCallHierarchyTreeStub.withArgs(fakeUri, fakePosition, sinon.match.any, sinon.match.any).resolves(mockHierarchyRoot);

        const params = { request: mockRequest, context: mockContext, stream: mockStream, token: mockToken, extensionContext: mockExtensionContext, logger: mockLogger, codeContext: '', lm: mockLm };
        await handleRestEndpoint(params, 'get data endpoint');

        assert.ok(buildCallHierarchyTreeStub.calledOnceWith(fakeUri, fakePosition, mockLogger, mockToken), 'buildCallHierarchyTree should be called with correct args');
        assert.ok(mockStream.markdown.calledWith(sinon.match(/Successfully built call hierarchy for getData/)), 'Markdown should report success');
        assert.ok(mockLogger.logUsage.calledWith('request', sinon.match.has('status', 'call_hierarchy_data_built')), 'Log should indicate data_built status');
    });

    test('should handle buildCallHierarchyTree returning null', async () => {
        const fakeUri = vscode.Uri.file('/test/Controller.java');
        const fakePosition = new vscode.Position(15, 10);
        const targetEndpoint: EndpointInfo = { uri: fakeUri, position: fakePosition, path: '/api/data', method: 'GET', handlerMethodName: 'getData', startLine: 14, endLine: 20 };

        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([targetEndpoint]);
        (endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).resolves(targetEndpoint);
        buildCallHierarchyTreeStub.resolves(null);

        const params = { request: mockRequest, context: mockContext, stream: mockStream, token: mockToken, extensionContext: mockExtensionContext, logger: mockLogger, codeContext: '', lm: mockLm };
        await handleRestEndpoint(params, 'get data endpoint');

        assert.ok(buildCallHierarchyTreeStub.calledOnce, 'buildCallHierarchyTree should be called');
        assert.ok(mockStream.markdown.calledWith(sinon.match(/Could not build call hierarchy data/)), 'Markdown should report failure');
        assert.ok(mockLogger.logUsage.calledWith('request', sinon.match.has('status', 'call_hierarchy_data_build_failed')), 'Log should indicate build_failed status');
    });

    // Cancellation test (optional, but good if your buildCallHierarchyTree handles cancellation actively)
    test('should log cancellation if token is cancelled during buildCallHierarchyTree', async () => {
        const fakeUri = vscode.Uri.file('/test/Controller.java');
        const fakePosition = new vscode.Position(15, 10);
        const targetEndpoint: EndpointInfo = { uri: fakeUri, position: fakePosition, path: '/api/data', method: 'GET', handlerMethodName: 'getData', startLine: 14, endLine: 20 };

        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([targetEndpoint]);
        (endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).resolves(targetEndpoint);

        // Simulate cancellation *after* buildCallHierarchyTree is called but *before* it would resolve
        buildCallHierarchyTreeStub.callsFake(async (uri, position, logger, tokenArg) => {
            tokenArg.isCancellationRequested = true; // Simulate cancellation
            // The actual buildCallHierarchyTree function in call-hierarchy.ts will check this token.
            // For this test, we ensure it's set, and the main function handles it.
            return null; // or a specific response if cancellation has one
        });

        const params = { request: mockRequest, context: mockContext, stream: mockStream, token: mockToken, extensionContext: mockExtensionContext, logger: mockLogger, codeContext: '', lm: mockLm };
        await handleRestEndpoint(params, 'get data endpoint');

        assert.ok(buildCallHierarchyTreeStub.calledOnce, 'buildCallHierarchyTree should be called');
        // The 'cancelled_during_hierarchy_build' log is now made in handleRestEndpoint after buildCallHierarchyTree returns (or is awaited)
        // if the token passed to buildCallHierarchyTree leads to it returning null due to cancellation.
        // We need to ensure the token state is checked by handleRestEndpoint *after* the call to buildCallHierarchyTree
        // For this test, we assume the token.isCancellationRequested = true set in the fake will be checked by handleRestEndpoint after the await.
        // The test setup here is a bit tricky because the cancellation happens *inside* the mocked function's execution period.
        // The direct check here will be on handleRestEndpoint's logging AFTER buildCallHierarchyTree completes.
        // A more robust test of buildCallHierarchyTree's internal cancellation is in call-hierarchy.test.ts
        assert.ok(mockLogger.logUsage.calledWith('request', sinon.match.has('status', 'cancelled_during_hierarchy_build')), 'Log should indicate cancellation during build');
    });

});