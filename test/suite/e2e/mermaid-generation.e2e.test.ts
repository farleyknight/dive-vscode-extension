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

        // Target: public String sayHello() { // Line 16 (1-indexed), name starts at char 19 (0-indexed)
        const endpointName = 'sayHello';
        const endpointLine = 15; // 0-indexed
        const endpointChar = 19; // 0-indexed for 'sayHello'
        const endpointVsCodePosition = new vscode.Position(endpointLine, endpointChar);

        // Convert to IUri and IPosition for EndpointInfo
        const targetIUri: IUri = fromVscodeUri(javaFixtureVsCodeUri);
        const targetIPosition: IPosition = fromVscodePosition(endpointVsCodePosition);

        const targetEndpointInfo: EndpointInfo = {
            uri: targetIUri,
            position: targetIPosition,
            path: '/api/test/hello',
            method: 'GET',
            handlerMethodName: endpointName,
            startLine: endpointLine - 1, // approx
            endLine: endpointLine + 2, // approx
        };

        discoverEndpointsStub.resolves([targetEndpointInfo]);
        disambiguateEndpointStub.resolves(targetEndpointInfo);

        // Mock for vscode.prepareCallHierarchy (called by buildCallHierarchyTree)
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
            sinon.match({ fsPath: javaFixtureVsCodeUri.fsPath }), // Match URI by fsPath
            sinon.match({ line: endpointVsCodePosition.line, character: endpointVsCodePosition.character }) // Match position by line and character
        ).resolves([mockCallHierarchyItem]);

        // Mock for vscode.provideOutgoingCalls (called by buildCallHierarchyTree)
        // sayHello makes no outgoing calls in this fixture.
        executeCommandStub.withArgs('vscode.provideOutgoingCalls', sinon.match({ name: endpointName })).resolves([]);

        // Mock CommandHandlerParams
        const mockExtensionContext: vscode.ExtensionContext = {
            extensionUri: vscode.Uri.file(path.resolve(__dirname, '../../../../')),
            subscriptions: [],
            workspaceState: {
                get: sandbox.stub().callsFake((key: string, defaultValue?: any) => defaultValue),
                update: sandbox.stub().resolves(),
                keys: sandbox.stub().returns([])
            } as vscode.Memento,
            globalState: {
                get: sandbox.stub().callsFake((key: string, defaultValue?: any) => defaultValue),
                update: sandbox.stub().resolves(),
                keys: sandbox.stub().returns([]),
                setKeysForSync: sandbox.stub()
            } as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
            secrets: { get: sandbox.stub().resolves(''), store: sandbox.stub().resolves(), delete: sandbox.stub().resolves(), onDidChange: sandbox.stub().returns({ dispose: sandbox.stub() }) },
            extensionPath: path.resolve(__dirname, '../../../../'),
            storageUri: undefined,
            globalStorageUri: vscode.Uri.file(path.resolve(__dirname, '../../../../.globalStorage')),
            logUri: vscode.Uri.file(path.resolve(__dirname, '../../../../.logs')),
            environmentVariableCollection: {
                persistent: false,
                replace: sandbox.stub(),
                append: sandbox.stub(),
                prepend: sandbox.stub(),
                get: sandbox.stub().returns(undefined),
                forEach: sandbox.stub(),
                delete: sandbox.stub(),
                clear: sandbox.stub(),
                [Symbol.iterator]: sandbox.stub().returns({ next: () => ({ done: true, value: undefined }) }),
                description: 'mocked EVC',
                getScoped: sandbox.stub().returns(undefined),
            } as vscode.GlobalEnvironmentVariableCollection,
            extensionMode: vscode.ExtensionMode.Test,
            asAbsolutePath: (relativePath: string) => path.resolve(path.resolve(__dirname, '../../../../'), relativePath),
            storagePath: undefined,
            logPath: path.resolve(__dirname, '../../../../.logs'),
            globalStoragePath: path.resolve(__dirname, '../../../../.globalStorage'),
            extension: {
                id: 'farleyknight.dive', // Example extension ID
                extensionUri: vscode.Uri.file(path.resolve(__dirname, '../../../../')),
                extensionPath: path.resolve(__dirname, '../../../../'),
                isActive: true,
                packageJSON: { name: 'dive', version: '0.0.1', publisher: 'farleyknight' }, // Minimal package.json
                exports: {},
                activate: sandbox.stub().resolves(),
                extensionKind: vscode.ExtensionKind.Workspace,
            } as vscode.Extension<any>,
            languageModelAccessInformation: {
                canSendRequest: sandbox.stub().returns(true),
                onDidChange: sandbox.stub().returns({ dispose: sandbox.stub() }),
            } as vscode.LanguageModelAccessInformation,
        };

        const mockLogger: Partial<vscode.TelemetryLogger> = {
            logUsage: sandbox.stub(),
            logError: sandbox.stub().callsFake((errorOrEventName: string | Error, data?: Record<string, any>) => {}),
        };

        const mockStream: Partial<vscode.ChatResponseStream> = {
            progress: sandbox.stub(),
            markdown: sandbox.stub(),
            button: sandbox.stub(),
        };

        const mockRequest: Partial<vscode.ChatRequest> = {
            command: 'restEndpoint',
            prompt: '/restEndpoint for sayHello method'
        };
        const mockContext: Partial<vscode.ChatContext> = {
            history: []
        };


        const params: any = { // Cast to any to allow partial mocks for simplicity
            request: mockRequest as vscode.ChatRequest,
            context: mockContext as vscode.ChatContext,
            stream: mockStream as vscode.ChatResponseStream,
            token: new vscode.CancellationTokenSource().token,
            extensionContext: mockExtensionContext,
            logger: mockLogger as vscode.TelemetryLogger,
            codeContext: '',
            lmAdapter: mockLmAdapter
        };

        await handleRestEndpoint(params, 'GET /api/test/hello');

        assert.ok(getMermaidWebviewHtmlStub.calledOnce, 'getMermaidWebviewHtml should have been called');
        assert.ok(capturedMermaidSyntax, 'Mermaid syntax should have been captured');

        console.log('[E2E Mermaid] Captured Syntax:', capturedMermaidSyntax);

        const expectedParticipant = 'TestController_sayHello'; // After getParticipantName & sanitize
        assert.ok(capturedMermaidSyntax!.includes('sequenceDiagram'), 'Diagram should be a sequenceDiagram');
        assert.ok(capturedMermaidSyntax!.includes(`participant ${expectedParticipant}`), `Diagram should contain participant ${expectedParticipant}`);
        // Since sayHello has no children in our mock, check for "No outgoing calls"
        assert.ok(
            capturedMermaidSyntax!.includes(`${expectedParticipant}->>${expectedParticipant}: No outgoing calls found to diagram.`),
            'Diagram should indicate no outgoing calls for a leaf method'
        );

    }).timeout(lspInitializationDelay + 20000); // Generous timeout
});