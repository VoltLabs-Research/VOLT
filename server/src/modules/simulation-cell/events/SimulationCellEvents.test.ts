import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import SimulationCell from '@modules/simulation-cell/models/SimulationCell';
import SimulationCellEvents from '@modules/simulation-cell/events/SimulationCellEvents';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import Team from '@modules/team/models/Team';
import Trajectory from '@modules/trajectory/models/Trajectory';
import User from '@modules/auth/models/User';

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    trajectory: Trajectory;
}

describe('SimulationCellEvents', () => {
    let dataSource: DataSource;
    const events = new SimulationCellEvents();

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
        boundingBox: null,
        geometry: null,
        team: fixture.team.id,
        trajectory: trajectoryId ?? fixture.trajectory.id,
        timestep
    }).save();

    describe('deleteTeamSimulationCells', () => {
        it('deletes every cell of the deleted team', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);
            await seedCell(fixture, 1);

            await events.deleteTeamSimulationCells({ teamId: fixture.team.id });

            assert.equal(await SimulationCell.countBy({ team: fixture.team.id }), 0);
        });

        it('keeps the cells of the other teams', async () => {
            const fixture = await createTeamFixture('one');
            const other = await createTeamFixture('two');
            await seedCell(fixture, 0);
            const survivor = await seedCell(other, 0);

            await events.deleteTeamSimulationCells({ teamId: fixture.team.id });

            assert.deepEqual((await SimulationCell.find()).map((cell) => cell.id), [survivor.id]);
        });

        it('resolves when the deleted team had no cell', async () => {
            const fixture = await createTeamFixture('one');

            await events.deleteTeamSimulationCells({ teamId: fixture.team.id });

            assert.equal(await SimulationCell.count(), 0);
        });
    });

    describe('deleteTrajectorySimulationCells', () => {
        it('deletes every cell of the deleted trajectory', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);
            await seedCell(fixture, 1);

            await events.deleteTrajectorySimulationCells({
                trajectoryId: fixture.trajectory.id,
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                trajectoryName: fixture.trajectory.name
            });

            assert.equal(await SimulationCell.count(), 0);
        });

        it('keeps the cells of the other trajectories of the same team', async () => {
            const fixture = await createTeamFixture('one');
            const second = await Trajectory.create({
                name: 'run-second',
                team: fixture.team.id,
                storageClusterId: fixture.cluster.id,
                createdBy: fixture.owner.id
            }).save();
            await seedCell(fixture, 0);
            const survivor = await seedCell(fixture, 0, second.id);

            await events.deleteTrajectorySimulationCells({
                trajectoryId: fixture.trajectory.id,
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                trajectoryName: fixture.trajectory.name
            });

            assert.deepEqual((await SimulationCell.find()).map((cell) => cell.id), [survivor.id]);
        });
    });

    describe('foreign key cascades', () => {
        it('deletes the cells when the trajectory row is deleted', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);

            await Trajectory.delete({ id: fixture.trajectory.id });

            assert.equal(await SimulationCell.count(), 0);
        });

        it('deletes the cells when the team row is deleted', async () => {
            const fixture = await createTeamFixture('one');
            await seedCell(fixture, 0);

            await Team.delete({ id: fixture.team.id });

            assert.equal(await SimulationCell.count(), 0);
        });
    });
});
