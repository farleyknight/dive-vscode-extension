import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

// List of annotations to discover via LSP
const springAnnotations = [
	'@RestController',
	'@Controller', // Note: We'll need to check LSP results for how `@ResponseBody` might be represented
	'@RequestMapping',
	'@GetMapping',
	'@PostMapping',
	'@PutMapping',
	'@DeleteMapping',
	'@PatchMapping',
];

// List of annotations to look for on lines (simple string matching)
const mappingAnnotations = [
	'@RestController',
	'@RequestMapping',
	'@GetMapping',
	'@PostMapping',
	'@PutMapping',
	'@DeleteMapping',
	'@PatchMapping',
];

// Keywords to filter command list (adjust as needed)
const commandKeywords = [
	'java',
	'spring',
	'symbol',
	'endpoint',
	'mapping',
	'reference',
	'navigate',
	'annotation'
];

suite('E2E Test Suite - Annotation Discovery', () => { // Updated suite name
	vscode.window.showInformationMessage('[E2E] Start Annotation Discovery tests.');

	// Define LSP wait time outside the test to be accessible by timeout
	const lspInitializationDelay = 30000; // 30 seconds - adjust if needed

	test('Should discover Spring Boot annotations using LSP', async () => {
		console.log('[E2E Test] Starting test: Should discover Spring Boot annotations...');
		// Ensure a workspace folder is open
		assert.ok(vscode.workspace.workspaceFolders, "[E2E Test] No workspace folder found. E2E tests require a workspace.");
		assert.strictEqual(vscode.workspace.workspaceFolders.length, 1, "[E2E Test] Expected exactly one workspace folder for E2E tests.");
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		console.log(`[E2E Test] Workspace root: ${workspaceRoot}`);

		// Using TestController.java as it has multiple annotations
		const javaFixturePath = path.join(workspaceRoot, 'src/main/java/com/example/testfixture/TestController.java');
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
		// This is a simple delay. A more robust mechanism (e.g., waiting for language
		// status changes, specific diagnostic updates, or extension readiness APIs if
		// available) would be preferable in a production-grade test suite.
		// The Java LS can be slow, especially on first activation or in resource-constrained CI environments.
		console.log(`[E2E Test] Waiting ${lspInitializationDelay}ms for LSP initialization...`);
		await new Promise(resolve => setTimeout(resolve, lspInitializationDelay));
		console.log('[E2E Test] LSP initialization wait finished.');

		// Execute LSP workspace symbol provider for each annotation
		console.log('\\n[E2E Test] === Executing Workspace Symbol Provider for Annotations ===');
		for (const annotation of springAnnotations) {
			try {
				console.log(`\\n[E2E Test] Querying for: "${annotation}"...`);
				// Remove the '@' prefix for the LSP query, as it might not work with it.
				const query = annotation.startsWith('@') ? annotation.substring(1) : annotation;
				console.log(`[E2E Test] Actual LSP query: "${query}"`);
				const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
					'vscode.executeWorkspaceSymbolProvider',
					query // Use the annotation name *without* the '@' prefix
				);

				// Log the count and the raw response
				const symbolCount = symbols?.length ?? 0;
				console.log(`[E2E Test] Found ${symbolCount} symbols for ${annotation}`);
				console.log(`\\n[E2E Test] --- Raw LSP Response for ${annotation} ---`);
				console.log(JSON.stringify(symbols || '[]', null, 2)); // Log the raw JSON or '[]' if null/undefined
				console.log('[E2E Test] -----------------------------------------');

				// Verify that the LSP found at least one symbol for the annotation
				assert.ok(symbolCount > 0, `[E2E Test] Expected to find at least one symbol for ${annotation}, but found ${symbolCount}`);

			} catch (error) {
				console.error(`[E2E Test] Error executing workspace symbol provider or asserting for ${annotation}:`, error);
				// Fail the test if an error occurs during execution or assertion
				assert.fail(`[E2E Test] Failed during processing for ${annotation}: ${error}`);
			}
		}
		console.log('\\n[E2E Test] === Finished Querying Annotations ===\\n');

		// // Document Symbol Provider is less likely to directly find annotations across files,
		// // so we focus on Workspace Symbols for this discovery task.
		// try {
		// 	console.log('[E2E Test] Executing vscode.executeDocumentSymbolProvider...');
		// 	if (!document) {
		// 		assert.fail('[E2E Test] Document was not successfully opened earlier');
		// 	}
		// 	const documentSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[] | vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri);
		// 	console.log('\\n[E2E Test] --- Found Document Symbols ---');
		// 	console.log(JSON.stringify(documentSymbols, null, 2));
		// 	console.log('[E2E Test] ---------------------------');
		// 	assert.ok(documentSymbols !== undefined, '[E2E Test] executeDocumentSymbolProvider returned undefined');
		// 	assert.ok(Array.isArray(documentSymbols), '[E2E Test] Expected document symbols to be an array');
		// } catch (error) {
		// 	console.error('[E2E Test] Error executing document symbol provider:', error);
		// 	assert.fail(`[E2E Test] Failed to execute document symbol provider: ${error}`);
		// }


	}).timeout(lspInitializationDelay + 15000); // Increase timeout: LSP wait + buffer
});

