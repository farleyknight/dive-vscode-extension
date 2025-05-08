import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { buildCallHierarchyTree, CustomHierarchyNode } from '../../src/call-hierarchy'; // Adjust path
import { ICommandExecutor } from '../../src/adapters/vscodeExecution'; // Added
import { VSCodeSymbolKind } from '../../src/adapters/vscodeTypes'; // Added

// Helper to create a mock CallHierarchyItem
const createMockCallHierarchyItem = (
    name: string,
    kind: VSCodeSymbolKind,
    uri: vscode.Uri,
    rangeLine: number, // Just line for simplicity in mock
    selRangeLine: number // Just line for simplicity in mock
): vscode.CallHierarchyItem => {
    return new vscode.CallHierarchyItem(
        kind as number,
        name,
        `detail for ${name}`,
        uri,
        new vscode.Range(new vscode.Position(rangeLine, 0), new vscode.Position(rangeLine + 1, 0)),
        new vscode.Range(new vscode.Position(selRangeLine, 0), new vscode.Position(selRangeLine, 5))
    );
};

// Helper to create a mock CallHierarchyOutgoingCall
const createMockOutgoingCall = (toItem: vscode.CallHierarchyItem): vscode.CallHierarchyOutgoingCall => {
    return new vscode.CallHierarchyOutgoingCall(
        toItem,
        [new vscode.Range(new vscode.Position(0,0), new vscode.Position(0,5))] // fromRanges, not critical for these tests
    );
};

