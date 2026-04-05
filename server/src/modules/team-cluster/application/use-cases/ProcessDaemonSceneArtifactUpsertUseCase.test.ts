import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import ProcessDaemonSceneArtifactUpsertUseCase from './ProcessDaemonSceneArtifactUpsertUseCase';
import Trajectory, { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { SceneArtifactSourceType, SceneArtifactStatus } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

class StubTeamClusterLifecycleService {
    public readonly authenticated: Array<{ teamClusterId: string; daemonPassword: string }> = [];

    async authenticateDaemonConnection(teamClusterId: string, daemonPassword: string): Promise<void> {
        this.authenticated.push({ teamClusterId, daemonPassword });
    }
}

class StubAnalysisRepository implements Partial<IAnalysisRepository> {
    constructor(private readonly analyses: Map<string, Analysis>) {}

    async findById(id: string): Promise<Analysis | null> {
        return this.analyses.get(id) ?? null;
    }
}

class StubTrajectoryRepository implements Partial<ITrajectoryRepository> {
    constructor(private readonly trajectories: Map<string, Trajectory>) {}

    async findById(id: string): Promise<Trajectory | null> {
        return this.trajectories.get(id) ?? null;
    }
}

class StubSceneArtifactRepository implements Partial<ISceneArtifactRepository> {
    public readonly batches: Array<Array<{ objectName: string; data: Record<string, unknown> }>> = [];

    async upsertManyByObjectName(entries: Array<{ objectName: string; data: Record<string, unknown> }>): Promise<void> {
        this.batches.push(entries);
    }
}

const buildTrajectory = (): Trajectory => {
    return new Trajectory('trajectory-1', {
        name: 'Trajectory 1',
        team: 'team-1',
        folder: null,
        storageClusterId: 'storage-1',
        createdBy: 'user-1',
        status: TrajectoryStatus.Completed,
        isPublic: false,
        frames: [],
        analysis: [],
        rasterSceneViews: 0,
        stats: {
            totalFiles: 1,
            totalSize: 1
        },
        createdAt: new Date(),
        updatedAt: new Date()
    });
};

const buildAnalysis = (): Analysis => {
    return new Analysis('analysis-1', {
        plugin: 'plugin-1',
        pluginDisplayName: 'Plugin 1',
        computeClusterId: 'compute-1',
        storageClusterId: 'storage-1',
        config: {},
        trajectory: 'trajectory-1',
        createdBy: 'user-1',
        team: 'team-1',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
    });
};

test('accepts plugin exposure scene artifacts reported by the analysis compute cluster', async () => {
    const lifecycleService = new StubTeamClusterLifecycleService();
    const sceneArtifactRepository = new StubSceneArtifactRepository();

    const useCase = new ProcessDaemonSceneArtifactUpsertUseCase(
        lifecycleService as never,
        new StubAnalysisRepository(new Map([['analysis-1', buildAnalysis()]])) as never,
        new StubTrajectoryRepository(new Map([['trajectory-1', buildTrajectory()]])) as never,
        sceneArtifactRepository as never
    );

    const result = await useCase.execute({
        teamClusterId: 'compute-1',
        daemonPassword: 'daemon-password',
        trajectory: 'trajectory-1',
        storageClusterId: 'storage-1',
        analysis: 'analysis-1',
        plugin: 'plugin-1',
        sourceType: SceneArtifactSourceType.PluginExposure,
        timestep: 75000,
        objectName: 'trajectory-trajectory-1/analysis-analysis-1/glb/75000/exposure-1.glb.zst',
        storageBucket: 'volt-models',
        params: {
            exposureId: 'exposure-1'
        },
        displayName: 'Exposure 1',
        status: SceneArtifactStatus.Ready,
        metadata: {
            pluginId: 'plugin-1',
            exposureName: 'Exposure 1'
        }
    });

    assert.equal(result.success, true);
    assert.equal(lifecycleService.authenticated.length, 1);
    assert.equal(sceneArtifactRepository.batches.length, 1);
    assert.equal(sceneArtifactRepository.batches[0]?.length, 1);
    assert.equal(sceneArtifactRepository.batches[0]?.[0]?.data.storageClusterId, 'storage-1');
    assert.equal(sceneArtifactRepository.batches[0]?.[0]?.data.analysis, 'analysis-1');
    assert.equal(sceneArtifactRepository.batches[0]?.[0]?.data.plugin, 'plugin-1');
});

test('rejects plugin exposure scene artifacts reported by an unrelated cluster', async () => {
    const useCase = new ProcessDaemonSceneArtifactUpsertUseCase(
        new StubTeamClusterLifecycleService() as never,
        new StubAnalysisRepository(new Map([['analysis-1', buildAnalysis()]])) as never,
        new StubTrajectoryRepository(new Map([['trajectory-1', buildTrajectory()]])) as never,
        new StubSceneArtifactRepository() as never
    );

    const result = await useCase.execute({
        teamClusterId: 'rogue-1',
        daemonPassword: 'daemon-password',
        trajectory: 'trajectory-1',
        storageClusterId: 'storage-1',
        analysis: 'analysis-1',
        plugin: 'plugin-1',
        sourceType: SceneArtifactSourceType.PluginExposure,
        timestep: 75000,
        objectName: 'trajectory-trajectory-1/analysis-analysis-1/glb/75000/exposure-1.glb.zst',
        storageBucket: 'volt-models',
        params: {
            exposureId: 'exposure-1'
        },
        displayName: 'Exposure 1',
        status: SceneArtifactStatus.Ready
    });

    assert.equal(result.success, false);
    if (result.success) {
        assert.fail('Expected plugin exposure upsert to be rejected for unrelated cluster');
    }

    assert.equal(result.error.statusCode, 403);
    assert.equal(result.error.message, 'Plugin exposure artifacts must be reported by the analysis compute or storage cluster');
});
