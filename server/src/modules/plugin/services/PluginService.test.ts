import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import PluginService from '@modules/plugin/services/PluginService';
import Plugin from '@modules/plugin/models/Plugin';
import Analysis from '@modules/analysis/models/Analysis';
import AnalysisProvenance from '@modules/analysis/models/AnalysisProvenance';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryFrame from '@modules/trajectory/models/TrajectoryFrame';
import SimulationCell from '@modules/simulation-cell/models/SimulationCell';
import StoragePlacement from '@modules/cluster/models/StoragePlacement';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { PluginStatus } from '@volt/contracts/modules/plugin/domain/enums';
import { SceneArtifactSourceType } from '@shared/contracts/types/SceneArtifact';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    trajectory: Trajectory;
}

const modifierNode = (name: string) => ({
    id: 'modifier-1',
    type: 'modifier',
    position: {
        x: 0,
        y: 0
    },
    data: {
        modifier: {
            key: 'radial',
            name
        }
    }
});

const argumentsNode = () => ({
    id: 'arguments-1',
    type: 'arguments',
    position: {
        x: 10,
        y: 0
    },
    data: {
        arguments: {
            arguments: [
                {
                    argument: 'cutoff',
                    type: 'number',
                    label: 'Cutoff',
                    required: true,
                    default: 5,
                    min: 1,
                    max: 10,
                    step: 1
                },
                {
                    argument: 'mode',
                    type: 'select',
                    label: 'Mode',
                    options: [{
                        key: 'fast',
                        label: 'Fast'
                    }]
                }
            ]
        }
    }
});

const contextNode = () => ({
    id: 'context-1',
    type: 'context',
    position: {
        x: 15,
        y: 0
    },
    data: { context: { source: 'trajectory_dumps' } }
});

const entrypointNode = (entrypoint: Record<string, unknown>) => ({
    id: 'entrypoint-1',
    type: 'entrypoint',
    position: {
        x: 20,
        y: 0
    },
    data: { entrypoint }
});

const RUNTIME_EDGES = [
    {
        id: 'edge-1',
        source: 'modifier-1',
        target: 'arguments-1'
    },
    {
        id: 'edge-2',
        source: 'arguments-1',
        target: 'context-1'
    },
    {
        id: 'edge-3',
        source: 'context-1',
        target: 'entrypoint-1'
    }
];

const buildWorkflow = (nodes: unknown[], edges: unknown[] = []): WorkflowProps => ({
    nodes,
    edges
} as unknown as WorkflowProps);

const draftWorkflow = (
    name = 'Radial Distribution',
    entrypoint: Record<string, unknown> = {}
): WorkflowProps => buildWorkflow([
    modifierNode(name),
    argumentsNode(),
    contextNode(),
    entrypointNode(entrypoint)
], RUNTIME_EDGES);

