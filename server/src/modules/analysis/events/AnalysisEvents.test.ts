import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import redisClient from '@shared/infrastructure/redis/redisClient';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import teamJobMaintenanceService from '@modules/jobs/services/TeamJobMaintenanceService';
import analysisExecutionLogService from '@modules/analysis/services/AnalysisExecutionLogService';
import AnalysisEvents from '@modules/analysis/events/AnalysisEvents';
import Analysis from '@modules/analysis/models/Analysis';
import Plugin from '@modules/plugin/models/Plugin';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import Trajectory from '@modules/trajectory/models/Trajectory';
import StoragePlacement from '@modules/cluster/models/StoragePlacement';
import ClusterTransferJob from '@modules/cluster/models/ClusterTransferJob';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { SceneArtifactSourceType } from '@shared/contracts/types/SceneArtifact';
import { StoragePlacementScopeType } from '@modules/cluster/contracts/domain/storage-placement';
import { ClusterTransferJobReason, ClusterTransferJobState } from '@modules/cluster/contracts/domain/cluster-transfer-job';

interface EmittedEvent{
    name: string;
    payload: Record<string, unknown>;
}

interface DaemonCall{
    teamClusterId: string;
    command: string;
    payload?: Record<string, unknown>;
}

interface DeletedPrefix{
    teamClusterId: string;
    bucket: string;
    prefix: string;
}

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    trajectory: Trajectory;
    plugin: Plugin;
}

const noopPipeline = {
    del: () => noopPipeline,
    srem: () => noopPipeline,
    incr: () => noopPipeline,
    exec: async () => []
};

