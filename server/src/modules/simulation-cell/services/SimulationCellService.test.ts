import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import SimulationCell from '@modules/simulation-cell/models/SimulationCell';
import SimulationCellService, { insertSimulationCells } from '@modules/simulation-cell/services/SimulationCellService';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import Team from '@modules/team/models/Team';
import Trajectory from '@modules/trajectory/models/Trajectory';
import User from '@modules/auth/models/User';
import type { SimulationCellDims, SimulationCellGeometry } from '@shared/contracts/types/SimulationCell';

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    trajectory: Trajectory;
}

const BOUNDING_BOX: SimulationCellDims = {
    width: 10.5,
    height: 20.25,
    length: 30
};

const GEOMETRY: SimulationCellGeometry = {
    cell_vectors: [
        [10.5, 0, 0],
        [0, 20.25, 0],
        [0, 0, 30]
    ],
    cell_origin: [0, 0, 0],
    periodic_boundary_conditions: {
        x: true,
        y: false,
        z: true
    }
};

describe('SimulationCellService', () => {
    let dataSource: DataSource;
    const service = new SimulationCellService();

    before(async () => {
        dataSource = await createHarness([SimulationCell, Trajectory, TeamCluster, CatalogFolder, Team, User]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
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

        return {
            team,
            owner,
            cluster,
            trajectory
        };
    };

    const seedCell = (fixture: TeamFixture, timestep: number, trajectoryId?: string): Promise<SimulationCell> => SimulationCell.create({
        boundingBox: BOUNDING_BOX,
        geometry: GEOMETRY,
        team: fixture.team.id,
        trajectory: trajectoryId ?? fixture.trajectory.id,
        timestep
    }).save();

    describe('list', () => {
        it('returns the cells of the team with the default page and limit', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);

            const result = await service.list({ teamId: fixture.team.id });

            assert.equal(result.data.length, 1);
            assert.equal(result.page, 1);
            assert.equal(result.limit, 10);
            assert.equal(result.total, 1);
            assert.equal(result.totalPages, 1);
        });

        it('excludes the cells of the other teams', async () => {
            const fixture = await createTeamFixture('one');
            const other = await createTeamFixture('two');
            const mine = await seedCell(fixture, 0);
            await seedCell(other, 0);

            const result = await service.list({ teamId: fixture.team.id });

            assert.deepEqual(result.data.map((cell) => cell._id), [mine.id]);
        });

        it('narrows the listing to a single trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const second = await Trajectory.create({
                name: 'run-second',
                team: fixture.team.id,
                storageClusterId: fixture.cluster.id,
                createdBy: fixture.owner.id
            }).save();
            const mine = await seedCell(fixture, 0);
            await seedCell(fixture, 0, second.id);

            const result = await service.list({
                teamId: fixture.team.id,
                trajectoryId: fixture.trajectory.id
            });

            assert.deepEqual(result.data.map((cell) => cell._id), [mine.id]);
        });

        it('narrows the listing to a single timestep', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);
            const target = await seedCell(fixture, 7);

            const result = await service.list({
                teamId: fixture.team.id,
                timestep: '7'
            });

            assert.deepEqual(result.data.map((cell) => cell._id), [target.id]);
        });

        it('matches the timestep zero instead of ignoring it as a missing filter', async () => {
            const fixture = await createTeamFixture('one');
            const first = await seedCell(fixture, 0);
            await seedCell(fixture, 1);

            const result = await service.list({
                teamId: fixture.team.id,
                timestep: '0'
            });

            assert.deepEqual(result.data.map((cell) => cell._id), [first.id]);
        });

        it('slices the requested page and reports the page count', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);
            await seedCell(fixture, 1);
            await seedCell(fixture, 2);

            const result = await service.list({
                teamId: fixture.team.id,
                page: '2',
                limit: '2'
            });

            assert.equal(result.data.length, 1);
            assert.equal(result.page, 2);
            assert.equal(result.limit, 2);
            assert.equal(result.total, 3);
            assert.equal(result.totalPages, 2);
        });

        it('caps the requested limit at five hundred', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);

            const result = await service.list({
                teamId: fixture.team.id,
                limit: '100000'
            });

            assert.equal(result.limit, 500);
        });

        it('falls back to the default page and limit when they are not numeric', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);

            const result = await service.list({
                teamId: fixture.team.id,
                page: 'first',
                limit: 'many'
            });

            assert.equal(result.page, 1);
            assert.equal(result.limit, 10);
        });

        it('falls back to the default limit when the requested limit is fractional', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);

            const result = await service.list({
                teamId: fixture.team.id,
                limit: '2.5'
            });

            assert.equal(result.limit, 10);
        });

        it('projects the joined trajectory as an identifier and a name only', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);

            const result = await service.list({ teamId: fixture.team.id });
            const trajectory = result.data[0].trajectory as Record<string, unknown>;

            assert.deepEqual(Object.keys(trajectory), ['_id', 'name']);
            assert.equal(trajectory._id, fixture.trajectory.id);
            assert.equal(trajectory.name, fixture.trajectory.name);
        });

        it('does not leak the other columns of the joined trajectory on the wire', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);

            const result = await service.list({ teamId: fixture.team.id });
            const wire = JSON.parse(JSON.stringify(result.data[0])) as { trajectory: Record<string, unknown> };

            assert.deepEqual(Object.keys(wire.trajectory), ['_id', 'name']);
            assert.equal('status' in wire.trajectory, false);
            assert.equal('createdBy' in wire.trajectory, false);
            assert.equal('storageClusterId' in wire.trajectory, false);
        });

        it('round trips the bounding box and the geometry through the json columns', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);

            const result = await service.list({ teamId: fixture.team.id });

            assert.deepEqual(result.data[0].boundingBox, BOUNDING_BOX);
            assert.deepEqual(result.data[0].geometry, GEOMETRY);
        });

        it('reports zero pages when the team has no cell', async () => {
            const fixture = await createTeamFixture('one');

            const result = await service.list({ teamId: fixture.team.id });

            assert.deepEqual(result.data, []);
            assert.equal(result.total, 0);
            assert.equal(result.totalPages, 0);
        });
    });

    describe('getByTrajectory', () => {
        it('returns the cell of the requested timestep', async () => {
            const fixture = await createTeamFixture('one');
            const target = await seedCell(fixture, 5);
            await seedCell(fixture, 9);

            const cell = await service.getByTrajectory({
                teamId: fixture.team.id,
                trajectoryId: fixture.trajectory.id,
                timestep: 5
            });

            assert.equal(cell?._id, target.id);
            assert.equal(cell?.timestep, 5);
        });

        it('falls back to the highest timestep when the requested one has no cell', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 1);
            const highest = await seedCell(fixture, 9);

            const cell = await service.getByTrajectory({
                teamId: fixture.team.id,
                trajectoryId: fixture.trajectory.id,
                timestep: 4
            });

            assert.equal(cell?._id, highest.id);
        });

        it('returns the highest timestep when no timestep is requested', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 1);
            const highest = await seedCell(fixture, 12);
            await seedCell(fixture, 3);

            const cell = await service.getByTrajectory({
                teamId: fixture.team.id,
                trajectoryId: fixture.trajectory.id
            });

            assert.equal(cell?._id, highest.id);
        });

        it('projects the joined trajectory as an identifier and a name only', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);

            const cell = await service.getByTrajectory({
                teamId: fixture.team.id,
                trajectoryId: fixture.trajectory.id
            });

            assert.deepEqual(Object.keys(cell?.trajectory as Record<string, unknown>), ['_id', 'name']);
        });

        it('returns null when the trajectory has no cell', async () => {
            const fixture = await createTeamFixture('one');

            const cell = await service.getByTrajectory({
                teamId: fixture.team.id,
                trajectoryId: fixture.trajectory.id
            });

            assert.equal(cell, null);
        });

        it('returns null when the trajectory belongs to another team', async () => {
            const fixture = await createTeamFixture('one');
            const other = await createTeamFixture('two');
            await seedCell(other, 0);

            const cell = await service.getByTrajectory({
                teamId: fixture.team.id,
                trajectoryId: other.trajectory.id
            });

            assert.equal(cell, null);
        });
    });

    describe('getById', () => {
        it('returns the cell with its joined trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const stored = await seedCell(fixture, 3);

            const cell = await service.getById({ simulationCellId: stored.id });

            assert.equal(cell._id, stored.id);
            assert.equal(cell.team, fixture.team.id);
            assert.equal(cell.timestep, 3);
            assert.deepEqual(cell.boundingBox, BOUNDING_BOX);
            assert.deepEqual(Object.keys(cell.trajectory as Record<string, unknown>), ['_id', 'name']);
            assert.ok(cell.createdAt instanceof Date);
            assert.ok(cell.updatedAt instanceof Date);
        });

        it('rejects an unknown cell with a not found error', async () => {
            await assert.rejects(
                () => service.getById({ simulationCellId: 'f'.repeat(24) }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.SIMULATION_CELL_NOT_FOUND);
                    assert.equal(error.statusCode, 404);
                    assert.equal(error.message, 'SimulationCell not found');
                    return true;
                }
            );
        });
    });

    describe('insertSimulationCells', () => {
        it('inserts the batch and returns the identifiers of the stored cells', async () => {
            const fixture = await createTeamFixture('one');

            const inserted = await insertSimulationCells([
                {
                    boundingBox: BOUNDING_BOX,
                    geometry: GEOMETRY,
                    team: fixture.team.id,
                    trajectory: fixture.trajectory.id,
                    timestep: 0
                },
                {
                    boundingBox: BOUNDING_BOX,
                    geometry: GEOMETRY,
                    team: fixture.team.id,
                    trajectory: fixture.trajectory.id,
                    timestep: 1
                }
            ]);

            assert.equal(inserted.length, 2);
            assert.equal(await SimulationCell.countBy({ team: fixture.team.id }), 2);
            assert.deepEqual(
                (await SimulationCell.findBy({ team: fixture.team.id })).map((cell) => cell.id).sort(),
                inserted.map((cell) => cell._id).sort()
            );
        });

        it('accepts a trajectory reference object as well as an identifier', async () => {
            const fixture = await createTeamFixture('one');

            await insertSimulationCells([{
                boundingBox: BOUNDING_BOX,
                geometry: GEOMETRY,
                team: fixture.team.id,
                trajectory: { _id: fixture.trajectory.id },
                timestep: 4
            }]);

            const stored = await SimulationCell.findOneByOrFail({ timestep: 4 });

            assert.equal(stored.trajectory, fixture.trajectory.id);
        });

        it('round trips the bounding box and the geometry it inserts', async () => {
            const fixture = await createTeamFixture('one');

            const [inserted] = await insertSimulationCells([{
                boundingBox: BOUNDING_BOX,
                geometry: GEOMETRY,
                team: fixture.team.id,
                trajectory: fixture.trajectory.id,
                timestep: 0
            }]);
            const stored = await SimulationCell.findOneByOrFail({ id: inserted._id });

            assert.deepEqual(stored.boundingBox, BOUNDING_BOX);
            assert.deepEqual(stored.geometry, GEOMETRY);
        });

        it('stores a null bounding box and geometry when they are missing from the item', async () => {
            const fixture = await createTeamFixture('one');

            const [inserted] = await insertSimulationCells([{
                team: fixture.team.id,
                trajectory: fixture.trajectory.id,
                timestep: 0
            }]);
            const stored = await SimulationCell.findOneByOrFail({ id: inserted._id });

            assert.equal(stored.boundingBox, null);
            assert.equal(stored.geometry, null);
        });

        it('returns an empty list for an empty batch', async () => {
            const fixture = await createTeamFixture('one');

            assert.deepEqual(await insertSimulationCells([]), []);
            assert.equal(await SimulationCell.countBy({ team: fixture.team.id }), 0);
        });

        it('inserts nothing when one item of the batch has no team', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(() => insertSimulationCells([
                {
                    boundingBox: BOUNDING_BOX,
                    geometry: GEOMETRY,
                    team: fixture.team.id,
                    trajectory: fixture.trajectory.id,
                    timestep: 0
                },
                {
                    boundingBox: BOUNDING_BOX,
                    geometry: GEOMETRY,
                    trajectory: fixture.trajectory.id,
                    timestep: 1
                }
            ]));

            assert.equal(await SimulationCell.count(), 0);
        });

        it('inserts nothing when one item of the batch points at an unknown trajectory', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(() => insertSimulationCells([
                {
                    boundingBox: BOUNDING_BOX,
                    geometry: GEOMETRY,
                    team: fixture.team.id,
                    trajectory: fixture.trajectory.id,
                    timestep: 0
                },
                {
                    boundingBox: BOUNDING_BOX,
                    geometry: GEOMETRY,
                    team: fixture.team.id,
                    trajectory: 'f'.repeat(24),
                    timestep: 1
                }
            ]));

            assert.equal(await SimulationCell.count(), 0);
        });

        it('inserts nothing when one item of the batch has no timestep', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(() => insertSimulationCells([
                {
                    boundingBox: BOUNDING_BOX,
                    geometry: GEOMETRY,
                    team: fixture.team.id,
                    trajectory: fixture.trajectory.id,
                    timestep: 0
                },
                {
                    boundingBox: BOUNDING_BOX,
                    geometry: GEOMETRY,
                    team: fixture.team.id,
                    trajectory: fixture.trajectory.id
                }
            ]));

            assert.equal(await SimulationCell.count(), 0);
        });
    });
});
