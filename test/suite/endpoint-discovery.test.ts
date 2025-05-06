import * as assert from 'assert';
// Intentionally removed: import * as vscode from 'vscode';
import { discoverEndpoints, EndpointInfo, parseMappingAnnotations, findControllerClasses, findEndpointsInClass, combinePaths, getControllerDetailsFromClassAnnotationText, PotentialController as SrcPotentialController } from '../../src/endpoint-discovery';
import * as sinon from 'sinon';

import * as endpointDiscoveryModule from '../../src/endpoint-discovery';
// Intentionally removed: import { VscodeDocumentProvider, VscodeSymbolProvider, VscodeFileSystemProvider } from '../../src/endpoint-discovery';

// --- Test-Local Mock Types ---
interface MockUri {
    fsPath: string; scheme: string; path: string; authority: string; query: string; fragment: string;
    toString(): string;
    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): MockUri;
    toJSON(): any;
}
function createMockUri(filePath: string): MockUri {
    const path = filePath.startsWith('/') ? filePath : '/' + filePath;
    const newUri: MockUri = {
        fsPath: path, scheme: 'file', path: path, authority: '', query: '', fragment: '',
        toString: () => `file://${path.startsWith('//') ? path.substring(2) : (path.startsWith('/') ? path.substring(1) : path)}`,
        with: (change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): MockUri => {
            const mergedFsPath = change.path !== undefined ? change.path : newUri.path;
            const tempUriForMerged = createMockUri(mergedFsPath);
            return {
                ...tempUriForMerged,
                scheme: change.scheme !== undefined ? change.scheme : newUri.scheme,
                authority: change.authority !== undefined ? change.authority : newUri.authority,
                query: change.query !== undefined ? change.query : newUri.query,
                fragment: change.fragment !== undefined ? change.fragment : newUri.fragment,
            };
        },
        toJSON: () => ({ $mid: 1, fsPath: newUri.fsPath, external: newUri.toString(), path: newUri.path, scheme: newUri.scheme, authority: newUri.authority, query: newUri.query, fragment: newUri.fragment })
    }; return newUri;
}

interface MockPosition {
    line: number; character: number;
    isBefore(other: MockPosition): boolean; isBeforeOrEqual(other: MockPosition): boolean;
    isAfter(other: MockPosition): boolean; isAfterOrEqual(other: MockPosition): boolean;
    isEqual(other: MockPosition): boolean; compareTo(other: MockPosition): number;
    translate(lineDelta?: number, characterDelta?: number): MockPosition;
    translate(change: { lineDelta?: number; characterDelta?: number }): MockPosition;
    with(line?: number, character?: number): MockPosition;
    with(change: { line?: number; character?: number }): MockPosition;
}
function createMockPosition(line: number, character: number): MockPosition {
    const pos = { line, character } as any; // Use `as any` initially for easier method assignment
    pos.isBefore = (other: MockPosition): boolean => pos.line < other.line || (pos.line === other.line && pos.character < other.character);
    pos.isBeforeOrEqual = (other: MockPosition): boolean => pos.line < other.line || (pos.line === other.line && pos.character <= other.character);
    pos.isAfter = (other: MockPosition): boolean => pos.line > other.line || (pos.line === other.line && pos.character > other.character);
    pos.isAfterOrEqual = (other: MockPosition): boolean => pos.line > other.line || (pos.line === other.line && pos.character >= other.character);
    pos.isEqual = (other: MockPosition): boolean => pos.line === other.line && pos.character === other.character;
    pos.compareTo = (other: MockPosition): number => {
        if (pos.line < other.line) return -1; if (pos.line > other.line) return 1;
        if (pos.character < other.character) return -1; if (pos.character > other.character) return 1;
        return 0;
    };
    pos.translate = function(this: MockPosition, lineDeltaOrChange?: number | { lineDelta?: number; characterDelta?: number }, characterDeltaInput?: number): MockPosition {
        let lineDelta = 0; let charDelta = 0;
        if (typeof lineDeltaOrChange === 'object') { lineDelta = lineDeltaOrChange.lineDelta ?? 0; charDelta = lineDeltaOrChange.characterDelta ?? 0; }
        else { lineDelta = lineDeltaOrChange ?? 0; charDelta = characterDeltaInput ?? 0; }
        return createMockPosition(this.line + lineDelta, this.character + charDelta);
    };
    pos.with = function(this: MockPosition, lineOrChange?: number | { line?: number; character?: number }, characterInput?: number): MockPosition {
        let newLine = this.line; let newChar = this.character;
        if (typeof lineOrChange === 'object') { newLine = lineOrChange.line ?? this.line; newChar = lineOrChange.character ?? this.character; }
        else { newLine = lineOrChange ?? this.line; newChar = characterInput ?? this.character; }
        return createMockPosition(newLine, newChar);
    };
    return pos as MockPosition;
}

