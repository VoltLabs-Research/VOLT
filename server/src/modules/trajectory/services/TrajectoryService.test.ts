import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryFrame from '@modules/trajectory/models/TrajectoryFrame';
import TrajectoryUploadSession from '@modules/trajectory/models/TrajectoryUploadSession';
import { TrajectoryUploadSessionStatus } from '@modules/trajectory/contracts/domain/trajectory-upload-session';
import TrajectoryCloneJob from '@modules/trajectory/models/TrajectoryCloneJob';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import SimulationCell from '@modules/simulation-cell/models/SimulationCell';
import Analysis from '@modules/analysis/models/Analysis';
import Plugin from '@modules/plugin/models/Plugin';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import User from '@modules/auth/models/User';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { TrajectoryStatus } from '@shared/contracts/types/Trajectory';
import { SceneArtifactSourceType } from '@shared/contracts/types/SceneArtifact';

const onTheWire = <T>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T;

interface Fixture{
    team: Team;
    otherTeam: Team;
    owner: User;
    cluster: TeamCluster;
    plugin: Plugin;
}

const ENTITIES = [
    Trajectory,
    TrajectoryFrame,
    TrajectoryUploadSession,
    TrajectoryCloneJob,
    SceneArtifact,
    SimulationCell,
    Analysis,
    Plugin,
    TeamCluster,
    CatalogFolder,
    Team,
    TeamMember,
    TeamRole,
    User
];

