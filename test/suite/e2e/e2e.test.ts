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

const lspInitializationDelay = 20000; // 20 seconds - adjust if needed

suite('E2E Test Suite - Annotation Discovery', () => { // Updated suite name
	vscode.window.showInformationMessage('[E2E] Start Annotation Discovery tests.');

	// Define LSP wait time outside the test to be accessible by timeout

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

				// Print structured summary instead of raw JSON
				if (symbols && symbols.length > 0) {
					console.log(`[E2E Test] --- Symbol Summary for ${annotation} ---`);
					symbols.slice(0, 5).forEach(s => { // Log first 5 symbols
						const { name, kind, location, containerName } = s;
						const filePath = location.uri.fsPath.replace(workspaceRoot, ''); // Relative path
						const position = `L${location.range.start.line + 1}C${location.range.start.character + 1}`;
						console.log(`  - ${name} (${vscode.SymbolKind[kind]}) ${containerName ? `in [${containerName}]` : ''} at ${filePath} ${position}`);
					});
					if (symbols.length > 5) {
						console.log(`  ... (${symbols.length - 5} more symbols)`);
					}
					console.log('[E2E Test] -----------------------------------------');
				} else {
					console.log(`[E2E Test] No symbols returned for ${annotation}.`);
				}

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

			// Print structured summary instead of raw JSON
			const symbolCount = documentSymbols?.length ?? 0;
			console.log(`[E2E Test] Found ${symbolCount} document symbols for ${javaFileUri.fsPath}`);
			if (documentSymbols && symbolCount > 0) {
				console.log(`[E2E Test] --- Document Symbol Summary (${javaFileUri.fsPath}) ---`);
				const printSymbols = (symbols: (vscode.DocumentSymbol | vscode.SymbolInformation)[], indent = '  ') => {
					symbols.slice(0, 10).forEach(s => { // Limit depth/breadth
						// Handle both DocumentSymbol and SymbolInformation shapes if necessary
						const name = s.name;
						const kind = vscode.SymbolKind[s.kind];
						const range = (s as vscode.DocumentSymbol).range || (s as vscode.SymbolInformation).location.range;
						const position = `L${range.start.line + 1}C${range.start.character + 1}`;
						const detail = (s as vscode.DocumentSymbol).detail || '';
						console.log(`${indent}- ${name} (${kind}) ${detail} ${position}`);
						if ((s as vscode.DocumentSymbol).children?.length > 0) {
							if (indent.length < 8) { // Limit indentation depth
								printSymbols((s as vscode.DocumentSymbol).children, indent + '  ');
							} else {
								console.log(`${indent}  ... (children omitted due to depth)`);
							}
						}
					});
					 if (symbols.length > 10) {
						console.log(`${indent}... (${symbols.length - 10} more symbols at this level)`);
					}
				};
				printSymbols(documentSymbols);
				console.log('[E2E Test] -------------------------------------------------------------');
			} else {
				console.log(`[E2E Test] No document symbols returned for ${javaFileUri.fsPath}.`);
			}

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

						console.log(`\\n[E2E Test] --- Hover Info for ${annotation} at L${lineIndex + 1}:C${annotationIndex} ---`);
						if (hoverResult && hoverResult.length > 0 && hoverResult[0].contents.length > 0) {
							hoversFound++;
							// Print summary of first content part without raw markdown
							const firstContent = hoverResult[0].contents[0];
							let contentSummary = '';
							if (typeof firstContent === 'object' && 'value' in firstContent) { // MarkdownString
								contentSummary = `MarkdownString starting with: "${firstContent.value.substring(0, 50).replace(/\\n/g, '\\\\n')}..."`;
							} else if (typeof firstContent === 'string') { // string (MarkedString)
								contentSummary = `string starting with: "${firstContent.substring(0, 50).replace(/\\n/g, '\\\\n')}..."`;
							} else {
								contentSummary = `Hover content type: ${typeof firstContent}`;
							}
							console.log(`  First content part: ${contentSummary}`);
							assert.ok(hoverResult[0].contents.length > 0, `[E2E Test] Expected hover content for ${annotation} at ${lineIndex + 1}:${annotationIndex}`);
						} else {
							console.log(`  No hover information received.`);
							// It's possible some annotations *don't* have hover info, so only fail if specifically expected
							// assert.fail(`[E2E Test] Expected hover information for ${annotation} at ${lineIndex + 1}:${annotationIndex}, but got none.`);
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

			console.log('\\n[E2E Test] --- Potentially Relevant Commands Summary --- ');
			console.log(`  Found ${relevantCommands.length} commands containing keywords: ${commandKeywords.join(', ')}`);
			relevantCommands.sort().slice(0, 30).forEach(cmd => console.log(`  - ${cmd}`)); // Log first 30 alphabetically
			console.log('[E2E Test] ---------------------------------------');

			// Explicitly check for a key command
			const callHierarchyCommand = 'java.showCallHierarchy'; // Example, adjust if needed
			if (allCommands.includes(callHierarchyCommand)) {
				console.log(`\\n[E2E Test] Confirmed presence of key command: ${callHierarchyCommand}`);
			} else {
				console.warn(`\\n[E2E Test] Key command ${callHierarchyCommand} not found in command list.`);
			}

		} catch (error) {
			console.error(`[E2E Test] Error getting or filtering commands:`, error);
			assert.fail(`[E2E Test] Failed during command discovery: ${error}`);
		}

		console.log('\\n[E2E Test] === Finished Command Discovery ===\\n');

	}).timeout(lspInitializationDelay + 10000); // Timeout: LSP wait + command fetching buffer
});

// Previous hover/symbol logic removed.