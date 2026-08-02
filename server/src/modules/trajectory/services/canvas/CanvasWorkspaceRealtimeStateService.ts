import { redis } from '@core/config/redis';

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
const TTL_SECONDS = 60 * 60;

class CanvasWorkspaceRealtimeStateService {
    async getSnapshot(trajectoryId: string, ownerId: string): Promise<CanvasWorkspaceSnapshot | null> {
        const raw = await redis!.get(this.buildKey(trajectoryId, ownerId));

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

        await this.persist(snapshot);
        return snapshot;
    }

    async applyPatch(
        trajectoryId: string,
        ownerId: string,
        patch: WorkspaceStatePatch
    ): Promise<CanvasWorkspaceApplyResult> {
        const existing = await this.getSnapshot(trajectoryId, ownerId);
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

        const nextState = {
            ...baseState,
            ...delta
        };
        const snapshot: CanvasWorkspaceSnapshot = {
            trajectoryId,
            ownerId,
            revision: baseRevision + 1,
            state: nextState,
            updatedAt: Date.now()
        };

        await this.persist(snapshot);

        return {
            revision: snapshot.revision,
            state: snapshot.state,
            delta
        };
    }

    async release(trajectoryId: string, ownerId: string): Promise<void> {
        const key = this.buildKey(trajectoryId, ownerId);
        await redis!.multi()
            .del(key)
            .srem(this.buildIndexKey(trajectoryId), ownerId)
            .exec();
    }

    private async persist(snapshot: CanvasWorkspaceSnapshot): Promise<void> {
        const key = this.buildKey(snapshot.trajectoryId, snapshot.ownerId);
        const indexKey = this.buildIndexKey(snapshot.trajectoryId);

        await redis!.multi()
            .set(key, JSON.stringify(snapshot), 'EX', TTL_SECONDS)
            .sadd(indexKey, snapshot.ownerId)
            .expire(indexKey, TTL_SECONDS * 2)
            .exec();
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
