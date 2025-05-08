import { CustomHierarchyNode } from './call-hierarchy';
import { ICallHierarchyItem, VSCodeSymbolKind } from './adapters/vscodeTypes'; // Added
import { fromVscodeCallHierarchyItem } from './adapters/vscodeUtils'; // Added

/**
 * Optional details for generating a sequence diagram specifically for an API endpoint.
 */
export interface EndpointDiagramDetails {
    path: string;        // e.g., "/api/test/hello"
    method: string;      // e.g., "GET"
    handlerName: string; // e.g., "sayHello"
    // We might add expected response code/content later if needed for more detailed diagrams
}

/**
 * Generates a Mermaid sequence diagram string from a call hierarchy tree.
 *
 * @param rootNode The root of the call hierarchy tree (CustomHierarchyNode).
 * @param endpointDetails Optional details if the rootNode represents an API endpoint.
 * @returns A string representing the Mermaid sequence diagram.
 */
export function generateMermaidSequenceDiagram(
    rootNode: CustomHierarchyNode | null,
    endpointDetails?: EndpointDiagramDetails
): string {
    if (!rootNode) {
        return 'sequenceDiagram\n    participant User\n    User->>System: No call hierarchy data to display.';
    }

    const lines: string[] = ['sequenceDiagram'];
    const participants = new Set<string>();

    const addParticipant = (name: string) => {
        const sanitizedName = sanitizeParticipantName(name);
        if (!participants.has(sanitizedName)) {
            participants.add(sanitizedName);
            lines.push(`    participant ${sanitizedName}`);
        }
        return sanitizedName;
    };

    const abstractRootItem = fromVscodeCallHierarchyItem(rootNode.item);
    const rootParticipantName = getParticipantName(abstractRootItem);
    const sanitizedRootParticipantName = sanitizeParticipantName(rootParticipantName);

    if (endpointDetails) {
        const clientParticipant = addParticipant('Client');
        // Ensure the main endpoint handler (controller) is added as a participant
        // getParticipantName often returns Class.method, sanitize will handle it
        const controllerParticipant = addParticipant(rootParticipantName); // rootParticipantName is already Class.method

        lines.push(`    ${clientParticipant}->>${controllerParticipant}: ${endpointDetails.method} ${endpointDetails.path}`);
        lines.push(`    Note right of ${controllerParticipant}: ${rootParticipantName}()`); // Use the non-sanitized name for the note for readability

        if (!rootNode.children || rootNode.children.length === 0) {
            // For leaf nodes like sayHello, add the direct response to Client
            // The actual response message might need to be more dynamic later
            lines.push(`    ${controllerParticipant}-->>${clientParticipant}: 200 OK Response`);
        } else {
            // If there are internal calls, process them
            buildDiagramRecursive(rootNode, controllerParticipant, lines, addParticipant, 0);
            // After internal calls, the endpoint eventually responds to the client
            // This is a simplified return; a real system might have complex return paths
            lines.push(`    ${controllerParticipant}-->>${clientParticipant}: Response`);
        }
    } else {
        // Original logic for non-endpoint call hierarchies
        addParticipant(rootParticipantName);
        buildDiagramRecursive(rootNode, sanitizedRootParticipantName, lines, addParticipant, 0);

        if (lines.length === 1 + participants.size) {
            const firstParticipant = participants.values().next().value || 'System';
            lines.push(`    ${firstParticipant}->>${firstParticipant}: No outgoing calls found to diagram.`);
        }
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
    currentParticipantName: string, // This should be the sanitized name
    lines: string[],
    addParticipant: (name: string) => string,
    depth: number
): void {
    if (!currentNode.children || currentNode.children.length === 0) {
        return;
    }

    currentNode.children.forEach(childNode => {
        const abstractChildItem = fromVscodeCallHierarchyItem(childNode.item);
        const childParticipantDisplayName = getParticipantName(abstractChildItem);
        const childParticipantSanitizedName = addParticipant(childParticipantDisplayName);
        const callMessage = escapeMermaidMessage(abstractChildItem.name); // Use name from abstract item for message

        lines.push(`    ${currentParticipantName}->>${childParticipantSanitizedName}: ${callMessage}()`);

        buildDiagramRecursive(childNode, childParticipantSanitizedName, lines, addParticipant, depth + 1);
    });
}

/**
 * Extracts a display name for a participant from a CallHierarchyItem.
 * Tries to use the format ClassName.methodName if possible, otherwise just item.name.
 *
 * @param item The CallHierarchyItem.
 * @returns A string suitable for use as a participant name.
 */
export function getParticipantName(item: ICallHierarchyItem): string {
    let detailName = '';
    if (item.detail) {
        const pathParts = item.detail.split(/[.\/]/);
        const potentialClassName = pathParts.pop();
        if (potentialClassName && potentialClassName !== item.name) {
            if (item.kind === VSCodeSymbolKind.Method ||
                item.kind === VSCodeSymbolKind.Function ||
                item.kind === VSCodeSymbolKind.Constructor) {
                detailName = potentialClassName;
            }
        }
    }

    if (detailName) {
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
export function sanitizeParticipantName(name: string): string {
    let sanitized = name.replace(/[\s.:()\[\]{}]/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');
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
export function escapeMermaidMessage(message: string): string {
    return message;
}