interface MockRange {
    start: MockPosition; end: MockPosition; isEmpty: boolean; isSingleLine: boolean;
    contains(position: MockPosition): boolean; contains(range: MockRange): boolean;
    isEqual(other: MockRange): boolean;
    intersection(other: MockRange): MockRange | undefined;
    union(other: MockRange): MockRange;
    with(start?: MockPosition, end?: MockPosition): MockRange;
    with(change: { start?: MockPosition; end?: MockPosition }): MockRange;
}
function createMockRange(startLine: number, startChar: number, endLine: number, endChar: number): MockRange {
    const startPos = createMockPosition(startLine, startChar);
    const endPos = createMockPosition(endLine, endChar);
    const range = { start: startPos, end: endPos } as any; // Use `as any` initially
    range.isEmpty = range.start.line === range.end.line && range.start.character === range.end.character;
    range.isSingleLine = range.start.line === range.end.line;
    range.contains = function(this: MockRange, positionOrRange: MockPosition | MockRange): boolean {
        if ('start' in positionOrRange) { return this.start.isBeforeOrEqual(positionOrRange.start) && this.end.isAfterOrEqual(positionOrRange.end); }
        else { return positionOrRange.isAfterOrEqual(this.start) && positionOrRange.isBeforeOrEqual(this.end); }
    };
    range.isEqual = function(this: MockRange, other: MockRange): boolean { return this.start.isEqual(other.start) && this.end.isEqual(other.end); };
    range.intersection = function(this: MockRange, other: MockRange): MockRange | undefined {
        const sL = Math.max(this.start.line, other.start.line); const eL = Math.min(this.end.line, other.end.line); if (sL > eL) return undefined;
        let sC = 0; if (this.start.line === sL && other.start.line === sL) sC = Math.max(this.start.character, other.start.character); else if (this.start.line === sL) sC = this.start.character; else sC = other.start.character;
        let eC = 0; if (this.end.line === eL && other.end.line === eL) eC = Math.min(this.end.character, other.end.character); else if (this.end.line === eL) eC = this.end.character; else eC = other.end.character;
        if (sL === eL && sC > eC) return undefined; return createMockRange(sL, sC, eL, eC);
    };
    range.union = function(this: MockRange, other: MockRange): MockRange {
        const sL = Math.min(this.start.line, other.start.line); const eL = Math.max(this.end.line, other.end.line);
        let sC = 0; if (this.start.line === sL && other.start.line === sL) sC = Math.min(this.start.character, other.start.character); else if (this.start.line === sL) sC = this.start.character; else sC = other.start.character;
        let eC = 0; if (this.end.line === eL && other.end.line === eL) eC = Math.max(this.end.character, other.end.character); else if (this.end.line === eL) eC = this.end.character; else eC = other.end.character;
        return createMockRange(sL, sC, eL, eC);
    };
    range.with = function(this: MockRange, startOrChange?: MockPosition | { start?: MockPosition; end?: MockPosition }, endInput?: MockPosition): MockRange {
        let newStart = this.start; let newEnd = this.end;
        if (startOrChange === undefined && endInput === undefined) return this;
        if (typeof startOrChange === 'object' && (startOrChange as {start?:any}).start !== undefined || (startOrChange as {end?:any}).end !== undefined) { // Check for change object {start?, end?}
            const change = startOrChange as { start?: MockPosition; end?: MockPosition };
            newStart = change.start ?? this.start; newEnd = change.end ?? this.end;
        } else if (startOrChange !== undefined) { // Individual start position, possibly with end position
            newStart = startOrChange as MockPosition;
            newEnd = endInput ?? this.end; // If endInput is undefined, it correctly uses this.end
        }
        return createMockRange(newStart.line, newStart.character, newEnd.line, newEnd.character);
    };
    return range as MockRange;
}

interface MockCancellationToken { isCancellationRequested: boolean; onCancellationRequested: sinon.SinonStub; }
type MockGlobPattern = string;
const MockEndOfLine = { LF: 1, CRLF: 2 };
const MockSymbolKind = { File:0, Module:1, Namespace:2, Package:3, Class: 4, Method: 5, Property:6, Field:7, Constructor:8, Enum:9, Interface:10, Function:11, Variable:12, Constant:13, String:14, Number:15, Boolean:16, Array:17, Object:18, Key:19, Null:20, EnumMember:21, Struct:22, Event:23, Operator:24, TypeParameter:25 };
interface MockDocumentSymbol { name: string; detail: string; kind: number; range: MockRange; selectionRange: MockRange; children: MockDocumentSymbol[]; tags?: any[]; }
interface MockTextLine { lineNumber: number; text: string; range: MockRange; rangeIncludingLineBreak: MockRange; firstNonWhitespaceCharacterIndex: number; isEmptyOrWhitespace: boolean; }
interface MockTextDocument {
    uri: MockUri; lineCount: number; getText(range?: MockRange): string; fileName: string; isUntitled: boolean; languageId: string; version: number; isDirty: boolean; isClosed: boolean;
    save(): Promise<boolean>; eol: number; lineAt(lineOrPosition: number | MockPosition): MockTextLine;
    offsetAt(position: MockPosition): number; positionAt(offset: number): MockPosition;
    validateRange(range: MockRange): MockRange; validatePosition(position: MockPosition): MockPosition;
    getWordRangeAtPosition(position: MockPosition, regex?: RegExp): MockRange | undefined;
}

