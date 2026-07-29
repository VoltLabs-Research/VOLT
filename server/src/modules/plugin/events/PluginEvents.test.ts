import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import storagePlacementService from '@modules/cluster/services/StoragePlacementService';
import PluginEvents from '@modules/plugin/events/PluginEvents';
import Plugin from '@modules/plugin/models/Plugin';
import Workflow from '@modules/plugin/models/plugin/workflow/Workflow';
import Analysis from '@modules/analysis/models/Analysis';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import Trajectory from '@modules/trajectory/models/Trajectory';
import StoragePlacement from '@modules/cluster/models/StoragePlacement';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { SceneArtifactSourceType } from '@shared/contracts/types/SceneArtifact';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    trajectory: Trajectory;
    plugin: Plugin;
}

interface DaemonCall{
    teamClusterId: string;
    command: string;
}

describe('PluginEvents', () => {
    let dataSource: DataSource;
    const events = new PluginEvents();
    const published: EmittedEvent[] = [];
    const daemonCalls: DaemonCall[] = [];

    before(async () => {
        dataSource = await createHarness([
            Plugin,
            Analysis,
            SceneArtifact,
            Trajectory,
            StoragePlacement,
            TeamCluster,
            CatalogFolder,
            Team,
            User
        ]);

        eventBus.emit = async (name, payload) => {
            published.push({
                name,
                payload
            });
        };
        teamClusterDaemonClient.command = (async (teamClusterId: string, command: string) => {
            daemonCalls.push({
                teamClusterId,
                command
            });
            return {
                queued: true,
                jobId: 'job-1'
            };
        }) as typeof teamClusterDaemonClient.command;
        storagePlacementService.ensurePlacement = (async () => ({
            props: { primaryClusterId: 'owner-cluster' }
        })) as unknown as typeof storagePlacementService.ensurePlacement;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
        daemonCalls.length = 0;
    });

    const createTeamFixture = async (name: string): Promise<TeamFixture> => {
        const owner = await User.create({
            email: `owner-${name}@volt.test`,
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: `team-${name}`,
            owner: owner.id
        }).save();
        const cluster = await TeamCluster.create({
            name: `cluster-${name}`,
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();
        const trajectory = await Trajectory.create({
            name: `run-${name}`,
            team: team.id,
            storageClusterId: cluster.id,
            createdBy: owner.id
        }).save();
        const plugin = await Plugin.create({
            team: team.id,
            workflow: { nodes: [] }
        }).save();

        return {
            team,
            owner,
            cluster,
            trajectory,
            plugin
        };
    };

    const seedSceneArtifact = (
        fixture: TeamFixture,
        objectName: string,
        overrides: Partial<SceneArtifact> = {}
    ): Promise<SceneArtifact> => SceneArtifact.create({
        trajectory: fixture.trajectory.id,
        storageClusterId: fixture.cluster.id,
        plugin: fixture.plugin.id,
        sourceType: SceneArtifactSourceType.PluginExposure,
        timestep: 0,
        objectName,
        storageBucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
        displayName: objectName,
        ...overrides
    }).save();

    describe('deletePluginExposures', () => {
        it('removes only the plugin exposure artifacts of the deleted plugin', async () => {
            const fixture = await createTeamFixture('one');
            const other = await createTeamFixture('two');
            await seedSceneArtifact(fixture, 'deleted-exposure');
            const otherPlugin = await seedSceneArtifact(other, 'kept-exposure');
            const rasterized = await seedSceneArtifact(fixture, 'kept-raster', {
                sourceType: SceneArtifactSourceType.ColorCoding
            });

            await events.deletePluginExposures({
                pluginId: fixture.plugin.id,
                teamId: fixture.team.id,
                workflow: new Workflow(fixture.plugin.id, fixture.plugin.workflow)
            });

            assert.equal(await SceneArtifact.countBy({ objectName: 'deleted-exposure' }), 0);
            assert.equal(await SceneArtifact.countBy({ id: otherPlugin.id }), 1);
            assert.equal(await SceneArtifact.countBy({ id: rasterized.id }), 1);
        });
    });

    describe('deleteTrajectoryExposures', () => {
        it('removes only the plugin exposure artifacts of the deleted trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const otherTrajectory = await Trajectory.create({
                name: 'run-other',
                team: fixture.team.id,
                storageClusterId: fixture.cluster.id,
                createdBy: fixture.owner.id
            }).save();
            await seedSceneArtifact(fixture, 'deleted-exposure');
            const survivor = await seedSceneArtifact(fixture, 'kept-exposure', { trajectory: otherTrajectory.id });

            await events.deleteTrajectoryExposures({
                trajectoryId: fixture.trajectory.id,
                trajectoryName: fixture.trajectory.name,
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.equal(await SceneArtifact.countBy({ objectName: 'deleted-exposure' }), 0);
            assert.equal(await SceneArtifact.countBy({ id: survivor.id }), 1);
        });
    });

    describe('deleteTeamPlugins', () => {
        it('deletes every plugin of the team and publishes one event each', async () => {
            const fixture = await createTeamFixture('one');
            const second = await Plugin.create({
                team: fixture.team.id,
                workflow: { nodes: [] }
            }).save();

            await events.deleteTeamPlugins({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.equal(await Plugin.countBy({ team: fixture.team.id }), 0);
            assert.deepEqual(published.map((event) => event.name), ['plugin.deleted', 'plugin.deleted']);
            assert.deepEqual(
                published.map((event) => (event.payload as { pluginId: string }).pluginId).sort(),
                [fixture.plugin.id, second.id].sort()
            );
        });

        it('keeps the plugins of the other teams', async () => {
            const fixture = await createTeamFixture('one');
            const other = await createTeamFixture('two');

            await events.deleteTeamPlugins({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.equal(await Plugin.countBy({ id: other.plugin.id }), 1);
            assert.equal(published.length, 1);
        });

        it('resolves when the team has no plugins', async () => {
            const owner = await User.create({
                email: 'empty@volt.test',
                firstName: 'ada'
            }).save();
            const team = await Team.create({
                name: 'empty',
                owner: owner.id
            }).save();

            await events.deleteTeamPlugins({
                teamId: team.id,
                userId: owner.id
            });

            assert.equal(published.length, 0);
        });
    });

    describe('warmupPluginBinaries', () => {
        it('skips the warmup when the plugin has no python binary', async () => {
            const fixture = await createTeamFixture('one');

            await events.warmupPluginBinaries({
                pluginId: fixture.plugin.id,
                teamId: fixture.team.id
            });

            assert.deepEqual(daemonCalls, []);
        });

        it('commands every cluster attached to the team', async () => {
            const fixture = await createTeamFixture('one');
            const second = await TeamCluster.create({
                name: 'cluster-second',
                team: fixture.team.id,
                createdBy: fixture.owner.id,
                services: {},
                queueConcurrency: {},
                queueScopeLimits: {},
                roleConfig: {}
            }).save();

            await events.warmupPluginBinaries({
                pluginId: fixture.plugin.id,
                teamId: fixture.team.id,
                binaryObjectPath: 'plugin-binaries/x/run.bin',
                requirementsFile: 'requirements.txt'
            });

            assert.deepEqual(
                daemonCalls.map((call) => call.teamClusterId).sort(),
                [fixture.cluster.id, second.id].sort()
            );
        });

        it('does nothing when the team has no cluster', async () => {
            const owner = await User.create({
                email: 'clusterless@volt.test',
                firstName: 'ada'
            }).save();
            const team = await Team.create({
                name: 'clusterless',
                owner: owner.id
            }).save();
            const plugin = await Plugin.create({
                team: team.id,
                workflow: { nodes: [] }
            }).save();

            await events.warmupPluginBinaries({
                pluginId: plugin.id,
                teamId: team.id,
                binaryObjectPath: 'plugin-binaries/x/run.bin',
                requirementsFile: 'requirements.txt'
            });

            assert.deepEqual(daemonCalls, []);
        });
    });
});