describe('AnalysisEvents', () => {
    let dataSource: DataSource;
    const events = new AnalysisEvents();
    const published: EmittedEvent[] = [];
    const daemonCalls: DaemonCall[] = [];
    const deletedPrefixes: DeletedPrefix[] = [];
    const cleanedAnalyses: Record<string, unknown>[] = [];
    const clearedRuntimeState: string[] = [];

    before(async () => {
        dataSource = await createHarness([
            Analysis,
            Plugin,
            SceneArtifact,
            Trajectory,
            StoragePlacement,
            ClusterTransferJob,
            TeamCluster,
            CatalogFolder,
            Team,
            User
        ]);

        eventBus.emit = (async (name: string, payload: Record<string, unknown>) => {
            published.push({
                name,
                payload
            });
        }) as typeof eventBus.emit;
        teamClusterDaemonClient.command = (async (teamClusterId: string, command: string, payload?: Record<string, unknown>) => {
            daemonCalls.push({
                teamClusterId,
                command,
                payload
            });
            return {};
        }) as typeof teamClusterDaemonClient.command;
        objectGatewayClient.deleteByPrefix = (async (teamClusterId: string, bucket: string, prefix: string) => {
            deletedPrefixes.push({
                teamClusterId,
                bucket,
                prefix
            });
            return 0;
        }) as typeof objectGatewayClient.deleteByPrefix;
        teamJobMaintenanceService.cleanupDeletedAnalysis = (async (input: Record<string, unknown>) => {
            cleanedAnalyses.push(input);
        }) as unknown as typeof teamJobMaintenanceService.cleanupDeletedAnalysis;
        analysisExecutionLogService.clearRuntimeState = (async (analysisId: string) => {
            clearedRuntimeState.push(analysisId);
        }) as typeof analysisExecutionLogService.clearRuntimeState;
        redisClient.smembers = (async () => []) as typeof redisClient.smembers;
        redisClient.pipeline = (() => noopPipeline) as unknown as typeof redisClient.pipeline;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
        daemonCalls.length = 0;
        deletedPrefixes.length = 0;
        cleanedAnalyses.length = 0;
        clearedRuntimeState.length = 0;
    });

    const createTeamFixture = async (name: string): Promise<TeamFixture> => {
        const owner = await User.create({
            email: `owner-${name}@volt.test`,
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name,
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
            name: `traj-${name}`,
            team: team.id,
            createdBy: owner.id,
            storageClusterId: cluster.id,
            folder: null
        }).save();
        const plugin = await Plugin.create({
            team: team.id,
            workflow: {
                nodes: [],
                edges: []
            }
        }).save();

        return {
            team,
            owner,
            cluster,
            trajectory,
            plugin
        };
    };

    const seedAnalysis = (fixture: TeamFixture, overrides: Partial<Analysis> = {}): Promise<Analysis> => Analysis.create({
        team: fixture.team.id,
        trajectory: fixture.trajectory.id,
        plugin: fixture.plugin.id,
        pluginDisplayName: 'Radial Distribution',
        config: {},
        createdBy: fixture.owner.id,
        computeClusterId: fixture.cluster.id,
        storageClusterId: fixture.cluster.id,
        ...overrides
    }).save();

    const seedSceneArtifact = (fixture: TeamFixture, analysisId: string | null, objectName: string): Promise<SceneArtifact> => SceneArtifact.create({
        trajectory: fixture.trajectory.id,
        storageClusterId: fixture.cluster.id,
        analysis: analysisId,
        plugin: fixture.plugin.id,
        sourceType: SceneArtifactSourceType.PluginExposure,
        timestep: 0,
        objectName,
        storageBucket: 'scenes',
        displayName: 'scene'
    }).save();

    describe('purgeJobsAndArtifacts', () => {
        it('deletes the scene artifacts of the removed analysis only', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);
            const other = await seedAnalysis(fixture);
            await seedSceneArtifact(fixture, analysis.id, 'scene-1');
            const survivor = await seedSceneArtifact(fixture, other.id, 'scene-2');

            await events.purgeJobsAndArtifacts({
                analysisId: analysis.id,
                teamId: fixture.team.id,
                trajectoryId: fixture.trajectory.id
            } as EventMap['analysis.deleted']);

            const remaining = await SceneArtifact.find();
            assert.deepEqual(remaining.map((artifact) => artifact.id), [survivor.id]);
        });

        it('asks the job maintenance service to clean the analysis up', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            await events.purgeJobsAndArtifacts({
                analysisId: analysis.id,
                teamId: fixture.team.id,
                trajectoryId: fixture.trajectory.id
            } as EventMap['analysis.deleted']);

            assert.equal(cleanedAnalyses.length, 1);
            assert.equal(cleanedAnalyses[0].analysisId, analysis.id);
            assert.deepEqual(clearedRuntimeState, [analysis.id]);
        });
    });

    describe('cleanupStorage', () => {
        it('deletes the storage placement and the transfer jobs of the analysis', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            await StoragePlacement.create({
                team: fixture.team.id,
                scopeType: StoragePlacementScopeType.Analysis,
                scopeId: analysis.id,
                primaryClusterId: fixture.cluster.id
            }).save();
            await ClusterTransferJob.create({
                team: fixture.team.id,
                scopeType: StoragePlacementScopeType.Analysis,
                scopeId: analysis.id,
                sourceClusterId: fixture.cluster.id,
                destinationClusterId: fixture.cluster.id,
                requestedBy: fixture.owner.id,
                reason: ClusterTransferJobReason.Manual,
                state: ClusterTransferJobState.Queued
            }).save();

            await events.cleanupStorage({
                analysisId: analysis.id,
                trajectoryId: fixture.trajectory.id,
                teamClusterId: fixture.cluster.id
            } as EventMap['analysis.deleted']);

            assert.equal(await StoragePlacement.countBy({ scopeId: analysis.id }), 0);
            assert.equal(await ClusterTransferJob.countBy({ scopeId: analysis.id }), 0);
        });

        it('keeps the placement of another scope untouched', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            await StoragePlacement.create({
                team: fixture.team.id,
                scopeType: StoragePlacementScopeType.Trajectory,
                scopeId: fixture.trajectory.id,
                primaryClusterId: fixture.cluster.id
            }).save();

            await events.cleanupStorage({
                analysisId: analysis.id,
                trajectoryId: fixture.trajectory.id,
                teamClusterId: fixture.cluster.id
            } as EventMap['analysis.deleted']);

            assert.equal(await StoragePlacement.countBy({ scopeId: fixture.trajectory.id }), 1);
        });

        it('skips the remote prefix deletion when the analysis has no storage cluster', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            await events.cleanupStorage({
                analysisId: analysis.id,
                trajectoryId: fixture.trajectory.id,
                teamClusterId: undefined
            } as EventMap['analysis.deleted']);

            assert.deepEqual(deletedPrefixes, []);
        });

        it('deletes the remote prefixes of the analysis when a cluster is known', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            await events.cleanupStorage({
                analysisId: analysis.id,
                trajectoryId: fixture.trajectory.id,
                teamClusterId: fixture.cluster.id
            } as EventMap['analysis.deleted']);

            assert.ok(deletedPrefixes.length > 0);
            assert.ok(deletedPrefixes.every((target) => target.teamClusterId === fixture.cluster.id));
            assert.ok(deletedPrefixes.every((target) => target.prefix.includes(analysis.id)));
        });
    });

    describe('purgeDaemonListings', () => {
        it('purges the listing and sub-listing rows on the cluster', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            await events.purgeDaemonListings({
                analysisId: analysis.id,
                teamClusterId: fixture.cluster.id
            } as EventMap['analysis.deleted']);

            assert.deepEqual(
                daemonCalls.map((call) => call.payload?.documentType),
                ['listing', 'sub-listing']
            );
        });

        it('does nothing when the analysis has no cluster', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            await events.purgeDaemonListings({
                analysisId: analysis.id,
                teamClusterId: undefined
            } as EventMap['analysis.deleted']);

            assert.deepEqual(daemonCalls, []);
        });
    });

    describe('deleteTeamAnalyses', () => {
        it('deletes every analysis of the team and announces each one', async () => {
            const fixture = await createTeamFixture('one');
            const first = await seedAnalysis(fixture);
            const second = await seedAnalysis(fixture);

            await events.deleteTeamAnalyses({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            } as EventMap['team.deleted']);

            assert.equal(await Analysis.countBy({ team: fixture.team.id }), 0);
            assert.deepEqual(
                published.map((event) => event.payload.analysisId).sort(),
                [first.id, second.id].sort()
            );
        });

        it('keeps the analyses of another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            await seedAnalysis(fixture);
            const survivor = await seedAnalysis(otherFixture);

            await events.deleteTeamAnalyses({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            } as EventMap['team.deleted']);

            const remaining = await Analysis.find();
            assert.deepEqual(remaining.map((analysis) => analysis.id), [survivor.id]);
        });
    });

    describe('deleteTrajectoryAnalyses', () => {
        it('deletes only the analyses of the removed trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const other = await Trajectory.create({
                name: 'other',
                team: fixture.team.id,
                createdBy: fixture.owner.id,
                storageClusterId: fixture.cluster.id,
                folder: null
            }).save();
            await seedAnalysis(fixture);
            const survivor = await seedAnalysis(fixture, { trajectory: other.id });

            await events.deleteTrajectoryAnalyses({
                trajectoryId: fixture.trajectory.id,
                teamId: fixture.team.id,
                userId: fixture.owner.id
            } as EventMap['trajectory.deleted']);

            const remaining = await Analysis.find();
            assert.deepEqual(remaining.map((analysis) => analysis.id), [survivor.id]);
        });

        it('does nothing when the trajectory has no analyses', async () => {
            const fixture = await createTeamFixture('one');

            await events.deleteTrajectoryAnalyses({
                trajectoryId: fixture.trajectory.id,
                teamId: fixture.team.id,
                userId: fixture.owner.id
            } as EventMap['trajectory.deleted']);

            assert.deepEqual(published, []);
        });
    });
});