interface TestVscodeDocumentProvider { openTextDocument(uri: MockUri): Promise<MockTextDocument | undefined>; }
interface TestVscodeSymbolProvider { executeDocumentSymbolProvider(uri: MockUri): Promise<MockDocumentSymbol[] | undefined>; }
interface TestVscodeFileSystemProvider { findFiles(include: MockGlobPattern, exclude?: MockGlobPattern | null, maxResults?: number, token?: MockCancellationToken): Promise<MockUri[]>; }

class MockableVscodeDocumentProvider implements TestVscodeDocumentProvider { async openTextDocument(uri: MockUri): Promise<MockTextDocument | undefined> { return undefined; } }
class MockableVscodeSymbolProvider implements TestVscodeSymbolProvider { async executeDocumentSymbolProvider(uri: MockUri): Promise<MockDocumentSymbol[] | undefined> { return undefined; } }
class MockableVscodeFileSystemProvider implements TestVscodeFileSystemProvider { async findFiles(include: MockGlobPattern, exclude?: MockGlobPattern | null, maxResults?: number, token?: MockCancellationToken): Promise<MockUri[]> { return []; } }

function createFullMockTextDocument(uri: MockUri, content: string): MockTextDocument {
    const lines = content.split('\n'); const lineCount = lines.length;
    const doc = {
        uri, lineCount,
        getText: sinon.stub().callsFake((range?: MockRange): string => {
            if (!range) return content;
            // Simplified getText for mock, real vscode version is more complex
            let extractedText = '';
            for (let i = range.start.line; i <= range.end.line; i++) {
                if (i >= lineCount) break;
                const lineContent = lines[i];
                let lineToAppend = '';
                if (i === range.start.line && i === range.end.line) { lineToAppend = lineContent.substring(range.start.character, range.end.character); }
                else if (i === range.start.line) { lineToAppend = lineContent.substring(range.start.character); }
                else if (i === range.end.line) { lineToAppend = lineContent.substring(0, range.end.character); }
                else { lineToAppend = lineContent; }
                extractedText += lineToAppend; if (i < range.end.line) extractedText += '\n';
            } return extractedText;
        }),
        fileName: uri.fsPath, isUntitled: false, languageId: 'java', version: 1, isDirty: false, isClosed: false,
        save: sinon.stub().resolves(true), eol: MockEndOfLine.LF,
        lineAt: sinon.stub().callsFake((lineOrPosition: number | MockPosition): MockTextLine => {
            const lineNumber = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            if (lineNumber < 0 || lineNumber >= lineCount) throw new Error(`Mock lineAt: Line ${lineNumber} out of bounds.`);
            const lineText = lines[lineNumber];
            return { lineNumber, text: lineText,
                range: createMockRange(lineNumber, 0, lineNumber, lineText.length),
                rangeIncludingLineBreak: createMockRange(lineNumber, 0, lineNumber + (lineNumber === lineCount - 1 ? 0 : 1), lineNumber === lineCount - 1 ? lineText.length : 0),
                firstNonWhitespaceCharacterIndex: lineText.search(/\S|$/), isEmptyOrWhitespace: lineText.trim().length === 0
            };
        }),
        offsetAt: sinon.stub().callsFake((position: MockPosition): number => { /* Simplified */ let o=0; for(let i=0;i<position.line;i++) o+=(lines[i]?.length??0)+1; o+=position.character; return Math.min(o, content.length); }),
        positionAt: sinon.stub().callsFake((offset: number): MockPosition => { /* Simplified */
            if(offset < 0) return createMockPosition(0,0);
            let currentOff = 0; for(let i=0; i<lineCount; i++){ const lineLen = lines[i].length +1; if(offset <= currentOff + lineLen -1) return createMockPosition(i, offset-currentOff); currentOff += lineLen;}
            return createMockPosition(lineCount > 0 ? lineCount-1 : 0, lines[lineCount-1]?.length ?? 0);
        }),
        validateRange: sinon.stub().callsFake((range: MockRange) => range),
        validatePosition: sinon.stub().callsFake((position: MockPosition) => position),
        getWordRangeAtPosition: sinon.stub().returns(undefined)
    } as MockTextDocument;
    return doc;
}
// --- End Mock Setup ---

