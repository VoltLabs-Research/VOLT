import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryFrame from '@modules/trajectory/models/TrajectoryFrame';
import SimulationCell from '@modules/simulation-cell/models/SimulationCell';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { getTrajectoryFrames } from '@modules/trajectory/services/trajectory/TrajectoryReader';
import type { TrajectoryFrameSimulationCellEmbed } from '@shared/contracts/types/Trajectory';

interface Fixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    trajectory: Trajectory;
}

describe('TrajectoryReader', () => {
    let dataSource: DataSource;

    before(async () => {
        dataSource = await createHarness([
            Trajectory,
            TrajectoryFrame,
            SimulationCell,
            TeamCluster,
            CatalogFolder,
            Team,
            User
        ]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: 'Team One',
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
        const trajectory = await Trajectory.create({
            name: 'run',
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

    const seedCell = (fixture: Fixture, timestep: number): Promise<SimulationCell> => SimulationCell.create({
        team: fixture.team.id,
        trajectory: fixture.trajectory.id,
        timestep,
        boundingBox: {
            width: 1,
            height: 2,
            length: 3
        },
        geometry: {
            cell_vectors: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            cell_origin: [0, 0, 0],
            periodic_boundary_conditions: {
                x: true,
                y: false,
                z: true
            }
        }
    }).save();

    it('returns an empty list when the trajectory has no frames', async () => {
        const fixture = await createFixture();

        assert.deepEqual(await getTrajectoryFrames(fixture.trajectory.id), []);
    });

    it('returns the frames sorted by ascending timestep', async () => {
        const fixture = await createFixture();
        for(const timestep of [30, 10, 20]){
            await TrajectoryFrame.create({
                trajectoryId: fixture.trajectory.id,
                timestep,
                natoms: timestep / 10
            }).save();
        }

        const frames = await getTrajectoryFrames(fixture.trajectory.id);

        assert.deepEqual(frames.map((frame) => frame.timestep), [10, 20, 30]);
        assert.deepEqual(frames.map((frame) => frame.natoms), [1, 2, 3]);
    });

    it('omits the simulation cell when the frame has none', async () => {
        const fixture = await createFixture();
        await TrajectoryFrame.create({
            trajectoryId: fixture.trajectory.id,
            timestep: 0,
            natoms: 4
        }).save();

        const [frame] = await getTrajectoryFrames(fixture.trajectory.id);

        assert.equal(frame.simulationCell, undefined);
    });

    it('embeds the referenced simulation cell', async () => {
        const fixture = await createFixture();
        const cell = await seedCell(fixture, 10);
        await TrajectoryFrame.create({
            trajectoryId: fixture.trajectory.id,
            timestep: 10,
            natoms: 4,
            simulationCell: cell.id
        }).save();

        const [frame] = await getTrajectoryFrames(fixture.trajectory.id);
        const embedded = frame.simulationCell as TrajectoryFrameSimulationCellEmbed;

        assert.equal(embedded._id, cell.id);
        assert.equal(embedded.timestep, 10);
        assert.equal(embedded.team, fixture.team.id);
        assert.equal(embedded.trajectory, fixture.trajectory.id);
        assert.deepEqual(embedded.boundingBox, {
            width: 1,
            height: 2,
            length: 3
        });
        assert.deepEqual(embedded.geometry.periodic_boundary_conditions, {
            x: true,
            y: false,
            z: true
        });
        assert.ok(embedded.createdAt instanceof Date);
    });

    it('reads only the frames of the requested trajectory', async () => {
        const fixture = await createFixture();
        const other = await Trajectory.create({
            name: 'other',
            team: fixture.team.id,
            storageClusterId: fixture.cluster.id,
            createdBy: fixture.owner.id
        }).save();
        await TrajectoryFrame.create({
            trajectoryId: fixture.trajectory.id,
            timestep: 0,
            natoms: 1
        }).save();
        await TrajectoryFrame.create({
            trajectoryId: other.id,
            timestep: 0,
            natoms: 2
        }).save();

        const frames = await getTrajectoryFrames(fixture.trajectory.id);

        assert.equal(frames.length, 1);
        assert.equal(frames[0].natoms, 1);
    });
});
