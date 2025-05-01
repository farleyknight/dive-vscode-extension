import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('E2E Test Suite', () => {
	vscode.window.showInformationMessage('Start E2E tests.');

	// test('Sample test', () => {
	// 	assert.strictEqual(-1, [1, 2, 3].indexOf(5));
	// 	assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	// });

	// Add E2E tests here that interact with the test workspace and LSP
	test('Should open Java file and wait for LSP', async () => {
		// Ensure a workspace folder is open
		assert.ok(vscode.workspace.workspaceFolders, "No workspace folder found. E2E tests require a workspace.");
		assert.strictEqual(vscode.workspace.workspaceFolders.length, 1, "Expected exactly one workspace folder for E2E tests.");
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

		// Open the Java file
		const javaFilePath = path.join(workspaceRoot, 'src/main/java/com/example/demo/DemoApplication.java');
		const javaFileUri = vscode.Uri.file(javaFilePath);
		let document: vscode.TextDocument | undefined;

		console.log(`Attempting to open: ${javaFileUri.fsPath}`);

		try {
			document = await vscode.workspace.openTextDocument(javaFileUri);
			console.log(`Successfully opened document: ${document.uri.fsPath}`);
			await vscode.window.showTextDocument(document);
			console.log('Document shown in editor.');
		} catch (error) {
			console.error(`Failed to open or show document: ${javaFileUri.fsPath}`, error);
			assert.fail(`Failed to open Java file: ${error}`);
		}

		// Wait for LSP to initialize (important!)
		// This is a simple delay, a more robust mechanism might be needed.
		// E.g., checking for language client readiness or specific extension activation.
		const lspInitializationDelay = 10000; // 10 seconds, adjust as needed
		console.log(`Waiting ${lspInitializationDelay}ms for LSP initialization...`);
		await new Promise(resolve => setTimeout(resolve, lspInitializationDelay));
		console.log('LSP initialization wait finished.');

		// Execute LSP command (example: find workspace symbols)
		try {
			console.log('\nExecuting vscode.executeWorkspaceSymbolProvider for "TestController"...');
			const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>('vscode.executeWorkspaceSymbolProvider', 'TestController');
			console.log('\n--- Found Symbols ---');
			console.log(JSON.stringify(symbols, null, 2));
			console.log('---------------------\n');

			// Also try document symbol provider
			console.log('Executing vscode.executeDocumentSymbolProvider...');
			if (!document) {
				assert.fail('Document was not successfully opened');
			}
			const documentSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[] | vscode.DocumentSymbol[]>(
				'vscode.executeDocumentSymbolProvider',
				document.uri
			);
			console.log('\n--- Found Document Symbols ---');
			// We need to search within the results for 'TestController'
			const foundDocSymbol = findSymbolByName(documentSymbols, 'TestController');
			console.log(JSON.stringify(foundDocSymbol ? [foundDocSymbol] : [], null, 2)); // Log found symbol or empty array
			console.log('---------------------------\n');

			// Basic assertion (can be expanded later)
			assert.ok(Array.isArray(symbols), 'Expected symbols to be an array');
			// assert.ok(symbols.length > 0, 'Should find at least one symbol for TestController'); // Add more specific assertions later
		} catch (error) {
			console.error('Error executing workspace symbol provider:', error);
			assert.fail(`Failed to execute workspace symbol provider: ${error}`);
		}
	}).timeout(20000); // Increase timeout for E2E test including LSP startup
});

// Helper function to recursively find a symbol by name in DocumentSymbol[]
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