import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';

import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';

type WhiteboardElement = Record<string, unknown>;
type WhiteboardAppState = Record<string, unknown>;

interface StoredWhiteboardScene {
    revision?: number;
    elements?: unknown[];
    appState?: WhiteboardAppState;
}

interface WhiteboardRoomState {
    whiteboardId: string;
    teamId: string;
    storageClusterId: string;
    payloadKey: string;
    revision: number;
    elements: Map<string, WhiteboardElement>;
    elementSignatures: Map<string, string>;
    elementOrder: string[];
    appState: WhiteboardAppState;
    snapshotCache: WhiteboardSceneSnapshot | null;
    persistTimer: ReturnType<typeof setTimeout> | null;
    lastEditedBy: string | null;
    lastPersistedRevision: number;
}

interface WhiteboardSceneSnapshot {
    whiteboardId: string;
    revision: number;
    elements: WhiteboardElement[];
    appState: WhiteboardAppState;
}

interface WhiteboardSceneDelta {
    whiteboardId: string;
    revision: number;
    elements: WhiteboardElement[];
    appState: WhiteboardAppState;
    elementOrder?: string[];
}

interface MergeSceneResult {
    changed: boolean;
    revision: number;
    delta?: WhiteboardSceneDelta;
}

const PERSIST_DEBOUNCE_MS = 500;

const EMPTY_SCENE = (): StoredWhiteboardScene => ({
    revision: 0,
    elements: [],
    appState: {}
});

const getElementId = (element: WhiteboardElement): string | null => {
    const id = element.id;
    return typeof id === 'string' && id.length > 0 ? id : null;
};

const getElementVersion = (element: WhiteboardElement): number => (
    typeof element.version === 'number' && Number.isFinite(element.version)
        ? element.version
        : 0
);

const getElementUpdated = (element: WhiteboardElement): number => (
    typeof element.updated === 'number' && Number.isFinite(element.updated)
        ? element.updated
        : 0
);

const getElementVersionNonce = (element: WhiteboardElement): number => (
    typeof element.versionNonce === 'number' && Number.isFinite(element.versionNonce)
        ? element.versionNonce
        : 0
);

const getElementSignature = (element: WhiteboardElement): string | null => {
    try {
        return JSON.stringify(element);
    } catch {
        return null;
    }
};

const hasEquivalentElementPayload = (
    current: WhiteboardElement,
    incoming: WhiteboardElement,
    currentSignature?: string | null,
    incomingSignature?: string | null
): boolean => {
    const resolvedCurrentSignature = currentSignature ?? getElementSignature(current);
    const resolvedIncomingSignature = incomingSignature ?? getElementSignature(incoming);

    if (typeof resolvedCurrentSignature === 'string' && typeof resolvedIncomingSignature === 'string') {
        return resolvedCurrentSignature === resolvedIncomingSignature;
    }

    return false;
};

const shouldReplaceElement = (
    current: WhiteboardElement | undefined,
    incoming: WhiteboardElement,
    currentSignature?: string | null,
    incomingSignature?: string | null
): boolean => {
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

    return !hasEquivalentElementPayload(current, incoming, currentSignature, incomingSignature);
};

const normalizeElements = (value: unknown): WhiteboardElement[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((element): element is WhiteboardElement => (
        typeof element === 'object' && element !== null && typeof (element as WhiteboardElement).id === 'string'
    ));
};

const normalizeAppState = (value: unknown): WhiteboardAppState => (
    typeof value === 'object' && value !== null
        ? { ...(value as WhiteboardAppState) }
        : {}
);

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

@Singleton()
export default class WhiteboardRealtimeStateService {
    private readonly rooms = new Map<string, WhiteboardRoomState>();
    private readonly pendingLoads = new Map<string, Promise<WhiteboardRoomState | null>>();

