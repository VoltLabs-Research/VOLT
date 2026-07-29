import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import Analysis from '@modules/analysis/models/Analysis';
import Plugin from '@modules/plugin/models/Plugin';
import SimulationCell from '@modules/simulation-cell/models/SimulationCell';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryFrame from '@modules/trajectory/models/TrajectoryFrame';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { RasterMetadataService } from '@modules/raster/services/RasterMetadataService';
import type { RasterStorageService } from '@modules/raster/services/RasterStorageService';
import { RasterMetadataStatus } from '@shared/contracts/types/RasterMetadata';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    otherCluster: TeamCluster;
    trajectory: Trajectory;
    plugin: Plugin;
}

describe('RasterMetadataService', () => {
    let dataSource: DataSource;
    let previewKeys: string[] = [];
    let analysisPreviewKeys: string[] = [];
    let listPreviewsFails = false;

    const rasterStorage = {
        listPreviewFiles: async function *(){
            if(listPreviewsFails){
                throw new Error('gateway unavailable');
            }

            yield* previewKeys;
        },
        listAnalysisPreviewFiles: async function *(){
            yield* analysisPreviewKeys;
        }
    } as unknown as RasterStorageService;

    const service = new RasterMetadataService(rasterStorage);

    before(async () => {
        dataSource = await createHarness([
            Analysis,
            Plugin,
            SimulationCell,
            Trajectory,
            TrajectoryFrame,
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
        previewKeys = [];
        analysisPreviewKeys = [];
        listPreviewsFails = false;
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
        const otherCluster = await TeamCluster.create({
            name: `other-cluster-${name}`,
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
            otherCluster,
            trajectory,
            plugin
        };
    };

    const seedFrames = async (fixture: TeamFixture, timesteps: number[]): Promise<void> => {
        for(const timestep of timesteps){
            await TrajectoryFrame.create({
                trajectoryId: fixture.trajectory.id,
                timestep,
                natoms: 100,
                simulationCell: null
            }).save();
        }
    };

    const seedAnalysis = (fixture: TeamFixture, overrides: Partial<Analysis> = {}): Promise<Analysis> => Analysis.create({
        team: fixture.team.id,
        trajectory: fixture.trajectory.id,
        plugin: fixture.plugin.id,
        pluginDisplayName: 'Radial Distribution',
        config: {},
        createdBy: fixture.owner.id,
        computeClusterId: fixture.cluster.id,
        storageClusterId: fixture.otherCluster.id,
        ...overrides
    }).save();

    it('answers not found for a trajectory that does not exist', async () => {
        const fixture = await createTeamFixture('one');

        await assert.rejects(
            () => service.getRasterMetadata('a1b2c3d4e5f6a1b2c3d4e5f6', fixture.team.id),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'Trajectory::NotFound');
                assert.equal(error.message, 'Trajectory not found');
                assert.equal(error.statusCode, 404);
                return true;
            }
        );
    });

    it('answers not found instead of failing when the trajectory id is malformed', async () => {
        const fixture = await createTeamFixture('one');

        await assert.rejects(
            () => service.getRasterMetadata('not-a-trajectory-id', fixture.team.id),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'Trajectory::NotFound');
                assert.equal(error.statusCode, 404);
                return true;
            }
        );
    });

    it('answers not found for a trajectory of another team', async () => {
        const fixture = await createTeamFixture('one');
        const otherFixture = await createTeamFixture('two');

        await assert.rejects(
            () => service.getRasterMetadata(fixture.trajectory.id, otherFixture.team.id),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'Trajectory::NotFound');
                assert.equal(error.statusCode, 404);
                return true;
            }
        );
    });

    it('reports nothing when neither the trajectory nor an analysis has previews', async () => {
        const fixture = await createTeamFixture('one');
        await seedFrames(fixture, [0, 1]);

        assert.equal(await service.getRasterMetadata(fixture.trajectory.id, fixture.team.id), null);
    });

    it('counts the persisted frames as the total', async () => {
        const fixture = await createTeamFixture('one');
        await seedFrames(fixture, [0, 1, 2]);
        previewKeys = [`trajectory-${fixture.trajectory.id}/previews/timestep-0.png`];

        const metadata = await service.getRasterMetadata(fixture.trajectory.id, fixture.team.id);

        assert.equal(metadata?.totalFrames, 3);
        assert.equal(metadata?.rasterizedFrames, 1);
    });

    it('ignores the frames of another trajectory in the total', async () => {
        const fixture = await createTeamFixture('one');
        const other = await Trajectory.create({
            name: 'other',
            team: fixture.team.id,
            createdBy: fixture.owner.id,
            storageClusterId: fixture.cluster.id,
            folder: null
        }).save();
        await seedFrames(fixture, [0]);
        await TrajectoryFrame.create({
            trajectoryId: other.id,
            timestep: 0,
            natoms: 1,
            simulationCell: null
        }).save();
        previewKeys = [`trajectory-${fixture.trajectory.id}/previews/timestep-0.png`];

        const metadata = await service.getRasterMetadata(fixture.trajectory.id, fixture.team.id);

        assert.equal(metadata?.totalFrames, 1);
    });

    it('lists the available timesteps in ascending order', async () => {
        const fixture = await createTeamFixture('one');
        await seedFrames(fixture, [0, 1, 2]);
        previewKeys = [
            `trajectory-${fixture.trajectory.id}/previews/timestep-2.png`,
            `trajectory-${fixture.trajectory.id}/previews/timestep-0.png`,
            `trajectory-${fixture.trajectory.id}/previews/not-a-frame.txt`
        ];

        const metadata = await service.getRasterMetadata(fixture.trajectory.id, fixture.team.id);

        assert.deepEqual(metadata?.trajectory?.availableTimesteps, [0, 2]);
    });

    it('reports the rasterization as processing while frames are missing', async () => {
        const fixture = await createTeamFixture('one');
        await seedFrames(fixture, [0, 1]);
        previewKeys = [`trajectory-${fixture.trajectory.id}/previews/timestep-0.png`];

        const metadata = await service.getRasterMetadata(fixture.trajectory.id, fixture.team.id);

        assert.equal(metadata?.status, RasterMetadataStatus.Processing);
    });

    it('reports the rasterization as completed once every frame has a preview', async () => {
        const fixture = await createTeamFixture('one');
        await seedFrames(fixture, [0, 1]);
        previewKeys = [
            `trajectory-${fixture.trajectory.id}/previews/timestep-0.png`,
            `trajectory-${fixture.trajectory.id}/previews/timestep-1.png`
        ];

        const metadata = await service.getRasterMetadata(fixture.trajectory.id, fixture.team.id);

        assert.equal(metadata?.status, RasterMetadataStatus.Completed);
    });

    it('reports the rasterization as completed when the trajectory has no persisted frame', async () => {
        const fixture = await createTeamFixture('one');
        previewKeys = [`trajectory-${fixture.trajectory.id}/previews/timestep-0.png`];

        const metadata = await service.getRasterMetadata(fixture.trajectory.id, fixture.team.id);

        assert.equal(metadata?.totalFrames, 0);
        assert.equal(metadata?.status, RasterMetadataStatus.Completed);
    });

    it('groups the analysis previews by timestep with their models sorted', async () => {
        const fixture = await createTeamFixture('one');
        const analysis = await seedAnalysis(fixture);
        await seedFrames(fixture, [0, 1]);
        analysisPreviewKeys = [
            `trajectory-${fixture.trajectory.id}/analysis-${analysis.id}/raster/1_surface.png`,
            `trajectory-${fixture.trajectory.id}/analysis-${analysis.id}/raster/0_ball.png`,
            `trajectory-${fixture.trajectory.id}/analysis-${analysis.id}/raster/0_atoms.png`
        ];

        const metadata = await service.getRasterMetadata(fixture.trajectory.id, fixture.team.id);

        assert.equal(metadata?.analyses.length, 1);
        assert.equal(metadata?.analyses[0].analysisId, analysis.id);
        assert.deepEqual(metadata?.analyses[0].availableTimesteps, [0, 1]);
        assert.deepEqual(metadata?.analyses[0].frames, [
            {
                timestep: 0,
                availableModels: ['atoms', 'ball']
            },
            {
                timestep: 1,
                availableModels: ['surface']
            }
        ]);
    });

    it('omits an analysis without previews', async () => {
        const fixture = await createTeamFixture('one');
        await seedAnalysis(fixture);
        await seedFrames(fixture, [0]);
        previewKeys = [`trajectory-${fixture.trajectory.id}/previews/timestep-0.png`];

        const metadata = await service.getRasterMetadata(fixture.trajectory.id, fixture.team.id);

        assert.deepEqual(metadata?.analyses, []);
    });

    it('ignores the analyses of another trajectory', async () => {
        const fixture = await createTeamFixture('one');
        const other = await Trajectory.create({
            name: 'other',
            team: fixture.team.id,
            createdBy: fixture.owner.id,
            storageClusterId: fixture.cluster.id,
            folder: null
        }).save();
        await seedAnalysis(fixture, { trajectory: other.id });
        previewKeys = [`trajectory-${fixture.trajectory.id}/previews/timestep-0.png`];

        const metadata = await service.getRasterMetadata(fixture.trajectory.id, fixture.team.id);

        assert.deepEqual(metadata?.analyses, []);
    });

    it('turns the missing storage cluster of an analysis into a raster failure instead of a conflict', async () => {
        const fixture = await createTeamFixture('one');
        await seedAnalysis(fixture, { storageClusterId: null });
        previewKeys = [`trajectory-${fixture.trajectory.id}/previews/timestep-0.png`];

        await assert.rejects(
            () => service.getRasterMetadata(fixture.trajectory.id, fixture.team.id),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, ErrorCodes.RASTER_FAILED);
                assert.equal(error.message, 'Failed to resolve raster analyses metadata');
                assert.equal(error.statusCode, 500);
                return true;
            }
        );
    });

    it('turns a preview listing failure into a raster failure', async () => {
        const fixture = await createTeamFixture('one');
        listPreviewsFails = true;

        await assert.rejects(
            () => service.getRasterMetadata(fixture.trajectory.id, fixture.team.id),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, ErrorCodes.RASTER_FAILED);
                assert.equal(error.message, 'Failed to list raster previews');
                assert.equal(error.statusCode, 500);
                return true;
            }
        );
    });
});
