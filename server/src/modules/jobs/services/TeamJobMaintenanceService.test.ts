import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import SimulationCell from '@modules/simulation-cell/models/SimulationCell';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryFrame from '@modules/trajectory/models/TrajectoryFrame';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { TeamJobMaintenanceService } from '@modules/jobs/services/TeamJobMaintenanceService';
import TeamJobsService from '@modules/team/socket/team/TeamJobsService';
import type { TeamJobSummary } from '@modules/team/socket/team/TeamJobsService';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { JobStatus } from '@shared/contracts/types/JobStatus';

interface DaemonCall{
    teamClusterId: string;
    command: string;
    payload?: Record<string, unknown>;
}

interface PipelineOperation{
    command: string;
    args: unknown[];
}

interface EmittedEvent{
    name: string;
    payload: Record<string, unknown>;
}

interface RequeueInternals{
    requeueGlbPreprocessing(input: {
        trajectoryId: string;
        teamId: string;
        timesteps?: number[];
    }): Promise<string[]>;
}

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    trajectory: Trajectory;
}

const GLB_QUEUE = 'trajectory_glb_conversion';

describe('TeamJobMaintenanceService', () => {
    let dataSource: DataSource;
    const service = new TeamJobMaintenanceService();
    const internals = service as unknown as RequeueInternals;
    const daemonCalls: DaemonCall[] = [];
    const pipelineOperations: PipelineOperation[] = [];
    const published: EmittedEvent[] = [];
    let teamJobs: TeamJobSummary[] = [];
    let affectedJobIds: string[] = [];
    let daemonError: Error | null = null;

    const pipeline = {
        del: (...args: unknown[]) => {
            pipelineOperations.push({
                command: 'del',
                args
            });
            return pipeline;
        },
        srem: (...args: unknown[]) => {
            pipelineOperations.push({
                command: 'srem',
                args
            });
            return pipeline;
        },
        set: (...args: unknown[]) => {
            pipelineOperations.push({
                command: 'set',
                args
            });
            return pipeline;
        },
        incr: (...args: unknown[]) => {
            pipelineOperations.push({
                command: 'incr',
                args
            });
            return pipeline;
        },
        exec: async () => pipelineOperations.map((operation) => [
            null,
            operation.command === 'del' ? 1 : 0
        ] as [Error | null, unknown])
    };

    before(async () => {
        dataSource = await createHarness([
            SimulationCell,
            Trajectory,
            TrajectoryFrame,
            TeamCluster,
            CatalogFolder,
            Team,
            User
        ]);

        Object.assign(service as unknown as Record<string, unknown>, {
            redis: {
                pipeline: () => pipeline,
                smembers: async () => []
            },
            teamClusterDaemonClient: {
                command: async (teamClusterId: string, command: string, payload?: Record<string, unknown>) => {
                    daemonCalls.push({
                        teamClusterId,
                        command,
                        payload
                    });

                    if(daemonError){
                        throw daemonError;
                    }

                    return {
                        affectedJobs: affectedJobIds.length,
                        affectedJobIds
                    };
                }
            },
            eventBus: {
                emit: async (name: string, payload: Record<string, unknown>) => {
                    published.push({
                        name,
                        payload
                    });
                }
            },
            dumpStorage: {
                getObjectName: (trajectoryId: string, timestep: string) => `trajectory-${trajectoryId}/dump-${timestep}.gz`
            }
        });

        TeamJobsService.prototype.getFlatTeamJobs = (async () => teamJobs) as typeof TeamJobsService.prototype.getFlatTeamJobs;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        daemonCalls.length = 0;
        pipelineOperations.length = 0;
        published.length = 0;
        teamJobs = [];
        affectedJobIds = [];
        daemonError = null;
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

        return {
            team,
            owner,
            cluster,
            trajectory
        };
    };

    const seedFrames = async (trajectoryId: string, timesteps: number[]): Promise<void> => {
        for(const timestep of timesteps){
            await TrajectoryFrame.create({
                trajectoryId,
                timestep,
                natoms: 10,
                simulationCell: null
            }).save();
        }
    };

    const glbJob = (fixture: TeamFixture, timestep: number): TeamJobSummary => ({
        jobId: `trajectory-glb:${fixture.trajectory.id}:${timestep}`,
        teamId: fixture.team.id,
        teamClusterId: fixture.cluster.id,
        queueType: GLB_QUEUE,
        status: JobStatus.Failed,
        source: 'projected',
        backingSource: 'daemon',
        trajectoryId: fixture.trajectory.id,
        timestep
    } as TeamJobSummary);

    describe('glb requeue job identifiers', () => {
        it('keeps the trajectory-glb:trajectoryId:timestep identifier of every requeued frame', async () => {
            const fixture = await createTeamFixture('one');
            await seedFrames(fixture.trajectory.id, [0, 10]);

            const jobIds = await internals.requeueGlbPreprocessing({
                trajectoryId: fixture.trajectory.id,
                teamId: fixture.team.id
            });

            assert.deepEqual(jobIds.sort(), [
                `trajectory-glb:${fixture.trajectory.id}:0`,
                `trajectory-glb:${fixture.trajectory.id}:10`
            ].sort());
        });

        it('requeues only the requested timesteps', async () => {
            const fixture = await createTeamFixture('one');
            await seedFrames(fixture.trajectory.id, [0, 10, 20]);

            const jobIds = await internals.requeueGlbPreprocessing({
                trajectoryId: fixture.trajectory.id,
                teamId: fixture.team.id,
                timesteps: [10]
            });

            assert.deepEqual(jobIds, [`trajectory-glb:${fixture.trajectory.id}:10`]);
        });

        it('sends the persisted frames to the storage cluster of the trajectory', async () => {
            const fixture = await createTeamFixture('one');
            await seedFrames(fixture.trajectory.id, [7]);

            await internals.requeueGlbPreprocessing({
                trajectoryId: fixture.trajectory.id,
                teamId: fixture.team.id
            });

            assert.deepEqual(daemonCalls, [{
                teamClusterId: fixture.cluster.id,
                command: ChannelCommands.TrajectoryEnqueuePreprocessing,
                payload: {
                    trajectoryId: fixture.trajectory.id,
                    teamId: fixture.team.id,
                    storageClusterId: fixture.cluster.id,
                    frames: [{
                        timestep: 7,
                        objectKey: `trajectory-${fixture.trajectory.id}/dump-7.gz`,
                        ownerClusterId: fixture.cluster.id
                    }]
                }
            }]);
        });

        it('skips the requeue of a trajectory that does not exist', async () => {
            const fixture = await createTeamFixture('one');

            const jobIds = await internals.requeueGlbPreprocessing({
                trajectoryId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
                teamId: fixture.team.id
            });

            assert.deepEqual(jobIds, []);
            assert.deepEqual(daemonCalls, []);
        });

        it('skips the requeue instead of failing when the trajectory id is malformed', async () => {
            const fixture = await createTeamFixture('one');

            const jobIds = await internals.requeueGlbPreprocessing({
                trajectoryId: 'not-a-trajectory-id',
                teamId: fixture.team.id
            });

            assert.deepEqual(jobIds, []);
            assert.deepEqual(daemonCalls, []);
        });

        it('skips the requeue when the trajectory has no persisted frame', async () => {
            const fixture = await createTeamFixture('one');

            const jobIds = await internals.requeueGlbPreprocessing({
                trajectoryId: fixture.trajectory.id,
                teamId: fixture.team.id
            });

            assert.deepEqual(jobIds, []);
            assert.deepEqual(daemonCalls, []);
        });

        it('ignores the frames of another trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const other = await Trajectory.create({
                name: 'other',
                team: fixture.team.id,
                createdBy: fixture.owner.id,
                storageClusterId: fixture.cluster.id,
                folder: null
            }).save();
            await seedFrames(fixture.trajectory.id, [0]);
            await seedFrames(other.id, [1, 2]);

            const jobIds = await internals.requeueGlbPreprocessing({
                trajectoryId: fixture.trajectory.id,
                teamId: fixture.team.id
            });

            assert.deepEqual(jobIds, [`trajectory-glb:${fixture.trajectory.id}:0`]);
        });

        it('requeues nothing when the requested timesteps have no persisted frame', async () => {
            const fixture = await createTeamFixture('one');
            await seedFrames(fixture.trajectory.id, [0]);

            const jobIds = await internals.requeueGlbPreprocessing({
                trajectoryId: fixture.trajectory.id,
                teamId: fixture.team.id,
                timesteps: [99]
            });

            assert.deepEqual(jobIds, []);
            assert.deepEqual(daemonCalls, []);
        });
    });

    describe('retryJobs', () => {
        it('does nothing when no job is requested', async () => {
            const result = await service.retryJobs('team-1', []);

            assert.deepEqual(result, {
                retriedFrames: 0,
                affectedClusters: 0,
                clusterFailures: []
            });
            assert.deepEqual(daemonCalls, []);
        });

        it('counts a glb frame the cluster forgot as recovered when the persisted frame requeues it', async () => {
            const fixture = await createTeamFixture('one');
            await seedFrames(fixture.trajectory.id, [0]);
            const job = glbJob(fixture, 0);
            teamJobs = [job];
            affectedJobIds = [];

            const result = await service.retryJobs(fixture.team.id, [job.jobId]);

            assert.equal(result.retriedFrames, 1);
            assert.equal(result.affectedClusters, 1);
            assert.deepEqual(result.clusterFailures, []);
            assert.deepEqual(
                daemonCalls.map((call) => call.command),
                [ChannelCommands.JobsRetry, ChannelCommands.TrajectoryEnqueuePreprocessing]
            );
        });

        it('reports a partial confirmation when the requeued identifier does not match the projected job', async () => {
            const fixture = await createTeamFixture('one');
            await seedFrames(fixture.trajectory.id, [0]);
            const job = {
                ...glbJob(fixture, 0),
                jobId: `glb:${fixture.trajectory.id}:0`
            } as TeamJobSummary;
            teamJobs = [job];
            affectedJobIds = [];

            const result = await service.retryJobs(fixture.team.id, [job.jobId]);

            assert.equal(result.retriedFrames, 0);
            assert.equal(result.clusterFailures.length, 1);
            assert.equal(result.clusterFailures[0].reason, 'partial-confirmation');
        });

        it('announces the retried job as retrying', async () => {
            const fixture = await createTeamFixture('one');
            const job = glbJob(fixture, 0);
            teamJobs = [job];
            affectedJobIds = [job.jobId];

            await service.retryJobs(fixture.team.id, [job.jobId]);

            assert.deepEqual(published.map((event) => event.name), ['job.status.changed']);
            assert.equal(published[0].payload.jobId, job.jobId);
            assert.equal(published[0].payload.status, JobStatus.Retrying);
            assert.equal(published[0].payload.backingSource, 'daemon');
        });

        it('ignores the jobs that are not backed by a daemon', async () => {
            const fixture = await createTeamFixture('one');
            const job = {
                ...glbJob(fixture, 0),
                backingSource: 'local'
            } as TeamJobSummary;
            teamJobs = [job];

            const result = await service.retryJobs(fixture.team.id, [job.jobId]);

            assert.deepEqual(result, {
                retriedFrames: 0,
                affectedClusters: 0,
                clusterFailures: []
            });
            assert.deepEqual(daemonCalls, []);
        });

        it('reports a failed command as a cluster failure with its message', async () => {
            const fixture = await createTeamFixture('one');
            const job = glbJob(fixture, 0);
            teamJobs = [job];
            daemonError = new Error('cluster offline');

            const result = await service.retryJobs(fixture.team.id, [job.jobId]);

            assert.equal(result.retriedFrames, 0);
            assert.deepEqual(result.clusterFailures, [{
                teamClusterId: fixture.cluster.id,
                requestedJobs: 1,
                affectedJobs: 0,
                reason: 'command-failed',
                message: 'cluster offline'
            }]);
        });

        it('retries nothing when the requested job is not projected', async () => {
            const fixture = await createTeamFixture('one');
            teamJobs = [];

            const result = await service.retryJobs(fixture.team.id, ['trajectory-glb:missing:0']);

            assert.deepEqual(result, {
                retriedFrames: 0,
                affectedClusters: 0,
                clusterFailures: []
            });
        });
    });

    describe('retryFailedJobsForTrajectory', () => {
        it('retries only the failed jobs of the trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const failed = glbJob(fixture, 0);
            const completed = {
                ...glbJob(fixture, 1),
                status: JobStatus.Completed
            } as TeamJobSummary;
            teamJobs = [failed, completed];
            affectedJobIds = [failed.jobId];

            const result = await service.retryFailedJobsForTrajectory(fixture.team.id, fixture.trajectory.id);

            assert.equal(result.retriedFrames, 1);
            assert.deepEqual(daemonCalls[0].payload?.jobIds, [failed.jobId]);
        });

        it('retries nothing for a trajectory without failed jobs', async () => {
            const fixture = await createTeamFixture('one');
            teamJobs = [{
                ...glbJob(fixture, 0),
                status: JobStatus.Completed
            } as TeamJobSummary];

            const result = await service.retryFailedJobsForTrajectory(fixture.team.id, fixture.trajectory.id);

            assert.equal(result.retriedFrames, 0);
            assert.deepEqual(daemonCalls, []);
        });
    });

    describe('removeJobsForTrajectory', () => {
        it('drops the projected keys of the removed jobs', async () => {
            const fixture = await createTeamFixture('one');
            const job = {
                ...glbJob(fixture, 0),
                status: JobStatus.Queued,
                analysisId: 'a1b2c3d4e5f6a1b2c3d4e5f6'
            } as TeamJobSummary;
            teamJobs = [job];
            affectedJobIds = [job.jobId];

            const result = await service.removeJobsForTrajectory(fixture.team.id, fixture.trajectory.id);

            assert.equal(result.deletedJobs, 1);
            assert.equal(result.deletedAnalyses, 1);
            assert.equal(result.affectedClusters, 1);
            assert.deepEqual(pipelineOperations, [
                {
                    command: 'del',
                    args: [`jobs:status:${job.jobId}`]
                },
                {
                    command: 'srem',
                    args: [`team:${fixture.team.id}:projected-jobs`, job.jobId]
                },
                {
                    command: 'set',
                    args: [`jobs:removed:${job.jobId}`, '1', 'EX', 600]
                },
                {
                    command: 'srem',
                    args: ['analysis:a1b2c3d4e5f6a1b2c3d4e5f6:projected-jobs', job.jobId]
                },
                {
                    command: 'incr',
                    args: [`team:${fixture.team.id}:projected-jobs:revision`]
                }
            ]);
        });

        it('leaves the completed jobs of the trajectory alone', async () => {
            const fixture = await createTeamFixture('one');
            teamJobs = [{
                ...glbJob(fixture, 0),
                status: JobStatus.Completed
            } as TeamJobSummary];

            const result = await service.removeJobsForTrajectory(fixture.team.id, fixture.trajectory.id);

            assert.deepEqual(result, {
                deletedJobs: 0,
                deletedAnalyses: 0,
                affectedClusters: 0,
                clusterFailures: []
            });
            assert.deepEqual(pipelineOperations, []);
        });

        it('reports the cluster failure and keeps the projection when the command fails', async () => {
            const fixture = await createTeamFixture('one');
            teamJobs = [{
                ...glbJob(fixture, 0),
                status: JobStatus.Running
            } as TeamJobSummary];
            daemonError = new Error('cluster offline');

            const result = await service.removeJobsForTrajectory(fixture.team.id, fixture.trajectory.id);

            assert.equal(result.deletedJobs, 0);
            assert.equal(result.affectedClusters, 0);
            assert.equal(result.clusterFailures[0].reason, 'command-failed');
            assert.deepEqual(pipelineOperations, []);
        });
    });

    describe('removeJobsForAnalysis', () => {
        it('drops the jobs of the analysis whatever their status is', async () => {
            const fixture = await createTeamFixture('one');
            const analysisId = 'a1b2c3d4e5f6a1b2c3d4e5f6';
            const job = {
                ...glbJob(fixture, 0),
                queueType: 'analysis_processing',
                status: JobStatus.Completed,
                analysisId
            } as TeamJobSummary;
            teamJobs = [job];
            affectedJobIds = [job.jobId];

            const result = await service.removeJobsForAnalysis(fixture.team.id, analysisId);

            assert.equal(result.deletedJobs, 1);
            assert.equal(result.deletedAnalyses, 1);
        });

        it('does nothing when the analysis has no projected job', async () => {
            const fixture = await createTeamFixture('one');

            const result = await service.removeJobsForAnalysis(fixture.team.id, 'a1b2c3d4e5f6a1b2c3d4e5f6');

            assert.deepEqual(result, {
                deletedJobs: 0,
                deletedAnalyses: 0,
                affectedClusters: 0,
                clusterFailures: []
            });
        });
    });

    describe('cleanupDeletedTrajectory', () => {
        it('does nothing without a team', async () => {
            await service.cleanupDeletedTrajectory({
                teamId: '',
                trajectoryId: 'a1b2c3d4e5f6a1b2c3d4e5f6'
            });

            assert.deepEqual(daemonCalls, []);
            assert.deepEqual(pipelineOperations, []);
        });

        it('purges the runtime state of the trajectory on the storage cluster', async () => {
            const fixture = await createTeamFixture('one');
            teamJobs = [];

            await service.cleanupDeletedTrajectory({
                teamId: fixture.team.id,
                trajectoryId: fixture.trajectory.id,
                storageClusterId: fixture.cluster.id
            });

            assert.deepEqual(daemonCalls, [{
                teamClusterId: fixture.cluster.id,
                command: ChannelCommands.TrajectoryCleanupRuntimeState,
                payload: {
                    trajectoryId: fixture.trajectory.id,
                    analysisIds: [],
                    jobIds: []
                }
            }]);
        });

        it('drops the jupyter lock of the trajectory with the exact lock key', async () => {
            const fixture = await createTeamFixture('one');
            teamJobs = [];

            await service.cleanupDeletedTrajectory({
                teamId: fixture.team.id,
                trajectoryId: fixture.trajectory.id,
                storageClusterId: fixture.cluster.id
            });

            assert.ok(pipelineOperations.some((operation) => operation.command === 'del'
                && operation.args[0] === `lock:jupyter:${fixture.team.id}:trajectory:${fixture.trajectory.id}`));
        });
    });

    describe('cleanupDeletedAnalysis', () => {
        it('purges the runtime state of the analysis on the compute cluster', async () => {
            const fixture = await createTeamFixture('one');
            const analysisId = 'a1b2c3d4e5f6a1b2c3d4e5f6';
            teamJobs = [];

            await service.cleanupDeletedAnalysis({
                analysisId,
                teamId: fixture.team.id,
                computeClusterId: fixture.cluster.id
            });

            assert.deepEqual(daemonCalls, [{
                teamClusterId: fixture.cluster.id,
                command: ChannelCommands.AnalysisCleanupRuntimeState,
                payload: {
                    analysisId,
                    jobIds: []
                }
            }]);
        });

        it('drops the session keys of the analysis', async () => {
            const fixture = await createTeamFixture('one');
            const analysisId = 'a1b2c3d4e5f6a1b2c3d4e5f6';
            teamJobs = [];

            await service.cleanupDeletedAnalysis({
                analysisId,
                teamId: fixture.team.id,
                computeClusterId: fixture.cluster.id
            });

            const deletedKeys = pipelineOperations
                .filter((operation) => operation.command === 'del')
                .map((operation) => operation.args[0]);

            assert.ok(deletedKeys.includes(`daemon-analysis:${analysisId}:remaining`));
            assert.ok(deletedKeys.includes(`daemon-analysis:${analysisId}:failed`));
            assert.ok(deletedKeys.includes(`daemon-analysis:${analysisId}:terminal-keys`));
        });
    });
});
