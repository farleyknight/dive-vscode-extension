import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('E2E Test Suite', () => {
	vscode.window.showInformationMessage('[E2E] Start tests.'); // Added tag

	// test('Sample test', () => {
	// 	assert.strictEqual(-1, [1, 2, 3].indexOf(5));
	// 	assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	// });

	// Add E2E tests here that interact with the test workspace and LSP
	test('Should open Java file, wait for LSP, and find symbols', async () => {
		console.log('[E2E Test] Starting test: Should open Java file...');
		// Ensure a workspace folder is open
		assert.ok(vscode.workspace.workspaceFolders, "[E2E Test] No workspace folder found. E2E tests require a workspace.");
		assert.strictEqual(vscode.workspace.workspaceFolders.length, 1, "[E2E Test] Expected exactly one workspace folder for E2E tests.");
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		console.log(`[E2E Test] Workspace root: ${workspaceRoot}`);

		// Determine the path to a specific Java file within the fixtures
		// Using TestController.java as it has multiple annotations
		const javaFixturePath = path.join(workspaceRoot, 'src/main/java/com/example/testfixture/TestController.java'); // Corrected path
		const javaFileUri = vscode.Uri.file(javaFixturePath);
		let document: vscode.TextDocument | undefined;

		console.log(`[E2E Test] Attempting to open: ${javaFileUri.fsPath}`);

		try {
			document = await vscode.workspace.openTextDocument(javaFileUri);
			console.log(`[E2E Test] Successfully opened document: ${document.uri.fsPath}`);
			await vscode.window.showTextDocument(document);
			console.log('[E2E Test] Document shown in editor.');
		} catch (error) {
			console.error(`[E2E Test] Failed to open or show document: ${javaFileUri.fsPath}`, error);
			assert.fail(`[E2E Test] Failed to open Java file: ${error}`);
		}

		// Wait for LSP to initialize (important!)
		// This is a simple delay, a more robust mechanism might be needed.
		// E.g., checking for language client readiness or specific extension activation.
		// Increased delay significantly as Java LS can be slow, especially on first activation.
		const lspInitializationDelay = 30000; // 30 seconds
		console.log(`[E2E Test] Waiting ${lspInitializationDelay}ms for LSP initialization...`);
		await new Promise(resolve => setTimeout(resolve, lspInitializationDelay));
		console.log('[E2E Test] LSP initialization wait finished.');

		// Execute LSP command (example: find workspace symbols for a specific controller)
		try {
			const targetSymbolName = 'TestController';
			console.log(`\n[E2E Test] Executing vscode.executeWorkspaceSymbolProvider for "${targetSymbolName}"...`);
			const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>('vscode.executeWorkspaceSymbolProvider', targetSymbolName);
			console.log(`\n[E2E Test] --- Found Symbols for ${targetSymbolName} ---`);
			console.log(JSON.stringify(symbols, null, 2));
			console.log('[E2E Test] ---------------------\n');

			// Also try document symbol provider for the opened document
			console.log('[E2E Test] Executing vscode.executeDocumentSymbolProvider...');
			if (!document) {
				assert.fail('[E2E Test] Document was not successfully opened earlier');
			}
			const documentSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[] | vscode.DocumentSymbol[]>(
				'vscode.executeDocumentSymbolProvider',
				document.uri
			);
			console.log('\n[E2E Test] --- Found Document Symbols ---');
			// We need to search within the results for the target symbol
			const foundDocSymbol = findSymbolByName(documentSymbols, targetSymbolName);
			console.log(JSON.stringify(foundDocSymbol ? [foundDocSymbol] : [], null, 2)); // Log found symbol or empty array
			console.log('[E2E Test] ---------------------------\n');

			// Basic assertion: Check if workspace symbol provider returned results
			assert.ok(Array.isArray(symbols), '[E2E Test] Expected workspace symbols to be an array');
			// Add more specific assertions later based on expected symbols in TestController.java
			// assert.ok(symbols.length > 0, `[E2E Test] Should find at least one workspace symbol for ${targetSymbolName}`);

			// Basic assertion: Check if document symbol provider returned a valid result (array, even if empty)
			assert.ok(documentSymbols !== undefined, '[E2E Test] executeDocumentSymbolProvider returned undefined');
			assert.ok(Array.isArray(documentSymbols), '[E2E Test] Expected document symbols to be an array');
			// assert.ok(foundDocSymbol, `[E2E Test] Should find the document symbol for ${targetSymbolName}`);

			console.log('[E2E Test] Basic symbol assertions passed.');

		} catch (error) {
			console.error('[E2E Test] Error executing symbol provider:', error);
			assert.fail(`[E2E Test] Failed to execute symbol provider: ${error}`);
		}
	}).timeout(45000); // Increase overall test timeout to accommodate longer LSP wait
});

// Helper function to recursively find a symbol by name in DocumentSymbol[] or SymbolInformation[]
function findSymbolByName(symbols: (vscode.SymbolInformation | vscode.DocumentSymbol)[] | undefined, name: string): vscode.DocumentSymbol | vscode.SymbolInformation | undefined {
	if (!symbols) {
		return undefined;
	}
	for (const symbol of symbols) {
		if (symbol.name === name) {
			return symbol;
		}
		// If it's a DocumentSymbol, check its children recursively
		if ('children' in symbol && symbol.children) {
			const foundInChildren = findSymbolByName(symbol.children, name);
			if (foundInChildren) {
				return foundInChildren;
			}
		}
	}
	return undefined;
}