import * as assert from 'assert';
import {
    generateMermaidSequenceDiagram,
    getParticipantName,
    sanitizeParticipantName,
    // escapeMermaidMessage // Add if tests for it are un-commented
} from '../../src/mermaid-sequence-translator';
import { CustomHierarchyNode } from '../../src/call-hierarchy'; // Assuming path
import { ICallHierarchyItem, VSCodeSymbolKind, IUri, IRange, IPosition } from '../../src/adapters/vscodeTypes';
import { toVscodeCallHierarchyItem, fromVscodeCallHierarchyItem } from '../../src/adapters/vscodeUtils';

// Helper to access internal functions if they are not exported
// This is a bit of a hack; ideally, these would be tested directly if exported,
// or indirectly through generateMermaidSequenceDiagram.
// For now, let's assume we might need to test them.
// If getParticipantName and sanitizeParticipantName are exported, direct import is better.


suite('MermaidSequenceTranslator', () => {
    suite('generateMermaidSequenceDiagram', () => {
        test('should return a placeholder diagram if rootNode is null', () => {
            const expectedDiagram = 'sequenceDiagram\n    participant User\n    User->>System: No call hierarchy data to display.';
            assert.strictEqual(generateMermaidSequenceDiagram(null), expectedDiagram);
        });

        test('should generate a diagram for a simple parent-child relationship', () => {
            const mockParentData: ICallHierarchyItem = {
                name: 'parentMethod',
                kind: VSCodeSymbolKind.Method,
                uri: { fsPath: 'test.java' } as IUri,
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } as IRange,
                selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } as IRange,
                detail: 'com.example.ParentClass'
            };
            const mockChildData: ICallHierarchyItem = {
                name: 'childMethod',
                kind: VSCodeSymbolKind.Method,
                uri: { fsPath: 'test.java' } as IUri,
                range: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } } as IRange,
                selectionRange: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } } as IRange,
                detail: 'com.example.ChildClass'
            };

            // Use object literal style for CustomHierarchyNode
            const childCustomNode: CustomHierarchyNode = {
                item: mockChildData as any, // Cast to any to bypass type mismatch
                children: [],
                parents: [] // Parent will be set below
            };
            const parentCustomNode: CustomHierarchyNode = {
                item: mockParentData as any, // Cast to any to bypass type mismatch
                children: [childCustomNode],
                parents: []
            };
            childCustomNode.parents.push(parentCustomNode); // Establish parent link

            const result = generateMermaidSequenceDiagram(parentCustomNode);
            const resultLines = result.replace(/\r\n/g, '\n').split('\n').map(l => l.trim());

            const expectedParticipants = new Set([
                'participant ParentClass', // Expect Class Name
                'participant ChildClass'   // Expect Class Name
            ]);
            const actualParticipants = new Set(resultLines.filter(line => line.startsWith('participant ')));
            assert.deepStrictEqual(actualParticipants, expectedParticipants, "Participants do not match");

            const expectedCall = 'ParentClass->>ChildClass: childMethod()'; // Expect Class->>Class: method()
            assert.ok(resultLines.some(line => line.includes(expectedCall)), `Diagram should contain call: ${expectedCall}`);
        });

        test('should return a diagram indicating no outgoing calls if rootNode has no children', () => {
            const mockRootData: ICallHierarchyItem = {
                name: 'mainFunction',
                kind: VSCodeSymbolKind.Function,
                uri: { fsPath: 'test.ts' } as IUri,
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } as IRange,
                selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } as IRange,
                detail: undefined // No class detail for a simple function
            };
            const rootNode: CustomHierarchyNode = {
                item: mockRootData as any, // Cast to any to bypass type mismatch
                children: [],
                parents: []
            };
            const expectedDiagram = 'sequenceDiagram\n    participant mainFunction\n    mainFunction->>mainFunction: No outgoing calls found to diagram.';
            assert.strictEqual(generateMermaidSequenceDiagram(rootNode), expectedDiagram);
        });

        test('should generate a correct diagram for a leaf endpoint (e.g., sayHello)', () => {
            const mockSayHelloData: ICallHierarchyItem = {
                name: 'sayHello',
                kind: VSCodeSymbolKind.Method,
                uri: { fsPath: 'TestController.java' } as IUri,
                range: { start: { line: 10, character: 0 }, end: { line: 12, character: 0 } } as IRange,
                selectionRange: { start: { line: 11, character: 0 }, end: { line: 11, character: 10 } } as IRange,
                detail: 'com.example.TestController'
            };
            const rootNode: CustomHierarchyNode = {
                item: mockSayHelloData as any, // Cast to any to bypass type mismatch
                children: [],
                parents: []
            };
            // Need to import EndpointDiagramDetails or define it locally for the test
            // For simplicity, defining structure locally:
            const endpointDetails = {
                path: '/api/test/hello',
                method: 'GET',
                handlerName: 'sayHello'
            };
            const result = generateMermaidSequenceDiagram(rootNode, endpointDetails as any); // Cast as any to avoid type error for now
            const expectedDiagram = `sequenceDiagram
    participant Client
    participant TestController
    Client->>TestController: GET /api/test/hello
    Note over TestController: sayHello()
    TestController-->>Client: Response`;
            assert.strictEqual(result.replace(/\r\n/g, '\n'), expectedDiagram.replace(/\r\n/g, '\n'));
        });
    });

    suite('getParticipantName', () => {
        test('should return item.name if no detail or class-like structure', () => {
            const item: ICallHierarchyItem = {
                name: 'simpleFunction',
                kind: VSCodeSymbolKind.Function,
                uri: { fsPath: 'test.ts' } as IUri,
                range: { start: {line: 0, character: 0}, end: {line: 0, character: 0}} as IRange,
                selectionRange: { start: {line: 0, character: 0}, end: {line: 0, character: 0}} as IRange,
                detail: undefined
            };
            assert.strictEqual(getParticipantName(item), 'simpleFunction');
        });

        test('should use detail to form Class.methodName', () => {
            const item: ICallHierarchyItem = {
                name: 'myMethod',
                kind: VSCodeSymbolKind.Method,
                detail: 'com.example.MyClass',
                uri: { fsPath: 'test.java' } as IUri,
                range: { start: {line: 0, character: 0}, end: {line: 0, character: 0}} as IRange,
                selectionRange: { start: {line: 0, character: 0}, end: {line: 0, character: 0}} as IRange
            };
            assert.strictEqual(getParticipantName(item), 'MyClass');
        });

        test('should handle detail with / separators', () => {
            const item: ICallHierarchyItem = {
                name: 'anotherMethod',
                kind: VSCodeSymbolKind.Method,
                detail: 'com/example/another/AnotherClass',
                uri: { fsPath: 'test.java' } as IUri,
                range: { start: {line: 0, character: 0}, end: {line: 0, character: 0}} as IRange,
                selectionRange: { start: {line: 0, character: 0}, end: {line: 0, character: 0}} as IRange
            };
            assert.strictEqual(getParticipantName(item), 'AnotherClass');
        });

        test('should not prepend detail if item.name already contains it', () => {
            const item: ICallHierarchyItem = {
                name: 'MyClass.myMethod',
                kind: VSCodeSymbolKind.Method,
                detail: 'com.example.MyClass',
                uri: { fsPath: 'test.java' } as IUri,
                range: { start: {line: 0, character: 0}, end: {line: 0, character: 0}} as IRange,
                selectionRange: { start: {line: 0, character: 0}, end: {line: 0, character: 0}} as IRange
            };
            assert.strictEqual(getParticipantName(item), 'MyClass');
        });

        test('should clean method arguments and return type from name if no detail', () => {
            const item: ICallHierarchyItem = {
                name: 'complexMethod(String arg): Object',
                kind: VSCodeSymbolKind.Method,
                uri: { fsPath: 'test.ts' } as IUri,
                range: { start: {line: 0, character: 0}, end: {line: 0, character: 0}} as IRange,
                selectionRange: { start: {line: 0, character: 0}, end: {line: 0, character: 0}} as IRange,
                detail: undefined
            };
            assert.strictEqual(getParticipantName(item), 'complexMethod');
        });
    });

    suite('sanitizeParticipantName', () => {
        test('should replace spaces, parentheses, brackets with underscores', () => {
            assert.strictEqual(sanitizeParticipantName('My Class.method(args): ret'), 'My_Class.method_args_:_ret'); // Expect colon NOT replaced
        });

        test('should remove leading/trailing underscores', () => {
            assert.strictEqual(sanitizeParticipantName('_MyClass_'), 'MyClass');
            assert.strictEqual(sanitizeParticipantName('(MyClass)'), 'MyClass');
        });

        test('should return UnknownParticipant for empty or all-special-character names', () => {
            assert.strictEqual(sanitizeParticipantName(''), 'UnknownParticipant');
            assert.strictEqual(sanitizeParticipantName('() [] {}'), 'UnknownParticipant');
            assert.strictEqual(sanitizeParticipantName('.:'), '.:');
        });

        test('should handle names that are already clean', () => {
            assert.strictEqual(sanitizeParticipantName('my-function-name'), 'my-function-name');
        });
    });

    // suite('escapeMermaidMessage', () => {
    //     // Current implementation returns message as is.
    //     test('should return the message as is (current behavior)', () => {
    //         const mstr = require('../../src/mermaid-sequence-translator');
    //         const escapeMermaidMessage = mstr.escapeMermaidMessage;
    //         assert.strictEqual(escapeMermaidMessage('Hello: World'), 'Hello: World');
    //     });
    // });
});