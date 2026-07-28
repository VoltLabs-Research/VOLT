import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import Trajectory from '@modules/trajectory/models/Trajectory';
import Analysis from '@modules/analysis/models/Analysis';
import Plugin from '@modules/plugin/models/Plugin';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import {
    recordSceneArtifact,
    resolveSceneArtifactStorageCluster
} from '@modules/trajectory/services/SceneArtifactService';
import { SceneArtifactSourceType, SceneArtifactStatus } from '@shared/contracts/types/SceneArtifact';

interface Fixture{
    team: Team;
    owner: User;
    storageCluster: TeamCluster;
    otherCluster: TeamCluster;
    trajectory: Trajectory;
    plugin: Plugin;
}

describe('SceneArtifactService', () => {
    let dataSource: DataSource;

    before(async () => {
        dataSource = await createHarness([
            SceneArtifact,
            Trajectory,
            Analysis,
            Plugin,
            TeamCluster,
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

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const storageCluster = await TeamCluster.create({
            name: 'storage',
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();
        const otherCluster = await TeamCluster.create({
            name: 'analysis-storage',
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();
        const trajectory = await Trajectory.create({
            name: 'run',
            team: team.id,
            storageClusterId: storageCluster.id,
            createdBy: owner.id
        }).save();
        const plugin = await Plugin.create({
            team: team.id,
            workflow: { nodes: [] }
        }).save();

        return {
            team,
            owner,
            storageCluster,
            otherCluster,
            trajectory,
            plugin
        };
    };

    const createAnalysis = (fixture: Fixture, storageClusterId: string | null): Promise<Analysis> => Analysis.create({
        plugin: fixture.plugin.id,
        pluginDisplayName: 'Radial Distribution',
        team: fixture.team.id,
        trajectory: fixture.trajectory.id,
        createdBy: fixture.owner.id,
        storageClusterId,
        config: {}
    }).save();

    it('inserts a new artifact for an unseen object name', async () => {
        const fixture = await createFixture();

        await recordSceneArtifact({
            objectName: 'models/first.glb.zst',
            trajectory: fixture.trajectory.id,
            storageClusterId: fixture.storageCluster.id,
            sourceType: SceneArtifactSourceType.ColorCoding,
            timestep: 10,
            params: { property: 'c_cna' },
            displayName: 'Color coding'
        });

        const artifact = await SceneArtifact.findOneBy({ objectName: 'models/first.glb.zst' });

        assert.ok(artifact);
        assert.equal(artifact.trajectory, fixture.trajectory.id);
        assert.equal(artifact.timestep, 10);
        assert.equal(artifact.status, SceneArtifactStatus.Ready);
        assert.equal(artifact.storageBucket, 'volt-models');
        assert.deepEqual(artifact.params, { property: 'c_cna' });
        assert.deepEqual(artifact.metadata, {});
        assert.equal(artifact.analysis, null);
        assert.equal(artifact.plugin, null);
    });

    it('updates the existing row instead of inserting a duplicate object name', async () => {
        const fixture = await createFixture();

        await recordSceneArtifact({
            objectName: 'models/shared.glb.zst',
            trajectory: fixture.trajectory.id,
            storageClusterId: fixture.storageCluster.id,
            sourceType: SceneArtifactSourceType.ColorCoding,
            timestep: 10,
            params: { property: 'c_cna' },
            displayName: 'First'
        });
        const inserted = await SceneArtifact.findOneBy({ objectName: 'models/shared.glb.zst' });

        await recordSceneArtifact({
            objectName: 'models/shared.glb.zst',
            trajectory: fixture.trajectory.id,
            storageClusterId: fixture.storageCluster.id,
            plugin: fixture.plugin.id,
            sourceType: SceneArtifactSourceType.LineStyle,
            timestep: 20,
            params: { exposureId: 'exposure-1' },
            displayName: 'Second',
            metadata: { exporter: 'LineExporter' },
            status: SceneArtifactStatus.Failed,
            storageBucket: 'custom-bucket'
        });

        const artifacts = await SceneArtifact.findBy({ objectName: 'models/shared.glb.zst' });

        assert.equal(artifacts.length, 1);
        assert.equal(artifacts[0].id, inserted?.id);
        assert.equal(artifacts[0].displayName, 'Second');
        assert.equal(artifacts[0].timestep, 20);
        assert.equal(artifacts[0].sourceType, SceneArtifactSourceType.LineStyle);
        assert.equal(artifacts[0].status, SceneArtifactStatus.Failed);
        assert.equal(artifacts[0].storageBucket, 'custom-bucket');
        assert.equal(artifacts[0].plugin, fixture.plugin.id);
        assert.deepEqual(artifacts[0].params, { exposureId: 'exposure-1' });
        assert.deepEqual(artifacts[0].metadata, { exporter: 'LineExporter' });
    });

    it('keeps distinct object names as distinct rows', async () => {
        const fixture = await createFixture();

        for(const objectName of ['models/a.glb.zst', 'models/b.glb.zst']){
            await recordSceneArtifact({
                objectName,
                trajectory: fixture.trajectory.id,
                storageClusterId: fixture.storageCluster.id,
                sourceType: SceneArtifactSourceType.ColorCoding,
                timestep: 1,
                params: {},
                displayName: objectName
            });
        }

        assert.equal(await SceneArtifact.count(), 2);
    });

    it('resolves the storage cluster of the analysis when one is given', async () => {
        const fixture = await createFixture();
        const analysis = await createAnalysis(fixture, fixture.otherCluster.id);

        const resolved = await resolveSceneArtifactStorageCluster({
            trajectoryId: fixture.trajectory.id,
            analysisId: analysis.id
        });

        assert.equal(resolved, fixture.otherCluster.id);
    });

    it('falls back to the trajectory storage cluster when the analysis is unknown', async () => {
        const fixture = await createFixture();

        const resolved = await resolveSceneArtifactStorageCluster({
            trajectoryId: fixture.trajectory.id,
            analysisId: 'a'.repeat(24)
        });

        assert.equal(resolved, fixture.storageCluster.id);
    });

    it('resolves the trajectory storage cluster when no analysis is given', async () => {
        const fixture = await createFixture();

        const resolved = await resolveSceneArtifactStorageCluster({ trajectoryId: fixture.trajectory.id });

        assert.equal(resolved, fixture.storageCluster.id);
    });

    it('returns undefined when neither the analysis nor the trajectory exist', async () => {
        await createFixture();

        const resolved = await resolveSceneArtifactStorageCluster({ trajectoryId: 'b'.repeat(24) });

        assert.equal(resolved, undefined);
    });

    it('deletes the scene artifacts of a deleted analysis instead of orphaning them', async () => {
        const fixture = await createFixture();
        const analysis = await createAnalysis(fixture, fixture.storageCluster.id);

        await recordSceneArtifact({
            objectName: 'models/exposure.glb.zst',
            trajectory: fixture.trajectory.id,
            storageClusterId: fixture.storageCluster.id,
            analysis: analysis.id,
            plugin: fixture.plugin.id,
            sourceType: SceneArtifactSourceType.PluginExposure,
            timestep: 5,
            params: { exposureId: 'exposure-1' },
            displayName: 'Exposure'
        });

        assert.equal(await SceneArtifact.countBy({ analysis: analysis.id }), 1);

        await analysis.remove();

        assert.equal(await SceneArtifact.count(), 0);
    });
});
