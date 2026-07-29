import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import Analysis from '@modules/analysis/models/Analysis';
import Plugin from '@modules/plugin/models/Plugin';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import analysisMemberContentCounter from '@modules/analysis/services/AnalysisMemberContentCounter';

interface TeamFixture{
    team: Team;
    cluster: TeamCluster;
    trajectory: Trajectory;
    plugin: Plugin;
}

describe('AnalysisMemberContentCounter', () => {
    let dataSource: DataSource;

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
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createUser = (email: string): Promise<User> => User.create({
        email,
        firstName: 'ada'
    }).save();

    const createTeamFixture = async (name: string): Promise<TeamFixture> => {
        const owner = await createUser(`owner-${name}@volt.test`);
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
        const plugin = await Plugin.create({
            team: team.id,
            workflow: {
                nodes: [],
                edges: []
            }
        }).save();

        return {
            team,
            cluster,
            trajectory,
            plugin
        };
    };

    const seedAnalysis = (fixture: TeamFixture, userId: string): Promise<Analysis> => Analysis.create({
        team: fixture.team.id,
        trajectory: fixture.trajectory.id,
        plugin: fixture.plugin.id,
        pluginDisplayName: 'Radial Distribution',
        config: {},
        createdBy: userId,
        computeClusterId: fixture.cluster.id,
        storageClusterId: fixture.cluster.id
    }).save();

    it('counts the analyses created by each requested member', async () => {
        const fixture = await createTeamFixture('one');
        const first = await createUser('first@volt.test');
        const second = await createUser('second@volt.test');

        await seedAnalysis(fixture, first.id);
        await seedAnalysis(fixture, first.id);
        await seedAnalysis(fixture, first.id);
        await seedAnalysis(fixture, second.id);

        const result = await analysisMemberContentCounter.countForTeamMembers(fixture.team.id, [first.id, second.id]);

        assert.equal(result.key, 'analysesCount');
        assert.equal(result.counts.get(first.id), 3);
        assert.equal(result.counts.get(second.id), 1);
        assert.equal(result.counts.size, 2);
    });

    it('returns numbers instead of driver strings', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');

        await seedAnalysis(fixture, author.id);

        const result = await analysisMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id]);

        assert.equal(typeof result.counts.get(author.id), 'number');
    });

    it('counts only the analyses of the requested team', async () => {
        const fixture = await createTeamFixture('one');
        const otherFixture = await createTeamFixture('two');
        const author = await createUser('author@volt.test');

        await seedAnalysis(fixture, author.id);
        await seedAnalysis(otherFixture, author.id);
        await seedAnalysis(otherFixture, author.id);

        const result = await analysisMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id]);

        assert.equal(result.counts.get(author.id), 1);
    });

    it('omits the members without analyses', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');
        const idle = await createUser('idle@volt.test');

        await seedAnalysis(fixture, author.id);

        const result = await analysisMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id, idle.id]);

        assert.equal(result.counts.has(idle.id), false);
        assert.equal(result.counts.size, 1);
    });

    it('ignores the members that were not requested', async () => {
        const fixture = await createTeamFixture('one');
        const requested = await createUser('requested@volt.test');
        const other = await createUser('other@volt.test');

        await seedAnalysis(fixture, requested.id);
        await seedAnalysis(fixture, other.id);

        const result = await analysisMemberContentCounter.countForTeamMembers(fixture.team.id, [requested.id]);

        assert.deepEqual([...result.counts.entries()], [[requested.id, 1]]);
    });

    it('returns an empty map without querying when no member is requested', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');

        await seedAnalysis(fixture, author.id);

        const result = await analysisMemberContentCounter.countForTeamMembers(fixture.team.id, []);

        assert.equal(result.key, 'analysesCount');
        assert.equal(result.counts.size, 0);
    });

    it('returns an empty map when the team has no analyses', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');

        const result = await analysisMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id]);

        assert.equal(result.counts.size, 0);
    });

    it('keys the counts by the raw user id so the members view can look them up', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');

        await seedAnalysis(fixture, author.id);

        const result = await analysisMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id]);

        assert.deepEqual([...result.counts.keys()], [author.id]);
    });
});
