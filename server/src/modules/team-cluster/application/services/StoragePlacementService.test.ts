import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import StoragePlacementService from './StoragePlacementService';
import { createStoragePlacementProps } from '@modules/team-cluster/domain/entities/StoragePlacement';
import Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';

import type Analysis from '@modules/analysis/domain/entities/Analysis';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import type StoragePlacement from '@modules/team-cluster/domain/entities/StoragePlacement';
import type StoragePlacementRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/StoragePlacementRepository';
import type SceneArtifact from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

class StubTrajectoryRepository {
    public updates: Array<{ id: string; data: Partial<Trajectory['props']> }> = [];
    public exported: Trajectory[] = [];

    async updateById(id: string, data: Partial<Trajectory['props']>): Promise<Trajectory | null> {
        this.updates.push({ id, data });
        return null;
    }

    async findById(id: string): Promise<Trajectory | null> {
        return this.exported.find((trajectory) => trajectory.id === id) ?? null;
    }
    async findOne(): Promise<Trajectory | null> { return null; }
    async findAll(): Promise<never> { throw new Error('not implemented'); }
    async export(options?: { filter?: Record<string, unknown> }): Promise<Trajectory[]> {
        const ids = options?.filter && typeof options.filter === 'object' && '_id' in options.filter
            ? ((options.filter._id as { $in?: string[] })?.$in ?? [])
            : null;

        if (ids) {
            const idSet = new Set(ids);
            return this.exported.filter((trajectory) => idSet.has(trajectory.id));
        }

        if (
            options?.filter
            && typeof options.filter === 'object'
            && 'team' in options.filter
            && 'storageClusterId' in options.filter
        ) {
            const teamId = typeof options.filter.team === 'string' ? options.filter.team : '';
            const primaryClusterId = typeof options.filter.storageClusterId === 'string'
                ? options.filter.storageClusterId
                : '';

            return this.exported.filter((trajectory) => {
                return trajectory.props.team === teamId
                    && trajectory.props.storageClusterId === primaryClusterId;
            });
        }

        return this.exported;
    }
    async create(): Promise<Trajectory> { throw new Error('not implemented'); }
    async updateMany(): Promise<number> { return 0; }
    async insertMany(): Promise<void> {}
    async deleteById(): Promise<boolean> { return false; }
    async deleteMany(): Promise<number> { return 0; }
    async count(): Promise<number> { return 0; }
    async countGroupedBy(): Promise<Map<string, number>> { return new Map(); }
    async exists(): Promise<boolean> { return false; }
    async createWithId(): Promise<Trajectory> { throw new Error('not implemented'); }
    async searchIdsByTeamAndName(): Promise<string[]> { return []; }
}

class StubAnalysisRepository {
    public updatesById: Array<{ id: string; data: Partial<Analysis['props']> }> = [];
    public bulkUpdates: Array<{ filter: Record<string, unknown>; data: Partial<Analysis['props']> }> = [];
    public exported: Analysis[] = [];

    async updateById(id: string, data: Partial<Analysis['props']>): Promise<Analysis | null> {
        this.updatesById.push({ id, data });
        return null;
    }

    async updateMany(filter: Record<string, unknown>, data: Partial<Analysis['props']>): Promise<number> {
        this.bulkUpdates.push({ filter, data });
        return 1;
    }

    async findById(id: string): Promise<Analysis | null> {
        return this.exported.find((analysis) => analysis.id === id) ?? null;
    }
    async findOne(): Promise<Analysis | null> { return null; }
    async findAll(): Promise<never> { throw new Error('not implemented'); }
    async export(options?: { filter?: Record<string, unknown> }): Promise<Analysis[]> {
        if (!options?.filter || typeof options.filter !== 'object') {
            return this.exported;
        }

        const filter = options.filter;
        if ('trajectory' in filter && typeof filter.trajectory === 'string') {
            return this.exported.filter((analysis) => analysis.props.trajectory === filter.trajectory);
        }

        if ('team' in filter && typeof filter.team === 'string') {
            return this.exported.filter((analysis) => analysis.props.team === filter.team);
        }

        return this.exported;
    }
    async create(): Promise<Analysis> { throw new Error('not implemented'); }
    async insertMany(): Promise<void> {}
    async deleteById(): Promise<boolean> { return false; }
    async deleteMany(): Promise<number> { return 0; }
    async count(): Promise<number> { return 0; }
    async countGroupedBy(): Promise<Map<string, number>> { return new Map(); }
    async exists(): Promise<boolean> { return false; }
    async getCompletedFramesByCluster(): Promise<Record<string, number>> { return {}; }
    async findByTeamAndSearch(): Promise<never> { throw new Error('not implemented'); }
}