// Helper function removed as it's not used in the modified test focused on workspace symbols for annotations.
// function findSymbolByName(...) { ... }

suite('E2E Test Suite - Document Symbol Discovery', () => { // Updated suite name
	vscode.window.showInformationMessage('[E2E] Start Document Symbol tests.');

	// Define LSP wait time outside the test to be accessible by timeout
	const lspInitializationDelay = 30000; // 30 seconds - adjust if needed

	test('Should discover symbols in TestController.java using LSP', async () => { // Updated test name
		console.log('[E2E Test] Starting test: Should discover document symbols...');
		// Ensure a workspace folder is open
		assert.ok(vscode.workspace.workspaceFolders, "[E2E Test] No workspace folder found. E2E tests require a workspace.");
		assert.strictEqual(vscode.workspace.workspaceFolders.length, 1, "[E2E Test] Expected exactly one workspace folder for E2E tests.");
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		console.log(`[E2E Test] Workspace root: ${workspaceRoot}`);

		// Using TestController.java as it has multiple annotations
		const javaFixturePath = path.join(workspaceRoot, 'src/main/java/com/example/testfixture/TestController.java');
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
		// This is a simple delay. A more robust mechanism (e.g., waiting for language
		// status changes, specific diagnostic updates, or extension readiness APIs if
		// available) would be preferable in a production-grade test suite.
		// The Java LS can be slow, especially on first activation or in resource-constrained CI environments.
		console.log(`[E2E Test] Waiting ${lspInitializationDelay}ms for LSP initialization...`);
		await new Promise(resolve => setTimeout(resolve, lspInitializationDelay));
		console.log('[E2E Test] LSP initialization wait finished.');

		// Execute Document Symbol Provider for the opened Java file
		console.log('\\n[E2E Test] === Executing Document Symbol Provider ===');
		try {
			console.log(`\\n[E2E Test] Querying document symbols for: ${javaFileUri.fsPath}...`);
			if (!document) {
				assert.fail('[E2E Test] Document was not successfully opened earlier');
			}

			// Use executeDocumentSymbolProvider to get symbols within the specific file
			const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | vscode.SymbolInformation[]>(
				'vscode.executeDocumentSymbolProvider',
				document.uri
			);

			console.log(`\\n[E2E Test] --- Raw LSP Response for Document Symbols (${javaFileUri.fsPath}) ---`);
			console.log(JSON.stringify(documentSymbols || '[]', null, 2)); // Log the raw JSON or '[]' if null/undefined
			console.log('[E2E Test] -------------------------------------------------------------');

			// Basic assertion: Check if the command returned an array
			assert.ok(Array.isArray(documentSymbols), `[E2E Test] Expected document symbols for ${javaFileUri.fsPath} to be an array`);

		} catch (error) {
			console.error(`[E2E Test] Error executing document symbol provider or asserting for ${javaFileUri.fsPath}:`, error);
			// Fail the test if an error occurs
			assert.fail(`[E2E Test] Failed during document symbol processing for ${javaFileUri.fsPath}: ${error}`);
		}
		console.log('\\n[E2E Test] === Finished Document Symbol Query ===\\n');

	}).timeout(lspInitializationDelay + 15000); // Increase timeout: LSP wait + buffer
});

