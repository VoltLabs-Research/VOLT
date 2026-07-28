import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import StoragePlacement from '@modules/cluster/models/StoragePlacement';
import ClusterTransferJob from '@modules/cluster/models/ClusterTransferJob';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import Trajectory from '@modules/trajectory/models/Trajectory';
import Analysis from '@modules/analysis/models/Analysis';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import Plugin from '@modules/plugin/models/Plugin';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { StoragePlacementScopeType, StoragePlacementState } from '@modules/cluster/contracts/domain/storage-placement';
import { StoragePlacementService } from '@modules/cluster/services/StoragePlacementService';
import { SceneArtifactSourceType, SceneArtifactStatus } from '@shared/contracts/types/SceneArtifact';
import ApplicationError from '@shared/application/errors/ApplicationError';

interface Fixture{
    team: Team;
    owner: User;
    storageCluster: TeamCluster;
    otherCluster: TeamCluster;
    trajectory: Trajectory;
    analysis: Analysis;
    plugin: Plugin;
}

describe('StoragePlacementService', () => {
    let dataSource: DataSource;
    const service = new StoragePlacementService();

    before(async () => {
        dataSource = await createHarness([
            StoragePlacement,
            ClusterTransferJob,
            TeamCluster,
            Trajectory,
            Analysis,
            SceneArtifact,
            Plugin,
            CatalogFolder,
            Team,
            User
        ]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createCluster = async (team: Team, owner: User, name: string): Promise<TeamCluster> => {
        return TeamCluster.create({
            name,
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();
    };

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const storageCluster = await createCluster(team, owner, 'storage');
        const otherCluster = await createCluster(team, owner, 'other');
        const trajectory = await Trajectory.create({
            name: 'traj',
            team: team.id,
            createdBy: owner.id,
            storageClusterId: storageCluster.id,
            folder: null,
            stats: {
                totalFiles: 0,
                totalSize: 0
            }
        }).save();
        const plugin = await Plugin.create({
            team: team.id,
            workflow: {}
        }).save();
        const analysis = await Analysis.create({
            team: team.id,
            trajectory: trajectory.id,
            createdBy: owner.id,
            plugin: plugin.id,
            pluginDisplayName: 'plug',
            config: {},
            storageClusterId: storageCluster.id,
            computeClusterId: storageCluster.id
        }).save();

        return {
            team,
            owner,
            storageCluster,
            otherCluster,
            trajectory,
            analysis,
            plugin
        };
    };

    it('creates a trajectory placement with normalized buckets and defaults', async () => {
        const fixture = await createFixture();

        const placement = await service.ensurePlacement('trajectory', fixture.trajectory.id);

        assert.equal(placement.props.team, fixture.team.id);
        assert.equal(placement.props.scopeType, StoragePlacementScopeType.Trajectory);
        assert.equal(placement.props.scopeId, fixture.trajectory.id);
        assert.equal(placement.props.primaryClusterId, fixture.storageCluster.id);
        assert.equal(placement.props.state, StoragePlacementState.Active);
        assert.deepEqual(placement.props.replicaClusterIds, []);
        assert.equal(placement.props.lastVerifiedAt, null);
        assert.equal(placement.props.bytesUsed, null);
        assert.ok(placement.props.buckets.length > 0);

        const sortedBuckets = [...placement.props.buckets].sort((left, right) => {
            return left.bucket === right.bucket
                ? left.prefix.localeCompare(right.prefix)
                : left.bucket.localeCompare(right.bucket);
        });
        assert.deepEqual(placement.props.buckets, sortedBuckets);
    });

    it('is idempotent and never inserts a second row for the same scope', async () => {
        const fixture = await createFixture();

        const first = await service.ensurePlacement('trajectory', fixture.trajectory.id);
        const second = await service.ensurePlacement('trajectory', fixture.trajectory.id);

        assert.equal(first._id, second._id);
        assert.equal(await StoragePlacement.count(), 1);
    });

    it('finds a placement by scope and returns null when absent', async () => {
        const fixture = await createFixture();

        assert.equal(await service.findByScope('trajectory', fixture.trajectory.id), null);

        await service.ensurePlacement('trajectory', fixture.trajectory.id);
        const found = await service.findByScope('trajectory', fixture.trajectory.id);

        assert.equal(found?.props.scopeId, fixture.trajectory.id);
    });

    it('assigns a plugin binary placement', async () => {
        const fixture = await createFixture();

        const placement = await service.assignPluginBinaryPlacement(
            fixture.plugin.id,
            fixture.team.id,
            fixture.otherCluster.id
        );

        assert.equal(placement.props.scopeType, StoragePlacementScopeType.PluginBinary);
        assert.equal(placement.props.primaryClusterId, fixture.otherCluster.id);
        assert.equal(placement.props.buckets.length, 1);
        assert.match(placement.props.buckets[0]!.prefix, /^plugin-binaries\//);
    });

    it('switches the primary cluster and keeps unspecified fields', async () => {
        const fixture = await createFixture();
        await service.ensurePlacement('trajectory', fixture.trajectory.id);

        const verifiedAt = new Date('2024-01-01T00:00:00.000Z');
        const switched = await service.switchPrimaryCluster('trajectory', fixture.trajectory.id, fixture.otherCluster.id, {
            replicaClusterIds: [fixture.storageCluster.id],
            state: 'moving',
            lastVerifiedAt: verifiedAt,
            bytesUsed: 42
        });

        assert.equal(switched.props.primaryClusterId, fixture.otherCluster.id);
        assert.deepEqual(switched.props.replicaClusterIds, [fixture.storageCluster.id]);
        assert.equal(switched.props.state, 'moving');
        assert.equal(switched.props.lastVerifiedAt?.getTime(), verifiedAt.getTime());
        assert.equal(switched.props.bytesUsed, 42);
        assert.equal(await StoragePlacement.count(), 1);
    });

    it('sets the placement state without touching the primary cluster', async () => {
        const fixture = await createFixture();
        await service.ensurePlacement('trajectory', fixture.trajectory.id);

        const readOnly = await service.setPlacementState('trajectory', fixture.trajectory.id, 'read-only');

        assert.equal(readOnly.props.state, 'read-only');
        assert.equal(readOnly.props.primaryClusterId, fixture.storageCluster.id);
    });

    it('lists placements by primary cluster scoped to the team', async () => {
        const fixture = await createFixture();
        await service.ensurePlacement('trajectory', fixture.trajectory.id);
        await service.ensurePlacement('analysis', fixture.analysis.id);

        const placements = await service.listByPrimaryClusterId(fixture.team.id, fixture.storageCluster.id);

        assert.equal(placements.length, 2);
        assert.equal((await service.listByPrimaryClusterId(fixture.team.id, fixture.otherCluster.id)).length, 0);
    });

    it('synchronizes the storage owner for a trajectory scope', async () => {
        const fixture = await createFixture();
        await SceneArtifact.create({
            trajectory: fixture.trajectory.id,
            storageClusterId: fixture.storageCluster.id,
            analysis: fixture.analysis.id,
            plugin: fixture.plugin.id,
            sourceType: SceneArtifactSourceType.PluginExposure,
            timestep: 0,
            objectName: 'artifact-one',
            storageBucket: 'bucket',
            params: {},
            displayName: 'artifact',
            status: SceneArtifactStatus.Ready
        }).save();

        await service.synchronizeScopeStorageOwner('trajectory', fixture.trajectory.id, fixture.otherCluster.id);

        assert.equal((await Trajectory.findOneBy({ id: fixture.trajectory.id }))?.storageClusterId, fixture.otherCluster.id);
        assert.equal((await Analysis.findOneBy({ id: fixture.analysis.id }))?.storageClusterId, fixture.otherCluster.id);
        assert.equal((await SceneArtifact.findOneBy({ objectName: 'artifact-one' }))?.storageClusterId, fixture.otherCluster.id);

        const analysisPlacement = await service.findByScope('analysis', fixture.analysis.id);
        assert.equal(analysisPlacement?.props.primaryClusterId, fixture.otherCluster.id);
        assert.equal(analysisPlacement?.props.state, StoragePlacementState.Active);
    });

    it('synchronizes the storage owner for an analysis scope only', async () => {
        const fixture = await createFixture();

        await service.synchronizeScopeStorageOwner('analysis', fixture.analysis.id, fixture.otherCluster.id);

        assert.equal((await Analysis.findOneBy({ id: fixture.analysis.id }))?.storageClusterId, fixture.otherCluster.id);
        assert.equal((await Trajectory.findOneBy({ id: fixture.trajectory.id }))?.storageClusterId, fixture.storageCluster.id);
    });

    it('plans transfer placements and skips analyses covered by their trajectory', async () => {
        const fixture = await createFixture();

        const placements = await service.resolveTransferPlacementsForCluster(fixture.team.id, fixture.storageCluster.id);

        assert.equal(placements.length, 1);
        assert.equal(placements[0]!.props.scopeType, StoragePlacementScopeType.Trajectory);
        assert.equal(placements[0]!.props.scopeId, fixture.trajectory.id);
    });

    it('plans an analysis placement when its trajectory lives on another cluster', async () => {
        const fixture = await createFixture();
        await Trajectory.update({ id: fixture.trajectory.id }, { storageClusterId: fixture.otherCluster.id });

        const placements = await service.resolveTransferPlacementsForCluster(fixture.team.id, fixture.storageCluster.id);

        assert.equal(placements.length, 1);
        assert.equal(placements[0]!.props.scopeType, StoragePlacementScopeType.Analysis);
        assert.equal(placements[0]!.props.scopeId, fixture.analysis.id);
    });

    it('rejects a placement for a missing trajectory', async () => {
        await createFixture();

        await assert.rejects(
            () => service.ensurePlacement('trajectory', 'missing-trajectory'),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'Trajectory::NotFound');
                return true;
            }
        );
    });

    it('rejects a placement for a missing analysis', async () => {
        await createFixture();

        await assert.rejects(
            () => service.ensurePlacement('analysis', 'missing-analysis'),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'Analysis::NotFound');
                return true;
            }
        );
    });

    it('rejects a placement for a missing plugin', async () => {
        await createFixture();

        await assert.rejects(
            () => service.ensurePlacement('plugin-binary', 'missing-plugin'),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'Plugin::NotFound');
                return true;
            }
        );
    });

    it('rejects an analysis placement when the storage cluster is not assigned', async () => {
        const fixture = await createFixture();
        await Analysis.update({ id: fixture.analysis.id }, { storageClusterId: null });

        await assert.rejects(
            () => service.ensurePlacement('analysis', fixture.analysis.id),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'StoragePlacement::AnalysisStorageClusterRequired');
                return true;
            }
        );
    });
});