class StubSceneArtifactRepository {
    public bulkUpdates: Array<{ filter: Record<string, unknown>; data: Partial<SceneArtifact['props']> }> = [];

    async updateMany(filter: Record<string, unknown>, data: Partial<SceneArtifact['props']>): Promise<number> {
        this.bulkUpdates.push({ filter, data });
        return 1;
    }

    async findById(): Promise<SceneArtifact | null> { return null; }
    async findOne(): Promise<SceneArtifact | null> { return null; }
    async findAll(): Promise<never> { throw new Error('not implemented'); }
    async export(): Promise<SceneArtifact[]> { return []; }
    async create(): Promise<SceneArtifact> { throw new Error('not implemented'); }
    async updateById(): Promise<SceneArtifact | null> { return null; }
    async insertMany(): Promise<void> {}
    async deleteById(): Promise<boolean> { return false; }
    async deleteMany(): Promise<number> { return 0; }
    async count(): Promise<number> { return 0; }
    async countGroupedBy(): Promise<Map<string, number>> { return new Map(); }
    async exists(): Promise<boolean> { return false; }
    async upsertByObjectName(): Promise<SceneArtifact> { throw new Error('not implemented'); }
    async upsertManyByObjectName(): Promise<void> {}
    async findAllByTeamId(): Promise<never> { throw new Error('not implemented'); }
}

class StubStoragePlacementRepository {
    public placements = new Map<string, StoragePlacement>();
    public upserts: Array<{ scopeType: string; scopeId: string; data: Record<string, unknown> }> = [];

    async findByScope(scopeType: string, scopeId: string): Promise<StoragePlacement | null> {
        return this.placements.get(`${scopeType}:${scopeId}`) ?? null;
    }

    async upsertByScope(scopeType: string, scopeId: string, data: Record<string, unknown>): Promise<StoragePlacement> {
        this.upserts.push({ scopeType, scopeId, data });
        const nextPlacement = {
            id: `${scopeType}:${scopeId}`,
            _id: `${scopeType}:${scopeId}`,
            props: data
        } as unknown as StoragePlacement;

        this.placements.set(`${scopeType}:${scopeId}`, nextPlacement);
        return nextPlacement;
    }

    async listByPrimaryClusterId(): Promise<StoragePlacement[]> {
        return [...this.placements.values()];
    }
}

const buildService = () => {
    const storagePlacementRepository = new StubStoragePlacementRepository();
    const trajectoryRepository = new StubTrajectoryRepository();
    const analysisRepository = new StubAnalysisRepository();
    const sceneArtifactRepository = new StubSceneArtifactRepository();

    const service = new StoragePlacementService(
        storagePlacementRepository as unknown as StoragePlacementRepository,
        trajectoryRepository as unknown as ITrajectoryRepository,
        analysisRepository as unknown as IAnalysisRepository,
        {} as IPluginRepository,
        sceneArtifactRepository as unknown as ISceneArtifactRepository
    );

    return {
        service,
        storagePlacementRepository,
        trajectoryRepository,
        analysisRepository,
        sceneArtifactRepository
    };
};

