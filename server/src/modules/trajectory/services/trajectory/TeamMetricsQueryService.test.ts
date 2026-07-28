import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import Trajectory from '@modules/trajectory/models/Trajectory';
import Analysis from '@modules/analysis/models/Analysis';
import Plugin from '@modules/plugin/models/Plugin';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import teamMetricsQueryService from '@modules/trajectory/services/trajectory/TeamMetricsQueryService';

interface Fixture{
    team: Team;
    otherTeam: Team;
    owner: User;
    cluster: TeamCluster;
    plugin: Plugin;
}

describe('TeamMetricsQueryService', () => {
    let dataSource: DataSource;

    before(async () => {
        dataSource = await createHarness([
            Trajectory,
            Analysis,
            Plugin,
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

    const seedTrajectory = (fixture: Fixture, teamId: string, name: string): Promise<Trajectory> => Trajectory.create({
        name,
        team: teamId,
        storageClusterId: fixture.cluster.id,
        createdBy: fixture.owner.id
    }).save();

    const seedAnalysis = (fixture: Fixture, trajectoryId: string, teamId: string): Promise<Analysis> => Analysis.create({
        plugin: fixture.plugin.id,
        pluginDisplayName: 'Radial Distribution',
        team: teamId,
        trajectory: trajectoryId,
        createdBy: fixture.owner.id,
        config: {}
    }).save();

    it('reports zeroes for a team without content', async () => {
        const fixture = await createFixture();

        const metrics = await teamMetricsQueryService.getTeamMetrics(fixture.team.id);

        assert.equal(metrics.totals.trajectories, 0);
        assert.equal(metrics.totals.analysis, 0);
        assert.deepEqual(metrics.weekly.labels, []);
    });

    it('counts the trajectories of the requested team only', async () => {
        const fixture = await createFixture();
        await seedTrajectory(fixture, fixture.team.id, 'one');
        await seedTrajectory(fixture, fixture.team.id, 'two');
        await seedTrajectory(fixture, fixture.otherTeam.id, 'foreign');

        const metrics = await teamMetricsQueryService.getTeamMetrics(fixture.team.id);

        assert.equal(metrics.totals.trajectories, 2);
    });

    it('counts the analyses attached to the team trajectories', async () => {
        const fixture = await createFixture();
        const trajectory = await seedTrajectory(fixture, fixture.team.id, 'one');
        const foreign = await seedTrajectory(fixture, fixture.otherTeam.id, 'foreign');
        await seedAnalysis(fixture, trajectory.id, fixture.team.id);
        await seedAnalysis(fixture, trajectory.id, fixture.team.id);
        await seedAnalysis(fixture, foreign.id, fixture.otherTeam.id);

        const metrics = await teamMetricsQueryService.getTeamMetrics(fixture.team.id);

        assert.equal(metrics.totals.analysis, 2);
    });

    it('reports the current month growth as a percentage', async () => {
        const fixture = await createFixture();
        await seedTrajectory(fixture, fixture.team.id, 'one');

        const metrics = await teamMetricsQueryService.getTeamMetrics(fixture.team.id);

        assert.equal(metrics.lastMonth.trajectories, 100);
        assert.equal(metrics.lastMonth.analysis, 0);
    });

    it('publishes one weekly bucket per label for every series', async () => {
        const fixture = await createFixture();
        const trajectory = await seedTrajectory(fixture, fixture.team.id, 'one');
        await seedAnalysis(fixture, trajectory.id, fixture.team.id);

        const metrics = await teamMetricsQueryService.getTeamMetrics(fixture.team.id);

        assert.equal(metrics.weekly.labels.length, 1);
        assert.deepEqual(metrics.weekly.trajectories, [1]);
        assert.deepEqual(metrics.weekly.analysis, [1]);
    });
});