describe('TrajectoryService', () => {
    let dataSource: DataSource;
    const service = new TrajectoryService();

    before(async () => {
        dataSource = await createHarness(ENTITIES);
        (eventBus as unknown as { publish: () => Promise<void> }).publish = async () => {};
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada',
            lastName: 'lovelace'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const otherTeam = await Team.create({
            name: 'Team Two',
            owner: owner.id
        }).save();
        const cluster = await TeamCluster.create({
            name: 'storage',
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();
        const plugin = await Plugin.create({
            team: team.id,
            workflow: { nodes: [] }
        }).save();

        return {
            team,
            otherTeam,
            owner,
            cluster,
            plugin
        };
    };

    const seedTrajectory = (
        fixture: Fixture,
        overrides: Partial<Trajectory> = {}
    ): Promise<Trajectory> => Trajectory.create({
        name: 'run',
        team: fixture.team.id,
        storageClusterId: fixture.cluster.id,
        createdBy: fixture.owner.id,
        folder: null,
        ...overrides
    }).save();

    const seedFrame = (
        trajectoryId: string,
        timestep: number,
        natoms: number,
        simulationCell: string | null = null
    ): Promise<TrajectoryFrame> => TrajectoryFrame.create({
        trajectoryId,
        timestep,
        natoms,
        simulationCell
    }).save();

    const seedFolder = (
        fixture: Fixture,
        title: string,
        parent: string | null = null
    ): Promise<CatalogFolder> => CatalogFolder.create({
        team: fixture.team.id,
        createdBy: fixture.owner.id,
        title,
        parent,
        kind: CatalogFolderKind.Trajectory
    }).save();

    const seedAnalysis = (fixture: Fixture, trajectoryId: string): Promise<Analysis> => Analysis.create({
        plugin: fixture.plugin.id,
        pluginDisplayName: 'Radial Distribution',
        team: fixture.team.id,
        trajectory: trajectoryId,
        createdBy: fixture.owner.id,
        config: {}
    }).save();

    const seedArtifact = (
        trajectoryId: string,
        clusterId: string,
        overrides: Partial<SceneArtifact> = {}
    ): Promise<SceneArtifact> => SceneArtifact.create({
        trajectory: trajectoryId,
        storageClusterId: clusterId,
        sourceType: SceneArtifactSourceType.ColorCoding,
        timestep: 0,
        objectName: `models/${Math.random().toString(36).slice(2)}.glb.zst`,
        storageBucket: 'volt-models',
        params: {},
        displayName: 'artifact',
        metadata: {},
        ...overrides
    }).save();

    describe('getByTeamId', () => {
        it('returns the team trajectories newest updated first with frame summaries', async () => {
            const fixture = await createFixture();
            const first = await seedTrajectory(fixture, { name: 'alpha' });
            const second = await seedTrajectory(fixture, { name: 'beta' });
            await seedFrame(first.id, 30, 11);
            await seedFrame(first.id, 10, 7);
            await seedFrame(first.id, 20, 9);

            const result = await service.getByTeamId({ teamId: fixture.team.id });

            assert.equal(result.total, 2);
            assert.equal(result.page, 1);
            assert.equal(result.limit, 20);
            assert.equal(result.totalPages, 1);
            assert.equal(result.data.length, 2);

            const alpha = result.data.find((item) => item.name === 'alpha');
            assert.equal(alpha?.framesCount, 3);
            assert.equal(alpha?.atoms, 7);
            assert.equal(alpha?.firstTimestep, 10);

            const beta = result.data.find((item) => item.name === 'beta');
            assert.equal(beta?.framesCount, 0);
            assert.equal(beta?.atoms, 0);
            assert.equal(beta?.firstTimestep, undefined);
            assert.ok(second.id);
        });

        it('exposes the trajectory id on the wire as _id', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);

            const result = await service.getByTeamId({ teamId: fixture.team.id });

            assert.equal(result.data[0]._id, trajectory.id);
        });

        it('loads the createdBy and storage cluster references', async () => {
            const fixture = await createFixture();
            await seedTrajectory(fixture);

            const result = await service.getByTeamId({ teamId: fixture.team.id });
            const record = onTheWire<{
                createdBy: { _id: string; email: string };
                storageClusterId: { _id: string; name: string };
            }>(result.data[0]);

            assert.equal(record.createdBy._id, fixture.owner.id);
            assert.equal(record.createdBy.email, 'owner@volt.test');
            assert.equal(record.storageClusterId._id, fixture.cluster.id);
            assert.equal(record.storageClusterId.name, 'storage');
        });

        it('excludes the trajectories of other teams', async () => {
            const fixture = await createFixture();
            await seedTrajectory(fixture);
            await seedTrajectory(fixture, { team: fixture.otherTeam.id });

            const result = await service.getByTeamId({ teamId: fixture.team.id });

            assert.equal(result.total, 1);
        });

        it('filters the root folder when folderId is "root"', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'nested');
            await seedTrajectory(fixture, { name: 'at-root' });
            await seedTrajectory(fixture, {
                name: 'in-folder',
                folder: folder.id
            });

            const result = await service.getByTeamId({
                teamId: fixture.team.id,
                folderId: 'root'
            });

            assert.equal(result.total, 1);
            assert.equal(result.data[0].name, 'at-root');
        });

        it('filters by an explicit folder id', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'nested');
            await seedTrajectory(fixture, { name: 'at-root' });
            await seedTrajectory(fixture, {
                name: 'in-folder',
                folder: folder.id
            });

            const result = await service.getByTeamId({
                teamId: fixture.team.id,
                folderId: folder.id
            });

            assert.equal(result.total, 1);
            assert.equal(result.data[0].name, 'in-folder');
        });

        it('searches by name case insensitively', async () => {
            const fixture = await createFixture();
            await seedTrajectory(fixture, { name: 'Copper Lattice' });
            await seedTrajectory(fixture, { name: 'iron slab' });

            const result = await service.getByTeamId({
                teamId: fixture.team.id,
                search: 'copper'
            });

            assert.equal(result.total, 1);
            assert.equal(result.data[0].name, 'Copper Lattice');
        });

        it('does not let the search wildcards match every row', async () => {
            const fixture = await createFixture();
            await seedTrajectory(fixture, { name: '100% copper' });
            await seedTrajectory(fixture, { name: 'iron slab' });

            const wildcard = await service.getByTeamId({
                teamId: fixture.team.id,
                search: '%'
            });
            assert.equal(wildcard.data.some((item) => item.name === 'iron slab'), false);

            const underscore = await service.getByTeamId({
                teamId: fixture.team.id,
                search: 'iro_'
            });
            assert.equal(underscore.data.some((item) => item.name === 'iron slab'), false);
        });

        it('paginates while reporting the unpaged total', async () => {
            const fixture = await createFixture();
            for(const name of ['a', 'b', 'c']){
                await seedTrajectory(fixture, { name });
            }

            const firstPage = await service.getByTeamId({
                teamId: fixture.team.id,
                page: 1,
                limit: 2
            });
            const secondPage = await service.getByTeamId({
                teamId: fixture.team.id,
                page: 2,
                limit: 2
            });

            assert.equal(firstPage.total, 3);
            assert.equal(firstPage.totalPages, 2);
            assert.equal(firstPage.data.length, 2);
            assert.equal(secondPage.data.length, 1);
        });
    });

    describe('getById', () => {
        it('returns the trajectory with its frames sorted by timestep', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            await seedFrame(trajectory.id, 20, 8);
            await seedFrame(trajectory.id, 10, 4);

            const result = onTheWire<{
                _id: string;
                team: { _id: string; name: string };
                frames: Array<{ timestep: number; natoms: number; simulationCell?: unknown }>;
            }>(await service.getById({ trajectoryId: trajectory.id }));

            assert.equal(result._id, trajectory.id);
            assert.equal(result.team._id, fixture.team.id);
            assert.equal(result.team.name, 'Team One');
            assert.deepEqual(result.frames.map((frame) => frame.timestep), [10, 20]);
            assert.equal(result.frames[0].simulationCell, undefined);
        });

        it('embeds the simulation cell when the frame references one', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            const cell = await SimulationCell.create({
                team: fixture.team.id,
                trajectory: trajectory.id,
                timestep: 10,
                boundingBox: {
                    width: 1,
                    height: 2,
                    length: 3
                },
                geometry: {
                    cell_vectors: [[1, 0, 0]],
                    cell_origin: [0, 0, 0],
                    periodic_boundary_conditions: {
                        x: true,
                        y: true,
                        z: true
                    }
                }
            }).save();
            await seedFrame(trajectory.id, 10, 4, cell.id);

            const result = onTheWire<{
                frames: Array<{ simulationCell: { _id: string; timestep: number } }>;
            }>(await service.getById({ trajectoryId: trajectory.id }));

            assert.equal(result.frames[0].simulationCell._id, cell.id);
            assert.equal(result.frames[0].simulationCell.timestep, 10);
        });

        it('rejects an unknown trajectory', async () => {
            await createFixture();

            await assert.rejects(
                () => service.getById({ trajectoryId: 'a'.repeat(24) }),
                (error: unknown) => error instanceof ApplicationError && error.statusCode === 404
            );
        });
    });

    describe('updateById', () => {
        it('renames the trajectory and flips its visibility', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture, { isPublic: true });

            const result = onTheWire<{ _id: string; name: string; isPublic: boolean; team: { _id: string } }>(
                await service.updateById({
                    trajectoryId: trajectory.id,
                    name: 'renamed',
                    isPublic: false
                })
            );

            assert.equal(result._id, trajectory.id);
            assert.equal(result.name, 'renamed');
            assert.equal(result.isPublic, false);
            assert.equal(result.team._id, fixture.team.id);

            const reloaded = await Trajectory.findOneBy({ id: trajectory.id });
            assert.equal(reloaded?.name, 'renamed');
            assert.equal(reloaded?.isPublic, false);
        });

        it('rejects an unknown trajectory', async () => {
            await createFixture();

            await assert.rejects(
                () => service.updateById({
                    trajectoryId: 'a'.repeat(24),
                    name: 'renamed',
                    isPublic: true
                }),
                (error: unknown) => error instanceof ApplicationError && error.statusCode === 404
            );
        });
    });

    describe('move', () => {
        it('moves a trajectory into a folder', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            const folder = await seedFolder(fixture, 'target');

            const result = await service.move({
                teamId: fixture.team.id,
                trajectoryId: trajectory.id,
                folderId: folder.id
            });

            assert.equal(result, null);
            const reloaded = await Trajectory.findOneBy({ id: trajectory.id });
            assert.equal(reloaded?.folder, folder.id);
        });

        it('moves a trajectory back to the root', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'target');
            const trajectory = await seedTrajectory(fixture, { folder: folder.id });

            await service.move({
                teamId: fixture.team.id,
                trajectoryId: trajectory.id,
                folderId: null
            });

            const reloaded = await Trajectory.findOneBy({ id: trajectory.id });
            assert.equal(reloaded?.folder, null);
        });

        it('rejects a trajectory owned by another team', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture, { team: fixture.otherTeam.id });

            await assert.rejects(
                () => service.move({
                    teamId: fixture.team.id,
                    trajectoryId: trajectory.id,
                    folderId: null
                }),
                (error: unknown) => error instanceof ApplicationError && error.statusCode === 404
            );
        });

        it('rejects an unknown target folder', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);

            await assert.rejects(
                () => service.move({
                    teamId: fixture.team.id,
                    trajectoryId: trajectory.id,
                    folderId: 'a'.repeat(24)
                }),
                (error: unknown) => error instanceof ApplicationError && error.statusCode === 404
            );
        });
    });

    describe('folders', () => {
        it('lists the root folders newest first with the default limit', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            await seedFolder(fixture, 'child', root.id);

            const result = await service.listFolders(fixture.team.id, {});

            assert.equal(result.total, 1);
            assert.equal(result.limit, 500);
            assert.equal(result.page, 1);
            assert.equal(result.data[0].title, 'root-one');
            assert.equal(result.data[0].parent, null);
        });

        it('lists the children of a folder', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            await seedFolder(fixture, 'child', root.id);

            const result = await service.listFolders(fixture.team.id, { parentId: root.id });

            assert.equal(result.total, 1);
            assert.equal(result.data[0].title, 'child');
            assert.equal(result.data[0].parent, root.id);
        });

        it('paginates the folder listing', async () => {
            const fixture = await createFixture();
            await seedFolder(fixture, 'one');
            await seedFolder(fixture, 'two');

            const result = await service.listFolders(fixture.team.id, {
                page: 2,
                limit: 1
            });

            assert.equal(result.total, 2);
            assert.equal(result.totalPages, 2);
            assert.equal(result.data.length, 1);
        });

        it('creates a folder at the root', async () => {
            const fixture = await createFixture();

            const folder = await service.createFolder(fixture.team.id, fixture.owner.id, { title: 'created' });

            assert.equal(folder.title, 'created');
            assert.equal(folder.parent, null);
            const stored = await CatalogFolder.findOneBy({ id: folder._id });
            assert.equal(stored?.team, fixture.team.id);
            assert.equal(stored?.createdBy, fixture.owner.id);
            assert.equal(stored?.kind, CatalogFolderKind.Trajectory);
        });

        it('creates a nested folder', async () => {
            const fixture = await createFixture();
            const parent = await seedFolder(fixture, 'parent');

            const folder = await service.createFolder(fixture.team.id, fixture.owner.id, {
                title: 'nested',
                parentId: parent.id
            });

            assert.equal(folder.parent, parent.id);
        });

        it('reads a single folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'readable');

            const result = await service.getFolder(fixture.team.id, folder.id);

            assert.equal(result._id, folder.id);
            assert.equal(result.title, 'readable');
        });

        it('rejects reading a folder of another team', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'readable');

            await assert.rejects(
                () => service.getFolder(fixture.otherTeam.id, folder.id),
                (error: unknown) => error instanceof ApplicationError && error.statusCode === 404
            );
        });

        it('renames a folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'before');

            const result = await service.updateFolder(fixture.team.id, folder.id, { title: 'after' });

            assert.equal(result.title, 'after');
            const stored = await CatalogFolder.findOneBy({ id: folder.id });
            assert.equal(stored?.title, 'after');
        });

        it('rejects renaming an unknown folder', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.updateFolder(fixture.team.id, 'a'.repeat(24), { title: 'after' }),
                (error: unknown) => error instanceof ApplicationError && error.statusCode === 404
            );
        });

        it('deletes a folder tree including its subfolders', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            const child = await seedFolder(fixture, 'child', root.id);
            const grandChild = await seedFolder(fixture, 'grand-child', child.id);
            const survivor = await seedFolder(fixture, 'survivor');

            const result = await service.deleteFolder(fixture.team.id, root.id);

            assert.equal(result, null);
            assert.equal(await CatalogFolder.countBy({ id: root.id }), 0);
            assert.equal(await CatalogFolder.countBy({ id: child.id }), 0);
            assert.equal(await CatalogFolder.countBy({ id: grandChild.id }), 0);
            assert.equal(await CatalogFolder.countBy({ id: survivor.id }), 1);
        });

        it('deletes the trajectories stored inside the folder tree', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'doomed');
            const trajectory = await seedTrajectory(fixture, { folder: folder.id });
            await seedFrame(trajectory.id, 0, 4);
            const survivor = await seedTrajectory(fixture, { name: 'survivor' });

            await service.deleteFolder(fixture.team.id, folder.id);

            assert.equal(await Trajectory.countBy({ id: trajectory.id }), 0);
            assert.equal(await TrajectoryFrame.countBy({ trajectoryId: trajectory.id }), 0);
            assert.equal(await Trajectory.countBy({ id: survivor.id }), 1);
        });

        it('rejects deleting an unknown folder', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.deleteFolder(fixture.team.id, 'a'.repeat(24)),
                (error: unknown) => error instanceof ApplicationError && error.statusCode === 404
            );
        });
    });

    describe('deleteById', () => {
        it('deletes the trajectory and its frames', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            await seedFrame(trajectory.id, 0, 4);
            await seedFrame(trajectory.id, 10, 4);

            const result = await service.deleteById({
                trajectoryId: trajectory.id,
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(result, { success: true });
            assert.equal(await Trajectory.countBy({ id: trajectory.id }), 0);
            assert.equal(await TrajectoryFrame.countBy({ trajectoryId: trajectory.id }), 0);
        });

        it('rejects an unknown trajectory', async () => {
            await createFixture();

            await assert.rejects(
                () => service.deleteById({ trajectoryId: 'a'.repeat(24) }),
                (error: unknown) => error instanceof ApplicationError && error.statusCode === 404
            );
        });
    });

    describe('listPublicTeamTrajectories', () => {
        it('returns only the public trajectories of the team with the team metadata', async () => {
            const fixture = await createFixture();
            const visible = await seedTrajectory(fixture, {
                name: 'public',
                isPublic: true
            });
            await seedTrajectory(fixture, {
                name: 'private',
                isPublic: false
            });
            await seedFrame(visible.id, 5, 12);

            const result = await service.listPublicTeamTrajectories({ teamId: fixture.team.id });

            assert.equal(result.total, 1);
            assert.equal(result.limit, 20);
            assert.equal(result.data[0].name, 'public');
            assert.equal(result.data[0].framesCount, 1);
            assert.equal(result.data[0].atoms, 12);
            assert.equal(result.data[0].firstTimestep, 5);
            assert.deepEqual(result._meta, {
                team: {
                    _id: fixture.team.id,
                    name: 'Team One'
                }
            });
        });

        it('rejects an unknown team', async () => {
            await createFixture();

            await assert.rejects(
                () => service.listPublicTeamTrajectories({ teamId: 'a'.repeat(24) }),
                (error: unknown) => error instanceof ApplicationError && error.statusCode === 404
            );
        });

        it('escapes the wildcards of the public search', async () => {
            const fixture = await createFixture();
            await seedTrajectory(fixture, {
                name: 'copper_100',
                isPublic: true
            });
            await seedTrajectory(fixture, {
                name: 'copperX100',
                isPublic: true
            });

            const result = await service.listPublicTeamTrajectories({
                teamId: fixture.team.id,
                search: 'copper_'
            });

            assert.equal(result.data.some((item) => item.name === 'copperX100'), false);
        });
    });

    describe('listTeamSceneArtifacts', () => {
        it('returns only the artifacts whose trajectory belongs to the team', async () => {
            const fixture = await createFixture();
            const owned = await seedTrajectory(fixture);
            const foreign = await seedTrajectory(fixture, { team: fixture.otherTeam.id });
            await seedArtifact(owned.id, fixture.cluster.id);
            await seedArtifact(foreign.id, fixture.cluster.id);

            const result = await service.listTeamSceneArtifacts({ teamId: fixture.team.id });

            assert.equal(result.total, 1);
            assert.equal(result.limit, 100);
            assert.equal(onTheWire<{ trajectory: { _id: string } }>(result.data[0]).trajectory._id, owned.id);
        });

        it('narrows the embedded trajectory to its name and storage cluster', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            await seedArtifact(trajectory.id, fixture.cluster.id);

            const result = await service.listTeamSceneArtifacts({ teamId: fixture.team.id });
            const artifact = onTheWire<{
                trajectory: Record<string, unknown> & { storageClusterId: { _id: string; name: string } };
                storageClusterId: { _id: string; name: string };
            }>(result.data[0]);

            assert.equal(artifact.trajectory.name, 'run');
            assert.equal(artifact.trajectory.status, undefined);
            assert.equal(artifact.trajectory.storageClusterId._id, fixture.cluster.id);
            assert.equal(artifact.trajectory.storageClusterId.name, 'storage');
            assert.equal(artifact.storageClusterId.name, 'storage');
        });

        it('filters by source type, analysis and timestep', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            const analysis = await seedAnalysis(fixture, trajectory.id);
            await seedArtifact(trajectory.id, fixture.cluster.id, {
                sourceType: SceneArtifactSourceType.PluginExposure,
                analysis: analysis.id,
                timestep: 10
            });
            await seedArtifact(trajectory.id, fixture.cluster.id, {
                sourceType: SceneArtifactSourceType.ColorCoding,
                timestep: 10
            });
            await seedArtifact(trajectory.id, fixture.cluster.id, {
                sourceType: SceneArtifactSourceType.PluginExposure,
                analysis: analysis.id,
                timestep: 20
            });

            const bySource = await service.listTeamSceneArtifacts({
                teamId: fixture.team.id,
                sourceType: SceneArtifactSourceType.PluginExposure
            });
            assert.equal(bySource.total, 2);

            const byAnalysis = await service.listTeamSceneArtifacts({
                teamId: fixture.team.id,
                analysisId: analysis.id
            });
            assert.equal(byAnalysis.total, 2);

            const byTimestep = await service.listTeamSceneArtifacts({
                teamId: fixture.team.id,
                timestep: 20
            });
            assert.equal(byTimestep.total, 1);
        });

        it('paginates the team artifacts while reporting the unpaged total', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            await seedArtifact(trajectory.id, fixture.cluster.id);
            await seedArtifact(trajectory.id, fixture.cluster.id);
            await seedArtifact(trajectory.id, fixture.cluster.id);

            const page = await service.listTeamSceneArtifacts({
                teamId: fixture.team.id,
                page: 2,
                limit: 2
            });

            assert.equal(page.total, 3);
            assert.equal(page.totalPages, 2);
            assert.equal(page.data.length, 1);
        });

        it('returns an empty page when the team has no artifacts', async () => {
            const fixture = await createFixture();

            const result = await service.listTeamSceneArtifacts({ teamId: fixture.team.id });

            assert.equal(result.total, 0);
            assert.deepEqual(result.data, []);
        });
    });

    describe('getSceneArtifacts', () => {
        it('lists the artifacts of one trajectory newest first', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            const other = await seedTrajectory(fixture, { name: 'other' });
            await seedArtifact(trajectory.id, fixture.cluster.id, { displayName: 'first' });
            await seedArtifact(other.id, fixture.cluster.id, { displayName: 'foreign' });

            const result = await service.getSceneArtifacts({ trajectoryId: trajectory.id });

            assert.equal(result.total, 1);
            assert.equal(result.limit, 100);
            assert.equal((result.data[0] as { displayName: string }).displayName, 'first');
        });

        it('filters by source type and timestep', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            await seedArtifact(trajectory.id, fixture.cluster.id, {
                sourceType: SceneArtifactSourceType.LineStyle,
                timestep: 10
            });
            await seedArtifact(trajectory.id, fixture.cluster.id, {
                sourceType: SceneArtifactSourceType.LineStyle,
                timestep: 20
            });

            const result = await service.getSceneArtifacts({
                trajectoryId: trajectory.id,
                sourceType: SceneArtifactSourceType.LineStyle,
                timestep: 20
            });

            assert.equal(result.total, 1);
        });

        it('projects the renderable exposures keeping the freshest artifact per exposure', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            const analysis = await seedAnalysis(fixture, trajectory.id);

            const stale = await seedArtifact(trajectory.id, fixture.cluster.id, {
                sourceType: SceneArtifactSourceType.PluginExposure,
                analysis: analysis.id,
                plugin: fixture.plugin.id,
                params: { exposureId: 'exposure-1' },
                metadata: {
                    exporter: 'MeshExporter',
                    exportType: 'glb',
                    exposureName: 'Stale name',
                    pluginId: fixture.plugin.id
                }
            });
            await Object.assign(stale, { updatedAt: new Date(Date.now() - 60_000) }).save();

            await seedArtifact(trajectory.id, fixture.cluster.id, {
                sourceType: SceneArtifactSourceType.PluginExposure,
                analysis: analysis.id,
                plugin: fixture.plugin.id,
                params: { exposureId: 'exposure-1' },
                metadata: {
                    exporter: 'MeshExporter',
                    exportType: 'glb',
                    exposureName: 'Fresh name',
                    pluginId: fixture.plugin.id
                }
            });

            const result = await service.getSceneArtifacts({
                trajectoryId: trajectory.id,
                sourceType: SceneArtifactSourceType.PluginExposure,
                projection: 'renderable-exposures'
            });

            assert.equal(result.total, 1);
            const exposure = result.data[0] as {
                name: string;
                pluginId: string;
                analysisId?: string;
                exposureId: string;
                export: { exporter?: string };
            };
            assert.equal(exposure.name, 'Fresh name');
            assert.equal(exposure.pluginId, fixture.plugin.id);
            assert.equal(exposure.analysisId, analysis.id);
            assert.equal(exposure.exposureId, 'exposure-1');
            assert.equal(exposure.export.exporter, 'MeshExporter');
        });

        it('drops the renderable exposures without a plugin reference', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            await seedArtifact(trajectory.id, fixture.cluster.id, {
                sourceType: SceneArtifactSourceType.PluginExposure,
                params: { exposureId: 'exposure-1' },
                metadata: {
                    exporter: 'MeshExporter',
                    exposureName: 'Orphan',
                    pluginId: fixture.plugin.id
                }
            });

            const result = await service.getSceneArtifacts({
                trajectoryId: trajectory.id,
                sourceType: SceneArtifactSourceType.PluginExposure,
                projection: 'renderable-exposures'
            });

            assert.equal(result.total, 0);
        });

        it('drops the exposures whose exporter cannot be rendered', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            await seedArtifact(trajectory.id, fixture.cluster.id, {
                sourceType: SceneArtifactSourceType.PluginExposure,
                plugin: fixture.plugin.id,
                params: { exposureId: 'exposure-1' },
                metadata: {
                    exporter: 'TableExporter',
                    exposureName: 'Table',
                    pluginId: fixture.plugin.id
                }
            });

            const result = await service.getSceneArtifacts({
                trajectoryId: trajectory.id,
                sourceType: SceneArtifactSourceType.PluginExposure,
                projection: 'renderable-exposures'
            });

            assert.equal(result.total, 0);
        });
    });

    describe('getTeamMetrics', () => {
        it('counts the team trajectories and their analyses', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            await seedTrajectory(fixture, { name: 'second' });
            await seedAnalysis(fixture, trajectory.id);

            const metrics = await service.getTeamMetrics({ teamId: fixture.team.id });

            assert.equal(metrics.totals.trajectories, 2);
            assert.equal(metrics.totals.analysis, 1);
            assert.ok(Array.isArray(metrics.weekly.labels));
        });

        it('reports zeroes for a team without content', async () => {
            const fixture = await createFixture();

            const metrics = await service.getTeamMetrics({ teamId: fixture.team.id });

            assert.equal(metrics.totals.trajectories, 0);
            assert.equal(metrics.totals.analysis, 0);
        });
    });

    describe('cancelUploadSession', () => {
        const seedSession = (fixture: Fixture, trajectoryId: string): Promise<TrajectoryUploadSession> => TrajectoryUploadSession.create({
            team: fixture.team.id,
            user: fixture.owner.id,
            ownerClusterId: fixture.cluster.id,
            bucket: 'volt-dumps',
            resourceKind: 'trajectory',
            resourceId: trajectoryId,
            files: [],
            expiresAt: new Date(Date.now() + 60_000)
        }).save();

        it('rejects an unknown session', async () => {
            await createFixture();

            await assert.rejects(
                () => service.cancelUploadSession({
                    uploadSessionId: 'a'.repeat(24),
                    teamId: 'b'.repeat(24),
                    userId: 'c'.repeat(24)
                }),
                (error: unknown) => error instanceof ApplicationError && error.statusCode === 404
            );
        });

        it('rejects a session owned by another user', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            const session = await seedSession(fixture, trajectory.id);

            await assert.rejects(
                () => service.cancelUploadSession({
                    uploadSessionId: session.id,
                    teamId: fixture.team.id,
                    userId: 'c'.repeat(24)
                }),
                (error: unknown) => error instanceof ApplicationError && error.statusCode === 403
            );
        });

        it('cancels a pending session and fails its trajectory', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            const session = await seedSession(fixture, trajectory.id);

            await service.cancelUploadSession({
                uploadSessionId: session.id,
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            const reloadedSession = await TrajectoryUploadSession.findOneBy({ id: session.id });
            const reloadedTrajectory = await Trajectory.findOneBy({ id: trajectory.id });
            assert.equal(reloadedSession?.status, 'cancelled');
            assert.equal(reloadedTrajectory?.status, TrajectoryStatus.Failed);
        });

        it('refuses to cancel a committed session', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            const session = await seedSession(fixture, trajectory.id);
            await Object.assign(session, { status: 'committed' }).save();

            await assert.rejects(
                () => service.cancelUploadSession({
                    uploadSessionId: session.id,
                    teamId: fixture.team.id,
                    userId: fixture.owner.id
                }),
                (error: unknown) => error instanceof ApplicationError && error.statusCode === 409
            );
        });
    });

    describe('commitUploadSession', () => {
        it('rejects an unknown session', async () => {
            await createFixture();

            await assert.rejects(
                () => service.commitUploadSession({
                    uploadSessionId: 'a'.repeat(24),
                    teamId: 'b'.repeat(24),
                    userId: 'c'.repeat(24)
                }),
                (error: unknown) => error instanceof ApplicationError && error.statusCode === 404
            );
        });

        it('is idempotent for an already committed session', async () => {
            const fixture = await createFixture();
            const trajectory = await seedTrajectory(fixture);
            const session = await TrajectoryUploadSession.create({
                team: fixture.team.id,
                user: fixture.owner.id,
                ownerClusterId: fixture.cluster.id,
                bucket: 'volt-dumps',
                resourceKind: 'trajectory',
                resourceId: trajectory.id,
                files: [],
                expiresAt: new Date(Date.now() + 60_000),
                status: TrajectoryUploadSessionStatus.Committed
            }).save();

            const result = await service.commitUploadSession({
                uploadSessionId: session.id,
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(result, { trajectoryId: trajectory.id });
        });
    });
});
