import * as assert from 'assert';
import * as vscode from 'vscode';
import { discoverEndpoints, EndpointInfo, parseMappingAnnotations } from '../../src/endpoint-discovery'; // Adjust path if needed
import * as sinon from 'sinon'; // Using sinon for mocking

// // Check the environment variable value - REMOVED
// console.log(`[endpoint-discovery.test.ts] Checking DIVE_TEST_GLOB: ${process.env.DIVE_TEST_GLOB}`);

// // Skip this entire suite if we are running E2E tests targeting a specific file - REMOVED
// const shouldSkip = !!process.env.DIVE_TEST_GLOB;

// suite(`Endpoint Discovery Suite${shouldSkip ? ' (Skipped in E2E specific run)' : ''}`, () => { // REMOVED condition
suite('Endpoint Discovery Suite', () => { // Standard suite definition
	// if (shouldSkip) { // REMOVED skip logic
	// 	console.log('Skipping Endpoint Discovery unit tests because DIVE_TEST_GLOB is set.');
	// 	return; // Exit the suite function early
	// }

	let sandbox: sinon.SinonSandbox;
	let executeCommandStub: sinon.SinonStub;

	setup(() => {
		// Create a sandbox for restoring mocks
		sandbox = sinon.createSandbox();
		// Stub vscode.commands.executeCommand
		executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');
	});

	teardown(() => {
		// Restore the original implementations
		sandbox.restore();
	});

	test('Should find @GetMapping combined with class-level @RequestMapping via LSP', async () => {
		// Arrange
		const mockUri = vscode.Uri.file('/path/to/mock/TestController.java');

		// 1. Mock `vscode.workspace.findFiles` to return our mock URI
		sandbox.stub(vscode.workspace, 'findFiles').resolves([mockUri]);

		// 2. Mock `vscode.workspace.openTextDocument`
		//    Make sure the `getText` method is implemented correctly for ranges.
		const mockDocumentContent = `
package com.example.test;

import org.springframework.web.bind.annotation.*;

// Line 4
@RestController // discoverEndpoints needs to find this
@RequestMapping("/api/class") // discoverEndpoints needs to find this
public class TestController { // Line 7 Definition starts

		// Line 9
    @GetMapping("/method") // discoverEndpoints needs to find this - Line 10
    public String getMethod() { // Line 11 Definition starts
        return "Hello GET";
    }

		// Line 15
		@PostMapping("/otherMethod") // discoverEndpoints needs to find this - Line 16
		public String postMethod() { // Line 17 Definition starts
				return "Hello POST";
		}
}
`;
		// Use a more robust getText mock that handles ranges correctly
		const mockTextDocument = {
			uri: mockUri,
			lineCount: mockDocumentContent.split('\n').length,
			getText: sinon.stub().callsFake((range?: vscode.Range) => {
				if (!range) {
					return mockDocumentContent;
				}
				// Simulate vscode's range behavior (exclusive end line)
				const lines = mockDocumentContent.split('\n');
				let text = '';
				for (let i = range.start.line; i <= range.end.line; i++) {
					if (i >= lines.length) break;
					const line = lines[i];
					const startChar = (i === range.start.line) ? range.start.character : 0;
					// End character is exclusive for substring, but inclusive for the loop
					const endChar = (i === range.end.line) ? range.end.character : line.length;
					text += line.substring(startChar, endChar) + (i < range.end.line ? '\n' : '');
				}
				// console.log(`[Mock getText] Range: L${range.start.line+1}C${range.start.character+1}-L${range.end.line+1}C${range.end.character+1} => "${text}"`);
				return text;
			}),
		} as unknown as vscode.TextDocument; // Cast to unknown first
		// Use a matcher for the URI in withArgs if direct comparison fails
		sandbox.stub(vscode.workspace, 'openTextDocument').withArgs(sinon.match((arg: vscode.Uri) => arg.fsPath === mockUri.fsPath)).resolves(mockTextDocument);


		// 3. Mock `vscode.commands.executeCommand` for `vscode.executeDocumentSymbolProvider`
		const classSymbolRange = new vscode.Range(7, 0, 19, 1);
		const getMethodSymbolRange = new vscode.Range(11, 4, 13, 5); // Adjusted start/end to cover definition
		const postMethodSymbolRange = new vscode.Range(17, 4, 19, 5); // Adjusted start/end to cover definition

		const classDocSymbol = new vscode.DocumentSymbol(
			'TestController',
			'com.example.test', // Detail
			vscode.SymbolKind.Class,
			classSymbolRange, // Full range of the class
			classSymbolRange // Selection range same as full range for class
			// No children array in constructor
		);
		// Assign children after construction
		classDocSymbol.children = [
				new vscode.DocumentSymbol(
					'getMethod',
					'() -> String', // Detail example
					vscode.SymbolKind.Method,
					getMethodSymbolRange,
					getMethodSymbolRange // Selection range
				),
				new vscode.DocumentSymbol(
					'postMethod',
					'() -> String', // Detail example
					vscode.SymbolKind.Method,
					postMethodSymbolRange,
					postMethodSymbolRange // Selection range
				)
			];

		const mockDocumentSymbols: vscode.DocumentSymbol[] = [classDocSymbol];

		executeCommandStub.withArgs('vscode.executeDocumentSymbolProvider', sinon.match((arg: vscode.Uri) => arg.fsPath === mockUri.fsPath)).resolves(mockDocumentSymbols);
		// Ensure other command calls don't interfere (or mock them specifically if needed)
		executeCommandStub.callThrough(); // Allow non-stubbed calls


		const expectedEndpoints: EndpointInfo[] = [
			{
				method: 'GET',
				path: '/api/class/method', // Combined path
				uri: mockUri,
				position: getMethodSymbolRange.start, // Position should be the *start* of the method symbol range
				handlerMethodName: 'getMethod'
			},
			{
			  method: 'POST',
			  path: '/api/class/otherMethod',
			  uri: mockUri,
			  position: postMethodSymbolRange.start, // Position should be the *start* of the method symbol range
			  handlerMethodName: 'postMethod'
			},
		];

		// Mock cancellation token
		const mockToken: vscode.CancellationToken = {
			isCancellationRequested: false,
			onCancellationRequested: sinon.stub().returns({ dispose: () => {} }) as any
		};

		// Act
		const actualEndpoints = await discoverEndpoints(mockToken); // Pass mock token

		// Log the actual endpoints found for better visibility
		console.log("\n--- Discovered Endpoints (Test Output) ---");
		console.log(JSON.stringify(actualEndpoints, (key, value) => {
			// Custom replacer to handle vscode.Uri and vscode.Position for cleaner logging
			if (value instanceof vscode.Uri) {
				return value.toString(); // Convert Uri to string
			}
			if (key === 'position' && value && typeof value === 'object' && 'line' in value && 'character' in value) {
				return `(L${value.line + 1}, C${value.character + 1})`; // Format Position
			}
			return value;
		}, 2));
		console.log("-----------------------------------------");

		// Assert
		// NOTE: This assertion will likely FAIL until discoverEndpoints is implemented
		//       to use the LSP symbols and parse document content for annotations.
		assert.strictEqual(actualEndpoints.length, expectedEndpoints.length, 'Number of endpoints found mismatch');

		if (actualEndpoints.length > 0 && expectedEndpoints.length > 0) {
			assert.strictEqual(actualEndpoints[0].method, expectedEndpoints[0].method, "Method mismatch for first endpoint");
			assert.strictEqual(actualEndpoints[0].path, expectedEndpoints[0].path, "Path mismatch for first endpoint");
			assert.strictEqual(actualEndpoints[0].handlerMethodName, expectedEndpoints[0].handlerMethodName, "Handler method name mismatch for first endpoint");
			assert.strictEqual(actualEndpoints[0].uri.toString(), expectedEndpoints[0].uri.toString(), "URI mismatch for first endpoint");
			assert.deepStrictEqual(actualEndpoints[0].position, expectedEndpoints[0].position, "Position mismatch for first endpoint");
		}

		if (actualEndpoints.length > 1 && expectedEndpoints.length > 1) {
			// Assertions for the second endpoint (POST)
			// Find the POST endpoint (order isn't guaranteed)
			const postEndpointExpected = expectedEndpoints.find(e => e.method === 'POST');
			const postEndpointActual = actualEndpoints.find(e => e.method === 'POST');
			assert.ok(postEndpointExpected, "Expected POST endpoint definition missing in test setup");
			assert.ok(postEndpointActual, "Actual POST endpoint not found by discovery logic");

			if(postEndpointActual && postEndpointExpected) { // Type guard
				assert.strictEqual(postEndpointActual.method, postEndpointExpected.method, "Method mismatch for second endpoint");
				assert.strictEqual(postEndpointActual.path, postEndpointExpected.path, "Path mismatch for second endpoint");
				assert.strictEqual(postEndpointActual.handlerMethodName, postEndpointExpected.handlerMethodName, "Handler method name mismatch for second endpoint");
				assert.strictEqual(postEndpointActual.uri.toString(), postEndpointExpected.uri.toString(), "URI mismatch for second endpoint");
				assert.deepStrictEqual(postEndpointActual.position, postEndpointExpected.position, "Position mismatch for second endpoint");
			}
		}
	});

	// TODO: Add more tests based on docs/next_steps.md
	// New suite specifically for testing the annotation parser
	suite('parseMappingAnnotations Suite', () => {

		test('Should parse basic @GetMapping', () => {
			const text = '@GetMapping("/users")';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'GET', paths: ['/users'] });
		});

		test('Should parse @PostMapping with value attribute', () => {
			const text = '@PostMapping(value = "/posts")';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'POST', paths: ['/posts'] });
		});

		test('Should parse @PutMapping with path attribute', () => {
			const text = '@PutMapping(path = "/items/{id}")';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'PUT', paths: ['/items/{id}'] });
		});

		test('Should parse @DeleteMapping with trailing slash in path', () => {
			const text = '@DeleteMapping("/tasks/")';
			const result = parseMappingAnnotations(text);
			// Path normalization happens later, parser returns raw path
			assert.deepStrictEqual(result, { httpMethod: 'DELETE', paths: ['/tasks/'] });
		});

		test('Should parse @PatchMapping with empty path', () => {
			const text = '@PatchMapping("")';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'PATCH', paths: [''] });
		});

		test('Should parse @RequestMapping with method and path', () => {
			const text = '@RequestMapping(value = "/orders", method = RequestMethod.POST)';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'POST', paths: ['/orders'] });
		});

		test('Should parse @RequestMapping with only path (default to GET)', () => {
			const text = '@RequestMapping("/products")';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'GET', paths: ['/products'] });
		});

		test('Should parse @RequestMapping with only method (default path /)', () => {
			const text = '@RequestMapping(method = RequestMethod.PUT)';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'PUT', paths: ['/'] }); // Default path
		});

		test('Should parse @RequestMapping without attributes (default GET, path /)', () => {
			const text = '@RequestMapping';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'GET', paths: ['/'] });
		});

		test('Should parse @GetMapping with multiple paths in value', () => {
			const text = '@GetMapping(value = {"/api/v1", "/api/latest"})';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'GET', paths: ['/api/v1', '/api/latest'] });
		});

		test('Should parse @PostMapping with multiple paths in path', () => {
			const text = '@PostMapping(path = {"/create", "/new"})';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'POST', paths: ['/create', '/new'] });
		});

		test('Should parse @RequestMapping with multiple paths and method', () => {
			const text = '@RequestMapping(path = {"/admin", "/config"}, method = RequestMethod.DELETE)';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'DELETE', paths: ['/admin', '/config'] });
		});

		test('Should parse @GetMapping with simple multiple paths', () => {
			const text = '@GetMapping({"/a", "/b"})';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'GET', paths: ['/a', '/b'] });
		});

		test('Should handle whitespace variations', () => {
			const text = ' @PutMapping ( path = { " / p1 " , "/p2" } ) ';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'PUT', paths: [' / p1 ', '/p2'] }); // Whitespace inside quotes is preserved
		});

		test('Should prioritize specific mapping over @RequestMapping', () => {
			const text = '@RequestMapping("/ignored")\n@GetMapping("/specific")';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'GET', paths: ['/specific'] });
		});

		test('Should handle multiple lines (basic)', () => {
			const text = `@PostMapping(
				value = "/multiline",
				// Some comment
				consumes = "application/json"
			)`;
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'POST', paths: ['/multiline'] }); // Ignores consumes for now
		});

		test('Should ignore non-mapping annotations', () => {
			const text = '@Deprecated\n@Autowired\n@GetMapping("/real")';
			const result = parseMappingAnnotations(text);
			assert.deepStrictEqual(result, { httpMethod: 'GET', paths: ['/real'] });
		});

		test('Should return null for no mapping annotations', () => {
			const text = '@Deprecated\npublic void someMethod() {}';
			const result = parseMappingAnnotations(text);
			assert.strictEqual(result, null);
		});

		test('Should return null for empty string', () => {
			const text = '';
			const result = parseMappingAnnotations(text);
			assert.strictEqual(result, null);
		});

        test('Should handle @RequestMapping with path array only', () => {
            const text = '@RequestMapping({"/c", "/d"})';
            const result = parseMappingAnnotations(text);
            assert.deepStrictEqual(result, { httpMethod: 'GET', paths: ['/c', '/d'] });
        });

        test('Should handle @GetMapping() with no path (defaults to /)', () => {
            const text = '@GetMapping()';
            const result = parseMappingAnnotations(text);
            assert.deepStrictEqual(result, { httpMethod: 'GET', paths: ['/'] });
        });

	});

	// ... other test cases
});