suite('Call Hierarchy Utility - buildCallHierarchyTree', () => {
    let sandbox: sinon.SinonSandbox;
    let mockLogger: any;
    let mockToken: vscode.CancellationToken;
    let mockCommandExecutor: ICommandExecutor;
    let executeCommandStubOnMock: sinon.SinonStub;
    const fakeUri = vscode.Uri.file('/test/Controller.java');

    setup(() => {
        sandbox = sinon.createSandbox();
        mockLogger = {
            logUsage: sandbox.stub(),
            logError: sandbox.stub(),
        };
        mockToken = {
            isCancellationRequested: false,
            onCancellationRequested: sandbox.stub().returns({ dispose: () => {} }),
        } as any;

        executeCommandStubOnMock = sandbox.stub();
        mockCommandExecutor = {
            executeCommand: executeCommandStubOnMock
        };
    });

    teardown(() => {
        sandbox.restore();
    });

    const rootItem = createMockCallHierarchyItem('rootMethod', VSCodeSymbolKind.Method, fakeUri, 10, 10);

    test('should successfully build a root node if prepareCallHierarchy succeeds', async () => {
        const fakePosition = new vscode.Position(10, 1);
        executeCommandStubOnMock.withArgs('vscode.prepareCallHierarchy', fakeUri, fakePosition).resolves([rootItem]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', rootItem).resolves([]); // No outgoing calls for this test

        const result = await buildCallHierarchyTree(mockCommandExecutor, fakeUri, fakePosition, mockLogger, mockToken);

        assert.ok(result, 'Result should not be null');
        assert.strictEqual(result?.item, rootItem, 'Root node item should be the prepared item');
        assert.strictEqual(result?.children.length, 0, 'Children should be empty');
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'started' })));
        assert.ok(mockLogger.logUsage.calledWith('prepareInitialCallHierarchyItem', sinon.match({ status: 'success' })));
        assert.ok(mockLogger.logUsage.calledWith('fetchOutgoingCalls', sinon.match({ itemName: 'rootMethod', status: 'success', count: 0 })));
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'completed_successfully', itemName: 'rootMethod' })));
    });

    test('should return null if prepareCallHierarchy returns no items', async () => {
        const fakePosition = new vscode.Position(15, 10);
        executeCommandStubOnMock.withArgs('vscode.prepareCallHierarchy', fakeUri, fakePosition).resolves([]);

        const result = await buildCallHierarchyTree(mockCommandExecutor, fakeUri, fakePosition, mockLogger, mockToken);

        assert.strictEqual(result, null);
        assert.ok(mockLogger.logUsage.calledWith('prepareInitialCallHierarchyItem', sinon.match({ status: 'no_items_returned' })));
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'initial_prepare_failed' })));
    });

    test('should return null if prepareCallHierarchy throws an error', async () => {
        const fakePosition = new vscode.Position(15, 10);
        const prepareError = new Error('LSP prepare error');
        executeCommandStubOnMock.withArgs('vscode.prepareCallHierarchy', fakeUri, fakePosition).rejects(prepareError);

        const result = await buildCallHierarchyTree(mockCommandExecutor, fakeUri, fakePosition, mockLogger, mockToken);

        assert.strictEqual(result, null);
        assert.ok(mockLogger.logError.calledWith(prepareError, sinon.match({ stage: 'prepareInitialCallHierarchyItem' })));
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'initial_prepare_failed' })));
    });

    test('should return null if cancellation is requested before prepareCallHierarchy', async () => {
        const fakePosition = new vscode.Position(15, 10);
        mockToken.isCancellationRequested = true;

        const result = await buildCallHierarchyTree(mockCommandExecutor, fakeUri, fakePosition, mockLogger, mockToken);

        assert.strictEqual(result, null);
        assert.ok(executeCommandStubOnMock.withArgs('vscode.prepareCallHierarchy').notCalled, 'prepareCallHierarchy should not be called');
        assert.ok(mockLogger.logUsage.calledWith('prepareInitialCallHierarchyItem', sinon.match({ status: 'cancelled_before_prepare' })));
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'cancelled_after_prepare' })));
    });

    test('should build one level of outgoing calls', async () => {
        const fakePosition = new vscode.Position(10, 1);
        const child1Item = createMockCallHierarchyItem('child1Method', VSCodeSymbolKind.Method, fakeUri, 20, 20);
        const child2Item = createMockCallHierarchyItem('child2Method', VSCodeSymbolKind.Method, fakeUri, 30, 30);

        executeCommandStubOnMock.withArgs('vscode.prepareCallHierarchy', fakeUri, fakePosition).resolves([rootItem]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', rootItem).resolves([
            createMockOutgoingCall(child1Item),
            createMockOutgoingCall(child2Item)
        ]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', child1Item).resolves([]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', child2Item).resolves([]);

        const result = await buildCallHierarchyTree(mockCommandExecutor, fakeUri, fakePosition, mockLogger, mockToken);

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
        const fakePosition = new vscode.Position(10, 1);
        executeCommandStubOnMock.withArgs('vscode.prepareCallHierarchy', fakeUri, fakePosition).resolves([rootItem]);

        let currentItem = rootItem;
        // Create a chain such that level5 is the last one expanded (depth 4 call, leads to depth 5 node which doesn't expand)
        // MAX_DEPTH is 5. Root (depth 0) -> L1 (d1) -> L2 (d2) -> L3 (d3) -> L4 (d4) -> L5 (d5, doesn't expand children)
        for (let i = 0; i < 5; i++) { // Create L1, L2, L3, L4, L5
            const nextItem = createMockCallHierarchyItem(`level${i + 1}`, VSCodeSymbolKind.Method, fakeUri, 100 + i * 10, 100 + i * 10);
            executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', currentItem).resolves([createMockOutgoingCall(nextItem)]);
            currentItem = nextItem;
        }
        // level5 should not fetch its children (level6)
        const level6Item = createMockCallHierarchyItem('level6_not_fetched', VSCodeSymbolKind.Method, fakeUri, 200, 200);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', currentItem).resolves([createMockOutgoingCall(level6Item)]); // This is for level5 item

        const result = await buildCallHierarchyTree(mockCommandExecutor, fakeUri, fakePosition, mockLogger, mockToken);

        assert.ok(result);
        let node = result;
        let depth = 0;
        while(node && node.children.length > 0) {
            node = node.children[0];
            depth++;
        }
        assert.strictEqual(depth, 5, 'Effective depth of the tree should be 5 (root + 5 levels of children)');

        // Check logs
        assert.ok(mockLogger.logUsage.calledWith('fetchOutgoingCalls', sinon.match({ itemName: 'level4' })), 'Should have fetched calls for level4');
        assert.ok(mockLogger.logUsage.neverCalledWith('fetchOutgoingCalls', sinon.match({ itemName: 'level5' })), 'Should NOT have fetched calls for level5 due to depth limit');
        assert.ok(mockLogger.logUsage.neverCalledWith('fetchOutgoingCalls', sinon.match({ itemName: 'level6_not_fetched' })), 'Should NOT have fetched calls for level6');
        assert.ok(mockLogger.logUsage.calledWith('expandOutgoingCallsRecursive', sinon.match({ status: 'max_depth_reached', itemName: 'level5' })), 'Max depth should be logged for level5 expansion attempt');
    });

    test('should handle circular dependencies by not adding cyclic child', async () => {
        const fakePosition = new vscode.Position(10, 1);
        const itemA = createMockCallHierarchyItem('methodA', VSCodeSymbolKind.Method, fakeUri, 20, 20);
        const itemB = createMockCallHierarchyItem('methodB', VSCodeSymbolKind.Method, fakeUri, 30, 30);

        executeCommandStubOnMock.withArgs('vscode.prepareCallHierarchy', fakeUri, fakePosition).resolves([rootItem]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', rootItem).resolves([createMockOutgoingCall(itemA)]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', itemA).resolves([createMockOutgoingCall(itemB)]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', itemB).resolves([createMockOutgoingCall(itemA)]); // B calls A (cycle)

        const result = await buildCallHierarchyTree(mockCommandExecutor, fakeUri, fakePosition, mockLogger, mockToken);

        assert.ok(result);
        assert.strictEqual(result?.children.length, 1, 'Root should have one child (A)');
        assert.strictEqual(result?.children[0].item.name, 'methodA');
        assert.strictEqual(result?.children[0].children.length, 1, 'MethodA should have one child (B)');
        assert.strictEqual(result?.children[0].children[0].item.name, 'methodB');
        assert.strictEqual(result?.children[0].children[0].children.length, 0, 'MethodB should have no children as its child (A) is a cycle');

        assert.ok(mockLogger.logUsage.calledWith('expandOutgoingCallsRecursive',
            sinon.match({ status: 'cycle_child_skipped', childName: 'methodA', parentName: 'methodB' })),
            'Cycle child skipped log for A (child of B) should be present');

        // Ensure the original cycle detection for a node itself (if it were to happen) isn't falsely triggered here for the skipped child logic.
        assert.ok(mockLogger.logUsage.neverCalledWith('expandOutgoingCallsRecursive',
            sinon.match({ status: 'cycle_detected_current_node', itemName: 'methodA' })),
            'methodA should not log cycle_detected_current_node when being skipped as a child of B');
    });

    test('should stop expansion if cancellation is requested during recursion', async () => {
        const fakePosition = new vscode.Position(10, 1);
        const child1 = createMockCallHierarchyItem('child1', VSCodeSymbolKind.Method, fakeUri, 20, 20);
        const child2 = createMockCallHierarchyItem('child2_not_expanded', VSCodeSymbolKind.Method, fakeUri, 30, 30);

        executeCommandStubOnMock.withArgs('vscode.prepareCallHierarchy', fakeUri, fakePosition).resolves([rootItem]);

        // Root provides child1
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', rootItem).resolves([createMockOutgoingCall(child1)]);

        // When child1's outgoing calls are fetched, set cancellation
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', child1)
            .callsFake(async () => {
                mockToken.isCancellationRequested = true;
                return [createMockOutgoingCall(child2)]; // child1 would call child2
            });

        // child2 should never have its calls fetched
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', child2).resolves([]);

        const result = await buildCallHierarchyTree(mockCommandExecutor, fakeUri, fakePosition, mockLogger, mockToken);

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
        const fakePosition = new vscode.Position(10, 1);
        const childWithError = createMockCallHierarchyItem('childWithError', VSCodeSymbolKind.Method, fakeUri, 20, 20);
        const healthyChild = createMockCallHierarchyItem('healthyChild', VSCodeSymbolKind.Method, fakeUri, 30, 30);
        const fetchError = new Error('LSP error providing outgoing calls');

        executeCommandStubOnMock.withArgs('vscode.prepareCallHierarchy', fakeUri, fakePosition).resolves([rootItem]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', rootItem).resolves([
            createMockOutgoingCall(childWithError),
            createMockOutgoingCall(healthyChild)
        ]);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', childWithError).rejects(fetchError);
        executeCommandStubOnMock.withArgs('vscode.provideOutgoingCalls', healthyChild).resolves([]);

        const result = await buildCallHierarchyTree(mockCommandExecutor, fakeUri, fakePosition, mockLogger, mockToken);

        assert.ok(result);
        assert.strictEqual(result?.children.length, 2);
        const errorNode = result?.children.find(c => c.item.name === 'childWithError');
        const healthyNode = result?.children.find(c => c.item.name === 'healthyChild');
        assert.ok(errorNode, 'Child with error should exist in tree');
        assert.strictEqual(errorNode?.children.length, 0, 'Child with error should not have expanded children');
        assert.ok(healthyNode, 'Healthy child should exist in tree');
        assert.strictEqual(healthyNode?.children.length, 0, 'Healthy child should have no further children as per mock');

        assert.ok(mockLogger.logError.calledWith(fetchError, sinon.match({ stage: 'fetchOutgoingCalls', itemName: 'childWithError' })));
        assert.ok(mockLogger.logUsage.calledWith('fetchOutgoingCalls', sinon.match({ status: 'error', itemName: 'childWithError' })));
        assert.ok(mockLogger.logUsage.calledWith('fetchOutgoingCalls', sinon.match({ status: 'success', itemName: 'healthyChild', count: 0 })));
    });

});
