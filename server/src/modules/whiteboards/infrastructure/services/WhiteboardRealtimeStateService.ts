import { SYS_BUCKETS } from '@core/config/minio';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';

type WhiteboardElement = Record<string, unknown>;
type WhiteboardAppState = Record<string, unknown>;

interface StoredWhiteboardScene {
    revision?: number;
    elements?: unknown[];
    appState?: WhiteboardAppState;
};

interface WhiteboardRoomState {
    whiteboardId: string;
    teamId: string;
    payloadKey: string;
    revision: number;
    elements: Map<string, WhiteboardElement>;
    elementOrder: string[];
    appState: WhiteboardAppState;
    persistTimer: ReturnType<typeof setTimeout> | null;
    lastEditedBy: string | null;
};

interface WhiteboardSceneSnapshot {
    whiteboardId: string;
    revision: number;
    elements: WhiteboardElement[];
    appState: WhiteboardAppState;
};

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

    return getElementVersionNonce(incoming) > getElementVersionNonce(current);
};

const normalizeElements = (value: unknown): WhiteboardElement[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((element): element is WhiteboardElement => {
        return typeof element === 'object' && element !== null && typeof (element as WhiteboardElement).id === 'string';
    });
};

const normalizeAppState = (value: unknown): WhiteboardAppState => {
    return typeof value === 'object' && value !== null
        ? { ...(value as WhiteboardAppState) }
        : {};
};

@injectable()
export default class WhiteboardRealtimeStateService {
    private readonly rooms = new Map<string, WhiteboardRoomState>();
    private readonly pendingLoads = new Map<string, Promise<WhiteboardRoomState | null>>();

    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository)
        private readonly whiteboardRepository: IWhiteboardRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {}

    async getSnapshot(whiteboardId: string): Promise<WhiteboardSceneSnapshot | null> {
        const room = await this.getOrLoadRoom(whiteboardId);
        return room ? this.toSnapshot(room) : null;
    }

    async mergeScene(
        whiteboardId: string,
        elements: WhiteboardElement[],
        appState: WhiteboardAppState,
        userId: string
    ): Promise<WhiteboardSceneSnapshot | null> {
        const room = await this.getOrLoadRoom(whiteboardId);
        if (!room) {
            return null;
        }

        const incomingOrder: string[] = [];

        for (const element of elements) {
            const id = getElementId(element);
            if (!id) {
                continue;
            }

            incomingOrder.push(id);
            if (shouldReplaceElement(room.elements.get(id), element)) {
                room.elements.set(id, element);
            }
        }

        if (incomingOrder.length > 0) {
            const nextOrder: string[] = [];
            const seen = new Set<string>();

            for (const id of incomingOrder) {
                if (seen.has(id) || !room.elements.has(id)) {
                    continue;
                }

                seen.add(id);
                nextOrder.push(id);
            }

            for (const id of room.elementOrder) {
                if (seen.has(id) || !room.elements.has(id)) {
                    continue;
                }

                seen.add(id);
                nextOrder.push(id);
            }

            room.elementOrder = nextOrder;
        }

        room.appState = {
            ...room.appState,
            ...normalizeAppState(appState)
        };
        room.revision += 1;
        room.lastEditedBy = userId;
        this.schedulePersist(room);

        return this.toSnapshot(room);
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

        const payloadKey = whiteboard.props.payloadKey || `${whiteboard.props.team}/${whiteboardId}/state.json`;
        let storedScene = EMPTY_SCENE();

        if (await this.storageService.exists(SYS_BUCKETS.WHITEBOARDS, payloadKey)) {
            try {
                const buffer = await this.storageService.getBuffer(SYS_BUCKETS.WHITEBOARDS, payloadKey);
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
            payloadKey,
            revision: typeof storedScene.revision === 'number' ? storedScene.revision : 0,
            elements: new Map(elements.map((element) => [element.id as string, element])),
            elementOrder: elements.map((element) => element.id as string),
            appState: normalizeAppState(storedScene.appState),
            persistTimer: null,
            lastEditedBy: typeof whiteboard.props.lastEditedBy === 'string' ? whiteboard.props.lastEditedBy : null
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
        const snapshot = this.toSnapshot(room);
        const storedScene: StoredWhiteboardScene = {
            revision: snapshot.revision,
            elements: snapshot.elements,
            appState: snapshot.appState
        };

        await this.storageService.upload(
            SYS_BUCKETS.WHITEBOARDS,
            room.payloadKey,
            Buffer.from(JSON.stringify(storedScene)),
            { 'Content-Type': 'application/json' }
        );

        if (room.lastEditedBy) {
            await this.whiteboardRepository.updateById(room.whiteboardId, {
                lastEditedBy: room.lastEditedBy
            });
        }
    }

    private toSnapshot(room: WhiteboardRoomState): WhiteboardSceneSnapshot {
        return {
            whiteboardId: room.whiteboardId,
            revision: room.revision,
            elements: room.elementOrder
                .map((id) => room.elements.get(id))
                .filter((element): element is WhiteboardElement => Boolean(element)),
            appState: { ...room.appState }
        };
    }
}