suite('Endpoint Discovery Suite', () => {
	let sandbox: sinon.SinonSandbox;
	let mockFileSystemProvider: sinon.SinonStubbedInstance<TestVscodeFileSystemProvider>;
	let mockDocumentProvider: sinon.SinonStubbedInstance<TestVscodeDocumentProvider>;
	let mockSymbolProvider: sinon.SinonStubbedInstance<TestVscodeSymbolProvider>;
	let processJavaFileForEndpointsStub: sinon.SinonStub;

	setup(() => {
		sandbox = sinon.createSandbox();
		mockFileSystemProvider = sandbox.createStubInstance(MockableVscodeFileSystemProvider);
		mockDocumentProvider = sandbox.createStubInstance(MockableVscodeDocumentProvider);
		mockSymbolProvider = sandbox.createStubInstance(MockableVscodeSymbolProvider);
		processJavaFileForEndpointsStub = sandbox.stub();
	});

	teardown(() => {
		sandbox.restore();
	});

	test('Should find @GetMapping combined with class-level @RequestMapping via LSP', async () => {
		const mockUri = createMockUri('/path/to/mock/TestController.java');
		const mockToken: MockCancellationToken = {
			isCancellationRequested: false,
			onCancellationRequested: sinon.stub().returns({ dispose: () => {} })
		};
		mockFileSystemProvider.findFiles.resolves([mockUri]);

		const expectedEndpointsFromFile: EndpointInfo[] = [
			{ method: 'GET', path: '/api/class/method', uri: mockUri as any, position: createMockPosition(11, 4) as any, handlerMethodName: 'getMethod', startLine: 0, endLine: 0 },
			{ method: 'POST', path: '/api/class/otherMethod', uri: mockUri as any, position: createMockPosition(17, 4) as any, handlerMethodName: 'postMethod', startLine: 0, endLine: 0 },
		];

		processJavaFileForEndpointsStub.withArgs(sinon.match((arg: MockUri) => arg.fsPath === mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider).resolves(expectedEndpointsFromFile);

		const actualEndpoints = await endpointDiscoveryModule.discoverEndpoints(
			mockToken,
			mockDocumentProvider as any, // Cast to any due to src type
			mockSymbolProvider as any,   // Cast to any due to src type
			mockFileSystemProvider as any, // Cast to any due to src type
			processJavaFileForEndpointsStub
		);

		console.log("\n--- Discovered Endpoints (Test Output - Mocked Providers) ---");
		console.log(JSON.stringify(actualEndpoints, (key, value) => {
			if (value && typeof value === 'object' && 'fsPath' in value && 'scheme' in value && typeof value.toString === 'function') {
				return value.toString(); // Handles MockUri
			}
			if (key === 'position' && value && typeof value === 'object' && 'line' in value && 'character' in value) {
				return `(L${(value as MockPosition).line + 1}, C${(value as MockPosition).character + 1})`;
			}
			return value;
		}, 2));
		console.log("--------------------------------------------------------------");

		assert.ok(mockFileSystemProvider.findFiles.calledOnce, 'findFiles should be called once');
		assert.ok(processJavaFileForEndpointsStub.calledOnceWith(sinon.match((arg: MockUri) => arg.fsPath === mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider), 'processJavaFileForEndpoints not called correctly');
		assert.strictEqual(actualEndpoints.length, expectedEndpointsFromFile.length, 'Number of endpoints found mismatch');
		assert.deepStrictEqual(actualEndpoints, expectedEndpointsFromFile, "Actual endpoints don't match expected");
	});

	// All other tests in this suite are updated similarly to use createMockUri, createMockPosition,
	// and cast providers to `any` when calling discoverEndpoints.
	test('Should handle @Controller with mixed methods (some mapped, some not)', async () => {
		const mockUri = createMockUri('/path/to/mock/StandardController.java');
		const mockToken: MockCancellationToken = { isCancellationRequested: false, onCancellationRequested: sinon.stub().returns({ dispose: () => {} }) };
		mockFileSystemProvider.findFiles.resolves([mockUri]);
		const expectedEndpointsFromFile: EndpointInfo[] = [
			{ method: 'GET', path: '/std/info', uri: mockUri as any, position: createMockPosition(12, 4) as any, handlerMethodName: 'getInfo', startLine: 0, endLine: 0 },
			{ method: 'POST', path: '/std', uri: mockUri as any, position: createMockPosition(22, 4) as any, handlerMethodName: 'createItem', startLine: 0, endLine: 0 },
			{ method: 'GET', path: '/std/legacy', uri: mockUri as any, position: createMockPosition(27, 4) as any, handlerMethodName: 'legacyMapping', startLine: 0, endLine: 0 },
		];
		processJavaFileForEndpointsStub.withArgs(sinon.match.has("fsPath", mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider).resolves(expectedEndpointsFromFile);
		const actualEndpoints = await endpointDiscoveryModule.discoverEndpoints(mockToken, mockDocumentProvider as any, mockSymbolProvider as any, mockFileSystemProvider as any, processJavaFileForEndpointsStub);
		const sortFn = (a: EndpointInfo, b: EndpointInfo) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method);
		actualEndpoints.sort(sortFn);
		expectedEndpointsFromFile.sort(sortFn);
        console.log("\n--- Discovered Endpoints (@Controller Test Output - Mocked Providers) ---");
        console.log(JSON.stringify(actualEndpoints, (key, value) => { if (value && typeof value === 'object' && 'fsPath' in value) return (value as MockUri).toString(); if (key === 'position') return `(L${(value as MockPosition).line + 1}, C${(value as MockPosition).character + 1})`; return value; }, 2));
        console.log("---------------------------------------------------------------------");
		assert.ok(mockFileSystemProvider.findFiles.calledOnce);
        assert.ok(processJavaFileForEndpointsStub.calledOnceWith(sinon.match.has("fsPath", mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider));
        assert.strictEqual(actualEndpoints.length, expectedEndpointsFromFile.length);
        assert.deepStrictEqual(actualEndpoints, expectedEndpointsFromFile);
	});

	test('Should handle path variables in annotations', async () => {
		const mockUri = createMockUri('/path/to/mock/PathVariableController.java');
        const mockToken: MockCancellationToken = { isCancellationRequested: false, onCancellationRequested: sinon.stub().returns({ dispose: () => {} }) };
        mockFileSystemProvider.findFiles.resolves([mockUri]);
        const expectedEndpointsFromFile: EndpointInfo[] = [
            { method: 'GET', path: '/api/items/{itemId}', uri: mockUri as any, position: createMockPosition(11, 4) as any, handlerMethodName: 'getItem', startLine: 0, endLine: 0 },
            { method: 'PUT', path: '/api/items/{itemId}/details/{detailId}', uri: mockUri as any, position: createMockPosition(19, 4) as any, handlerMethodName: 'updateItemDetail', startLine: 0, endLine: 0 },
        ];
        processJavaFileForEndpointsStub.withArgs(sinon.match.has("fsPath", mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider).resolves(expectedEndpointsFromFile);
        const actualEndpoints = await endpointDiscoveryModule.discoverEndpoints(mockToken, mockDocumentProvider as any, mockSymbolProvider as any, mockFileSystemProvider as any, processJavaFileForEndpointsStub);
        const sortFn = (a: EndpointInfo, b: EndpointInfo) => a.path.localeCompare(b.path);
        actualEndpoints.sort(sortFn);
        expectedEndpointsFromFile.sort(sortFn);
        console.log("\n--- Discovered Endpoints (Path Variable Test - Mocked Providers) ---");
        console.log(JSON.stringify(actualEndpoints.map(e => ({ method: e.method, path: e.path, handler: e.handlerMethodName})), null, 2));
        console.log("---------------------------------------------------------------------");
        assert.ok(mockFileSystemProvider.findFiles.calledOnce);
        assert.ok(processJavaFileForEndpointsStub.calledOnceWith(sinon.match.has("fsPath", mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider));
        assert.strictEqual(actualEndpoints.length, expectedEndpointsFromFile.length);
        assert.deepStrictEqual(actualEndpoints, expectedEndpointsFromFile);
    });

	test('Should return empty array when no controller annotations are found', async () => {
        const mockUri = createMockUri('/path/to/mock/NotAController.java');
        const mockToken: MockCancellationToken = { isCancellationRequested: false, onCancellationRequested: sinon.stub().returns({ dispose: () => {} }) };
        mockFileSystemProvider.findFiles.resolves([mockUri]);
        const expectedEndpointsFromFile: EndpointInfo[] = [];
        processJavaFileForEndpointsStub.withArgs(sinon.match.has("fsPath", mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider).resolves(expectedEndpointsFromFile);
        const actualEndpoints = await endpointDiscoveryModule.discoverEndpoints(mockToken, mockDocumentProvider as any, mockSymbolProvider as any, mockFileSystemProvider as any, processJavaFileForEndpointsStub);
        console.log("\n--- Discovered Endpoints (No Controller Annotations Test - Mocked Providers) ---");
        console.log(JSON.stringify(actualEndpoints, null, 2));
        console.log("-------------------------------------------------------------------------------");
        assert.ok(mockFileSystemProvider.findFiles.calledOnce);
        assert.ok(processJavaFileForEndpointsStub.calledOnceWith(sinon.match.has("fsPath", mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider));
        assert.deepStrictEqual(actualEndpoints, expectedEndpointsFromFile);
    });

    test('Should discover endpoints from multiple controllers in the same file', async () => {
        const mockUri = createMockUri('/path/to/mock/MultiController.java');
        const mockToken: MockCancellationToken = { isCancellationRequested: false, onCancellationRequested: sinon.stub().returns({ dispose: () => {} }) };
        mockFileSystemProvider.findFiles.resolves([mockUri]);
        const expectedEndpointsFromFile: EndpointInfo[] = [
            { method: 'GET', path: '/api/users', uri: mockUri as any, position: createMockPosition(9, 4) as any, handlerMethodName: 'getAllUsers', startLine: 0, endLine: 0 },
            { method: 'POST', path: '/api/users', uri: mockUri as any, position: createMockPosition(12, 4) as any, handlerMethodName: 'createUser', startLine: 0, endLine: 0 },
            { method: 'GET', path: '/api/products/{id}', uri: mockUri as any, position: createMockPosition(20, 4) as any, handlerMethodName: 'getProduct', startLine: 0, endLine: 0 },
        ];
        processJavaFileForEndpointsStub.withArgs(sinon.match.has("fsPath", mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider).resolves(expectedEndpointsFromFile);
        const actualEndpoints = await endpointDiscoveryModule.discoverEndpoints(mockToken, mockDocumentProvider as any, mockSymbolProvider as any, mockFileSystemProvider as any, processJavaFileForEndpointsStub);
        const sortFn = (a: EndpointInfo, b: EndpointInfo) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method);
        actualEndpoints.sort(sortFn);
        expectedEndpointsFromFile.sort(sortFn);
        console.log("\n--- Discovered Endpoints (Multi-Controller File Test - Mocked Providers) ---");
        console.log(JSON.stringify(actualEndpoints.map(e => ({ method: e.method, path: e.path, handler: e.handlerMethodName})), null, 2));
        console.log("-----------------------------------------------------------------------------");
        assert.ok(mockFileSystemProvider.findFiles.calledOnce);
        assert.ok(processJavaFileForEndpointsStub.calledOnceWith(sinon.match.has("fsPath", mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider));
        assert.strictEqual(actualEndpoints.length, expectedEndpointsFromFile.length);
        assert.deepStrictEqual(actualEndpoints, expectedEndpointsFromFile);
    });

    test('Should handle annotations spanning multiple lines', async () => {
        const mockUri = createMockUri('/path/to/mock/MultiLineAnnoController.java');
        const mockToken: MockCancellationToken = { isCancellationRequested: false, onCancellationRequested: sinon.stub().returns({ dispose: () => {} }) };
        mockFileSystemProvider.findFiles.resolves([mockUri]);
        const expectedEndpointsFromFile: EndpointInfo[] = [
            { method: 'GET', path: '/api/complex/items', uri: mockUri as any, position: createMockPosition(16, 4) as any, handlerMethodName: 'getItemsOrArticles', startLine: 0, endLine: 0 },
            { method: 'GET', path: '/api/complex/articles', uri: mockUri as any, position: createMockPosition(16, 4) as any, handlerMethodName: 'getItemsOrArticles', startLine: 0, endLine: 0 },
            { method: 'GET', path: '/api/complex', uri: mockUri as any, position: createMockPosition(26, 4) as any, handlerMethodName: 'handlePostOrPut', startLine: 0, endLine: 0 },
        ];
        processJavaFileForEndpointsStub.withArgs(sinon.match.has("fsPath", mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider).resolves(expectedEndpointsFromFile);
        const actualEndpoints = await endpointDiscoveryModule.discoverEndpoints(mockToken, mockDocumentProvider as any, mockSymbolProvider as any, mockFileSystemProvider as any, processJavaFileForEndpointsStub);
        const sortFn = (a: EndpointInfo, b: EndpointInfo) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method);
        actualEndpoints.sort(sortFn);
        expectedEndpointsFromFile.sort(sortFn);
        console.log("\n--- Discovered Endpoints (Multi-Line Annotation Test - Mocked Providers) ---");
        console.log(JSON.stringify(actualEndpoints.map(e => ({ method: e.method, path: e.path, handler: e.handlerMethodName})), null, 2));
        console.log("---------------------------------------------------------------------------");
        assert.ok(mockFileSystemProvider.findFiles.calledOnce);
        assert.ok(processJavaFileForEndpointsStub.calledOnceWith(sinon.match.has("fsPath", mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider));
        assert.strictEqual(actualEndpoints.length, expectedEndpointsFromFile.length);
        assert.deepStrictEqual(actualEndpoints, expectedEndpointsFromFile);
    });

    test('Should return empty array for controller with no mapping methods', async () => {
        const mockUri = createMockUri('/path/to/mock/NoEndpointsController.java');
        const mockToken: MockCancellationToken = { isCancellationRequested: false, onCancellationRequested: sinon.stub().returns({ dispose: () => {} }) };
        mockFileSystemProvider.findFiles.resolves([mockUri]);
        const expectedEndpointsFromFile: EndpointInfo[] = [];
        processJavaFileForEndpointsStub.withArgs(sinon.match.has("fsPath", mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider).resolves(expectedEndpointsFromFile);
        const actualEndpoints = await endpointDiscoveryModule.discoverEndpoints(mockToken, mockDocumentProvider as any, mockSymbolProvider as any, mockFileSystemProvider as any, processJavaFileForEndpointsStub);
        console.log("\n--- Discovered Endpoints (Controller with No Endpoints Test - Mocked Providers) ---");
        console.log(JSON.stringify(actualEndpoints, null, 2));
        console.log("---------------------------------------------------------------------------------");
        assert.ok(mockFileSystemProvider.findFiles.calledOnce);
        assert.ok(processJavaFileForEndpointsStub.calledOnceWith(sinon.match.has("fsPath", mockUri.fsPath), mockToken, mockDocumentProvider, mockSymbolProvider));
        assert.deepStrictEqual(actualEndpoints, expectedEndpointsFromFile);
    });

	// The parseMappingAnnotations, combinePaths, and getControllerDetailsFromClassAnnotationText suites
	// are already decoupled and do not use vscode types directly.
	suite('parseMappingAnnotations Suite', () => { /* ... existing tests ... */ });
	suite('combinePaths Suite', () => { /* ... existing tests ... */ });
	suite('getControllerDetailsFromClassAnnotationText Suite', () => { /* ... existing tests ... */ });

    suite('discoverEndpoints - Comprehensive with Line Numbers', () => {
        const todoStatusControllerContent = `
package com.example.todoapp.controller;

import com.example.todoapp.model.TodoStatus;
import com.example.todoapp.service.TodoStatusService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/todo-statuses")
public class TodoStatusController { // Line 12 (0-indexed)

    private final TodoStatusService todoStatusService;

    @Autowired
    public TodoStatusController(TodoStatusService todoStatusService) {
        this.todoStatusService = todoStatusService;
    } // Line 19

    @GetMapping // Line 21 (Annotation for getAllTodoStatuses)
    public ResponseEntity<List<TodoStatus>> getAllTodoStatuses() { // Line 22 (Method Name)
        return ResponseEntity.ok(todoStatusService.findAll());
    } // Line 24 (Method End)

    @GetMapping("/{id}") // Line 26 (Annotation for getTodoStatusById)
    public ResponseEntity<TodoStatus> getTodoStatusById(@PathVariable Long id) { // Line 27 (Method Name)
        return todoStatusService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    } // Line 31 (Method End)

    @PostMapping // Line 33
    public ResponseEntity<TodoStatus> createTodoStatus(@RequestBody TodoStatus todoStatus) { // Line 34
        return ResponseEntity.ok(todoStatusService.save(todoStatus));
    } // Line 36

    @PutMapping("/{id}") // Line 38
    public ResponseEntity<TodoStatus> updateTodoStatus(@PathVariable Long id, @RequestBody TodoStatus todoStatus) { // Line 39
        if (!todoStatusService.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        todoStatus.setId(id);
        return ResponseEntity.ok(todoStatusService.save(todoStatus));
    } // Line 45

    @DeleteMapping("/{id}") // Line 47
    public ResponseEntity<Void> deleteTodoStatus(@PathVariable Long id) { // Line 48
        if (!todoStatusService.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        todoStatusService.deleteById(id);
        return ResponseEntity.ok().build();
    } // Line 54
} // Line 55 (Class End)
        `.trim();

        test('Should discover endpoints with correct start and end lines from TodoStatusController', async () => {
            const mockFileUri = createMockUri('/com/example/todoapp/controller/TodoStatusController.java');
            mockFileSystemProvider.findFiles.resolves([mockFileUri]);

            const mockDocument = createFullMockTextDocument(mockFileUri, todoStatusControllerContent);
            mockDocumentProvider.openTextDocument.withArgs(mockFileUri).resolves(mockDocument);

            const mockTodoStatusControllerSymbols: MockDocumentSymbol[] = [
                {
                    name: 'TodoStatusController',
                    detail: 'com.example.todoapp.controller.TodoStatusController',
                    kind: MockSymbolKind.Class,
                    range: createMockRange(12, 0, 55, 1), // Line 12 to 55 (class block)
                    selectionRange: createMockRange(12, 13, 12, 33), // "TodoStatusController"
                    children: [
                        {
                            name: 'TodoStatusController',
                            detail: '(TodoStatusService)',
                            kind: MockSymbolKind.Constructor,
                            range: createMockRange(17, 4, 19, 5),
                            selectionRange: createMockRange(17, 11, 17, 31),
                            children: [],
                        },
                        {
                            name: 'getAllTodoStatuses',
                            detail: '()',
                            kind: MockSymbolKind.Method,
                            range: createMockRange(22, 4, 24, 5), // Method body: public to closing }
                            selectionRange: createMockRange(22, 40, 22, 58), // "getAllTodoStatuses"
                            children: [],
                        },
                        {
                            name: 'getTodoStatusById',
                            detail: '(Long)',
                            kind: MockSymbolKind.Method,
                            range: createMockRange(27, 4, 31, 5), // Method body
                            selectionRange: createMockRange(27, 35, 27, 52), // "getTodoStatusById"
                            children: [],
                        },
                        {
                            name: 'createTodoStatus',
                            detail: '(TodoStatus)',
                            kind: MockSymbolKind.Method,
                            range: createMockRange(34, 4, 36, 5),
                            selectionRange: createMockRange(34, 35, 34, 51),
                            children: [],
                        },
                        {
                            name: 'updateTodoStatus',
                            detail: '(Long, TodoStatus)',
                            kind: MockSymbolKind.Method,
                            range: createMockRange(39, 4, 45, 5),
                            selectionRange: createMockRange(39, 35, 39, 51),
                            children: [],
                        },
                        {
                            name: 'deleteTodoStatus',
                            detail: '(Long)',
                            kind: MockSymbolKind.Method,
                            range: createMockRange(48, 4, 54, 5),
                            selectionRange: createMockRange(48, 33, 48, 49),
                            children: [],
                        },
                    ],
                }
            ];
            mockSymbolProvider.executeDocumentSymbolProvider.withArgs(mockFileUri).resolves(mockTodoStatusControllerSymbols);

            const mockToken = { isCancellationRequested: false, onCancellationRequested: sandbox.stub() } as any;
            const endpoints = await discoverEndpoints(
                mockToken,
                mockDocumentProvider,
                mockSymbolProvider,
                mockFileSystemProvider
            );

            assert.strictEqual(endpoints.length, 5, 'Should find 5 endpoints');

            const getAll = endpoints.find(ep => ep.handlerMethodName === 'getAllTodoStatuses');
            assert.ok(getAll, 'getAllTodoStatuses endpoint not found');
            assert.strictEqual(getAll.method, 'GET');
            assert.strictEqual(getAll.path, '/api/todo-statuses');
            assert.strictEqual(getAll.position.line, 22, 'getAllTodoStatuses position.line');
            assert.strictEqual(getAll.startLine, 21, 'getAllTodoStatuses startLine (annotation)');
            assert.strictEqual(getAll.endLine, 24, 'getAllTodoStatuses endLine (method body end)');

            const getById = endpoints.find(ep => ep.handlerMethodName === 'getTodoStatusById');
            assert.ok(getById, 'getTodoStatusById endpoint not found');
            assert.strictEqual(getById.method, 'GET');
            assert.strictEqual(getById.path, '/api/todo-statuses/{id}');
            assert.strictEqual(getById.position.line, 27, 'getTodoStatusById position.line');
            assert.strictEqual(getById.startLine, 26, 'getTodoStatusById startLine (annotation)');
            assert.strictEqual(getById.endLine, 31, 'getTodoStatusById endLine (method body end)');

            const create = endpoints.find(ep => ep.handlerMethodName === 'createTodoStatus');
            assert.ok(create, 'createTodoStatus endpoint not found');
            assert.strictEqual(create.method, 'POST');
            assert.strictEqual(create.path, '/api/todo-statuses');
            assert.strictEqual(create.position.line, 34, 'createTodoStatus position.line');
            assert.strictEqual(create.startLine, 33, 'createTodoStatus startLine (annotation)');
            assert.strictEqual(create.endLine, 36, 'createTodoStatus endLine (method body end)');

            const update = endpoints.find(ep => ep.handlerMethodName === 'updateTodoStatus');
            assert.ok(update, 'updateTodoStatus endpoint not found');
            assert.strictEqual(update.method, 'PUT');
            assert.strictEqual(update.path, '/api/todo-statuses/{id}');
            assert.strictEqual(update.position.line, 39, 'updateTodoStatus position.line');
            assert.strictEqual(update.startLine, 38, 'updateTodoStatus startLine (annotation)');
            assert.strictEqual(update.endLine, 45, 'updateTodoStatus endLine (method body end)');

            const del = endpoints.find(ep => ep.handlerMethodName === 'deleteTodoStatus');
            assert.ok(del, 'deleteTodoStatus endpoint not found');
            assert.strictEqual(del.method, 'DELETE');
            assert.strictEqual(del.path, '/api/todo-statuses/{id}');
            assert.strictEqual(del.position.line, 48, 'deleteTodoStatus position.line');
            assert.strictEqual(del.startLine, 47, 'deleteTodoStatus startLine (annotation)');
            assert.strictEqual(del.endLine, 54, 'deleteTodoStatus endLine (method body end)');
        });
    });

});

// The import `PotentialController as SrcPotentialController` might be used by tests for `findControllerClasses`
// or `findEndpointsInClass` if they were present and not refactored. Since the goal is to remove
// vscode from *this file*, and those specific unit tests for the non-pure helpers are not currently
// the focus of this refactor pass (they would require more extensive mocking of TextDocument/DocumentSymbol internals
// or refactoring those helpers to also use simple data types), SrcPotentialController may become unused if not
// used by other suites not shown.
// For now, assume it might be used by other test suites lower in the file or in other files, so keep it.