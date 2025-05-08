import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { buildCallHierarchyTree, CustomHierarchyNode } from '../../src/call-hierarchy';
import { ICommandExecutor } from '../../src/adapters/vscodeExecution';
import { VSCodeSymbolKind, IUri, IPosition, ICancellationToken } from '../../src/adapters/vscodeTypes'; // Added IUri, IPosition, ICancellationToken
import { ILogger } from '../../src/adapters/iLogger'; // Added ILogger
import { fromVscodeUri, fromVscodePosition } from '../../src/adapters/vscodeUtils'; // Added converters
import { VscodeCancellationTokenAdapter } from '../../src/adapters/VscodeCancellationTokenAdapter'; // Added adapter

// Helper to create a mock CallHierarchyItem - uses vscode.Uri
const createMockCallHierarchyItem = (
    name: string,
    kind: VSCodeSymbolKind,
    uri: vscode.Uri, // Expects vscode.Uri
    rangeLine: number,
    selRangeLine: number
): vscode.CallHierarchyItem => {
    return new vscode.CallHierarchyItem(
        kind as number,
        name,
        `detail for ${name}`,
        uri, // Uses vscode.Uri
        new vscode.Range(new vscode.Position(rangeLine, 0), new vscode.Position(rangeLine + 1, 0)),
        new vscode.Range(new vscode.Position(selRangeLine, 0), new vscode.Position(selRangeLine, 5))
    );
};

// Helper to create a mock CallHierarchyOutgoingCall - uses vscode.CallHierarchyItem
const createMockOutgoingCall = (toItem: vscode.CallHierarchyItem): vscode.CallHierarchyOutgoingCall => {
    return new vscode.CallHierarchyOutgoingCall(
        toItem,
        [new vscode.Range(new vscode.Position(0,0), new vscode.Position(0,5))]
    );
};

