import * as vscode from 'vscode';
import { CustomHierarchyNode } from './call-hierarchy'; // Assuming CustomHierarchyNode is exported from call-hierarchy.ts

/**
 * Generates a Mermaid sequence diagram string from a call hierarchy tree.
 *
 * @param rootNode The root of the call hierarchy tree (CustomHierarchyNode).
 * @returns A string representing the Mermaid sequence diagram.
 */
export function generateMermaidSequenceDiagram(rootNode: CustomHierarchyNode | null): string {
    if (!rootNode) {
        return 'sequenceDiagram\n    participant User\n    User->>System: No call hierarchy data to display.';
    }

    const lines: string[] = ['sequenceDiagram'];
    const participants = new Set<string>();

    // Helper function to add participants and ensure they are declared only once
    const addParticipant = (name: string) => {
        const sanitizedName = sanitizeParticipantName(name);
        if (!participants.has(sanitizedName)) {
            participants.add(sanitizedName);
            lines.push(`    participant ${sanitizedName}`);
        }
        return sanitizedName;
    };

    // Add the initial caller (e.g., the endpoint itself or a conceptual "User")
    // For now, let's use the root node's name as the first participant.
    // We might need a more sophisticated way to determine the ultimate "initiator" later.
    const rootParticipantName = addParticipant(getParticipantName(rootNode.item));

    // Recursive helper to build diagram lines
    buildDiagramRecursive(rootNode, rootParticipantName, lines, addParticipant, 0);

    if (lines.length === 1 + participants.size) { // Only "sequenceDiagram" and participant lines, no interactions
        const firstParticipant = participants.values().next().value || 'System';
        lines.push(`    ${firstParticipant}->>${firstParticipant}: No outgoing calls found to diagram.`);
    }


    return lines.join('\n');
}

/**
 * Recursively traverses the call hierarchy to build Mermaid sequence diagram lines.
 *
 * @param currentNode The current node in the CustomHierarchyNode tree.
 * @param currentParticipantName The Mermaid participant name of the current node's item.
 * @param lines An array of strings to which Mermaid diagram lines will be added.
 * @param addParticipant A helper function to add and get sanitized participant names.
 * @param depth Current recursion depth (for indentation or future use).
 */
function buildDiagramRecursive(
    currentNode: CustomHierarchyNode,
    currentParticipantName: string,
    lines: string[],
    addParticipant: (name: string) => string,
    depth: number
): void {
    if (!currentNode.children || currentNode.children.length === 0) {
        return;
    }

    currentNode.children.forEach(childNode => {
        const childParticipantName = addParticipant(getParticipantName(childNode.item));
        const callMessage = escapeMermaidMessage(childNode.item.name); // Escape message content

        // Standard call
        lines.push(`    ${currentParticipantName}->>${childParticipantName}: ${callMessage}()`);

        // Recursively process children of this child
        buildDiagramRecursive(childNode, childParticipantName, lines, addParticipant, depth + 1);

        // For simplicity, MVP doesn't explicitly model return values yet,
        // but you could add something like:
        // lines.push(`    ${childParticipantName}-->>${currentParticipantName}: return`);
        // Or use activate/deactivate for call spans
    });
}

/**
 * Extracts a display name for a participant from a CallHierarchyItem.
 * Tries to use the format ClassName.methodName if possible, otherwise just item.name.
 *
 * @param item The CallHierarchyItem.
 * @returns A string suitable for use as a participant name.
 */
function getParticipantName(item: vscode.CallHierarchyItem): string {
    // vscode.SymbolKind.Class = 4, vscode.SymbolKind.Interface = 10 (for item.kind)
    // item.detail often contains the class name or module path.
    // Example: item.name = "myMethod", item.detail = "com.example.MyClass"
    // We want "MyClass.myMethod" or just "myMethod" if class is not clear.

    let detailName = '';
    if (item.detail) {
        // Try to extract class name from a fully qualified path
        const pathParts = item.detail.split(/[.\/]/); // Split by '.', '', or '/'
        const potentialClassName = pathParts.pop(); // Get the last part
        if (potentialClassName && potentialClassName !== item.name) {
             // Heuristic: if the last part of detail is not the method name itself, it might be the class.
            // And if item.kind suggests it's a method or function within a structure.
            if (item.kind === vscode.SymbolKind.Method ||
                item.kind === vscode.SymbolKind.Function ||
                item.kind === vscode.SymbolKind.Constructor) {
                detailName = potentialClassName;
            }
        }
    }

    if (detailName) {
        // If the item name itself already contains the detailName (e.g. name is "MyClass.myMethod"), don't prepend.
        if (item.name.startsWith(detailName + '.')) {
            return item.name;
        }
        return `${detailName}.${item.name}`;
    }
    return item.name;
}


/**
 * Sanitizes a string to be a valid Mermaid participant name.
 * Mermaid participant names ideally shouldn't contain spaces or special characters
 * that might break the syntax. Replaces problematic characters.
 *
 * @param name The raw name.
 * @returns A sanitized name.
 */
function sanitizeParticipantName(name: string): string {
    // Replace spaces, dots, colons, parentheses, brackets with underscores
    // Remove or replace other characters as needed.
    // Mermaid also allows quoting: participant "Name with spaces"
    // However, for simplicity in linking, avoiding spaces is better.
    let sanitized = name.replace(/[\s.:()\[\]{}]/g, '_');
    // Remove any leading/trailing underscores that might result
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    // Ensure it's not empty
    if (!sanitized) {
        return 'UnknownParticipant';
    }
    return sanitized;
}

/**
 * Escapes characters in a message string that might conflict with Mermaid syntax.
 * For example, colons in messages need to be handled.
 * Mermaid generally allows most characters, but explicit escaping for known problematic ones is safer.
 *
 * @param message The message string.
 * @returns An escaped string suitable for display in a Mermaid diagram.
 */
function escapeMermaidMessage(message: string): string {
    // According to Mermaid docs, for messages (text on arrows), most things are fine.
    // However, a colon `:` can be problematic if not intended as a message separator.
    // Using HTML entity `#58;` for colon is a common workaround.
    // For now, let's keep it simple and see if direct usage works.
    // If issues arise, we can implement stricter escaping.
    // Example: return message.replace(/:/g, '#58;');
    return message; // Keep simple for now
}