    constructor(
        private readonly whiteboardRepository: WhiteboardRepository,
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    async getSnapshot(whiteboardId: string): Promise<WhiteboardSceneSnapshot | null> {
        const room = await this.getOrLoadRoom(whiteboardId);
        return room ? this.toSnapshot(room) : null;
    }

    async mergeScene(
        whiteboardId: string,
        elements: WhiteboardElement[],
        appState: WhiteboardAppState,
        userId: string,
        elementOrder?: string[]
    ): Promise<MergeSceneResult | null> {
        const room = await this.getOrLoadRoom(whiteboardId);
        if (!room) {
            return null;
        }

        const incomingOrder: string[] = [];
        const changedElements: WhiteboardElement[] = [];
        let shouldBroadcastOrder = false;
        let didChange = false;

        for (const element of elements) {
            const id = getElementId(element);
            if (!id) {
                continue;
            }

            incomingOrder.push(id);
            const incomingSignature = getElementSignature(element);
            if (shouldReplaceElement(room.elements.get(id), element, room.elementSignatures.get(id), incomingSignature)) {
                room.elements.set(id, element);
                if (incomingSignature) {
                    room.elementSignatures.set(id, incomingSignature);
                } else {
                    room.elementSignatures.delete(id);
                }
                changedElements.push(element);
                didChange = true;
            }
        }

        if (Array.isArray(elementOrder) && elementOrder.length > 0) {
            const nextOrder = this.buildOrderedIds(elementOrder, room.elementOrder, room.elements);
            if (!areStringArraysEqual(room.elementOrder, nextOrder)) {
                room.elementOrder = nextOrder;
                shouldBroadcastOrder = true;
                didChange = true;
            }
        } else if (incomingOrder.length > 0) {
            const nextOrder: string[] = [];
            const seen = new Set<string>();

            for (const id of room.elementOrder) {
                if (seen.has(id) || !room.elements.has(id)) {
                    continue;
                }

                seen.add(id);
                nextOrder.push(id);
            }

            for (const id of incomingOrder) {
                if (seen.has(id) || !room.elements.has(id)) {
                    continue;
                }

                seen.add(id);
                nextOrder.push(id);
            }

            if (!areStringArraysEqual(room.elementOrder, nextOrder)) {
                room.elementOrder = nextOrder;
                didChange = true;
            }
        }

        const normalizedAppState = normalizeAppState(appState);
        const appStateDelta: WhiteboardAppState = {};

        for (const [key, value] of Object.entries(normalizedAppState)) {
            if (Object.is(room.appState[key], value)) {
                continue;
            }

            appStateDelta[key] = value;
        }

        if (Object.keys(appStateDelta).length > 0) {
            room.appState = {
                ...room.appState,
                ...appStateDelta
            };
            didChange = true;
        }

        if (!didChange) {
            return {
                changed: false,
                revision: room.revision
            };
        }

        room.snapshotCache = null;
        room.revision += 1;
        room.lastEditedBy = userId;
        this.schedulePersist(room);

        return {
            changed: true,
            revision: room.revision,
            delta: {
                whiteboardId: room.whiteboardId,
                revision: room.revision,
                elements: changedElements,
                appState: appStateDelta,
                elementOrder: shouldBroadcastOrder ? [...room.elementOrder] : undefined
            }
        };
    }

    async flushAndRelease(whiteboardId: string): Promise<void> {
        const room = this.rooms.get(whiteboardId);
        if (!room) {
            return;
        }

        if (room.persistTimer) {
            clearTimeout(room.persistTimer);
            room.persistTimer = null;
        }

        await this.persistRoom(room);
        this.rooms.delete(whiteboardId);
    }

    private async getOrLoadRoom(whiteboardId: string): Promise<WhiteboardRoomState | null> {
        const existing = this.rooms.get(whiteboardId);
        if (existing) {
            return existing;
        }

        const pendingLoad = this.pendingLoads.get(whiteboardId);
        if (pendingLoad) {
            return pendingLoad;
        }

        const loadPromise = this.loadRoom(whiteboardId).finally(() => {
            this.pendingLoads.delete(whiteboardId);
        });

        this.pendingLoads.set(whiteboardId, loadPromise);
        return loadPromise;
    }

    private async loadRoom(whiteboardId: string): Promise<WhiteboardRoomState | null> {
        const whiteboard = await this.whiteboardRepository.findById(whiteboardId);
        if (!whiteboard) {
            return null;
        }

        if (!whiteboard.props.payloadKey) {
            throw ApplicationError.conflict(
                'Whiteboard::PayloadKeyRequired',
                `Whiteboard ${whiteboard._id} does not have a payload key assigned`
            );
        }
        const storageClusterId = whiteboard.props.storageClusterId?.trim();
        if (!storageClusterId) {
            throw ApplicationError.conflict(
                'Whiteboard::StorageClusterRequired',
                `Whiteboard ${whiteboard._id} does not have a storage cluster assigned`
            );
        }

        const payloadKey = whiteboard.props.payloadKey;
        let storedScene = EMPTY_SCENE();

        if (await this.objectGatewayClient.exists(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, payloadKey)) {
            try {
                const buffer = await this.objectGatewayClient.getBuffer(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, payloadKey);
                const parsed: unknown = JSON.parse(buffer.toString('utf8'));

                if (typeof parsed === 'object' && parsed !== null) {
                    storedScene = parsed as StoredWhiteboardScene;
                }
            } catch {
                storedScene = EMPTY_SCENE();
            }
        }

        const elements = normalizeElements(storedScene.elements);
        const room: WhiteboardRoomState = {
            whiteboardId,
            teamId: whiteboard.props.team,
            storageClusterId,
            payloadKey,
            revision: typeof storedScene.revision === 'number' ? storedScene.revision : 0,
            elements: new Map(elements.map((element) => [element.id as string, element])),
            elementSignatures: new Map(elements
                .map((element) => {
                    const signature = getElementSignature(element);
                    return signature ? [element.id as string, signature] as const : null;
                })
                .filter((entry): entry is readonly [string, string] => Boolean(entry))),
            elementOrder: elements.map((element) => element.id as string),
            appState: normalizeAppState(storedScene.appState),
            snapshotCache: null,
            persistTimer: null,
            lastEditedBy: typeof whiteboard.props.lastEditedBy === 'string' ? whiteboard.props.lastEditedBy : null,
            lastPersistedRevision: typeof storedScene.revision === 'number' ? storedScene.revision : 0
        };

        this.rooms.set(whiteboardId, room);
        return room;
    }

    private schedulePersist(room: WhiteboardRoomState): void {
        if (room.persistTimer) {
            clearTimeout(room.persistTimer);
        }

        room.persistTimer = setTimeout(() => {
            room.persistTimer = null;
            this.persistRoom(room).catch(() => undefined);
        }, PERSIST_DEBOUNCE_MS);
    }

    private async persistRoom(room: WhiteboardRoomState): Promise<void> {
        if (room.revision === room.lastPersistedRevision) {
            return;
        }

        const snapshot = this.toSnapshot(room);
        const storedScene: StoredWhiteboardScene = {
            revision: snapshot.revision,
            elements: snapshot.elements,
            appState: snapshot.appState
        };

        const payload = Buffer.from(JSON.stringify(storedScene));
        await this.objectGatewayClient.putBuffer(room.storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
            objectKey: room.payloadKey,
            buffer: payload,
            contentLength: payload.byteLength,
            contentType: 'application/json'
        });
        room.lastPersistedRevision = room.revision;

        if (room.lastEditedBy) {
            await this.whiteboardRepository.updateById(room.whiteboardId, {
                lastEditedBy: room.lastEditedBy
            });
        }
    }

    private toSnapshot(room: WhiteboardRoomState): WhiteboardSceneSnapshot {
        if (room.snapshotCache) {
            return room.snapshotCache;
        }

        room.snapshotCache = {
            whiteboardId: room.whiteboardId,
            revision: room.revision,
            elements: room.elementOrder
                .map((id) => room.elements.get(id))
                .filter((element): element is WhiteboardElement => Boolean(element)),
            appState: { ...room.appState }
        };

        return room.snapshotCache;
    }

    private buildOrderedIds(
        primaryOrder: string[],
        secondaryOrder: string[],
        elements: Map<string, WhiteboardElement>
    ): string[] {
        const orderedIds = new Set<string>();
        const result: string[] = [];

        const appendId = (id: string) => {
            if (orderedIds.has(id) || !elements.has(id)) {
                return;
            }

            orderedIds.add(id);
            result.push(id);
        };

        for (const id of primaryOrder) {
            appendId(id);
        }

        for (const id of secondaryOrder) {
            appendId(id);
        }

        for (const id of elements.keys()) {
            appendId(id);
        }

        return result;
    }
}
