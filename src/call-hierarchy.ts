import * as vscode from 'vscode';
import * as path from 'path'; // For logging, if needed

// Define our custom node structure for the call hierarchy
export interface CustomHierarchyNode {
    item: vscode.CallHierarchyItem;
    children: CustomHierarchyNode[];
    parents: CustomHierarchyNode[];
    // depth?: number; // Optional: for managing recursion depth
    // uniqueId?: string; // Optional: for easier tracking/deduplication
}

const MAX_CALL_HIERARCHY_DEPTH = 5; // Max depth for fetching outgoing calls

/**
 * Creates a unique ID for a CallHierarchyItem to avoid cycles.
 */
function getCallHierarchyItemUniqueId(item: vscode.CallHierarchyItem): string {
    return `${item.uri.toString()}|${item.selectionRange.start.line}|${item.selectionRange.start.character}|${item.name}|${item.kind}`;
}

/**
 * Prepares the initial call hierarchy item for a given position in a document.
 * This is the first step before fetching incoming/outgoing calls.
 */
async function prepareInitialCallHierarchyItem(
    uri: vscode.Uri,
    position: vscode.Position,
    token: vscode.CancellationToken,
    logger: vscode.TelemetryLogger
): Promise<vscode.CallHierarchyItem | null> {
    if (token.isCancellationRequested) {
        logger.logUsage('prepareInitialCallHierarchyItem', { status: 'cancelled_before_prepare' });
        return null;
    }
    try {
        const initialItems = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
            'vscode.prepareCallHierarchy',
            uri,
            position
        );
        if (initialItems && initialItems.length > 0) {
            logger.logUsage('prepareInitialCallHierarchyItem', { status: 'success', itemCount: initialItems.length });
            return initialItems[0];
        } else {
            logger.logUsage('prepareInitialCallHierarchyItem', { status: 'no_items_returned' });
            return null;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.logError(error instanceof Error ? error : new Error(String(error)), { stage: 'prepareInitialCallHierarchyItem', message: errorMessage });
        logger.logUsage('prepareInitialCallHierarchyItem', { status: 'error', error: errorMessage });
        return null;
    }
}

async function fetchOutgoingCalls(
    item: vscode.CallHierarchyItem,
    token: vscode.CancellationToken,
    logger: vscode.TelemetryLogger
): Promise<vscode.CallHierarchyOutgoingCall[]> {
    if (token.isCancellationRequested) {
        logger.logUsage('fetchOutgoingCalls', { status: 'cancelled_before_fetch', itemName: item.name });
        return [];
    }
    try {
        const outgoingCalls = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
            'vscode.provideOutgoingCalls',
            item
        );
        logger.logUsage('fetchOutgoingCalls', { status: 'success', itemName: item.name, count: outgoingCalls?.length || 0 });
        return outgoingCalls || [];
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.logError(error instanceof Error ? error : new Error(String(error)), { stage: 'fetchOutgoingCalls', itemName: item.name, message: errorMessage });
        logger.logUsage('fetchOutgoingCalls', { status: 'error', itemName: item.name, error: errorMessage });
        return [];
    }
}

