import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { RasterJobEnqueuerService } from '@modules/raster/services/RasterJobEnqueuerService';
import type { RasterJobEnqueueResult } from '@modules/raster/services/RasterJobEnqueuerService';
import type {
    IDaemonAnalysisCompletionService,
    ITeamClusterSelectionService
} from '@shared/contracts/ports';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';

interface DaemonCall{
    teamClusterId: string;
    command: string;
    payload?: Record<string, unknown>;
}

interface ProjectedJobs{
    jobs: Array<Record<string, unknown>>;
    cleanupScope: string;
    teamClusterId: string;
}

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    computeCluster: TeamCluster;
    trajectory: Trajectory;
}

describe('RasterJobEnqueuerService', () => {
    let dataSource: DataSource;
    const daemonCalls: DaemonCall[] = [];
    const projections: ProjectedJobs[] = [];
    let daemonResponse: RasterJobEnqueueResult;
    let daemonError: Error | null = null;
    let resolvedComputeClusterId = '';

    const teamClusterSelectionService = {
        resolveComputeClusterId: async () => resolvedComputeClusterId
    } as unknown as ITeamClusterSelectionService;

    const teamClusterDaemonClient = {
        command: async (teamClusterId: string, command: string, payload?: Record<string, unknown>) => {
            daemonCalls.push({
                teamClusterId,
                command,
                payload
            });

            if(daemonError){
                throw daemonError;
            }

            return daemonResponse;
        }
    } as unknown as ITeamClusterDaemonClient;

    const daemonAnalysisCompletionService = {
        handleQueuedJobs: async (
            jobs: Array<Record<string, unknown>>,
            cleanupScope: string,
            teamClusterId: string
        ) => {
            projections.push({
                jobs,
                cleanupScope,
                teamClusterId
            });
        }
    } as unknown as IDaemonAnalysisCompletionService;

    const service = new RasterJobEnqueuerService(
        teamClusterSelectionService,
        teamClusterDaemonClient,
        daemonAnalysisCompletionService
    );

    before(async () => {
        dataSource = await createHarness([
            Trajectory,
            TeamCluster,
            CatalogFolder,
            Team,
            User
        ]);
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        daemonCalls.length = 0;
        projections.length = 0;
        daemonError = null;
        daemonResponse = {
            queuedJobs: 0,
            duplicateJobs: 0,
            skippedJobs: 0,
            alreadyRasterizedJobs: 0
        };
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
            name: `storage-${name}`,
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();
        const computeCluster = await TeamCluster.create({
            name: `compute-${name}`,
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

        resolvedComputeClusterId = computeCluster.id;

        return {
            team,
            owner,
            cluster,
            computeCluster,
            trajectory
        };
    };

    it('sends the rasterization command to the resolved compute cluster', async () => {
        const fixture = await createTeamFixture('one');

        const result = await service.triggerRasterization(fixture.trajectory.id, fixture.team.id);

        assert.deepEqual(daemonCalls, [{
            teamClusterId: fixture.computeCluster.id,
            command: ChannelCommands.TrajectoryRasterize,
            payload: {
                trajectoryId: fixture.trajectory.id,
                teamId: fixture.team.id,
                storageClusterId: fixture.cluster.id
            }
        }]);
        assert.deepEqual(result, daemonResponse);
    });

    it('answers not found for a trajectory that does not exist', async () => {
        const fixture = await createTeamFixture('one');

        await assert.rejects(
            () => service.triggerRasterization('a1b2c3d4e5f6a1b2c3d4e5f6', fixture.team.id),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'Trajectory::NotFound');
                assert.equal(error.message, 'Trajectory not found');
                assert.equal(error.statusCode, 404);
                return true;
            }
        );
        assert.deepEqual(daemonCalls, []);
    });

    it('answers not found instead of failing when the trajectory id is malformed', async () => {
        const fixture = await createTeamFixture('one');

        await assert.rejects(
            () => service.triggerRasterization('not-a-trajectory-id', fixture.team.id),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'Trajectory::NotFound');
                assert.equal(error.statusCode, 404);
                return true;
            }
        );
        assert.deepEqual(daemonCalls, []);
    });

    it('answers not found for a trajectory of another team', async () => {
        const fixture = await createTeamFixture('one');
        const otherFixture = await createTeamFixture('two');

        await assert.rejects(
            () => service.triggerRasterization(fixture.trajectory.id, otherFixture.team.id),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'Trajectory::NotFound');
                assert.equal(error.statusCode, 404);
                return true;
            }
        );
        assert.deepEqual(daemonCalls, []);
    });

    it('projects the queued jobs with the name of the trajectory', async () => {
        const fixture = await createTeamFixture('one');
        daemonResponse = {
            queuedJobs: 1,
            duplicateJobs: 0,
            skippedJobs: 0,
            alreadyRasterizedJobs: 0,
            jobs: [{
                jobId: 'raster:1',
                teamId: fixture.team.id,
                queueType: 'raster',
                trajectoryId: fixture.trajectory.id,
                timestep: 0
            }]
        };

        await service.triggerRasterization(fixture.trajectory.id, fixture.team.id);

        assert.equal(projections.length, 1);
        assert.equal(projections[0].cleanupScope, 'raster');
        assert.equal(projections[0].teamClusterId, fixture.computeCluster.id);
        assert.deepEqual(projections[0].jobs, [{
            jobId: 'raster:1',
            teamId: fixture.team.id,
            queueType: 'raster',
            trajectoryId: fixture.trajectory.id,
            timestep: 0,
            trajectoryName: fixture.trajectory.name
        }]);
    });

    it('projects nothing when the cluster queued no job', async () => {
        const fixture = await createTeamFixture('one');

        await service.triggerRasterization(fixture.trajectory.id, fixture.team.id);

        assert.deepEqual(projections, []);
    });

    it('turns an unexpected daemon failure into a raster failure', async () => {
        const fixture = await createTeamFixture('one');
        daemonError = new Error('connection refused');

        await assert.rejects(
            () => service.triggerRasterization(fixture.trajectory.id, fixture.team.id),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, ErrorCodes.RASTER_FAILED);
                assert.equal(error.message, 'Failed to queue rasterization jobs');
                assert.equal(error.statusCode, 500);
                return true;
            }
        );
    });

    it('keeps the original application error raised by the daemon client', async () => {
        const fixture = await createTeamFixture('one');
        daemonError = ApplicationError.conflict('Cluster::Busy', 'Cluster is busy');

        await assert.rejects(
            () => service.triggerRasterization(fixture.trajectory.id, fixture.team.id),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'Cluster::Busy');
                assert.equal(error.statusCode, 409);
                return true;
            }
        );
    });
});
