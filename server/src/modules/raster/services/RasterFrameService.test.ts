import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import Analysis from '@modules/analysis/models/Analysis';
import Plugin from '@modules/plugin/models/Plugin';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { RasterFrameService } from '@modules/raster/services/RasterFrameService';
import type { RasterStorageService } from '@modules/raster/services/RasterStorageService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Readable } from 'node:stream';

interface FrameRequest{
    trajectoryId: string;
    timestep: number;
    teamClusterId: string;
}

interface AnalysisFrameRequest extends FrameRequest{
    analysisId: string;
    model: string;
}

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    otherCluster: TeamCluster;
    trajectory: Trajectory;
    plugin: Plugin;
}

describe('RasterFrameService', () => {
    let dataSource: DataSource;
    const frameRequests: FrameRequest[] = [];
    const analysisFrameRequests: AnalysisFrameRequest[] = [];

    const rasterStorage = {
        getRasterFramePNG: async (trajectoryId: string, timestep: number, teamClusterId: string) => {
            frameRequests.push({
                trajectoryId,
                timestep,
                teamClusterId
            });

            return {
                stream: Readable.from(['png']),
                contentType: 'image/png',
                cacheControl: 'public, max-age=86400',
                filename: `trajectory-${trajectoryId}-timestep-${timestep}.png`
            };
        },
        getAnalysisRasterFramePNG: async (
            trajectoryId: string,
            analysisId: string,
            timestep: number,
            model: string,
            teamClusterId: string
        ) => {
            analysisFrameRequests.push({
                trajectoryId,
                analysisId,
                timestep,
                model,
                teamClusterId
            });

            return {
                stream: Readable.from(['png']),
                contentType: 'image/png',
                cacheControl: 'public, max-age=86400',
                filename: `trajectory-${trajectoryId}-analysis-${analysisId}-timestep-${timestep}-${model}.png`
            };
        }
    } as unknown as RasterStorageService;

    const service = new RasterFrameService(rasterStorage);

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
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        frameRequests.length = 0;
        analysisFrameRequests.length = 0;
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

    describe('getRasterFramePNG', () => {
        it('streams the frame from the storage cluster of the trajectory', async () => {
            const fixture = await createTeamFixture('one');

            const result = await service.getRasterFramePNG(fixture.trajectory.id, fixture.team.id, 4);

            assert.deepEqual(frameRequests, [{
                trajectoryId: fixture.trajectory.id,
                timestep: 4,
                teamClusterId: fixture.cluster.id
            }]);
            assert.equal(result.contentType, 'image/png');
            assert.equal(result.filename, `trajectory-${fixture.trajectory.id}-timestep-4.png`);
        });

        it('answers not found for a trajectory that does not exist', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.getRasterFramePNG('a1b2c3d4e5f6a1b2c3d4e5f6', fixture.team.id, 0),
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
                () => service.getRasterFramePNG('not-a-trajectory-id', fixture.team.id, 0),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Trajectory::NotFound');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
            assert.deepEqual(frameRequests, []);
        });

        it('answers not found for a trajectory of another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');

            await assert.rejects(
                () => service.getRasterFramePNG(fixture.trajectory.id, otherFixture.team.id, 0),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Trajectory::NotFound');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
            assert.deepEqual(frameRequests, []);
        });
    });

    describe('getAnalysisRasterFramePNG', () => {
        it('streams the analysis frame from the storage cluster of the analysis', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture);

            const result = await service.getAnalysisRasterFramePNG(
                fixture.trajectory.id,
                fixture.team.id,
                analysis.id,
                7,
                'surface'
            );

            assert.deepEqual(analysisFrameRequests, [{
                trajectoryId: fixture.trajectory.id,
                analysisId: analysis.id,
                timestep: 7,
                model: 'surface',
                teamClusterId: fixture.otherCluster.id
            }]);
            assert.equal(result.contentType, 'image/png');
        });

        it('answers conflict when the analysis has no storage cluster', async () => {
            const fixture = await createTeamFixture('one');
            const analysis = await seedAnalysis(fixture, { storageClusterId: null });

            await assert.rejects(
                () => service.getAnalysisRasterFramePNG(
                    fixture.trajectory.id,
                    fixture.team.id,
                    analysis.id,
                    0,
                    'surface'
                ),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Analysis::StorageClusterRequired');
                    assert.equal(error.message, 'Analysis storage cluster is required');
                    assert.equal(error.statusCode, 409);
                    return true;
                }
            );
            assert.deepEqual(analysisFrameRequests, []);
        });

        it('answers not found for an analysis that does not exist', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.getAnalysisRasterFramePNG(
                    fixture.trajectory.id,
                    fixture.team.id,
                    'a1b2c3d4e5f6a1b2c3d4e5f6',
                    0,
                    'surface'
                ),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Analysis::NotFound');
                    assert.equal(error.message, 'Analysis not found');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('answers not found instead of failing when the analysis id is malformed', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.getAnalysisRasterFramePNG(
                    fixture.trajectory.id,
                    fixture.team.id,
                    'not-an-analysis-id',
                    0,
                    'surface'
                ),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Analysis::NotFound');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
            assert.deepEqual(analysisFrameRequests, []);
        });

        it('answers not found for an analysis of another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            const analysis = await seedAnalysis(otherFixture, { trajectory: otherFixture.trajectory.id });

            await assert.rejects(
                () => service.getAnalysisRasterFramePNG(
                    fixture.trajectory.id,
                    fixture.team.id,
                    analysis.id,
                    0,
                    'surface'
                ),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Analysis::NotFound');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('answers not found for an analysis of another trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const other = await Trajectory.create({
                name: 'other',
                team: fixture.team.id,
                createdBy: fixture.owner.id,
                storageClusterId: fixture.cluster.id,
                folder: null
            }).save();
            const analysis = await seedAnalysis(fixture, { trajectory: other.id });

            await assert.rejects(
                () => service.getAnalysisRasterFramePNG(
                    fixture.trajectory.id,
                    fixture.team.id,
                    analysis.id,
                    0,
                    'surface'
                ),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Analysis::NotFound');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });
    });
});
