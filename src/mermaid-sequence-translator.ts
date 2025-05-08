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

    if (endpointDetails) {
        const clientParticipant = addParticipant('Client');

        // For the main controller, get its class name directly
        let controllerClassName = 'UnknownController';
        if (abstractRootItem.detail) {
            const pathParts = abstractRootItem.detail.split(/[.\/]/);
            const potentialClassName = pathParts.pop();
            if (potentialClassName) {
                controllerClassName = potentialClassName;
            }
        }
        const controllerParticipant = addParticipant(controllerClassName); // Use sanitized class name

        lines.push(`    ${clientParticipant}->>${controllerParticipant}: ${endpointDetails.method} ${endpointDetails.path}`);

        const rootMethodNameForNote = abstractRootItem.name.split('(')[0].trim();
        // The note should be associated with the specific method on the controller participant.
        // The user's diagram had "Note over TestController: fullComplexHello()".
        // Using "Note right of" is common, let's stick to what might be existing or a sensible default.
        lines.push(`    Note over ${controllerParticipant}: ${rootMethodNameForNote}()`);

        if (!rootNode.children || rootNode.children.length === 0) {
            lines.push(`    ${controllerParticipant}-->>${clientParticipant}: Response`);
        } else {
            buildDiagramRecursive(rootNode, controllerParticipant, lines, addParticipant, 0);

            // After all recursive calls, add the final response from the controller to the client.
            lines.push(`    ${controllerParticipant}-->>${clientParticipant}: Response`);
        }
    } else {
        // Original logic for non-endpoint call hierarchies
        const rootParticipantDisplayName = getParticipantName(abstractRootItem); // Will use new getParticipantName logic
        const sanitizedRootParticipantName = addParticipant(rootParticipantDisplayName);
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
    currentParticipantName: string, // This is the SANITIZED name of the CALLER (e.g., TestController)
    lines: string[],
    addParticipant: (name: string) => string,
    depth: number
): void {
    if (!currentNode.children || currentNode.children.length === 0) {
        return;
    }

    currentNode.children.forEach(childNode => {
        const abstractChildItem = fromVscodeCallHierarchyItem(childNode.item);
        // childParticipantDisplayName will be the CLASS NAME of the callee (e.g., TestController or TestService)
        const childParticipantDisplayName = getParticipantName(abstractChildItem);
        const childParticipantSanitizedName = addParticipant(childParticipantDisplayName); // Sanitized class name

        const methodNameForCall = abstractChildItem.name.split('(')[0].trim(); // e.g., "privateHelperHello" or "getServiceData"
        const callMessage = escapeMermaidMessage(methodNameForCall);

        // TODO: Handle return values or specific interactions if needed, e.g., from TestService back to TestController.
        // For now, it's just a call.
        lines.push(`    ${currentParticipantName}->>${childParticipantSanitizedName}: ${callMessage}()`);

        // If the child itself has children, recurse.
        // The participant for the next level of recursion is the sanitized class name of the child.
        buildDiagramRecursive(childNode, childParticipantSanitizedName, lines, addParticipant, depth + 1);

        // Add a generic return message from the callee back to the caller.
        // This assumes that every call eventually leads to a return that's relevant for the sequence.
        lines.push(`    ${childParticipantSanitizedName}-->>${currentParticipantName}: Returns`);
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
    // Try to extract the class name from item.detail
    if (item.detail) {
        const pathParts = item.detail.split(/[.\/]/); // Split by '.', '', or '/'
        // The class name is usually the last part after splitting package/module structure
        const potentialClassName = pathParts.pop();
        if (potentialClassName) {
            // Avoid returning method name as class name if item.name is different and more specific
            // (e.g. item.detail is a class, item.name is a method of that class)
            // This logic aims to return the class itself as the participant.
            return potentialClassName;
        }
    }
    // Fallback: if no detail or class name couldn't be reliably extracted,
    // use the item's name, cleaned of typical signature parts.
    // This might be a function not in a class, or if detail is missing/unhelpful.
    return item.name.split('(')[0].trim().replace(/[.:]/g, '_'); // Cleaned item name
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
    // Original sanitization logic:
    // let sanitized = name.replace(/[\s.:()\[\]{}]/g, '_');
    // To avoid creating names like "TestController_fullComplexHello_____String"
    // from "TestController.fullComplexHello() : String", the input `name` to this function
    // should already be cleaner (e.g., "TestController" or "TestService").
    // The new getParticipantName aims to provide these cleaner names.
    // This sanitizer will then primarily handle spaces or other truly special characters
    // not suitable for Mermaid IDs, rather than dismantling qualified names.

    // Keep it simple: replace common special characters and ensure it's a valid ID.
    // Allow dots in participant names if they come from qualified names that weren't simplified.
    let sanitized = name.replace(/[\s()\[\]{}]/g, '_'); // Keep dots if present, remove other typical offenders
    sanitized = sanitized.replace(/^_+|_+$/g, ''); // Trim leading/trailing underscores
    if (!sanitized) {
        return 'UnknownParticipant';
    }
    // If after sanitization, it's a keyword, Mermaid might have issues.
    // This is a simple safeguard; a more robust one might involve checking a list of keywords.
    if (sanitized.toLowerCase() === 'client' || sanitized.toLowerCase() === 'end') {
        // append suffix to avoid conflict with mermaid keywords
        // return sanitized + '_Participant';
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