describe('PluginService', () => {
    let dataSource: DataSource;
    const service = new PluginService();
    const published: EmittedEvent[] = [];

    before(async () => {
        dataSource = await createHarness([
            Plugin,
            Analysis,
            AnalysisProvenance,
            SceneArtifact,
            Trajectory,
            TrajectoryFrame,
            SimulationCell,
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
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
    });

    const createTeamFixture = async (name = 'one'): Promise<TeamFixture> => {
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

        return {
            team,
            owner,
            cluster,
            trajectory
        };
    };

    const seedPlugin = (fixture: TeamFixture, overrides: Partial<Plugin> = {}): Promise<Plugin> => Plugin.create({
        team: fixture.team.id,
        workflow: draftWorkflow(),
        ...overrides
    }).save();

    const seedAnalysis = (fixture: TeamFixture, pluginId: string, overrides: Partial<Analysis> = {}): Promise<Analysis> => Analysis.create({
        plugin: pluginId,
        pluginDisplayName: 'Radial Distribution',
        team: fixture.team.id,
        trajectory: fixture.trajectory.id,
        createdBy: fixture.owner.id,
        config: {},
        ...overrides
    }).save();

    const expectApplicationError = async (
        run: () => Promise<unknown>,
        code: string
    ): Promise<ApplicationError> => {
        try {
            await run();
        } catch (error: unknown) {
            assert.ok(error instanceof ApplicationError);
            assert.equal(error.code, code);
            return error;
        }

        throw new Error(`expected ${code} to be thrown`);
    };

    describe('listPlugins', () => {
        it('returns only the plugins of the team', async () => {
            const fixture = await createTeamFixture('one');
            const other = await createTeamFixture('two');
            const mine = await seedPlugin(fixture);
            await seedPlugin(other);

            const result = await service.listPlugins({ teamId: fixture.team.id });

            assert.deepEqual(result.data.map((plugin) => plugin._id), [mine.id]);
            assert.equal(result.total, 1);
        });

        it('filters by status', async () => {
            const fixture = await createTeamFixture('one');
            await seedPlugin(fixture);
            const published = await seedPlugin(fixture, { status: PluginStatus.PUBLISHED });

            const result = await service.listPlugins({
                teamId: fixture.team.id,
                status: PluginStatus.PUBLISHED
            });

            assert.deepEqual(result.data.map((plugin) => plugin._id), [published.id]);
            assert.equal(result.total, 1);
        });

        it('keeps the 100 items default limit', async () => {
            const fixture = await createTeamFixture('one');
            await seedPlugin(fixture);

            const result = await service.listPlugins({ teamId: fixture.team.id });

            assert.equal(result.limit, 100);
            assert.equal(result.page, 1);
            assert.equal(result.totalPages, 1);
        });

        it('paginates and reports the total of the filtered set', async () => {
            const fixture = await createTeamFixture('one');
            await seedPlugin(fixture);
            await seedPlugin(fixture);
            await seedPlugin(fixture);

            const firstPage = await service.listPlugins({
                teamId: fixture.team.id,
                page: 1,
                limit: 2
            });
            const secondPage = await service.listPlugins({
                teamId: fixture.team.id,
                page: 2,
                limit: 2
            });

            assert.equal(firstPage.data.length, 2);
            assert.equal(secondPage.data.length, 1);
            assert.equal(secondPage.total, 3);
            assert.equal(secondPage.totalPages, 2);
            assert.equal(secondPage.page, 2);
        });

        it('returns an empty page when the team has no plugins', async () => {
            const fixture = await createTeamFixture('one');

            const result = await service.listPlugins({ teamId: fixture.team.id });

            assert.deepEqual(result.data, []);
            assert.equal(result.total, 0);
            assert.equal(result.totalPages, 0);
        });
    });

    describe('createPlugin', () => {
        it('persists the workflow with its projection and publishes plugin.created', async () => {
            const fixture = await createTeamFixture('one');

            const { plugin } = await service.createPlugin({
                workflow: draftWorkflow('Created Plugin'),
                teamId: fixture.team.id
            });

            const stored = await Plugin.findOneByOrFail({ id: plugin._id });
            assert.equal(stored.team, fixture.team.id);
            assert.equal(stored.status, PluginStatus.DRAFT);
            assert.equal(stored.modifier?.name, 'Created Plugin');
            assert.deepEqual(stored.arguments.map((argument) => argument.argument), ['cutoff', 'mode']);
            assert.deepEqual(published.map((event) => event.name), ['plugin.created']);
        });

        it('rejects a workflow the draft validation refuses', async () => {
            const fixture = await createTeamFixture('one');

            await expectApplicationError(
                () => service.createPlugin({
                    workflow: buildWorkflow([]),
                    teamId: fixture.team.id
                }),
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH
            );
            assert.equal(await Plugin.count(), 0);
        });
    });

    describe('getPluginById', () => {
        it('returns the record of an existing plugin', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);

            const record = await service.getPluginById({ pluginId: plugin.id });

            assert.equal(record._id, plugin.id);
            assert.deepEqual(record.workflow, plugin.workflow);
        });

        it('throws PLUGIN_NOT_FOUND for an unknown id', async () => {
            await expectApplicationError(
                () => service.getPluginById({ pluginId: 'missing' }),
                ErrorCodes.PLUGIN_NOT_FOUND
            );
        });
    });

    describe('clonePlugin', () => {
        it('creates a draft copy with the renamed modifier', async () => {
            const fixture = await createTeamFixture('one');
            const original = await seedPlugin(fixture, { status: PluginStatus.PUBLISHED });

            const { plugin } = await service.clonePlugin({
                pluginId: original.id,
                teamId: fixture.team.id
            });

            const clone = await Plugin.findOneByOrFail({ id: plugin._id });
            assert.notEqual(clone.id, original.id);
            assert.equal(clone.status, PluginStatus.DRAFT);
            assert.equal(clone.modifier?.name, 'Radial Distribution (Copy)');
            assert.equal((await Plugin.findOneByOrFail({ id: original.id })).modifier?.name, undefined);
            assert.deepEqual(published.map((event) => event.name), ['plugin.created']);
        });

        it('throws PLUGIN_NOT_FOUND when the source does not exist', async () => {
            const fixture = await createTeamFixture('one');

            await expectApplicationError(
                () => service.clonePlugin({
                    pluginId: 'missing',
                    teamId: fixture.team.id
                }),
                ErrorCodes.PLUGIN_NOT_FOUND
            );
        });
    });

    describe('updatePluginById', () => {
        it('rewrites the workflow and its projection', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);

            const record = await service.updatePluginById({
                pluginId: plugin.id,
                workflow: draftWorkflow('Renamed')
            });

            const stored = await Plugin.findOneByOrFail({ id: plugin.id });
            assert.equal(record._id, plugin.id);
            assert.equal(stored.modifier?.name, 'Renamed');
            assert.equal(stored.status, PluginStatus.DRAFT);
        });

        it('refuses to publish an invalid workflow', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);

            await expectApplicationError(
                () => service.updatePluginById({
                    pluginId: plugin.id,
                    status: PluginStatus.PUBLISHED
                }),
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH
            );
            assert.equal((await Plugin.findOneByOrFail({ id: plugin.id })).status, PluginStatus.DRAFT);
        });

        it('keeps the stored binary fields when the incoming workflow omits them', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture, {
                workflow: draftWorkflow('Radial Distribution', {
                    binary: 'run.bin',
                    binaryObjectPath: 'plugin-binaries/kept/run.bin',
                    binaryFileName: 'run.bin',
                    binaryHash: 'hash-kept'
                })
            });

            await service.updatePluginById({
                pluginId: plugin.id,
                workflow: draftWorkflow('Radial Distribution', { entrypointScript: 'main.py' })
            });

            const stored = await Plugin.findOneByOrFail({ id: plugin.id });
            const entrypoint = stored.workflow.nodes
                .find((node) => node.type === 'entrypoint')?.data.entrypoint;
            assert.equal(entrypoint?.binaryObjectPath, 'plugin-binaries/kept/run.bin');
            assert.equal(entrypoint?.binaryHash, 'hash-kept');
        });

        it('throws PLUGIN_NOT_FOUND for an unknown id', async () => {
            await expectApplicationError(
                () => service.updatePluginById({ pluginId: 'missing' }),
                ErrorCodes.PLUGIN_NOT_FOUND
            );
        });
    });

    describe('deletePluginById', () => {
        it('removes the row and publishes plugin.deleted', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const survivor = await seedPlugin(fixture);

            assert.equal(await service.deletePluginById({ pluginId: plugin.id }), null);

            assert.equal(await Plugin.countBy({ id: plugin.id }), 0);
            assert.equal(await Plugin.countBy({ id: survivor.id }), 1);
            assert.deepEqual(published.map((event) => event.name), ['plugin.deleted']);
        });

        it('throws PLUGIN_NOT_FOUND for an unknown id', async () => {
            await expectApplicationError(
                () => service.deletePluginById({ pluginId: 'missing' }),
                ErrorCodes.PLUGIN_NOT_FOUND
            );
        });
    });

    describe('describePluginArguments', () => {
        it('describes the persisted argument definitions', async () => {
            const fixture = await createTeamFixture('one');
            const { plugin } = await service.createPlugin({
                workflow: draftWorkflow('Described'),
                teamId: fixture.team.id
            });

            const described = await service.describePluginArguments({ pluginId: plugin._id });

            assert.equal(described.pluginId, plugin._id);
            assert.equal(described.name, 'Described');
            assert.deepEqual(described.arguments.map((argument) => argument.key), ['cutoff', 'mode']);
            assert.equal(described.arguments[0].required, true);
            assert.equal(described.arguments[0].default, 5);
            assert.deepEqual(described.arguments[1].options, [{
                key: 'fast',
                label: 'Fast'
            }]);
        });

        it('throws PLUGIN_NOT_FOUND for an unknown id', async () => {
            await expectApplicationError(
                () => service.describePluginArguments({ pluginId: 'missing' }),
                ErrorCodes.PLUGIN_NOT_FOUND
            );
        });
    });

    describe('exportPlugin', () => {
        it('throws PLUGIN_NOT_FOUND for an unknown id', async () => {
            await expectApplicationError(
                () => service.exportPlugin({ pluginId: 'missing' }),
                ErrorCodes.PLUGIN_NOT_FOUND
            );
        });
    });

    describe('downloadBinary', () => {
        it('throws PLUGIN_NOT_FOUND for an unknown id', async () => {
            const fixture = await createTeamFixture('one');

            await expectApplicationError(
                () => service.downloadBinary({
                    pluginId: 'missing',
                    teamId: fixture.team.id
                }),
                ErrorCodes.PLUGIN_NOT_FOUND
            );
        });

        it('hides a plugin owned by another team', async () => {
            const fixture = await createTeamFixture('one');
            const other = await createTeamFixture('two');
            const plugin = await seedPlugin(other);

            await expectApplicationError(
                () => service.downloadBinary({
                    pluginId: plugin.id,
                    teamId: fixture.team.id
                }),
                ErrorCodes.PLUGIN_NOT_FOUND
            );
        });

        it('throws RESOURCE_NOT_FOUND when the workflow has no binary', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);

            await expectApplicationError(
                () => service.downloadBinary({
                    pluginId: plugin.id,
                    teamId: fixture.team.id
                }),
                ErrorCodes.RESOURCE_NOT_FOUND
            );
        });
    });

    describe('executePipeline', () => {
        it('rejects an empty stage list', async () => {
            const fixture = await createTeamFixture('one');

            await expectApplicationError(
                () => service.executePipeline({
                    trajectoryId: fixture.trajectory.id,
                    userId: fixture.owner.id,
                    teamId: fixture.team.id,
                    stages: []
                }),
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE
            );
        });

        it('rejects an unknown trajectory', async () => {
            const fixture = await createTeamFixture('one');

            await expectApplicationError(
                () => service.executePipeline({
                    trajectoryId: 'missing',
                    userId: fixture.owner.id,
                    teamId: fixture.team.id,
                    stages: [{
                        kind: 'plugin',
                        config: {}
                    }]
                }),
                ErrorCodes.TRAJECTORY_NOT_FOUND
            );
        });
    });

    describe('getPluginExposureGLB', () => {
        it('throws ANALYSIS_NOT_FOUND for an unknown analysis', async () => {
            const fixture = await createTeamFixture('one');

            await expectApplicationError(
                () => service.getPluginExposureGLB({
                    teamId: fixture.team.id,
                    trajectoryId: fixture.trajectory.id,
                    analysisId: 'missing',
                    exposureId: 'exposure-1',
                    timestep: '0'
                }),
                ErrorCodes.ANALYSIS_NOT_FOUND
            );
        });

        it('hides an analysis owned by another team', async () => {
            const fixture = await createTeamFixture('one');
            const other = await createTeamFixture('two');
            const plugin = await seedPlugin(other);
            const analysis = await seedAnalysis(other, plugin.id);

            await expectApplicationError(
                () => service.getPluginExposureGLB({
                    teamId: fixture.team.id,
                    trajectoryId: other.trajectory.id,
                    analysisId: analysis.id,
                    exposureId: 'exposure-1',
                    timestep: '0'
                }),
                ErrorCodes.ANALYSIS_NOT_FOUND
            );
        });

        it('throws when no artifact carries the requested exposure', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const analysis = await seedAnalysis(fixture, plugin.id);
            await SceneArtifact.create({
                trajectory: fixture.trajectory.id,
                storageClusterId: fixture.cluster.id,
                analysis: analysis.id,
                plugin: plugin.id,
                sourceType: SceneArtifactSourceType.PluginExposure,
                timestep: 0,
                objectName: 'other-exposure.glb',
                storageBucket: TEAM_CLUSTER_BUCKETS.MODELS,
                displayName: 'other',
                params: { exposureId: 'another-exposure' }
            }).save();

            await expectApplicationError(
                () => service.getPluginExposureGLB({
                    teamId: fixture.team.id,
                    trajectoryId: fixture.trajectory.id,
                    analysisId: analysis.id,
                    exposureId: 'exposure-1',
                    timestep: '0'
                }),
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND
            );
        });

        it('ignores an artifact recorded for another timestep', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const analysis = await seedAnalysis(fixture, plugin.id);
            await SceneArtifact.create({
                trajectory: fixture.trajectory.id,
                storageClusterId: fixture.cluster.id,
                analysis: analysis.id,
                plugin: plugin.id,
                sourceType: SceneArtifactSourceType.PluginExposure,
                timestep: 7,
                objectName: 'exposure-1.glb',
                storageBucket: TEAM_CLUSTER_BUCKETS.MODELS,
                displayName: 'exposure-1',
                params: { exposureId: 'exposure-1' }
            }).save();

            await expectApplicationError(
                () => service.getPluginExposureGLB({
                    teamId: fixture.team.id,
                    trajectoryId: fixture.trajectory.id,
                    analysisId: analysis.id,
                    exposureId: 'exposure-1',
                    timestep: '3'
                }),
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND
            );
        });

        it('rejects an artifact whose params carry extra keys', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const analysis = await seedAnalysis(fixture, plugin.id);
            await SceneArtifact.create({
                trajectory: fixture.trajectory.id,
                storageClusterId: fixture.cluster.id,
                analysis: analysis.id,
                plugin: plugin.id,
                sourceType: SceneArtifactSourceType.PluginExposure,
                timestep: 3,
                objectName: 'exposure-1.glb',
                storageBucket: TEAM_CLUSTER_BUCKETS.MODELS,
                displayName: 'exposure-1',
                params: {
                    exposureId: 'exposure-1',
                    property: 'energy'
                }
            }).save();

            await expectApplicationError(
                () => service.getPluginExposureGLB({
                    teamId: fixture.team.id,
                    trajectoryId: fixture.trajectory.id,
                    analysisId: analysis.id,
                    exposureId: 'exposure-1',
                    timestep: '3'
                }),
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND
            );
        });
    });

    describe('getPluginExposureChart', () => {
        it('throws FILE_NOT_FOUND for an unknown artifact', async () => {
            const fixture = await createTeamFixture('one');

            await expectApplicationError(
                () => service.getPluginExposureChart({
                    teamId: fixture.team.id,
                    artifactId: 'missing'
                }),
                ErrorCodes.FILE_NOT_FOUND
            );
        });

        it('rejects an artifact that is not a chart', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const analysis = await seedAnalysis(fixture, plugin.id);
            const artifact = await SceneArtifact.create({
                trajectory: fixture.trajectory.id,
                storageClusterId: fixture.cluster.id,
                analysis: analysis.id,
                plugin: plugin.id,
                sourceType: SceneArtifactSourceType.PluginExposure,
                timestep: 0,
                objectName: 'model.glb',
                storageBucket: TEAM_CLUSTER_BUCKETS.MODELS,
                displayName: 'model'
            }).save();

            await expectApplicationError(
                () => service.getPluginExposureChart({
                    teamId: fixture.team.id,
                    artifactId: artifact.id
                }),
                'PluginExposureChart::UnsupportedArtifact'
            );
        });

        it('hides an artifact whose trajectory belongs to another team', async () => {
            const fixture = await createTeamFixture('one');
            const other = await createTeamFixture('two');
            const plugin = await seedPlugin(other);
            const analysis = await seedAnalysis(other, plugin.id);
            const artifact = await SceneArtifact.create({
                trajectory: other.trajectory.id,
                storageClusterId: other.cluster.id,
                analysis: analysis.id,
                plugin: plugin.id,
                sourceType: SceneArtifactSourceType.PluginExposure,
                timestep: 0,
                objectName: 'chart.png',
                storageBucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
                displayName: 'chart',
                metadata: { exporter: 'ChartExporter' }
            }).save();

            await expectApplicationError(
                () => service.getPluginExposureChart({
                    teamId: fixture.team.id,
                    artifactId: artifact.id
                }),
                ErrorCodes.FILE_NOT_FOUND
            );
        });
    });

    describe('getPluginExposureExport', () => {
        it('throws ANALYSIS_NOT_FOUND for an unknown analysis', async () => {
            const fixture = await createTeamFixture('one');

            await expectApplicationError(
                () => service.getPluginExposureExport({
                    teamId: fixture.team.id,
                    analysisId: 'missing'
                }),
                ErrorCodes.ANALYSIS_NOT_FOUND
            );
        });

        it('hides an analysis owned by another team', async () => {
            const fixture = await createTeamFixture('one');
            const other = await createTeamFixture('two');
            const plugin = await seedPlugin(other);
            const analysis = await seedAnalysis(other, plugin.id);

            await expectApplicationError(
                () => service.getPluginExposureExport({
                    teamId: fixture.team.id,
                    analysisId: analysis.id
                }),
                ErrorCodes.ANALYSIS_NOT_FOUND
            );
        });
    });

    describe('getListingRowsByAnalysisId', () => {
        it('returns the empty result when the analysis has no compute cluster', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const analysis = await seedAnalysis(fixture, plugin.id);

            const result = await service.getListingRowsByAnalysisId({
                teamId: fixture.team.id,
                analysisId: analysis.id
            });

            assert.deepEqual(result.data, []);
            assert.equal(result.total, 0);
        });

        it('returns the empty result when the analysis does not exist', async () => {
            const fixture = await createTeamFixture('one');

            const result = await service.getListingRowsByAnalysisId({
                teamId: fixture.team.id,
                analysisId: 'missing'
            });

            assert.deepEqual(result.data, []);
        });
    });

    describe('getSubListing', () => {
        it('returns the empty sub listing when the analysis has no compute cluster', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const analysis = await seedAnalysis(fixture, plugin.id);

            const result = await service.getSubListing({
                teamId: fixture.team.id,
                analysisId: analysis.id,
                exposureId: 'exposure-1',
                timestep: 0,
                subListingName: 'neighbours'
            });

            assert.equal(result.subListingName, 'neighbours');
            assert.deepEqual(result.rows, []);
            assert.equal(result.total, 0);
        });
    });

    describe('summarizeAnalysisResult', () => {
        it('throws ANALYSIS_NOT_FOUND for an unknown analysis', async () => {
            await expectApplicationError(
                () => service.summarizeAnalysisResult({
                    analysisId: 'missing',
                    teamId: 'team-missing'
                }),
                ErrorCodes.ANALYSIS_NOT_FOUND
            );
        });

        it('reports no results when the analysis has no compute cluster', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const analysis = await seedAnalysis(fixture, plugin.id);

            const summary = await service.summarizeAnalysisResult({
                analysisId: analysis.id,
                teamId: fixture.team.id
            });

            assert.equal(summary.analysisId, analysis.id);
            assert.equal(summary.hasResults, false);
            assert.equal(summary.pluginDisplayName, 'Radial Distribution');
            assert.equal(summary.rowCount, 0);
        });
    });

    describe('getPluginListingDocuments', () => {
        it('returns the empty result when no analysis carries a compute cluster', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            await seedAnalysis(fixture, plugin.id);

            const result = await service.getPluginListingDocuments({
                pluginId: plugin.id,
                teamId: fixture.team.id
            });

            assert.deepEqual(result.data, []);
            assert.equal(result.total, 0);
        });
    });
});
