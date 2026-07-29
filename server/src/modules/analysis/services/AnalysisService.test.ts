import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import Analysis from '@modules/analysis/models/Analysis';
import Plugin from '@modules/plugin/models/Plugin';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import analysisExecutionLogService from '@modules/analysis/services/AnalysisExecutionLogService';
import teamJobMaintenanceService from '@modules/jobs/services/TeamJobMaintenanceService';
import TeamJobsService from '@modules/team/socket/team/TeamJobsService';
import type { TeamJobSummary } from '@modules/team/socket/team/TeamJobsService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import { JobStatus } from '@shared/contracts/types/JobStatus';

interface EmittedEvent{
    name: string;
    payload: Record<string, unknown>;
}

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    storage: TeamCluster;
    trajectory: Trajectory;
    plugin: Plugin;
}

const AN_ENTITY_ID = 'a1b2c3d4e5f6a1b2c3d4e5f6';

describe('AnalysisService', () => {
    let dataSource: DataSource;
    const service = new AnalysisService();
    const published: EmittedEvent[] = [];
    let teamJobs: TeamJobSummary[] = [];
    let retriedJobIds: string[] = [];
    let frameLogCalls: Record<string, unknown>[] = [];

    before(async () => {
        dataSource = await createHarness([
            Analysis,
            Plugin,
            Trajectory,
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
        TeamJobsService.prototype.getFlatTeamJobs = (async () => teamJobs) as typeof TeamJobsService.prototype.getFlatTeamJobs;
        teamJobMaintenanceService.retryJobs = (async (_teamId: string, jobIds: string[]) => {
            retriedJobIds = jobIds;
            return {
                retriedFrames: jobIds.length,
                affectedClusters: 1,
                clusterFailures: []
            };
        }) as typeof teamJobMaintenanceService.retryJobs;
        analysisExecutionLogService.getFrameLog = (async (input: Record<string, unknown>) => {
            frameLogCalls.push(input);
            return {
                analysisId: String(input.analysisId),
                timestep: Number(input.timestep),
                segments: [],
                sealed: false,
                truncated: false,
                nextCursor: undefined,
                status: undefined
            };
        }) as unknown as typeof analysisExecutionLogService.getFrameLog;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
        teamJobs = [];
        retriedJobIds = [];
        frameLogCalls = [];
    });

    const createUser = (email: string): Promise<User> => User.create({
        email,
        firstName: 'ada'
    }).save();

    const createCluster = (team: Team, owner: User, name: string): Promise<TeamCluster> => TeamCluster.create({
        name,
        team: team.id,
        createdBy: owner.id,
        services: {},
        queueConcurrency: {},
        queueScopeLimits: {},
        roleConfig: {}
    }).save();

    const createTeamFixture = async (name: string): Promise<TeamFixture> => {
        const owner = await createUser(`owner-${name}@volt.test`);
        const team = await Team.create({
            name,
            owner: owner.id
        }).save();
        const cluster = await createCluster(team, owner, `compute-${name}`);
        const storage = await createCluster(team, owner, `storage-${name}`);
        const trajectory = await Trajectory.create({
            name: `Water Box ${name}`,
            team: team.id,
            createdBy: owner.id,
            storageClusterId: storage.id,
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
            storage,
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
        storageClusterId: fixture.storage.id,
        ...overrides
    }).save();

    const daemonJob = (overrides: Partial<TeamJobSummary> = {}): TeamJobSummary => ({
        jobId: 'job-1',
        teamId: 'team-1',
        queueType: 'analysis_processing',
        status: JobStatus.Failed,
        source: 'projected',
        backingSource: 'daemon',
        teamClusterId: 'cluster-1',
        ...overrides
    } as TeamJobSummary);

    describe('getAnalysesByTeamId', () => {
        it('lists the analyses of the team with the trajectory name flattened', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            const result = await service.getAnalysesByTeamId({ teamId: fixture.team.id });

            assert.equal(result.total, 1);
            assert.equal(result.data[0]._id, analysis.id);
            assert.equal(
                (result.data[0] as unknown as { trajectoryName?: string }).trajectoryName,
                fixture.trajectory.name
            );
        });

        it('reduces the plugin relation to its id', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture);

            const result = await service.getAnalysesByTeamId({ teamId: fixture.team.id });

            assert.equal(result.data[0].plugin, fixture.plugin.id);
        });

        it('excludes the analyses of another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            await seedAnalysis(otherFixture);

            const result = await service.getAnalysesByTeamId({ teamId: fixture.team.id });

            assert.equal(result.total, 0);
        });

        it('defaults the list page size to one hundred', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture);

            const result = await service.getAnalysesByTeamId({ teamId: fixture.team.id });

            assert.equal(result.page, 1);
            assert.equal(result.limit, 100);
            assert.equal(result.totalPages, 1);
        });

        it('reports the page metadata of the requested page', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture);
            await seedAnalysis(fixture);
            await seedAnalysis(fixture);

            const result = await service.getAnalysesByTeamId({
                teamId: fixture.team.id,
                page: 2,
                limit: 2
            });

            assert.equal(result.total, 3);
            assert.equal(result.page, 2);
            assert.equal(result.totalPages, 2);
            assert.equal(result.data.length, 1);
        });

        it('caps the requested page size at five hundred', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture);

            const result = await service.getAnalysesByTeamId({
                teamId: fixture.team.id,
                limit: 99999
            });

            assert.equal(result.limit, 500);
        });

        it('finds an analysis through the name of its trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            const result = await service.getAnalysesByTeamId({
                teamId: fixture.team.id,
                search: 'water'
            });

            assert.deepEqual(result.data.map((item) => item._id), [analysis.id]);
        });

        it('finds an analysis through its plugin display name', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture, { pluginDisplayName: 'Coordination Number' });
            await seedAnalysis(fixture, { pluginDisplayName: 'Radial Distribution' });

            const result = await service.getAnalysesByTeamId({
                teamId: fixture.team.id,
                search: 'coordination'
            });

            assert.deepEqual(result.data.map((item) => item._id), [analysis.id]);
        });

        it('ignores a blank search and lists everything', async () => {
            const fixture = await createTeamFixture('one');
            await seedAnalysis(fixture);
            await seedAnalysis(fixture);

            const result = await service.getAnalysesByTeamId({
                teamId: fixture.team.id,
                search: '   '
            });

            assert.equal(result.total, 2);
        });
    });

    describe('getAnalysesByTrajectoryId', () => {
        it('lists the analyses of the trajectory newest first', async () => {
            const fixture = await createTeamFixture('one');
            const older = await seedAnalysis(fixture);
            const newer = await seedAnalysis(fixture);

            await Analysis.update({ id: older.id }, { createdAt: new Date('2024-01-01T00:00:00.000Z') });
            await Analysis.update({ id: newer.id }, { createdAt: new Date('2024-06-01T00:00:00.000Z') });

            const result = await service.getAnalysesByTrajectoryId({ trajectoryId: fixture.trajectory.id });

            assert.deepEqual(result.data.map((item) => item._id), [newer.id, older.id]);
        });

        it('excludes the analyses of another team when a team is given', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            await seedAnalysis(fixture);

            const result = await service.getAnalysesByTrajectoryId({
                trajectoryId: fixture.trajectory.id,
                teamId: otherFixture.team.id
            });

            assert.equal(result.total, 0);
        });

        it('returns an empty page for an unknown trajectory id', async () => {
            await createTeamFixture('one');

            const result = await service.getAnalysesByTrajectoryId({ trajectoryId: 'not-a-trajectory-id' });

            assert.equal(result.total, 0);
            assert.deepEqual(result.data, []);
        });
    });

    describe('getAnalysisById', () => {
        it('returns the analysis flattened with its wire identifier', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            const result = await service.getAnalysisById({
                teamId: fixture.team.id,
                analysisId: analysis.id
            });

            assert.equal(result._id, analysis.id);
            assert.equal(result.plugin, fixture.plugin.id);
            assert.equal(result.trajectory, fixture.trajectory.id);
        });

        it('rejects an analysis that does not exist', async () => {
            await assert.rejects(
                () => service.getAnalysisById({ analysisId: AN_ENTITY_ID }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.ANALYSIS_NOT_FOUND);
                    assert.equal(error.message, 'Analysis not found');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('answers not found instead of failing when the id is malformed', async () => {
            await assert.rejects(
                () => service.getAnalysisById({ analysisId: 'not-an-id' }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('rejects an analysis that belongs to another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            const analysis = await seedAnalysis(fixture);

            await assert.rejects(
                () => service.getAnalysisById({
                    teamId: otherFixture.team.id,
                    analysisId: analysis.id
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.TEAM_ACCESS_DENIED);
                    assert.equal(error.message, 'Analysis does not belong to this team');
                    assert.equal(error.statusCode, 403);
                    return true;
                }
            );
        });

        it('skips the ownership check when no team is given', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            const result = await service.getAnalysisById({ analysisId: analysis.id });

            assert.equal(result._id, analysis.id);
        });
    });

    describe('deleteAnalysisById', () => {
        it('removes the row and reports success', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            const result = await service.deleteAnalysisById({
                teamId: fixture.team.id,
                analysisId: analysis.id
            });

            assert.deepEqual(result, { success: true });
            assert.equal(await Analysis.countBy({ id: analysis.id }), 0);
        });

        it('announces the deletion with the cluster placement of the removed analysis', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            await service.deleteAnalysisById({
                teamId: fixture.team.id,
                analysisId: analysis.id,
                userId: fixture.owner.id
            });

            assert.equal(published.length, 1);
            assert.equal(published[0].name, 'analysis.deleted');
            assert.deepEqual(published[0].payload, {
                analysisId: analysis.id,
                trajectoryId: fixture.trajectory.id,
                pluginId: fixture.plugin.id,
                teamId: fixture.team.id,
                teamClusterId: fixture.storage.id,
                storageClusterId: fixture.storage.id,
                computeClusterId: fixture.cluster.id,
                userId: fixture.owner.id,
                pluginDisplayName: 'Radial Distribution'
            });
        });

        it('rejects an analysis that does not exist', async () => {
            await assert.rejects(
                () => service.deleteAnalysisById({ analysisId: AN_ENTITY_ID }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.ANALYSIS_NOT_FOUND);
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('rejects an analysis that belongs to another team without deleting it', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            const analysis = await seedAnalysis(fixture);

            await assert.rejects(
                () => service.deleteAnalysisById({
                    teamId: otherFixture.team.id,
                    analysisId: analysis.id
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.TEAM_ACCESS_DENIED);
                    assert.equal(error.statusCode, 403);
                    return true;
                }
            );
            assert.equal(await Analysis.countBy({ id: analysis.id }), 1);
            assert.equal(published.length, 0);
        });
    });

    describe('getAnalysisFrameLog', () => {
        it('forwards the trajectory of the analysis to the log service', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            await service.getAnalysisFrameLog({
                analysisId: analysis.id,
                teamId: fixture.team.id,
                timestep: 4
            });

            assert.deepEqual(frameLogCalls, [{
                analysisId: analysis.id,
                teamId: fixture.team.id,
                trajectoryId: fixture.trajectory.id,
                timestep: 4,
                afterCursor: undefined
            }]);
        });

        it('rejects an analysis that does not exist', async () => {
            await assert.rejects(
                () => service.getAnalysisFrameLog({
                    analysisId: AN_ENTITY_ID,
                    teamId: AN_ENTITY_ID,
                    timestep: 0
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.ANALYSIS_NOT_FOUND);
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('rejects an analysis that belongs to another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            const analysis = await seedAnalysis(fixture);

            await assert.rejects(
                () => service.getAnalysisFrameLog({
                    analysisId: analysis.id,
                    teamId: otherFixture.team.id,
                    timestep: 0
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.TEAM_ACCESS_DENIED);
                    assert.equal(error.statusCode, 403);
                    return true;
                }
            );
        });
    });

    describe('retryFailedFrames', () => {
        it('retries only the failed jobs of the analysis', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            teamJobs = [
                daemonJob({
                    jobId: 'failed-1',
                    analysisId: analysis.id,
                    timestep: 1
                }),
                daemonJob({
                    jobId: 'done-1',
                    analysisId: analysis.id,
                    status: JobStatus.Completed,
                    timestep: 2
                }),
                daemonJob({
                    jobId: 'failed-other',
                    analysisId: 'another-analysis'
                })
            ];

            const result = await service.retryFailedFrames({
                analysisId: analysis.id,
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(retriedJobIds, ['failed-1']);
            assert.equal(result.retriedFrames, 1);
            assert.equal(result.totalFrames, 2);
            assert.deepEqual(result.failedTimesteps, [1]);
            assert.equal(result.message, 'Requested retry for 1 failed frame(s)');
        });

        it('reports that there is nothing to retry when every frame succeeded', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            teamJobs = [daemonJob({
                jobId: 'done-1',
                analysisId: analysis.id,
                status: JobStatus.Completed
            })];

            const result = await service.retryFailedFrames({
                analysisId: analysis.id,
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(result, {
                message: 'No failed frames found for this analysis',
                retriedFrames: 0,
                totalFrames: 1,
                failedTimesteps: undefined
            });
            assert.deepEqual(retriedJobIds, []);
        });

        it('rejects an analysis that does not exist when it has no projected frames', async () => {
            await assert.rejects(
                () => service.retryFailedFrames({
                    analysisId: AN_ENTITY_ID,
                    teamId: AN_ENTITY_ID,
                    userId: AN_ENTITY_ID
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.ANALYSIS_NOT_FOUND);
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('rejects an analysis of another team when it has no projected frames', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            const analysis = await seedAnalysis(fixture);

            await assert.rejects(
                () => service.retryFailedFrames({
                    analysisId: analysis.id,
                    teamId: otherFixture.team.id,
                    userId: fixture.owner.id
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.TEAM_ACCESS_DENIED);
                    assert.equal(error.statusCode, 403);
                    return true;
                }
            );
        });
    });
});
