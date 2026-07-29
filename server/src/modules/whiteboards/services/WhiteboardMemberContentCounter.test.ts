import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import whiteboardMemberContentCounter from '@modules/whiteboards/services/WhiteboardMemberContentCounter';
import Whiteboard from '@modules/whiteboards/models/Whiteboard';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';

interface TeamFixture{
    team: Team;
    cluster: TeamCluster;
}

const ENTITIES = [Whiteboard, TeamCluster, CatalogFolder, Team, User];

describe('WhiteboardMemberContentCounter', () => {
    let dataSource: DataSource;

    before(async () => {
        dataSource = await createHarness(ENTITIES);
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

        return {
            team,
            cluster
        };
    };

    const seedWhiteboard = (fixture: TeamFixture, userId: string, title = 'Board'): Promise<Whiteboard> => Whiteboard.create({
        team: fixture.team.id,
        createdBy: userId,
        lastEditedBy: userId,
        title,
        storageClusterId: fixture.cluster.id,
        payloadKey: 'state.json'
    }).save();

    it('counts the whiteboards created by each requested member', async () => {
        const fixture = await createTeamFixture('one');
        const first = await createUser('first@volt.test');
        const second = await createUser('second@volt.test');

        await seedWhiteboard(fixture, first.id);
        await seedWhiteboard(fixture, first.id);
        await seedWhiteboard(fixture, first.id);
        await seedWhiteboard(fixture, second.id);

        const result = await whiteboardMemberContentCounter.countForTeamMembers(fixture.team.id, [first.id, second.id]);

        assert.equal(result.key, 'whiteboardsCount');
        assert.equal(result.counts.get(first.id), 3);
        assert.equal(result.counts.get(second.id), 1);
        assert.equal(result.counts.size, 2);
    });

    it('returns numbers instead of driver strings', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');

        await seedWhiteboard(fixture, author.id);

        const result = await whiteboardMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id]);

        assert.equal(typeof result.counts.get(author.id), 'number');
    });

    it('omits the members without whiteboards', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');
        const idle = await createUser('idle@volt.test');

        await seedWhiteboard(fixture, author.id);

        const result = await whiteboardMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id, idle.id]);

        assert.equal(result.counts.has(idle.id), false);
        assert.equal(result.counts.size, 1);
    });

    it('ignores the members that were not requested', async () => {
        const fixture = await createTeamFixture('one');
        const requested = await createUser('requested@volt.test');
        const other = await createUser('other@volt.test');

        await seedWhiteboard(fixture, requested.id);
        await seedWhiteboard(fixture, other.id);

        const result = await whiteboardMemberContentCounter.countForTeamMembers(fixture.team.id, [requested.id]);

        assert.deepEqual([...result.counts.entries()], [[requested.id, 1]]);
    });

    it('counts only the whiteboards of the requested team', async () => {
        const fixture = await createTeamFixture('one');
        const otherFixture = await createTeamFixture('two');
        const author = await createUser('author@volt.test');

        await seedWhiteboard(fixture, author.id);
        await seedWhiteboard(otherFixture, author.id);
        await seedWhiteboard(otherFixture, author.id);

        const result = await whiteboardMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id]);

        assert.equal(result.counts.get(author.id), 1);
    });

    it('returns an empty map when no member is requested', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');

        await seedWhiteboard(fixture, author.id);

        const result = await whiteboardMemberContentCounter.countForTeamMembers(fixture.team.id, []);

        assert.equal(result.key, 'whiteboardsCount');
        assert.equal(result.counts.size, 0);
    });

    it('returns an empty map when the team has no whiteboard', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');

        const result = await whiteboardMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id]);

        assert.equal(result.counts.size, 0);
    });

    it('drops the count of a member whose whiteboards were deleted', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');
        const whiteboard = await seedWhiteboard(fixture, author.id);

        await Whiteboard.delete({ id: whiteboard.id });

        const result = await whiteboardMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id]);

        assert.equal(result.counts.size, 0);
    });
});
