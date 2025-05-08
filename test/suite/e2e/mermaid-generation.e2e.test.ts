import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import { handleRestEndpoint } from '../../../src/diagramParticipant';
import * as mermaidWebviewTemplate from '../../../src/views/mermaid-webview-template';
import { EndpointInfo } from '../../../src/endpoint-discovery';
import * as endpointDiscovery from '../../../src/endpoint-discovery';
import * as endpointDisambiguation from '../../../src/endpoint-disambiguation';
import * as callHierarchy from '../../../src/call-hierarchy';
import { CustomHierarchyNode } from '../../../src/call-hierarchy';
import { IPosition, IUri } from '../../../src/adapters/vscodeTypes';
import { fromVscodePosition, fromVscodeUri } from '../../../src/adapters/vscodeUtils';
import { VscodeCancellationTokenAdapter } from '../../../src/adapters/VscodeCancellationTokenAdapter';
import { VscodeTelemetryLoggerAdapter } from '../../../src/adapters/VscodeTelemetryLoggerAdapter';

const lspInitializationDelay = 10000; // From other E2E tests

suite('E2E Test Suite - Mermaid Diagram Generation for /restEndpoint', () => {
    let sandbox: sinon.SinonSandbox;
    let getMermaidWebviewHtmlStub: sinon.SinonStub;
    let executeCommandStub: sinon.SinonStub;
    let discoverEndpointsStub: sinon.SinonStub;
    let disambiguateEndpointStub: sinon.SinonStub;
    let mockLmAdapter: any;

    let capturedMermaidSyntax: string | undefined;

    const fixtureFileName = 'TestController.java';
    // Path relative to <project_root>/test/fixtures/java-spring-test-project/
    const fixtureRelativePath = path.join('src', 'main', 'java', 'com', 'example', 'testfixture', fixtureFileName);

    setup(() => {
        sandbox = sinon.createSandbox();
        capturedMermaidSyntax = undefined;

        getMermaidWebviewHtmlStub = sandbox.stub(mermaidWebviewTemplate, 'getMermaidWebviewHtml').callsFake((mermaidSyntaxArg: string, themeArg?: string) => {
            capturedMermaidSyntax = mermaidSyntaxArg;
            return '<html><body>Mocked Webview</body></html>'; // Minimal valid HTML
        });

        executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');
        discoverEndpointsStub = sandbox.stub(endpointDiscovery, 'discoverEndpoints');
        disambiguateEndpointStub = sandbox.stub(endpointDisambiguation, 'disambiguateEndpoint');

        mockLmAdapter = {
            sendRequest: sandbox.stub(),
        };
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Should generate a Mermaid diagram for TestController.sayHello', async () => {
        assert.ok(vscode.workspace.workspaceFolders, "[E2E Test] No workspace folder found.");
        const workspaceRootUri = vscode.workspace.workspaceFolders![0].uri;
        const javaFixtureVsCodeUri = vscode.Uri.joinPath(workspaceRootUri, fixtureRelativePath);

        const document = await vscode.workspace.openTextDocument(javaFixtureVsCodeUri);
        await vscode.window.showTextDocument(document);

        console.log('[E2E Mermaid] Waiting for LSP initialization...');
        await new Promise(resolve => setTimeout(resolve, lspInitializationDelay));
        console.log('[E2E Mermaid] LSP initialization wait finished.');

        const endpointName = 'sayHello';
        const endpointLine = 15; // 0-indexed
        const endpointChar = 19; // 0-indexed for 'sayHello'
        const endpointVsCodePosition = new vscode.Position(endpointLine, endpointChar);

        const targetIUri: IUri = fromVscodeUri(javaFixtureVsCodeUri);
        const targetIPosition: IPosition = fromVscodePosition(endpointVsCodePosition);

        const targetEndpointInfo: EndpointInfo = {
            uri: targetIUri,
            position: targetIPosition,
            path: '/api/test/hello',
            method: 'GET',
            handlerMethodName: endpointName,
            startLine: endpointLine - 1,
            endLine: endpointLine + 2,
        };

        discoverEndpointsStub.resolves([targetEndpointInfo]);
        disambiguateEndpointStub.resolves(targetEndpointInfo);

        const mockCallHierarchyItem: vscode.CallHierarchyItem = {
            name: endpointName,
            kind: vscode.SymbolKind.Method,
            uri: javaFixtureVsCodeUri,
            range: new vscode.Range(endpointVsCodePosition, endpointVsCodePosition.translate(0, endpointName.length)),
            selectionRange: new vscode.Range(endpointVsCodePosition, endpointVsCodePosition.translate(0, endpointName.length)),
            detail: 'com.example.testfixture.TestController'
        };
        executeCommandStub.withArgs(
            'vscode.prepareCallHierarchy',
            sinon.match({ fsPath: javaFixtureVsCodeUri.fsPath }),
            sinon.match({ line: endpointVsCodePosition.line, character: endpointVsCodePosition.character })
        ).resolves([mockCallHierarchyItem]);

        executeCommandStub.withArgs('vscode.provideOutgoingCalls', sinon.match({ name: endpointName })).resolves([]);

        const mockExtensionContext: vscode.ExtensionContext = {
            extensionUri: vscode.Uri.file(path.resolve(__dirname, '../../../../')),
            subscriptions: [],
            workspaceState: { get: sandbox.stub().returns(undefined), update: sandbox.stub().resolves(), keys: sandbox.stub().returns([]) } as vscode.Memento,
            globalState: { get: sandbox.stub().returns(undefined), update: sandbox.stub().resolves(), keys: sandbox.stub().returns([]), setKeysForSync: sandbox.stub() } as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
            secrets: { get: sandbox.stub().resolves(''), store: sandbox.stub().resolves(), delete: sandbox.stub().resolves(), onDidChange: sandbox.stub().returns({ dispose: sandbox.stub() }) },
            extensionPath: path.resolve(__dirname, '../../../../'),
            storageUri: undefined,
            globalStorageUri: vscode.Uri.file(path.resolve(__dirname, '../../../../.globalStorage')),
            logUri: vscode.Uri.file(path.resolve(__dirname, '../../../../.logs')),
            environmentVariableCollection: {} as any, // Simplified mock
            extensionMode: vscode.ExtensionMode.Test,
            asAbsolutePath: (relativePath: string) => path.resolve(path.resolve(__dirname, '../../../../'), relativePath),
            storagePath: undefined,
            logPath: path.resolve(__dirname, '../../../../.logs'),
            globalStoragePath: path.resolve(__dirname, '../../../../.globalStorage'),
            extension: {} as any, // Simplified mock
            languageModelAccessInformation: {} as any // Simplified mock
        };
        const mockLogger: Partial<vscode.TelemetryLogger> = {
            logUsage: sandbox.stub(),
            logError: sandbox.stub().callsFake((errorOrEventName: string | Error, data?: Record<string, any>) => {
                // Stub implementation doesn't need to do anything specific here for most tests
                // console.log('Mock logError called:', errorOrEventName, data);
            })
        };
        const mockStream: Partial<vscode.ChatResponseStream> = { progress: sandbox.stub(), markdown: sandbox.stub(), button: sandbox.stub() };
        const mockRequest: Partial<vscode.ChatRequest> = { command: 'restEndpoint', prompt: '/restEndpoint for sayHello method' };
        const mockContext: Partial<vscode.ChatContext> = { history: [] };

        const params: any = {
            request: mockRequest as vscode.ChatRequest,
            context: mockContext as vscode.ChatContext,
            stream: mockStream as vscode.ChatResponseStream,
            token: new VscodeCancellationTokenAdapter(new vscode.CancellationTokenSource().token), // Use adapter
            extensionContext: mockExtensionContext,
            logger: new VscodeTelemetryLoggerAdapter(mockLogger as vscode.TelemetryLogger), // Use adapter
            codeContext: '',
            lmAdapter: mockLmAdapter
        };

        await handleRestEndpoint(params, 'GET /api/test/hello');

        assert.ok(getMermaidWebviewHtmlStub.calledOnce, 'getMermaidWebviewHtml should have been called');
        assert.ok(capturedMermaidSyntax, 'Mermaid syntax should have been captured');

        console.log('[E2E Mermaid] Captured Syntax:', capturedMermaidSyntax);

        // Assert the new expected structure for a leaf API endpoint
        const expectedDiagramSubstringClient = 'participant Client';
        const expectedDiagramSubstringController = 'participant TestController';
        const expectedDiagramSubstringRequest = `Client->>${expectedDiagramSubstringController.split(' ')[1]}: GET /api/test/hello`;
        const expectedDiagramSubstringNote = `Note over ${expectedDiagramSubstringController.split(' ')[1]}: sayHello()`;
        const expectedDiagramSubstringResponse = `${expectedDiagramSubstringController.split(' ')[1]}-->>Client: Response`;

        assert.ok(capturedMermaidSyntax!.includes('sequenceDiagram'), 'Diagram should be a sequenceDiagram');
        assert.ok(capturedMermaidSyntax!.includes(expectedDiagramSubstringClient), `Diagram should contain participant Client`);
        assert.ok(capturedMermaidSyntax!.includes(expectedDiagramSubstringController), `Diagram should contain participant TestController`);
        assert.ok(capturedMermaidSyntax!.includes(expectedDiagramSubstringRequest), `Diagram should contain the request line`);
        assert.ok(capturedMermaidSyntax!.includes(expectedDiagramSubstringNote), `Diagram should contain the note`);
        assert.ok(capturedMermaidSyntax!.includes(expectedDiagramSubstringResponse), `Diagram should contain the response line`);

        // Ensure the old "No outgoing calls" text is NOT present
        assert.ok(
            !capturedMermaidSyntax!.includes(': No outgoing calls found to diagram.'),
            'Diagram should NOT indicate no outgoing calls for a leaf API endpoint'
        );

    }).timeout(lspInitializationDelay + 20000); // Generous timeout

    test('Should assert the specific Mermaid diagram for TestController.sayHello', async () => {
        assert.ok(vscode.workspace.workspaceFolders, "[E2E Test] No workspace folder found.");
        const workspaceRootUri = vscode.workspace.workspaceFolders![0].uri;
        const javaFixtureVsCodeUri = vscode.Uri.joinPath(workspaceRootUri, fixtureRelativePath);

        const document = await vscode.workspace.openTextDocument(javaFixtureVsCodeUri);
        await vscode.window.showTextDocument(document);

        console.log('[E2E Mermaid Specific Test] Waiting for LSP initialization...');
        await new Promise(resolve => setTimeout(resolve, lspInitializationDelay));
        console.log('[E2E Mermaid Specific Test] LSP initialization wait finished.');

        const endpointName = 'sayHello';
        const endpointLine = 15; // 0-indexed
        const endpointChar = 19; // 0-indexed for 'sayHello'
        const endpointVsCodePosition = new vscode.Position(endpointLine, endpointChar);

        const targetIUri: IUri = fromVscodeUri(javaFixtureVsCodeUri);
        const targetIPosition: IPosition = fromVscodePosition(endpointVsCodePosition);

        const targetEndpointInfo: EndpointInfo = {
            uri: targetIUri,
            position: targetIPosition,
            path: '/api/test/hello',
            method: 'GET',
            handlerMethodName: endpointName,
            startLine: endpointLine - 1,
            endLine: endpointLine + 2,
        };

        discoverEndpointsStub.resolves([targetEndpointInfo]);
        disambiguateEndpointStub.resolves(targetEndpointInfo);

        const mockCallHierarchyItem: vscode.CallHierarchyItem = {
            name: endpointName,
            kind: vscode.SymbolKind.Method,
            uri: javaFixtureVsCodeUri,
            range: new vscode.Range(endpointVsCodePosition, endpointVsCodePosition.translate(0, endpointName.length)),
            selectionRange: new vscode.Range(endpointVsCodePosition, endpointVsCodePosition.translate(0, endpointName.length)),
            detail: 'com.example.testfixture.TestController'
        };
        executeCommandStub.withArgs(
            'vscode.prepareCallHierarchy',
            sinon.match({ fsPath: javaFixtureVsCodeUri.fsPath }),
            sinon.match({ line: endpointVsCodePosition.line, character: endpointVsCodePosition.character })
        ).resolves([mockCallHierarchyItem]);

        executeCommandStub.withArgs('vscode.provideOutgoingCalls', sinon.match({ name: endpointName })).resolves([]);

        const mockExtensionContext: vscode.ExtensionContext = {
            extensionUri: vscode.Uri.file(path.resolve(__dirname, '../../../../')),
            subscriptions: [],
            workspaceState: { get: sandbox.stub().returns(undefined), update: sandbox.stub().resolves(), keys: sandbox.stub().returns([]) } as vscode.Memento,
            globalState: { get: sandbox.stub().returns(undefined), update: sandbox.stub().resolves(), keys: sandbox.stub().returns([]), setKeysForSync: sandbox.stub() } as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
            secrets: { get: sandbox.stub().resolves(''), store: sandbox.stub().resolves(), delete: sandbox.stub().resolves(), onDidChange: sandbox.stub().returns({ dispose: sandbox.stub() }) },
            extensionPath: path.resolve(__dirname, '../../../../'),
            storageUri: undefined,
            globalStorageUri: vscode.Uri.file(path.resolve(__dirname, '../../../../.globalStorage')),
            logUri: vscode.Uri.file(path.resolve(__dirname, '../../../../.logs')),
            environmentVariableCollection: {} as any, // Simplified mock
            extensionMode: vscode.ExtensionMode.Test,
            asAbsolutePath: (relativePath: string) => path.resolve(path.resolve(__dirname, '../../../../'), relativePath),
            storagePath: undefined,
            logPath: path.resolve(__dirname, '../../../../.logs'),
            globalStoragePath: path.resolve(__dirname, '../../../../.globalStorage'),
            extension: {} as any, // Simplified mock
            languageModelAccessInformation: {} as any // Simplified mock
        };
        const mockLogger: Partial<vscode.TelemetryLogger> = {
            logUsage: sandbox.stub(),
            logError: sandbox.stub().callsFake((errorOrEventName: string | Error, data?: Record<string, any>) => {
                // Stub implementation doesn't need to do anything specific here
            })
        };
        const mockStream: Partial<vscode.ChatResponseStream> = { progress: sandbox.stub(), markdown: sandbox.stub(), button: sandbox.stub() };
        const mockRequest: Partial<vscode.ChatRequest> = { command: 'restEndpoint', prompt: '/restEndpoint for sayHello method specific diagram' };
        const mockContext: Partial<vscode.ChatContext> = { history: [] };

        const params: any = {
            request: mockRequest as vscode.ChatRequest,
            context: mockContext as vscode.ChatContext,
            stream: mockStream as vscode.ChatResponseStream,
            token: new VscodeCancellationTokenAdapter(new vscode.CancellationTokenSource().token), // Use adapter
            extensionContext: mockExtensionContext,
            logger: new VscodeTelemetryLoggerAdapter(mockLogger as vscode.TelemetryLogger), // Use adapter
            codeContext: '',
            lmAdapter: mockLmAdapter
        };

        await handleRestEndpoint(params, 'GET /api/test/hello');

        // Updated expectedDiagram to match the actual output
        const expectedDiagram = `sequenceDiagram
    participant Client
    participant TestController
    Client->>TestController: GET /api/test/hello
    Note over TestController: sayHello()
    TestController-->>Client: Response`;

        assert.ok(getMermaidWebviewHtmlStub.calledOnce, 'getMermaidWebviewHtml should have been called');
        assert.ok(capturedMermaidSyntax, 'Mermaid syntax should have been captured');

        assert.strictEqual(capturedMermaidSyntax, expectedDiagram, 'The generated Mermaid diagram does not match the expected specific diagram.');

    }).timeout(lspInitializationDelay + 20000);
});