test('StoragePlacementService synchronizes trajectory transfers to the new storage cluster in Mongo', async () => {
    const {
        service,
        storagePlacementRepository,
        trajectoryRepository,
        analysisRepository,
        sceneArtifactRepository
    } = buildService();

    analysisRepository.exported = [{
        id: 'analysis-1',
        _id: 'analysis-1',
        props: {
            team: 'team-1',
            trajectory: 'trajectory-1'
        }
    } as Analysis];
    storagePlacementRepository.placements.set('analysis:analysis-1', {
        id: 'analysis:analysis-1',
        _id: 'analysis:analysis-1',
        props: createStoragePlacementProps({
            team: 'team-1',
            scopeType: 'analysis',
            scopeId: 'analysis-1',
            primaryClusterId: 'storage-1',
            replicaClusterIds: ['storage-3'],
            buckets: [{
                bucket: 'plugins',
                prefix: 'plugins/trajectory-trajectory-1/analysis-analysis-1/'
            }]
        })
    } as StoragePlacement);

    await service.synchronizeScopeStorageOwner('trajectory', 'trajectory-1', 'storage-2');

    assert.deepEqual(trajectoryRepository.updates, [{
        id: 'trajectory-1',
        data: {
            storageClusterId: 'storage-2'
        }
    }]);
    assert.deepEqual(analysisRepository.bulkUpdates, [{
        filter: { trajectory: 'trajectory-1' },
        data: {
            storageClusterId: 'storage-2'
        }
    }]);
    assert.deepEqual(sceneArtifactRepository.bulkUpdates, [{
        filter: { trajectory: 'trajectory-1' },
        data: {
            storageClusterId: 'storage-2'
        }
    }]);
    assert.equal(storagePlacementRepository.upserts.length, 1);
    assert.equal(storagePlacementRepository.upserts[0]?.scopeType, 'analysis');
    assert.equal(storagePlacementRepository.upserts[0]?.scopeId, 'analysis-1');
    assert.equal(storagePlacementRepository.upserts[0]?.data.primaryClusterId, 'storage-2');
});

test('StoragePlacementService keeps analysis compute ownership untouched during storage transfers', async () => {
    const {
        service,
        analysisRepository,
        sceneArtifactRepository
    } = buildService();

    await service.synchronizeScopeStorageOwner('analysis', 'analysis-1', 'storage-2');

    assert.deepEqual(analysisRepository.updatesById, [{
        id: 'analysis-1',
        data: {
            storageClusterId: 'storage-2'
        }
    }]);
    assert.deepEqual(sceneArtifactRepository.bulkUpdates, [{
        filter: { analysis: 'analysis-1' },
        data: {
            storageClusterId: 'storage-2'
        }
    }]);
});

test('StoragePlacementService resolves cluster transfer placements without duplicating analyses already covered by their trajectory', async () => {
    const {
        service,
        storagePlacementRepository,
        trajectoryRepository,
        analysisRepository
    } = buildService();

    trajectoryRepository.exported = [new Trajectory('trajectory-1', {
            team: 'team-1',
            storageClusterId: 'storage-1'
        } as Trajectory['props']), new Trajectory('trajectory-2', {
            team: 'team-1',
            storageClusterId: 'storage-2'
        } as Trajectory['props'])];
    analysisRepository.exported = [{
        id: 'analysis-1',
        _id: 'analysis-1',
        props: {
            team: 'team-1',
            trajectory: 'trajectory-1',
            storageClusterId: 'storage-1'
        }
    } as Analysis, {
        id: 'analysis-2',
        _id: 'analysis-2',
        props: {
            team: 'team-1',
            trajectory: 'trajectory-2',
            storageClusterId: 'storage-1'
        }
    } as Analysis];

    const placements = await service.resolveTransferPlacementsForCluster('team-1', 'storage-1');

    assert.deepEqual(
        placements.map((placement) => `${placement.props.scopeType}:${placement.props.scopeId}`),
        ['trajectory:trajectory-1', 'analysis:analysis-2']
    );
    assert.deepEqual(
        storagePlacementRepository.upserts.map(({ scopeType, scopeId }) => `${scopeType}:${scopeId}`),
        ['trajectory:trajectory-1', 'analysis:analysis-2']
    );
});
