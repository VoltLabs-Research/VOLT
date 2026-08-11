import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import objectGatewayClient from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';
import Whiteboard from '@modules/whiteboards/models/Whiteboard';
import {
    EMPTY_WHITEBOARD_SCENE,
    requireWhiteboardPayloadKey,
    requireWhiteboardStorageClusterId
} from '@modules/whiteboards/contracts/whiteboard';
import type {
    WhiteboardAppState,
    WhiteboardElement,
    WhiteboardScene,
    WhiteboardSceneDelta,
    WhiteboardSceneSnapshot
} from '@modules/whiteboards/contracts/whiteboard';
import { isSameOrder, orderElementIds, shouldReplaceElement } from '@modules/whiteboards/services/whiteboard-scene-merge';

type MergeSceneResult =
    | { changed: false; revision: number }
    | { changed: true; revision: number; delta: WhiteboardSceneDelta };

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

const PERSIST_DEBOUNCE_MS = 500;

class WhiteboardRealtimeStateService {
    private readonly rooms = new Map<string, WhiteboardRoomState>();
    private readonly pendingLoads = new Map<string, Promise<WhiteboardRoomState | null>>();

    async getSnapshot(whiteboardId: string): Promise<WhiteboardSceneSnapshot | null> {
        const room = await this.getOrLoadRoom(whiteboardId);
        return room ? this.toSnapshot(room) : null;
    }

    async getTeamId(whiteboardId: string): Promise<string | null> {
        const room = await this.getOrLoadRoom(whiteboardId);
        return room?.teamId ?? null;
    }

    async mergeScene(
        whiteboardId: string,
        elements: WhiteboardElement[],
        appState: WhiteboardAppState,
        userId: string,
        elementOrder: string[] = []
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
            incomingOrder.push(element.id);

            const signature = JSON.stringify(element);
            if (room.elementSignatures.get(element.id) === signature) {
                continue;
            }

            if (shouldReplaceElement(room.elements.get(element.id), element)) {
                room.elements.set(element.id, element);
                room.elementSignatures.set(element.id, signature);
                changedElements.push(element);
                didChange = true;
            }
        }

        if (elementOrder.length > 0 || incomingOrder.length > 0) {
            const nextOrder = orderElementIds(room.elements, elementOrder, room.elementOrder, incomingOrder);
            if (!isSameOrder(room.elementOrder, nextOrder)) {
                room.elementOrder = nextOrder;
                // Only a client-supplied reordering is worth replaying to the other peers.
                shouldBroadcastOrder = elementOrder.length > 0;
                didChange = true;
            }
        }

        const appStateDelta: WhiteboardAppState = {};
        for (const [key, value] of Object.entries(appState)) {
            if (!Object.is(room.appState[key], value)) {
                appStateDelta[key] = value;
            }
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
        const whiteboard = await Whiteboard.findOneBy({ id: whiteboardId });
        if (!whiteboard) {
            return null;
        }

        const payloadKey = requireWhiteboardPayloadKey(whiteboard.id, whiteboard.payloadKey);
        const storageClusterId = requireWhiteboardStorageClusterId(whiteboard.id, whiteboard.storageClusterId);
        const scene = await this.readScene(storageClusterId, payloadKey);

        const room: WhiteboardRoomState = {
            whiteboardId,
            teamId: whiteboard.team,
            storageClusterId,
            payloadKey,
            revision: scene.revision,
            elements: new Map(scene.elements.map((element) => [element.id, element])),
            elementSignatures: new Map(scene.elements.map((element) => [element.id, JSON.stringify(element)])),
            elementOrder: scene.elements.map((element) => element.id),
            appState: scene.appState,
            snapshotCache: null,
            persistTimer: null,
            lastEditedBy: whiteboard.lastEditedBy ?? null,
            lastPersistedRevision: scene.revision
        };

        this.rooms.set(whiteboardId, room);
        return room;
    }

    /** Object storage hands us raw bytes, so an unparseable payload degrades to an empty scene. */
    private async readScene(storageClusterId: string, payloadKey: string): Promise<WhiteboardScene> {
        if (!await objectGatewayClient.exists(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, payloadKey)) {
            return EMPTY_WHITEBOARD_SCENE;
        }

        try {
            const buffer = await objectGatewayClient.getBuffer(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, payloadKey);
            return JSON.parse(buffer.toString('utf8')) as WhiteboardScene;
        } catch {
            return EMPTY_WHITEBOARD_SCENE;
        }
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

        const { whiteboardId, ...scene } = this.toSnapshot(room);
        const payload = Buffer.from(JSON.stringify(scene));
        await objectGatewayClient.putBuffer(room.storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
            objectKey: room.payloadKey,
            buffer: payload,
            contentLength: payload.byteLength,
            contentType: 'application/json'
        });
        room.lastPersistedRevision = room.revision;

        if (room.lastEditedBy) {
            await Whiteboard.update({ id: whiteboardId }, { lastEditedBy: room.lastEditedBy });
        }
    }

    private toSnapshot(room: WhiteboardRoomState): WhiteboardSceneSnapshot {
        room.snapshotCache ??= {
            whiteboardId: room.whiteboardId,
            revision: room.revision,
            elements: room.elementOrder
                .map((id) => room.elements.get(id))
                .filter((element): element is WhiteboardElement => Boolean(element)),
            appState: { ...room.appState }
        };

        return room.snapshotCache;
    }
}

export default new WhiteboardRealtimeStateService();
