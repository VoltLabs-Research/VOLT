import { reconcileElements } from '@excalidraw/excalidraw';
import type { WhiteboardAppState, WhiteboardElement, WhiteboardFiles } from '@/modules/whiteboards/contracts/excalidraw';

const PERSISTABLE_APP_STATE_KEYS = new Set([
    'viewBackgroundColor',
    'gridSize',
    'gridColor'
]);

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

const hasEquivalentElementPayload = (current: WhiteboardElement, incoming: WhiteboardElement): boolean => {
    try {
        return JSON.stringify(current) === JSON.stringify(incoming);
    } catch {
        return false;
    }
};

const areStringArraysEqual = (left: string[], right: string[]): boolean => {
    return left.length === right.length && left.every((value, index) => value === right[index]);
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

    const versionDelta = incoming.version - current.version;
    if (versionDelta !== 0) {
        return versionDelta > 0;
    }

    const updatedDelta = incoming.updated - current.updated;
    if (updatedDelta !== 0) {
        return updatedDelta > 0;
    }

    const versionNonceDelta = incoming.versionNonce - current.versionNonce;
    if (versionNonceDelta !== 0) {
        return versionNonceDelta > 0;
    }

    return !hasEquivalentElementPayload(current, incoming);
};

export const filterPersistableAppState = (appState: WhiteboardAppState): WhiteboardAppState => {
    const result: WhiteboardAppState = {};
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

export const cloneWhiteboardFiles = (files: WhiteboardFiles): WhiteboardFiles => cloneSerializable(files);

export const mergeWhiteboardElements = (
    currentElements: WhiteboardElement[],
    incomingElements: WhiteboardElement[],
    incomingElementOrder?: string[]
): WhiteboardElement[] => {
    const merged = new Map<string, WhiteboardElement>();
    const currentOrder: string[] = [];
    const incomingOrder: string[] = [];

    for (const element of currentElements) {
        merged.set(element.id, element);
        currentOrder.push(element.id);
    }

    for (const element of incomingElements) {
        incomingOrder.push(element.id);
        if (shouldReplaceElement(merged.get(element.id), element)) {
            merged.set(element.id, element);
        }
    }

    if (incomingElementOrder?.length) {
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
    currentAppState: WhiteboardAppState,
    incomingAppState: WhiteboardAppState
): WhiteboardAppState => ({
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
        currentElementsById.set(element.id, element);
        currentOrder.push(element.id);
    }

    for (const element of nextElements) {
        nextOrder.push(element.id);
        const currentElement = currentElementsById.get(element.id);
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
        if (element.fileId) {
            fileIds.add(element.fileId);
        }
    }

    return Array.from(fileIds);
};