// Helper function removed as it's not used.
// function findSymbolByName(...) { ... }

suite('E2E Test Suite - Hover Provider Discovery', () => { // Updated suite name
	vscode.window.showInformationMessage('[E2E] Start Hover Provider tests.');

	// Define LSP wait time outside the test to be accessible by timeout
	const lspInitializationDelay = 30000; // 30 seconds - adjust if needed

	test('Should get hover info for Spring annotations using LSP', async () => { // Updated test name
		console.log('[E2E Test] Starting test: Should get hover info...');
		// Ensure a workspace folder is open
		assert.ok(vscode.workspace.workspaceFolders, "[E2E Test] No workspace folder found. E2E tests require a workspace.");
		assert.strictEqual(vscode.workspace.workspaceFolders.length, 1, "[E2E Test] Expected exactly one workspace folder for E2E tests.");
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		console.log(`[E2E Test] Workspace root: ${workspaceRoot}`);

		// Using TestController.java as it has multiple annotations
		const javaFixturePath = path.join(workspaceRoot, 'src/main/java/com/example/testfixture/TestController.java');
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

		if (!document) {
			assert.fail('[E2E Test] Document was not opened successfully, cannot proceed.');
		}

		// Wait for LSP to initialize
		console.log(`[E2E Test] Waiting ${lspInitializationDelay}ms for LSP initialization...`);
		await new Promise(resolve => setTimeout(resolve, lspInitializationDelay));
		console.log('[E2E Test] LSP initialization wait finished.');

		// Iterate through lines and execute Hover Provider for annotations
		console.log('\\n[E2E Test] === Executing Hover Provider for Annotations ===');
		const lineCount = document.lineCount;
		let hoversFound = 0;

		for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
			const line = document.lineAt(lineIndex);
			for (const annotation of mappingAnnotations) {
				const annotationIndex = line.text.indexOf(annotation);
				if (annotationIndex !== -1) {
					const position = new vscode.Position(lineIndex, annotationIndex + 1); // Position slightly into the annotation
					console.log(`\\n[E2E Test] Found ${annotation} on line ${lineIndex + 1}, column ${annotationIndex}. Triggering hover at ${position.line + 1}:${position.character}...`);

					try {
						const hoverResult = await vscode.commands.executeCommand<vscode.Hover[]>(
							'vscode.executeHoverProvider',
							document.uri,
							position
						);

						console.log(`\\n[E2E Test] --- Raw LSP Hover Response for ${annotation} at ${lineIndex + 1}:${annotationIndex} ---`);
						// Hover result is an array, potentially empty. Log its contents.
						if (hoverResult && hoverResult.length > 0) {
							hoversFound++;
							// Process and log hover contents (often MarkdownString)
							hoverResult.forEach((hover, index) => {
								console.log(`[Hover ${index + 1}/${hoverResult.length}]:`);
								hover.contents.forEach((content, contentIndex) => {
									if (typeof content === 'object' && 'value' in content) { // Handle MarkdownString
										console.log(`  Content ${contentIndex + 1}: ${JSON.stringify(content.value)}`);
									} else {
										console.log(`  Content ${contentIndex + 1}: ${JSON.stringify(content)}`); // Handle other potential types
									}
								});
							});
						} else {
							console.log("(No hover information returned)");
						}
						console.log('[E2E Test] -------------------------------------------------------------');

					} catch (error) {
						console.error(`[E2E Test] Error executing hover provider for ${annotation} at ${lineIndex + 1}:${annotationIndex}:`, error);
						// Don't fail the whole test, just log and continue
					}
					// Avoid triggering hover multiple times if multiple annotations are on the same line (unlikely for mapping)
					break;
				}
			}
		}

		console.log('\\n[E2E Test] === Finished Hover Provider Queries ===\\n');
		// Basic assertion: check if we got any hover results at all
		assert.ok(hoversFound > 0, `[E2E Test] Expected to find at least one hover result for annotations in ${javaFileUri.fsPath}, but found ${hoversFound}`);

	}).timeout(lspInitializationDelay + 20000); // Increase timeout slightly more for potentially many hover calls
});

