import type { WhiteboardElement } from '@modules/whiteboards/contracts/whiteboard';

/**
 * Conflict resolution between two revisions of the same element: the highest
 * (version, updated, versionNonce) wins. When all three tie the payloads are
 * compared, so a re-send of an identical element is not a change.
 */
export const shouldReplaceElement = (current: WhiteboardElement | undefined, incoming: WhiteboardElement): boolean => {
    if(!current){
        return true;
    }

    for(const field of ['version', 'updated', 'versionNonce'] as const){
        const delta = (incoming[field] ?? 0) - (current[field] ?? 0);
        if(delta !== 0){
            return delta > 0;
        }
    }

    return JSON.stringify(current) !== JSON.stringify(incoming);
};

/**
 * Flattens the candidate orders into a single z-order: earlier sources win, ids
 * unknown to `elements` are dropped and elements no source mentions are appended
 * so nothing silently disappears from the scene.
 */
export const orderElementIds = (elements: Map<string, WhiteboardElement>, ...preferredOrders: string[][]): string[] => {
    const ordered: string[] = [];
    const seen = new Set<string>();

    for(const id of preferredOrders.flat()){
        if(seen.has(id) || !elements.has(id)) continue;
        seen.add(id);
        ordered.push(id);
    }

    for(const id of elements.keys()){
        if(!seen.has(id)) ordered.push(id);
    }

    return ordered;
};

export const isSameOrder = (left: string[], right: string[]): boolean =>
    left.length === right.length && left.every((id, index) => id === right[index]);
