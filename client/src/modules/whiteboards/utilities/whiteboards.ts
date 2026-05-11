import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';
import { reconcileElements } from '@excalidraw/excalidraw';

/**
 * Excalidraw `appState` keys that are safe to persist across sessions.
 * Transient fields (collaborators, loading flags, active selections, etc.)
 * are intentionally excluded to avoid restoring stale UI state.
 */
const PERSISTABLE_APP_STATE_KEYS = new Set([
    'viewBackgroundColor',
    'gridSize',
    'gridColor'
]);

type WhiteboardElement = Record<string, unknown>;
type WhiteboardAppState = Record<string, unknown>;

interface WhiteboardSceneDelta {
    changed: boolean;
    elements: WhiteboardElement[];
    appState: WhiteboardAppState;
    elementOrder?: string[];
};

const cloneSerializable = <T,>(value: T): T => {
    try {
        return JSON.parse(JSON.stringify(value)) as T;
    } catch {
        return value;
    }
};

const normalizeWhiteboardCollaborators = (
    sourceAppState: WhiteboardAppState,
    nextAppState: WhiteboardAppState
): WhiteboardAppState => {
    const sourceCollaborators = sourceAppState['collaborators'];
    if (sourceCollaborators instanceof Map) {
        return {
            ...nextAppState,
            collaborators: new Map(sourceCollaborators)
        };
    }

    const nextCollaborators = nextAppState['collaborators'];
    if (nextCollaborators instanceof Map) {
        return {
            ...nextAppState,
            collaborators: new Map(nextCollaborators)
        };
    }

    if (
        Object.prototype.hasOwnProperty.call(nextAppState, 'collaborators')
        && nextCollaborators !== undefined
    ) {
        return {
            ...nextAppState,
            collaborators: new Map()
        };
    }

    return nextAppState;
};

const getElementId = (element: WhiteboardElement): string | null => {
    const id = element.id;
    return typeof id === 'string' && id.length > 0 ? id : null;
};

const getElementVersion = (element: WhiteboardElement): number => {
    return typeof element.version === 'number' && Number.isFinite(element.version)
        ? element.version
        : 0;
};

const getElementUpdated = (element: WhiteboardElement): number => {
    return typeof element.updated === 'number' && Number.isFinite(element.updated)
        ? element.updated
        : 0;
};

const getElementVersionNonce = (element: WhiteboardElement): number => {
    return typeof element.versionNonce === 'number' && Number.isFinite(element.versionNonce)
        ? element.versionNonce
        : 0;
};

const hasEquivalentElementPayload = (current: WhiteboardElement, incoming: WhiteboardElement): boolean => {
    try {
        return JSON.stringify(current) === JSON.stringify(incoming);
    } catch {
        return false;
    }
};

const areStringArraysEqual = (left: string[], right: string[]): boolean => {
    if (left.length !== right.length) {
        return false;
    }

    for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index]) {
            return false;
        }
    }

    return true;
};

const buildOrderedElements = (
    elements: Map<string, WhiteboardElement>,
    primaryOrder: string[],
    secondaryOrder: string[]
): WhiteboardElement[] => {
    const orderedIds = new Set<string>();
    const orderedElements: WhiteboardElement[] = [];

    const appendById = (id: string) => {
        if (orderedIds.has(id)) {
            return;
        }

        const element = elements.get(id);
        if (!element) {
            return;
        }

        orderedIds.add(id);
        orderedElements.push(element);
    };

    for (const id of primaryOrder) {
        appendById(id);
    }

    for (const id of secondaryOrder) {
        appendById(id);
    }

    for (const [id, element] of elements.entries()) {
        if (orderedIds.has(id)) {
            continue;
        }

        orderedIds.add(id);
        orderedElements.push(element);
    }

    return orderedElements;
};

const reconcileWhiteboardElements = (
    currentElements: WhiteboardElement[],
    incomingElements: WhiteboardElement[]
): WhiteboardElement[] => {
    try {
        return reconcileElements(
            currentElements as never,
            incomingElements as never,
            {} as never
        ) as unknown as WhiteboardElement[];
    } catch {
        return incomingElements;
    }
};

const shouldReplaceElement = (current: WhiteboardElement | undefined, incoming: WhiteboardElement): boolean => {
    if (!current) {
        return true;
    }

    const versionDelta = getElementVersion(incoming) - getElementVersion(current);
    if (versionDelta !== 0) {
        return versionDelta > 0;
    }

    const updatedDelta = getElementUpdated(incoming) - getElementUpdated(current);
    if (updatedDelta !== 0) {
        return updatedDelta > 0;
    }

    const versionNonceDelta = getElementVersionNonce(incoming) - getElementVersionNonce(current);
    if (versionNonceDelta !== 0) {
        return versionNonceDelta > 0;
    }

    return !hasEquivalentElementPayload(current, incoming);
};

