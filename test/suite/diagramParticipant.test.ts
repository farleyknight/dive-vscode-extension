import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { handleRestEndpoint } from '../../src/diagramParticipant'; // Adjust path as necessary
import { EndpointInfo } from '../../src/endpoint-discovery'; // Adjust path
import * as endpointDiscovery from '../../src/endpoint-discovery'; // To mock discoverEndpoints
import * as endpointDisambiguation from '../../src/endpoint-disambiguation'; // To mock disambiguateEndpoint

suite('Diagram Participant - handleRestEndpoint', () => {
    let sandbox: sinon.SinonSandbox;
    let mockStream: any;
    let mockLogger: any;
    let mockLm: any;
    let mockToken: vscode.CancellationToken;
    let mockExtensionContext: vscode.ExtensionContext;
    let mockContext: vscode.ChatContext;
    let mockRequest: vscode.ChatRequest;

    setup(() => {
        sandbox = sinon.createSandbox();

        // Mock vscode.commands.executeCommand
        sandbox.stub(vscode.commands, 'executeCommand');

        // Mock discoverEndpoints and disambiguateEndpoint
        sandbox.stub(endpointDiscovery, 'discoverEndpoints');
        sandbox.stub(endpointDisambiguation, 'disambiguateEndpoint');

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
            onCancellationRequested: sandbox.stub(),
        } as any;

        // Basic mocks for other params
        mockExtensionContext = { subscriptions: [] } as any;
        mockContext = {} as any;
        mockRequest = { model: mockLm } as any;


    });

    teardown(() => {
        sandbox.restore();
    });

    test('should attempt to show call hierarchy for a disambiguated endpoint', async () => {
        const fakeUri = vscode.Uri.file('/test/file.java');
        const fakePosition = new vscode.Position(10, 5);
        const targetEndpoint: EndpointInfo = {
            uri: fakeUri,
            position: fakePosition,
            path: '/api/test',
            method: 'GET',
            handlerMethodName: 'getTest',
            startLine: 9,
            endLine: 15,
        };

        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([{ ...targetEndpoint, path: '/api/other' }]); // discovery returns some endpoints
        (endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).resolves(targetEndpoint);
        (vscode.commands.executeCommand as sinon.SinonStub).withArgs('java.showCallHierarchy', fakeUri, fakePosition).resolves();

        const params = {
            request: mockRequest,
            context: mockContext,
            stream: mockStream,
            token: mockToken,
            extensionContext: mockExtensionContext,
            logger: mockLogger,
            codeContext: '',
            lm: mockLm,
        };

        await handleRestEndpoint(params, 'show test endpoint');

        assert.ok((endpointDiscovery.discoverEndpoints as sinon.SinonStub).calledOnce, 'discoverEndpoints should be called');
        assert.ok((endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).calledOnce, 'disambiguateEndpoint should be called');

        const executeCommandStub = vscode.commands.executeCommand as sinon.SinonStub;
        assert.ok(executeCommandStub.calledWith('java.showCallHierarchy', fakeUri, fakePosition), 'executeCommand for call hierarchy should be called with correct args');

        assert.ok(mockStream.markdown.calledWith(sinon.match(/Attempted to display call hierarchy/)), 'Success message should be streamed');
        assert.ok(mockLogger.logUsage.calledWith('request', sinon.match.has('status', 'call_hierarchy_invoked')), 'logUsage should indicate call_hierarchy_invoked');
    });

    // Test for failure of vscode.commands.executeCommand
    test('should handle errors when showing call hierarchy fails', async () => {
        const fakeUri = vscode.Uri.file('/test/file.java');
        const fakePosition = new vscode.Position(10, 5);
        const targetEndpoint: EndpointInfo = {
            uri: fakeUri,
            position: fakePosition,
            path: '/api/test',
            method: 'GET',
            handlerMethodName: 'getTest',
            startLine: 9,
            endLine: 15,
        };
        const commandError = new Error('Call hierarchy failed');

        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([targetEndpoint]);
        (endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).resolves(targetEndpoint);
        (vscode.commands.executeCommand as sinon.SinonStub).withArgs('java.showCallHierarchy', fakeUri, fakePosition).rejects(commandError);

        const params = {
            request: mockRequest,
            context: mockContext,
            stream: mockStream,
            token: mockToken,
            extensionContext: mockExtensionContext,
            logger: mockLogger,
            codeContext: '',
            lm: mockLm,
        };

        await handleRestEndpoint(params, 'show test endpoint');

        const executeCommandStub = vscode.commands.executeCommand as sinon.SinonStub;
        assert.ok(executeCommandStub.calledWith('java.showCallHierarchy', fakeUri, fakePosition), 'executeCommand for call hierarchy should be called');

        assert.ok(mockStream.markdown.calledWith(sinon.match(/Failed to invoke call hierarchy: Call hierarchy failed/)), 'Error message should be streamed');
        assert.ok(mockLogger.logError.calledWith(commandError, sinon.match.has('stage', 'call_hierarchy_command')), 'logError should be called with the error');
        assert.ok(mockLogger.logUsage.calledWith('request', sinon.match.has('status', 'call_hierarchy_error')), 'logUsage should indicate call_hierarchy_error');
    });

    // Add more tests, e.g., for no endpoints found, disambiguation failure
    test('should handle no endpoints found by discoverEndpoints', async () => {
        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([]); // No endpoints

        const params = {
            request: mockRequest,
            context: mockContext,
            stream: mockStream,
            token: mockToken,
            extensionContext: mockExtensionContext,
            logger: mockLogger,
            codeContext: '',
            lm: mockLm,
        };

        await handleRestEndpoint(params, 'show test endpoint');

        assert.ok((endpointDiscovery.discoverEndpoints as sinon.SinonStub).calledOnce, 'discoverEndpoints should be called');
        assert.ok((endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).notCalled, 'disambiguateEndpoint should not be called if no endpoints');
        assert.ok((vscode.commands.executeCommand as sinon.SinonStub).notCalled, 'executeCommand should not be called');
        assert.ok(mockStream.markdown.calledWith(sinon.match(/couldn't find any REST endpoints/)), 'No endpoints message should be streamed');
        assert.ok(mockLogger.logUsage.calledWith('request', sinon.match.has('status', 'no_endpoints_found')), 'logUsage should indicate no_endpoints_found');
    });

    test('should handle disambiguation failure', async () => {
        const fakeUri = vscode.Uri.file('/test/file.java');
        const fakePosition = new vscode.Position(10, 5);
        const anEndpoint: EndpointInfo = { // Endpoint that discovery might find
            uri: fakeUri, position: fakePosition, path: '/api/some', method: 'GET', handlerMethodName: 'getSome',
            startLine: 9, endLine: 15,
        };

        (endpointDiscovery.discoverEndpoints as sinon.SinonStub).resolves([anEndpoint]);
        (endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).resolves(undefined); // Disambiguation returns no specific endpoint

        const params = {
            request: mockRequest,
            context: mockContext,
            stream: mockStream,
            token: mockToken,
            extensionContext: mockExtensionContext,
            logger: mockLogger,
            codeContext: '',
            lm: mockLm,
        };

        await handleRestEndpoint(params, 'show a very ambiguous endpoint');

        assert.ok((endpointDiscovery.discoverEndpoints as sinon.SinonStub).calledOnce, 'discoverEndpoints should be called');
        assert.ok((endpointDisambiguation.disambiguateEndpoint as sinon.SinonStub).calledOnce, 'disambiguateEndpoint should be called');
        assert.ok((vscode.commands.executeCommand as sinon.SinonStub).notCalled, 'executeCommand should not be called if disambiguation fails');
        // Message for disambiguation failure is handled within disambiguateEndpoint, so we might not see a specific one here from handleRestEndpoint directly,
        // but we check that logger recorded the failure.
        assert.ok(mockLogger.logUsage.calledWith('request', sinon.match.has('status', 'disambiguation_failed')), 'logUsage should indicate disambiguation_failed');
    });
});