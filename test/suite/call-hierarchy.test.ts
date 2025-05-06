import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { buildCallHierarchyTree, CustomHierarchyNode } from '../../src/call-hierarchy'; // Adjust path

suite('Call Hierarchy Utility - buildCallHierarchyTree', () => {
    let sandbox: sinon.SinonSandbox;
    let mockLogger: any;
    let mockToken: vscode.CancellationToken;

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

        // Mock vscode.commands.executeCommand for call hierarchy related commands
        // This stub will be configured per test for specific command responses
        sandbox.stub(vscode.commands, 'executeCommand');
    });

    teardown(() => {
        sandbox.restore();
    });

    test('should successfully build a root node if prepareCallHierarchy succeeds', async () => {
        const fakeUri = vscode.Uri.file('/test/Controller.java');
        const fakePosition = new vscode.Position(15, 10);
        const callHierarchyItem: vscode.CallHierarchyItem = new vscode.CallHierarchyItem(
            vscode.SymbolKind.Method, 'getData', 'detail', fakeUri,
            new vscode.Range(new vscode.Position(14, 0), new vscode.Position(20, 1)),
            new vscode.Range(new vscode.Position(15, 10), new vscode.Position(15, 17))
        );

        (vscode.commands.executeCommand as sinon.SinonStub)
            .withArgs('vscode.prepareCallHierarchy', fakeUri, fakePosition)
            .resolves([callHierarchyItem]);

        const result = await buildCallHierarchyTree(fakeUri, fakePosition, mockLogger, mockToken);

        assert.ok(result, 'Result should not be null');
        assert.strictEqual(result?.item, callHierarchyItem, 'Root node item should be the prepared item');
        assert.strictEqual(result?.children.length, 0, 'Children should be empty for stub');
        assert.strictEqual(result?.parents.length, 0, 'Parents should be empty for stub');
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'started' })), 'Log should indicate started status');
        assert.ok(mockLogger.logUsage.calledWith('prepareInitialCallHierarchyItem', sinon.match({ status: 'success' })), 'prepareInitialCallHierarchyItem should log success');
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'completed_stub', itemName: 'getData' })), 'Log should indicate completed_stub status');
    });

    test('should return null if prepareCallHierarchy returns no items', async () => {
        const fakeUri = vscode.Uri.file('/test/Controller.java');
        const fakePosition = new vscode.Position(15, 10);

        (vscode.commands.executeCommand as sinon.SinonStub)
            .withArgs('vscode.prepareCallHierarchy', fakeUri, fakePosition)
            .resolves([]); // Empty array

        const result = await buildCallHierarchyTree(fakeUri, fakePosition, mockLogger, mockToken);

        assert.strictEqual(result, null, 'Result should be null if prepare returns no items');
        assert.ok(mockLogger.logUsage.calledWith('prepareInitialCallHierarchyItem', sinon.match({ status: 'no_items_returned' })), 'prepareInitialCallHierarchyItem should log no_items_returned');
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'initial_prepare_failed' })), 'Log should indicate initial_prepare_failed status');
    });

    test('should return null if prepareCallHierarchy throws an error', async () => {
        const fakeUri = vscode.Uri.file('/test/Controller.java');
        const fakePosition = new vscode.Position(15, 10);
        const prepareError = new Error('LSP prepare error');

        (vscode.commands.executeCommand as sinon.SinonStub)
            .withArgs('vscode.prepareCallHierarchy', fakeUri, fakePosition)
            .rejects(prepareError);

        const result = await buildCallHierarchyTree(fakeUri, fakePosition, mockLogger, mockToken);

        assert.strictEqual(result, null, 'Result should be null if prepare throws error');
        assert.ok(mockLogger.logError.calledWith(prepareError, sinon.match({ stage: 'prepareInitialCallHierarchyItem' })), 'logError should be called for prepare error');
        assert.ok(mockLogger.logUsage.calledWith('prepareInitialCallHierarchyItem', sinon.match({ status: 'error' })), 'prepareInitialCallHierarchyItem should log error status');
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'initial_prepare_failed' })), 'Log should indicate initial_prepare_failed status');
    });

    test('should return null if cancellation is requested before prepareCallHierarchy', async () => {
        const fakeUri = vscode.Uri.file('/test/Controller.java');
        const fakePosition = new vscode.Position(15, 10);
        mockToken.isCancellationRequested = true;

        const result = await buildCallHierarchyTree(fakeUri, fakePosition, mockLogger, mockToken);

        assert.strictEqual(result, null);
        assert.ok((vscode.commands.executeCommand as sinon.SinonStub).notCalled, 'executeCommand for prepareCallHierarchy should not be called');
        assert.ok(mockLogger.logUsage.calledWith('prepareInitialCallHierarchyItem', sinon.match({ status: 'cancelled_before_prepare' })));
        assert.ok(mockLogger.logUsage.calledWith('buildCallHierarchyTree', sinon.match({ status: 'cancelled_after_prepare' })), 'buildCallHierarchyTree should log cancelled_after_prepare');
        assert.ok(mockLogger.logUsage.neverCalledWith('buildCallHierarchyTree', sinon.match({ status: 'initial_prepare_failed' })), 'buildCallHierarchyTree should not log initial_prepare_failed on this path');
    });

    // Add more tests here for fetching incoming/outgoing calls once implemented
});