/**
 * Returns a copy of `appState` containing only fields that are safe to
 * persist to the server. Filters out transient, session-only fields such
 * as collaboration data, loading flags, and active-selection state.
 */
export const filterPersistableAppState = (
    appState: Record<string, unknown>
): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const key of PERSISTABLE_APP_STATE_KEYS) {
        if (key in appState) {
            result[key] = appState[key];
        }
    }
    return result;
};

export const cloneWhiteboardElements = (
    elements: WhiteboardElement[]
): WhiteboardElement[] => cloneSerializable(elements);

export const cloneWhiteboardAppState = (
    appState: WhiteboardAppState
): WhiteboardAppState => normalizeWhiteboardCollaborators(
    appState,
    cloneSerializable(appState)
);

export const normalizeWhiteboardRuntimeAppState = (
    appState: WhiteboardAppState
): WhiteboardAppState => normalizeWhiteboardCollaborators(appState, { ...appState });

export const cloneWhiteboardFiles = <TFiles extends Record<string, unknown> | undefined>(
    files: TFiles
): TFiles => cloneSerializable(files);

export const mergeWhiteboardElements = (
    currentElements: WhiteboardElement[],
    incomingElements: WhiteboardElement[],
    incomingElementOrder?: string[]
): WhiteboardElement[] => {
    const merged = new Map<string, WhiteboardElement>();
    const currentOrder: string[] = [];
    const incomingOrder: string[] = [];

    for (const element of currentElements) {
        const id = getElementId(element);
        if (!id) {
            continue;
        }

        merged.set(id, element);
        currentOrder.push(id);
    }

    for (const element of incomingElements) {
        const id = getElementId(element);
        if (!id) {
            continue;
        }

        incomingOrder.push(id);
        if (shouldReplaceElement(merged.get(id), element)) {
            merged.set(id, element);
        }
    }

    if (Array.isArray(incomingElementOrder) && incomingElementOrder.length > 0) {
        return reconcileWhiteboardElements(
            currentElements,
            buildOrderedElements(merged, incomingElementOrder, currentOrder)
        );
    }

    return reconcileWhiteboardElements(
        currentElements,
        buildOrderedElements(merged, currentOrder, incomingOrder)
    );
};

export const mergeWhiteboardAppState = (
    currentAppState: Record<string, unknown>,
    incomingAppState: Record<string, unknown>
): Record<string, unknown> => ({
    ...currentAppState,
    ...filterPersistableAppState(incomingAppState)
});

export const computeWhiteboardSceneDelta = (
    currentElements: WhiteboardElement[],
    nextElements: WhiteboardElement[],
    currentAppState: WhiteboardAppState,
    nextAppState: WhiteboardAppState
): WhiteboardSceneDelta => {
    const currentElementsById = new Map<string, WhiteboardElement>();
    const currentOrder: string[] = [];
    const nextOrder: string[] = [];
    const changedElements: WhiteboardElement[] = [];

    for (const element of currentElements) {
        const id = getElementId(element);
        if (!id) {
            continue;
        }

        currentElementsById.set(id, element);
        currentOrder.push(id);
    }

    for (const element of nextElements) {
        const id = getElementId(element);
        if (!id) {
            continue;
        }

        nextOrder.push(id);
        const currentElement = currentElementsById.get(id);
        if (!currentElement || !hasEquivalentElementPayload(currentElement, element)) {
            changedElements.push(element);
        }
    }

    const currentPersistableAppState = filterPersistableAppState(currentAppState);
    const nextPersistableAppState = filterPersistableAppState(nextAppState);
    const changedAppState: WhiteboardAppState = {};

    for (const [key, value] of Object.entries(nextPersistableAppState)) {
        if (!Object.is(currentPersistableAppState[key], value)) {
            changedAppState[key] = value;
        }
    }

    const elementOrderChanged = !areStringArraysEqual(currentOrder, nextOrder);

    return {
        changed: changedElements.length > 0 || elementOrderChanged || Object.keys(changedAppState).length > 0,
        elements: changedElements,
        appState: changedAppState,
        elementOrder: elementOrderChanged ? nextOrder : undefined
    };
};

export const extractWhiteboardFileIds = (elements: WhiteboardElement[]): string[] => {
    const fileIds = new Set<string>();

    for (const element of elements) {
        const fileId = element.fileId;
        if (typeof fileId === 'string' && fileId.length > 0) {
            fileIds.add(fileId);
        }
    }

    return Array.from(fileIds);
};

export const getDeleteConfirmationMessage = (selectedItems: Whiteboard[]): string => {
    if (selectedItems.length === 1) {
        return `Delete whiteboard "${selectedItems[0].title}"? This action cannot be undone.`;
    }

    return `Delete ${selectedItems.length} whiteboards? This action cannot be undone.`;
};