// Recursive helper to expand outgoing calls
async function expandOutgoingCallsRecursive(
    currentNode: CustomHierarchyNode,
    depth: number,
    visitedIds: Set<string>,
    token: vscode.CancellationToken,
    logger: vscode.TelemetryLogger
): Promise<void> {
    const itemId = getCallHierarchyItemUniqueId(currentNode.item);

    // Check for max depth or if the current node itself creates a cycle with an ancestor
    if (depth >= MAX_CALL_HIERARCHY_DEPTH) {
        logger.logUsage('expandOutgoingCallsRecursive', { status: 'max_depth_reached', itemName: currentNode.item.name, depth });
        return;
    }
    if (visitedIds.has(itemId)) {
        logger.logUsage('expandOutgoingCallsRecursive', { status: 'cycle_detected_current_node', itemName: currentNode.item.name, depth });
        return;
    }

    visitedIds.add(itemId); // Add current node to visited set for this path

    if (token.isCancellationRequested) {
        logger.logUsage('expandOutgoingCallsRecursive', { status: 'cancelled_entry', itemName: currentNode.item.name, depth });
        visitedIds.delete(itemId); // Clean up visitedId for this path as it's aborting
        return;
    }

    const outgoingCalls = await fetchOutgoingCalls(currentNode.item, token, logger);

    // If cancellation happened during fetchOutgoingCalls, the token will be set
    if (token.isCancellationRequested) {
        logger.logUsage('expandOutgoingCallsRecursive', { status: 'cancelled_after_fetch', itemName: currentNode.item.name, depth });
        visitedIds.delete(itemId); // Clean up
        return;
    }

    for (const call of outgoingCalls) {
        const childsActualItem = call.to;
        const childsUniqueId = getCallHierarchyItemUniqueId(childsActualItem);

        // Check if adding this specific child would form a cycle with an ancestor on the current path
        if (visitedIds.has(childsUniqueId)) {
            logger.logUsage('expandOutgoingCallsRecursive', {
                status: 'cycle_child_skipped',
                childName: childsActualItem.name,
                parentName: currentNode.item.name,
                depth
            });
            continue; // Skip this child as it would form a cycle
        }

        const childNode: CustomHierarchyNode = {
            item: childsActualItem,
            children: [],
            parents: [currentNode], // Simple parent tracking
        };
        currentNode.children.push(childNode);
        await expandOutgoingCallsRecursive(childNode, depth + 1, visitedIds, token, logger);

        // If recursion for a child was cancelled, the main token might be set.
        // Stop processing further siblings if global cancellation is triggered.
        if (token.isCancellationRequested) {
            logger.logUsage('expandOutgoingCallsRecursive', { status: 'cancelled_in_sibling_expansion', itemName: currentNode.item.name, depth });
            break;
        }
    }

    visitedIds.delete(itemId); // Remove current node from visited set as we backtrack from this path
}

/**
 * Builds a tree structure representing the call hierarchy starting from an initial item.
 * (Currently a stub that only prepares the root item)
 */
export async function buildCallHierarchyTree(
    uri: vscode.Uri,
    position: vscode.Position,
    logger: vscode.TelemetryLogger,
    token: vscode.CancellationToken
): Promise<CustomHierarchyNode | null> {
    logger.logUsage('buildCallHierarchyTree', { status: 'started' });

    const initialItem = await prepareInitialCallHierarchyItem(uri, position, token, logger);

    if (token.isCancellationRequested) {
        logger.logUsage('buildCallHierarchyTree', { status: 'cancelled_after_prepare' });
        return null;
    }

    if (!initialItem) {
        logger.logUsage('buildCallHierarchyTree', { status: 'initial_prepare_failed' });
        return null;
    }

    const rootNode: CustomHierarchyNode = {
        item: initialItem,
        children: [],
        parents: [],
    };

    const visitedIdsOnPath = new Set<string>();
    await expandOutgoingCallsRecursive(rootNode, 0, visitedIdsOnPath, token, logger);

    if (token.isCancellationRequested && rootNode.children.length === 0) { // More precise cancellation check
        // If cancelled very early in expansion, or if prepare was successful but expansion yielded nothing due to cancellation
        logger.logUsage('buildCallHierarchyTree', { status: 'completed_cancelled_early_in_expansion', itemName: initialItem.name });
        return rootNode; // Return potentially empty/partial root if cancelled.
    } else if (token.isCancellationRequested) {
        logger.logUsage('buildCallHierarchyTree', { status: 'completed_cancelled_during_expansion', itemName: initialItem.name, childrenCount: rootNode.children.length });
        return rootNode;
    }

    logger.logUsage('buildCallHierarchyTree', { status: 'completed_successfully', itemName: initialItem.name, childrenCount: rootNode.children.length });
    return rootNode;
}