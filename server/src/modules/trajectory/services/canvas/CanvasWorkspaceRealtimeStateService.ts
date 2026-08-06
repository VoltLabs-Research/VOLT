import { getKeyValueStore, type KeyValueStore } from '@shared/infrastructure/keyvalue/KeyValueStore';

type WorkspaceStatePatch = Record<string, unknown>;

interface CanvasWorkspaceSnapshot {
    trajectoryId: string;
    ownerId: string;
    revision: number;
    state: WorkspaceStatePatch;
    updatedAt: number;
}

interface CanvasWorkspaceApplyResult {
    revision: number;
    state: WorkspaceStatePatch;
    delta: WorkspaceStatePatch;
}

const KEY_PREFIX = 'canvas:workspace';
const INDEX_PREFIX = 'canvas:workspace:index';
const TTL_MS = 60 * 60 * 1000;

class CanvasWorkspaceRealtimeStateService {
    async getSnapshot(trajectoryId: string, ownerId: string): Promise<CanvasWorkspaceSnapshot | null> {
        const raw = await getKeyValueStore().get(this.buildKey(trajectoryId, ownerId));

        if (!raw) {
            return null;
        }

        return JSON.parse(raw) as CanvasWorkspaceSnapshot;
    }

    async replaceSnapshot(
        trajectoryId: string,
        ownerId: string,
        state: WorkspaceStatePatch
    ): Promise<CanvasWorkspaceSnapshot> {
        const snapshot: CanvasWorkspaceSnapshot = {
            trajectoryId,
            ownerId,
            revision: 1,
            state,
            updatedAt: Date.now()
        };

        await getKeyValueStore().transaction((store) => this.persist(store, snapshot));
        return snapshot;
    }

    /**
     * Merges a patch and returns only what changed.
     *
     * Read, diff and write are held under a lock named for the workspace. Two
     * collaborators patching different fields at the same moment would otherwise
     * each write a snapshot built from the state they read, and the later write
     * would drop the earlier one's field along with its revision.
     */
    async applyPatch(
        trajectoryId: string,
        ownerId: string,
        patch: WorkspaceStatePatch
    ): Promise<CanvasWorkspaceApplyResult> {
        const key = this.buildKey(trajectoryId, ownerId);

        return getKeyValueStore().withLock(key, async (store) => {
            const raw = await store.get(key);
            const existing = raw ? JSON.parse(raw) as CanvasWorkspaceSnapshot : null;
            const baseState = existing?.state ?? {};
            const baseRevision = existing?.revision ?? 0;
            const delta = this.collectDelta(baseState, patch);

            if (Object.keys(delta).length === 0) {
                return {
                    revision: baseRevision,
                    state: baseState,
                    delta: {}
                };
            }

            const snapshot: CanvasWorkspaceSnapshot = {
                trajectoryId,
                ownerId,
                revision: baseRevision + 1,
                state: {
                    ...baseState,
                    ...delta
                },
                updatedAt: Date.now()
            };

            await this.persist(store, snapshot);

            return {
                revision: snapshot.revision,
                state: snapshot.state,
                delta
            };
        });
    }

    async release(trajectoryId: string, ownerId: string): Promise<void> {
        await getKeyValueStore().transaction(async (store) => {
            await store.delete([this.buildKey(trajectoryId, ownerId)]);
            await store.setRemove(this.buildIndexKey(trajectoryId), [ownerId]);
        });
    }

    private async persist(store: KeyValueStore, snapshot: CanvasWorkspaceSnapshot): Promise<void> {
        await store.set(
            this.buildKey(snapshot.trajectoryId, snapshot.ownerId),
            JSON.stringify(snapshot),
            { ttlMs: TTL_MS }
        );

        /*
         * The index outlives its members, so a workspace can still be enumerated
         * for cleanup after its last snapshot has lapsed.
         */
        await store.setAdd(this.buildIndexKey(snapshot.trajectoryId), [snapshot.ownerId], {
            ttlMs: TTL_MS * 2
        });
    }

    private collectDelta(base: WorkspaceStatePatch, incoming: WorkspaceStatePatch): WorkspaceStatePatch {
        const delta: WorkspaceStatePatch = {};

        for (const [key, value] of Object.entries(incoming)) {
            if (!this.areEqual(base[key], value)) {
                delta[key] = value;
            }
        }

        return delta;
    }

    private areEqual(left: unknown, right: unknown): boolean {
        return left === right || JSON.stringify(left) === JSON.stringify(right);
    }

    private buildKey(trajectoryId: string, ownerId: string): string {
        return `${KEY_PREFIX}:${trajectoryId}:${ownerId}`;
    }

    private buildIndexKey(trajectoryId: string): string {
        return `${INDEX_PREFIX}:${trajectoryId}`;
    }
}

export default new CanvasWorkspaceRealtimeStateService();
