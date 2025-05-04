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

		// 1. Mock vscode.executeWorkspaceSymbolProvider
		//    This needs to return symbols that *suggest* the relevant annotations.
		//    The actual discoverEndpoints function will need further logic
		//    (e.g., reading text around symbols, additional LSP calls) to confirm annotations and details.
		const mockWorkspaceSymbols: vscode.SymbolInformation[] = [
			// Symbol for the class - needed to find class-level @RequestMapping
			new vscode.SymbolInformation(
				'TestController',
				vscode.SymbolKind.Class,
				'com.example.test',
				new vscode.Location(mockUri, new vscode.Range(new vscode.Position(7, 0), new vscode.Position(19, 1))) // Adjusted range
			),
			// Symbol for the GET method
			new vscode.SymbolInformation(
				'getMethod',
				vscode.SymbolKind.Method,
				'TestController',
				new vscode.Location(mockUri, new vscode.Position(10, 4)) // Adjusted position
			),
			// Symbol for the POST method (needed if testing multiple methods)
			new vscode.SymbolInformation(
				'postMethod',
				vscode.SymbolKind.Method,
				'TestController',
				new vscode.Location(mockUri, new vscode.Position(15, 4)) // Adjusted position
			),
		];
		executeCommandStub.withArgs('vscode.executeWorkspaceSymbolProvider', '').resolves(mockWorkspaceSymbols);

		// 2. Mock reading file content (still needed by hypothetical implementation)
		//    A more advanced LSP implementation might use other calls (hovers, document symbols)
		//    but basic parsing around the symbol location is likely.
		const mockDocumentContent = `
package com.example.test;

import org.springframework.web.bind.annotation.*;

@RestController // discoverEndpoints needs to find this
@RequestMapping("/api/class") // discoverEndpoints needs to find this
public class TestController {

    @GetMapping("/method") // discoverEndpoints needs to find this
    public String getMethod() {
        return "Hello GET";
    }

		@PostMapping("/otherMethod") // discoverEndpoints needs to find this
		public String postMethod() {
				return "Hello POST";
		}
}
`;
		const mockTextDocument: Partial<vscode.TextDocument> = {
			uri: mockUri,
			getText: (range?: vscode.Range) => {
				// Simple mock: return whole content. Real impl might request specific ranges.
				if (!range) return mockDocumentContent;
				// Basic range handling if needed
				const lines = mockDocumentContent.split('\n');
				let text = '';
				for (let i = range.start.line; i <= range.end.line; i++) {
					if (i >= lines.length) break;
					const line = lines[i];
					const startChar = (i === range.start.line) ? range.start.character : 0;
					const endChar = (i === range.end.line) ? range.end.character : line.length;
					text += line.substring(startChar, endChar) + (i < range.end.line ? '\n' : '');
				}
				return text;
			},
			lineCount: mockDocumentContent.split('\n').length,
		};
		// sandbox.stub(vscode.workspace, 'openTextDocument').withArgs(mockUri).resolves(mockTextDocument as vscode.TextDocument);
    // Simpler stubbing: Assume any call to openTextDocument in this test context should resolve with mockTextDocument
    sandbox.stub(vscode.workspace, 'openTextDocument').resolves(mockTextDocument as vscode.TextDocument);

		const expectedEndpoints: EndpointInfo[] = [
			{
				method: 'GET',
				path: '/api/class/method', // Combined path
				uri: mockUri,
				position: new vscode.Position(10, 4), // Position of getMethod start
				handlerMethodName: 'getMethod'
			},
			// TODO: Update test if discoverEndpoints should find multiple methods per file in one pass
			// Example for POST method:
			{
			  method: 'POST',
			  path: '/api/class/otherMethod',
			  uri: mockUri,
			  position: new vscode.Position(15, 4), // Position of postMethod start
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