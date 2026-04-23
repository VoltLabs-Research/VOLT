import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import IORedis from 'ioredis';
import { inject } from 'tsyringe';

type WorkspaceStatePatch = Record<string, unknown>;

export interface CanvasWorkspaceSnapshot {
    trajectoryId: string;
    ownerId: string;
    revision: number;
    state: WorkspaceStatePatch;
    updatedAt: number;
}

export interface CanvasWorkspaceApplyResult {
    revision: number;
    state: WorkspaceStatePatch;
    delta: WorkspaceStatePatch;
}

const KEY_PREFIX = 'canvas:workspace';
const INDEX_PREFIX = 'canvas:workspace:index';
const TTL_SECONDS = 60 * 60;

@Singleton()
export default class CanvasWorkspaceRealtimeStateService {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis
    ) {}

    async getSnapshot(trajectoryId: string, ownerId: string): Promise<CanvasWorkspaceSnapshot | null> {
        const key = this.buildKey(trajectoryId, ownerId);
        const raw = await this.redis.get(key);

        if (!raw) {
            return null;
        }

        try {
            return JSON.parse(raw) as CanvasWorkspaceSnapshot;
        } catch (error) {
            logger.warn(`@canvas-workspace - failed to parse snapshot for ${key}: ${error}`);
            await this.redis.del(key);
            return null;
        }
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
            state: this.cloneState(state),
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

        const nextState = { ...baseState, ...delta };
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
        await this.redis.multi()
            .del(key)
            .srem(this.buildIndexKey(trajectoryId), ownerId)
            .exec();
    }

    async listOwners(trajectoryId: string): Promise<string[]> {
        const members = await this.redis.smembers(this.buildIndexKey(trajectoryId));
        return members.filter((id): id is string => typeof id === 'string' && id.length > 0);
    }

    private async persist(snapshot: CanvasWorkspaceSnapshot): Promise<void> {
        const key = this.buildKey(snapshot.trajectoryId, snapshot.ownerId);
        const indexKey = this.buildIndexKey(snapshot.trajectoryId);

        await this.redis.multi()
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

    private cloneState(state: WorkspaceStatePatch): WorkspaceStatePatch {
        try {
            return JSON.parse(JSON.stringify(state));
        } catch {
            return { ...state };
        }
    }

    private areEqual(left: unknown, right: unknown): boolean {
        if (left === right) {
            return true;
        }

        try {
            return JSON.stringify(left) === JSON.stringify(right);
        } catch {
            return false;
        }
    }

    private buildKey(trajectoryId: string, ownerId: string): string {
        return `${KEY_PREFIX}:${trajectoryId}:${ownerId}`;
    }

    private buildIndexKey(trajectoryId: string): string {
        return `${INDEX_PREFIX}:${trajectoryId}`;
    }
}