suite('Call Hierarchy Utility - buildCallHierarchyTree', () => {
    let sandbox: sinon.SinonSandbox;
    let mockLogger: sinon.SinonStubbedInstance<ILogger>;
    let mockVsCodeToken: vscode.CancellationToken;
    let mockTokenAdapter: ICancellationToken;
    let mockCommandExecutor: ICommandExecutor;
    let executeCommandStubOnMock: sinon.SinonStub;
    const fakeVsCodeUri = vscode.Uri.file('/test/Controller.java'); // vscode.Uri
    let iFakeUri: IUri; // IUri version for buildCallHierarchyTree call

    setup(() => {
        sandbox = sinon.createSandbox();
        mockLogger = {
            logUsage: sandbox.stub(),
            logError: sandbox.stub(),
            logInfo: sandbox.stub(),
            logDebug: sandbox.stub(),
            logWarning: sandbox.stub(),
        } as sinon.SinonStubbedInstance<ILogger>;

        mockVsCodeToken = {
            isCancellationRequested: false,
            onCancellationRequested: sandbox.stub().returns({ dispose: () => {} }),
        } as vscode.CancellationToken;
        mockTokenAdapter = new VscodeCancellationTokenAdapter(mockVsCodeToken);

        executeCommandStubOnMock = sandbox.stub();
        mockCommandExecutor = {
            executeCommand: executeCommandStubOnMock
        };
        iFakeUri = fromVscodeUri(fakeVsCodeUri); // Convert for buildCallHierarchyTree
    });

    teardown(() => {
        sandbox.restore();
    });

    // rootItem uses fakeVsCodeUri
    const rootItem = createMockCallHierarchyItem('rootMethod', VSCodeSymbolKind.Method, fakeVsCodeUri, 10, 10);

    test('should successfully build a root node if prepareCallHierarchy succeeds', async () => {
        const fakeVsCodePosition = new vscode.Position(10, 1);
        const iFakePosition: IPosition = fromVscodePosition(fakeVsCodePosition);
        executeCommandStubOnMock.withArgs(
            'vscode.prepareCallHierarchy',
            sinon.match((uri: vscode.Uri) => uri && uri.fsPath === fakeVsCodeUri.fsPath, "URI fsPath match"),
            sinon.match((pos: vscode.Position) => pos && pos.line === fakeVsCodePosition.line && pos.character === fakeVsCodePosition.character, "Position line/char match")
        ).resolves([rootItem]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', rootItem).resolves([]);
        const result = await buildCallHierarchyTree(mockCommandExecutor, iFakeUri, iFakePosition, mockLogger, mockTokenAdapter);

        assert.ok(result, 'Result should not be null');
        assert.strictEqual(result?.item, rootItem);
        assert.strictEqual(result?.children.length, 0);
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'started' })));
        assert.ok(mockLogger.logUsage.calledWith('prepareInitialCallHierarchyItem', sinon.match({ status: 'success' })));
        assert.ok(mockLogger.logUsage.calledWith('fetchOutgoingCalls', sinon.match({ itemName: 'rootMethod', status: 'success', count: 0 })));
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'completed_successfully', itemName: 'rootMethod' })));
    });

    test('should return null if prepareCallHierarchy returns no items', async () => {
        const fakeVsCodePosition = new vscode.Position(15, 10);
        const iFakePosition: IPosition = fromVscodePosition(fakeVsCodePosition);
        executeCommandStubOnMock.withArgs(
            'vscode.prepareCallHierarchy',
            sinon.match((uri: vscode.Uri) => uri && uri.fsPath === fakeVsCodeUri.fsPath, "URI fsPath match"),
            sinon.match((pos: vscode.Position) => pos && pos.line === fakeVsCodePosition.line && pos.character === fakeVsCodePosition.character, "Position line/char match")
        ).resolves([]);
        const result = await buildCallHierarchyTree(mockCommandExecutor, iFakeUri, iFakePosition, mockLogger, mockTokenAdapter);
        assert.strictEqual(result, null);
        assert.ok(mockLogger.logUsage.calledWith('prepareInitialCallHierarchyItem', sinon.match({ status: 'no_items_returned' })));
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'initial_prepare_failed' })));
    });

    test('should return null if prepareCallHierarchy throws an error', async () => {
        const fakeVsCodePosition = new vscode.Position(15, 10);
        const iFakePosition: IPosition = fromVscodePosition(fakeVsCodePosition);
        const prepareError = new Error('LSP prepare error');
        executeCommandStubOnMock.withArgs(
            'vscode.prepareCallHierarchy',
            sinon.match((uri: vscode.Uri) => uri && uri.fsPath === fakeVsCodeUri.fsPath, "URI fsPath match"),
            sinon.match((pos: vscode.Position) => pos && pos.line === fakeVsCodePosition.line && pos.character === fakeVsCodePosition.character, "Position line/char match")
        ).rejects(prepareError);
        const result = await buildCallHierarchyTree(mockCommandExecutor, iFakeUri, iFakePosition, mockLogger, mockTokenAdapter);
        assert.strictEqual(result, null);
        assert.ok(mockLogger.logError.calledWith(prepareError, sinon.match({ stage: 'prepareInitialCallHierarchyItem' })));
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'initial_prepare_failed' })));
    });

    test('should return null if cancellation is requested before prepareCallHierarchy', async () => {
        const fakeVsCodePosition = new vscode.Position(15, 10);
        const iFakePosition: IPosition = fromVscodePosition(fakeVsCodePosition);
        mockVsCodeToken.isCancellationRequested = true;
        const result = await buildCallHierarchyTree(mockCommandExecutor, iFakeUri, iFakePosition, mockLogger, mockTokenAdapter);
        assert.strictEqual(result, null);
        assert.ok(executeCommandStubOnMock.withArgs('vscode.prepareCallHierarchy').notCalled, 'prepareCallHierarchy should not be called');
        assert.ok(mockLogger.logUsage.calledWith('prepareInitialCallHierarchyItem', sinon.match({ status: 'cancelled_before_prepare' })));
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'cancelled_after_prepare' })));
    });

    test('should build one level of outgoing calls', async () => {
        const fakeVsCodePosition = new vscode.Position(10, 1);
        const iFakePosition: IPosition = fromVscodePosition(fakeVsCodePosition);
        const child1Item = createMockCallHierarchyItem('child1Method', VSCodeSymbolKind.Method, fakeVsCodeUri, 20, 20);
        const child2Item = createMockCallHierarchyItem('child2Method', VSCodeSymbolKind.Method, fakeVsCodeUri, 30, 30);
        executeCommandStubOnMock.withArgs(
            'vscode.prepareCallHierarchy',
            sinon.match((uri: vscode.Uri) => uri && uri.fsPath === fakeVsCodeUri.fsPath, "URI fsPath match"),
            sinon.match((pos: vscode.Position) => pos && pos.line === fakeVsCodePosition.line && pos.character === fakeVsCodePosition.character, "Position line/char match")
        ).resolves([rootItem]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', rootItem).resolves([
            createMockOutgoingCall(child1Item),
            createMockOutgoingCall(child2Item)
        ]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', child1Item).resolves([]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', child2Item).resolves([]);
        const result = await buildCallHierarchyTree(mockCommandExecutor, iFakeUri, iFakePosition, mockLogger, mockTokenAdapter);
        assert.ok(result);
        assert.strictEqual(result?.children.length, 2);
        assert.strictEqual(result?.children[0].item.name, 'child1Method');
        assert.strictEqual(result?.children[1].item.name, 'child2Method');
        assert.strictEqual(result?.children[0].children.length, 0);
        assert.ok(mockLogger.logUsage.calledWith('fetchOutgoingCalls', sinon.match({ itemName: 'rootMethod', count: 2 })));
        assert.ok(mockLogger.logUsage.calledWith('fetchOutgoingCalls', sinon.match({ itemName: 'child1Method', count: 0 })));
        assert.ok(mockLogger.logUsage.calledWith('fetchOutgoingCalls', sinon.match({ itemName: 'child2Method', count: 0 })));
    });

    test('should limit recursion to MAX_CALL_HIERARCHY_DEPTH (effective depth 5)', async () => {
        const fakeVsCodePosition = new vscode.Position(10, 1);
        const iFakePosition: IPosition = fromVscodePosition(fakeVsCodePosition);
        executeCommandStubOnMock.withArgs(
            'vscode.prepareCallHierarchy',
            sinon.match((uri: vscode.Uri) => uri && uri.fsPath === fakeVsCodeUri.fsPath, "URI fsPath match"),
            sinon.match((pos: vscode.Position) => pos && pos.line === fakeVsCodePosition.line && pos.character === fakeVsCodePosition.character, "Position line/char match")
        ).resolves([rootItem]);
        let currentItem = rootItem;
        for (let i = 0; i < 5; i++) {
            const nextItem = createMockCallHierarchyItem(`level${i + 1}`, VSCodeSymbolKind.Method, fakeVsCodeUri, 100 + i * 10, 100 + i * 10);
            executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', currentItem).resolves([createMockOutgoingCall(nextItem)]);
            currentItem = nextItem;
        }
        const level6Item = createMockCallHierarchyItem('level6_not_fetched', VSCodeSymbolKind.Method, fakeVsCodeUri, 200, 200);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', currentItem).resolves([createMockOutgoingCall(level6Item)]);
        const result = await buildCallHierarchyTree(mockCommandExecutor, iFakeUri, iFakePosition, mockLogger, mockTokenAdapter);
        assert.ok(result);
        let node = result;
        let depth = 0;
        while(node && node.children.length > 0) {
            node = node.children[0];
            depth++;
        }
        assert.strictEqual(depth, 5, 'Effective depth of the tree should be 5 (root + 5 levels of children)');
        assert.ok(mockLogger.logUsage.calledWith('fetchOutgoingCalls', sinon.match({ itemName: 'level4' })), 'Should have fetched calls for level4');
        assert.ok(mockLogger.logUsage.neverCalledWith('fetchOutgoingCalls', sinon.match({ itemName: 'level5' })), 'Should NOT have fetched calls for level5 due to depth limit');
        assert.ok(mockLogger.logUsage.neverCalledWith('fetchOutgoingCalls', sinon.match({ itemName: 'level6_not_fetched' })), 'Should NOT have fetched calls for level6');
        assert.ok(mockLogger.logUsage.calledWith('expandOutgoingCallsRecursive', sinon.match({ status: 'max_depth_reached', itemName: 'level5' })), 'Max depth should be logged for level5 expansion attempt');
    });

    test('should handle circular dependencies by not adding cyclic child', async () => {
        const fakeVsCodePosition = new vscode.Position(10, 1);
        const iFakePosition: IPosition = fromVscodePosition(fakeVsCodePosition);
        const itemA = createMockCallHierarchyItem('methodA', VSCodeSymbolKind.Method, fakeVsCodeUri, 20, 20);
        const itemB = createMockCallHierarchyItem('methodB', VSCodeSymbolKind.Method, fakeVsCodeUri, 30, 30);
        executeCommandStubOnMock.withArgs(
            'vscode.prepareCallHierarchy',
            sinon.match((uri: vscode.Uri) => uri && uri.fsPath === fakeVsCodeUri.fsPath, "URI fsPath match"),
            sinon.match((pos: vscode.Position) => pos && pos.line === fakeVsCodePosition.line && pos.character === fakeVsCodePosition.character, "Position line/char match")
        ).resolves([rootItem]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', rootItem).resolves([createMockOutgoingCall(itemA)]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', itemA).resolves([createMockOutgoingCall(itemB)]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', itemB).resolves([createMockOutgoingCall(itemA)]);
        const result = await buildCallHierarchyTree(mockCommandExecutor, iFakeUri, iFakePosition, mockLogger, mockTokenAdapter);
        assert.ok(result);
        assert.strictEqual(result?.children.length, 1, 'Root should have one child (A)');
        assert.strictEqual(result?.children[0].item.name, 'methodA');
        assert.strictEqual(result?.children[0].children.length, 1, 'MethodA should have one child (B)');
        assert.strictEqual(result?.children[0].children[0].item.name, 'methodB');
        assert.strictEqual(result?.children[0].children[0].children.length, 0, 'MethodB should have no children as its child (A) is a cycle');
        assert.ok(mockLogger.logUsage.calledWith('expandOutgoingCallsRecursive',
            sinon.match({ status: 'cycle_child_skipped', childName: 'methodA', parentName: 'methodB' })),
            'Cycle child skipped log for A (child of B) should be present');
        assert.ok(mockLogger.logUsage.neverCalledWith('expandOutgoingCallsRecursive',
            sinon.match({ status: 'cycle_detected_current_node', itemName: 'methodA' })),
            'methodA should not log cycle_detected_current_node when being skipped as a child of B');
    });

    test('should stop expansion if cancellation is requested during recursion', async () => {
        const fakeVsCodePosition = new vscode.Position(10, 1);
        const iFakePosition: IPosition = fromVscodePosition(fakeVsCodePosition);
        const child1 = createMockCallHierarchyItem('child1', VSCodeSymbolKind.Method, fakeVsCodeUri, 20, 20);
        const child2 = createMockCallHierarchyItem('child2_not_expanded', VSCodeSymbolKind.Method, fakeVsCodeUri, 30, 30);
        executeCommandStubOnMock.withArgs(
            'vscode.prepareCallHierarchy',
            sinon.match((uri: vscode.Uri) => uri && uri.fsPath === fakeVsCodeUri.fsPath, "URI fsPath match"),
            sinon.match((pos: vscode.Position) => pos && pos.line === fakeVsCodePosition.line && pos.character === fakeVsCodePosition.character, "Position line/char match")
        ).resolves([rootItem]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', rootItem).resolves([createMockOutgoingCall(child1)]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', child1)
            .callsFake(async () => {
                mockVsCodeToken.isCancellationRequested = true; // Set on the original token
                return [createMockOutgoingCall(child2)];
            });
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', child2).resolves([]);
        const result = await buildCallHierarchyTree(mockCommandExecutor, iFakeUri, iFakePosition, mockLogger, mockTokenAdapter);
        assert.ok(result, 'Result should exist');
        assert.strictEqual(result?.children.length, 1, 'Root should have child1');
        assert.strictEqual(result?.children[0].item.name, 'child1', 'First child should be child1');
        assert.strictEqual(result?.children[0].children.length, 0, 'child1 should have no children due to cancellation after its fetch');
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match(obj =>
            obj.status === 'completed_cancelled_during_expansion' || obj.status === 'completed_cancelled_early_in_expansion'
        )), 'Build tree should log a cancellation status');
        assert.ok(mockLogger.logUsage.calledWith('expandOutgoingCallsRecursive',
            sinon.match({ status: 'cancelled_after_fetch', itemName: 'child1' })),
            'expandOutgoingCallsRecursive for child1 should log cancelled_after_fetch');
    });

    test('should handle error during provideOutgoingCalls in recursion', async () => {
        const fakeVsCodePosition = new vscode.Position(10, 1);
        const iFakePosition: IPosition = fromVscodePosition(fakeVsCodePosition);
        const childWithError = createMockCallHierarchyItem('childWithError', VSCodeSymbolKind.Method, fakeVsCodeUri, 20, 20);
        const healthyChild = createMockCallHierarchyItem('healthyChild', VSCodeSymbolKind.Method, fakeVsCodeUri, 30, 30);
        const fetchError = new Error('LSP error providing outgoing calls');
        executeCommandStubOnMock.withArgs(
            'vscode.prepareCallHierarchy',
            sinon.match((uri: vscode.Uri) => uri && uri.fsPath === fakeVsCodeUri.fsPath, "URI fsPath match"),
            sinon.match((pos: vscode.Position) => pos && pos.line === fakeVsCodePosition.line && pos.character === fakeVsCodePosition.character, "Position line/char match")
        ).resolves([rootItem]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', rootItem).resolves([
            createMockOutgoingCall(childWithError),
            createMockOutgoingCall(healthyChild)
        ]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', childWithError).rejects(fetchError);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', healthyChild).resolves([]);
        const result = await buildCallHierarchyTree(mockCommandExecutor, iFakeUri, iFakePosition, mockLogger, mockTokenAdapter);
        assert.ok(result);
        const errorNode = result?.children.find(c => c.item.name === 'childWithError');
        const healthyNode = result?.children.find(c => c.item.name === 'healthyChild');
        assert.ok(errorNode, 'Child with error should exist in tree');
        assert.strictEqual(errorNode?.children.length, 0, 'Child with error should not have expanded children');
        assert.ok(healthyNode, 'Healthy child should exist in tree');
        assert.strictEqual(healthyNode?.children.length, 0, 'Healthy child should have no further children as per mock');
        assert.ok(mockLogger.logError.calledWith(fetchError, sinon.match({ stage: 'fetchOutgoingCalls', itemName: 'childWithError' })));
        assert.ok(mockLogger.logUsage.calledWith('fetchOutgoingCalls', sinon.match({ itemName: 'healthyChild', status: 'success' })));
    });
});
