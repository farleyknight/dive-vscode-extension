import * as assert from 'assert';
import * as vscode from 'vscode';
import {
    generateMermaidSequenceDiagram,
    getParticipantName,
    sanitizeParticipantName,
    // escapeMermaidMessage // Add if tests for it are un-commented
} from '../../src/mermaid-sequence-translator';
import { CustomHierarchyNode } from '../../src/call-hierarchy'; // Assuming path

// Helper to access internal functions if they are not exported
// This is a bit of a hack; ideally, these would be tested directly if exported,
// or indirectly through generateMermaidSequenceDiagram.
// For now, let's assume we might need to test them.
// If getParticipantName and sanitizeParticipantName are exported, direct import is better.


suite('MermaidSequenceTranslator', () => {
    suite('generateMermaidSequenceDiagram', () => {
        test('should return a diagram for no call hierarchy data if rootNode is null', () => {
            const expectedDiagram = 'sequenceDiagram\n    participant User\n    User->>System: No call hierarchy data to display.';
            assert.strictEqual(generateMermaidSequenceDiagram(null), expectedDiagram);
        });

        test('should return a diagram indicating no outgoing calls if rootNode has no children', () => {
            const rootItem: vscode.CallHierarchyItem = {
                name: 'mainFunction',
                kind: vscode.SymbolKind.Function,
                uri: vscode.Uri.file('test.ts'),
                range: new vscode.Range(0, 0, 0, 0),
                selectionRange: new vscode.Range(0, 0, 0, 0)
            };
            const rootNode: CustomHierarchyNode = { item: rootItem, children: [], parents: [] };
            const expectedDiagram = 'sequenceDiagram\n    participant mainFunction\n    mainFunction->>mainFunction: No outgoing calls found to diagram.';
            // Note: sanitizeParticipantName will be implicitly tested here.
            // If mainFunction needs sanitization, the expected participant name should reflect that.
            // For this test, assuming 'mainFunction' is a valid sanitized name.
            assert.strictEqual(generateMermaidSequenceDiagram(rootNode), expectedDiagram);
        });

        test('should generate a diagram for a simple parent-child relationship', () => {
            const parentItem: vscode.CallHierarchyItem = {
                name: 'ParentClass.parentMethod',
                kind: vscode.SymbolKind.Method,
                uri: vscode.Uri.file('test.java'),
                range: new vscode.Range(0, 0, 0, 0),
                selectionRange: new vscode.Range(0, 0, 0, 0),
                detail: 'com.example.ParentClass'
            };
            const childItem: vscode.CallHierarchyItem = {
                name: 'childMethod',
                kind: vscode.SymbolKind.Method,
                uri: vscode.Uri.file('test.java'),
                range: new vscode.Range(1, 0, 1, 0),
                selectionRange: new vscode.Range(1, 0, 1, 0),
                detail: 'com.example.ChildClass'
            };
            const childNode: CustomHierarchyNode = { item: childItem, children: [], parents: [] };
            const parentNode: CustomHierarchyNode = { item: parentItem, children: [childNode], parents: [] };

            // Expected names after getParticipantName and sanitizeParticipantName
            // Parent: ParentClass.parentMethod (sanitized if needed, but seems ok)
            // Child: ChildClass.childMethod (sanitized if needed)
            const expectedDiagramLines = [
                'sequenceDiagram',
                '    participant ParentClass_parentMethod', // Assuming sanitize replaces '.' with '_'
                '    participant ChildClass_childMethod',   // Assuming sanitize replaces '.' with '_'
                '    ParentClass_parentMethod->>ChildClass_childMethod: childMethod()'
            ];
            const result = generateMermaidSequenceDiagram(parentNode);
            // Normalize line endings and split for comparison
            const resultLines = result.replace(/\r\n/g, '\n').split('\n');

            assert.deepStrictEqual(resultLines.slice(0,1), expectedDiagramLines.slice(0,1)); // sequenceDiagram
            assert.strictEqual(resultLines.length, 4, "Diagram should have 4 lines");

            // Participant order can vary, so check them with Sets or by finding them
            const participantsFromResult = new Set(resultLines.slice(1,3));
            const expectedParticipants = new Set(expectedDiagramLines.slice(1,3));
            assert.deepStrictEqual(participantsFromResult, expectedParticipants, "Participants do not match");

            assert.strictEqual(resultLines[3], expectedDiagramLines[3], "Call line does not match");

        });

        // Add more tests: deeper hierarchy, multiple children, calls needing escaping
    });

    suite('getParticipantName', () => {
        test('should return item.name if no detail or class-like structure', () => {
            const item: vscode.CallHierarchyItem = {
                name: 'simpleFunction',
                kind: vscode.SymbolKind.Function,
                uri: vscode.Uri.file('test.ts'),
                range: new vscode.Range(0,0,0,0), selectionRange: new vscode.Range(0,0,0,0)
            };
            assert.strictEqual(getParticipantName(item), 'simpleFunction');
        });

        test('should use detail to form Class.methodName', () => {
            const item: vscode.CallHierarchyItem = {
                name: 'myMethod',
                kind: vscode.SymbolKind.Method,
                detail: 'com.example.MyClass',
                uri: vscode.Uri.file('test.java'),
                range: new vscode.Range(0,0,0,0), selectionRange: new vscode.Range(0,0,0,0)
            };
            assert.strictEqual(getParticipantName(item), 'MyClass.myMethod');
        });

        test('should handle detail with / separators', () => {
            const item: vscode.CallHierarchyItem = {
                name: 'anotherMethod',
                kind: vscode.SymbolKind.Method,
                detail: 'com/example/another/AnotherClass',
                uri: vscode.Uri.file('test.java'),
                range: new vscode.Range(0,0,0,0), selectionRange: new vscode.Range(0,0,0,0)
            };
            assert.strictEqual(getParticipantName(item), 'AnotherClass.anotherMethod');
        });

        test('should not prepend detail if item.name already contains it', () => {
            const item: vscode.CallHierarchyItem = {
                name: 'MyClass.myMethod',
                kind: vscode.SymbolKind.Method,
                detail: 'com.example.MyClass',
                uri: vscode.Uri.file('test.java'),
                range: new vscode.Range(0,0,0,0), selectionRange: new vscode.Range(0,0,0,0)
            };
            assert.strictEqual(getParticipantName(item), 'MyClass.myMethod');
        });

         test('should use item.name if detail is the same as item.name (heuristic check)', () => {
            const item: vscode.CallHierarchyItem = {
                name: 'constructor',
                kind: vscode.SymbolKind.Constructor,
                detail: 'constructor', // e.g. Python __init__ might appear this way
                uri: vscode.Uri.file('test.py'),
                range: new vscode.Range(0,0,0,0), selectionRange: new vscode.Range(0,0,0,0)
            };
            assert.strictEqual(getParticipantName(item), 'constructor');
        });
    });

    suite('sanitizeParticipantName', () => {
        test('should replace spaces, dots, colons, parentheses, brackets with underscores', () => {
            assert.strictEqual(sanitizeParticipantName('My Class.method(args): ret'), 'My_Class_method_args___ret');
        });

        test('should remove leading/trailing underscores', () => {
            assert.strictEqual(sanitizeParticipantName('.MyClass.'), 'MyClass'); // from " My Class " -> "_My_Class_" -> "My_Class"
            assert.strictEqual(sanitizeParticipantName('  leading space.and.dots '), 'leading_space_and_dots');
        });

        test('should return UnknownParticipant for empty or all-special-character names', () => {
            assert.strictEqual(sanitizeParticipantName(''), 'UnknownParticipant');
            assert.strictEqual(sanitizeParticipantName(' '), 'UnknownParticipant');
            assert.strictEqual(sanitizeParticipantName(' .:()[]{} '), 'UnknownParticipant');
        });

        test('should handle names that become valid after sanitization', () => {
            assert.strictEqual(sanitizeParticipantName('my-function-name'), 'my-function-name'); // Hyphens are not in the replace list
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