// Helper function removed.

suite('E2E Test Suite - Command Discovery', () => { // Updated suite name
	vscode.window.showInformationMessage('[E2E] Start Command Discovery tests.');

	// Define LSP wait time outside the test to be accessible by timeout
	const lspInitializationDelay = 30000; // 30 seconds - adjust if needed

	test('Should list potentially relevant Java/Spring commands', async () => { // Updated test name
		console.log('[E2E Test] Starting test: Should list commands...');
		// Ensure a workspace folder is open
		assert.ok(vscode.workspace.workspaceFolders, "[E2E Test] No workspace folder found. E2E tests require a workspace.");
		assert.strictEqual(vscode.workspace.workspaceFolders.length, 1, "[E2E Test] Expected exactly one workspace folder for E2E tests.");
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		console.log(`[E2E Test] Workspace root: ${workspaceRoot}`);

		// Using TestController.java to ensure Java extension activates
		const javaFixturePath = path.join(workspaceRoot, 'src/main/java/com/example/testfixture/TestController.java');
		const javaFileUri = vscode.Uri.file(javaFixturePath);
		let document: vscode.TextDocument | undefined;

		console.log(`[E2E Test] Attempting to open: ${javaFileUri.fsPath} to activate Java extension...`);

		try {
			document = await vscode.workspace.openTextDocument(javaFileUri);
			console.log(`[E2E Test] Successfully opened document: ${document.uri.fsPath}`);
			await vscode.window.showTextDocument(document);
			console.log('[E2E Test] Document shown in editor.');
		} catch (error) {
			console.error(`[E2E Test] Failed to open or show document: ${javaFileUri.fsPath}`, error);
			assert.fail(`[E2E Test] Failed to open Java file: ${error}`);
		}

		if (!document) {
			assert.fail('[E2E Test] Document was not opened successfully, cannot proceed.');
		}

		// Wait for LSP to initialize and register commands
		console.log(`[E2E Test] Waiting ${lspInitializationDelay}ms for LSP initialization and command registration...`);
		await new Promise(resolve => setTimeout(resolve, lspInitializationDelay));
		console.log('[E2E Test] LSP initialization wait finished.');

		// Get and filter available commands
		console.log('\\n[E2E Test] === Getting Available Commands ===');
		try {
			const allCommands = await vscode.commands.getCommands(true); // Get all commands
			assert.ok(Array.isArray(allCommands) && allCommands.length > 0, '[E2E Test] Failed to retrieve any commands.');

			console.log(`[E2E Test] Retrieved ${allCommands.length} total commands. Filtering...`);

			const relevantCommands = allCommands.filter(cmd =>
				commandKeywords.some(keyword => cmd.toLowerCase().includes(keyword))
			);

			console.log('\\n[E2E Test] --- Potentially Relevant Commands --- ');
			if (relevantCommands.length > 0) {
				console.log(JSON.stringify(relevantCommands.sort(), null, 2));
			} else {
				console.log("(No commands found matching keywords)");
			}
			console.log('[E2E Test] ---------------------------------------');

			// Optional: Add an assertion here if you expect specific commands to exist
			// assert.ok(relevantCommands.includes('some.expected.java.command'), 'Expected command not found');

		} catch (error) {
			console.error(`[E2E Test] Error getting or filtering commands:`, error);
			assert.fail(`[E2E Test] Failed during command discovery: ${error}`);
		}

		console.log('\\n[E2E Test] === Finished Command Discovery ===\\n');

	}).timeout(lspInitializationDelay + 10000); // Timeout: LSP wait + command fetching buffer
});

// Previous hover/symbol logic removed.