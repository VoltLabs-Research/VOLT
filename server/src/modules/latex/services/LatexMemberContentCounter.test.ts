import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import latexMemberContentCounter from '@modules/latex/services/LatexMemberContentCounter';
import LatexDocument from '@modules/latex/models/LatexDocument';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';

interface TeamFixture{
    team: Team;
    cluster: TeamCluster;
}

const ENTITIES = [LatexDocument, TeamCluster, CatalogFolder, Team, User];

describe('LatexMemberContentCounter', () => {
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

    const seedDocument = (fixture: TeamFixture, userId: string, title = 'Paper'): Promise<LatexDocument> => LatexDocument.create({
        team: fixture.team.id,
        title,
        storageClusterId: fixture.cluster.id,
        createdBy: userId,
        lastEditedBy: userId,
        folder: null
    }).save();

    it('counts the documents created by each requested member', async () => {
        const fixture = await createTeamFixture('one');
        const first = await createUser('first@volt.test');
        const second = await createUser('second@volt.test');

        await seedDocument(fixture, first.id);
        await seedDocument(fixture, first.id);
        await seedDocument(fixture, second.id);

        const result = await latexMemberContentCounter.countForTeamMembers(fixture.team.id, [first.id, second.id]);

        assert.equal(result.key, 'latexCount');
        assert.equal(result.counts.get(first.id), 2);
        assert.equal(result.counts.get(second.id), 1);
        assert.equal(result.counts.size, 2);
    });

    it('returns numbers instead of driver strings', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');

        await seedDocument(fixture, author.id);

        const result = await latexMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id]);

        assert.equal(typeof result.counts.get(author.id), 'number');
    });

    it('reports a real count instead of an always empty map', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');

        for(let index = 0; index < 5; index += 1){
            await seedDocument(fixture, author.id, `Paper ${index}`);
        }

        const result = await latexMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id]);

        assert.notEqual(result.counts.size, 0);
        assert.equal(result.counts.get(author.id), 5);
    });

    it('omits the members without documents', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');
        const idle = await createUser('idle@volt.test');

        await seedDocument(fixture, author.id);

        const result = await latexMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id, idle.id]);

        assert.equal(result.counts.has(idle.id), false);
        assert.equal(result.counts.size, 1);
    });

    it('ignores the members that were not requested', async () => {
        const fixture = await createTeamFixture('one');
        const requested = await createUser('requested@volt.test');
        const other = await createUser('other@volt.test');

        await seedDocument(fixture, requested.id);
        await seedDocument(fixture, other.id);

        const result = await latexMemberContentCounter.countForTeamMembers(fixture.team.id, [requested.id]);

        assert.deepEqual([...result.counts.entries()], [[requested.id, 1]]);
    });

    it('counts only the documents of the requested team', async () => {
        const fixture = await createTeamFixture('one');
        const otherFixture = await createTeamFixture('two');
        const author = await createUser('author@volt.test');

        await seedDocument(fixture, author.id);
        await seedDocument(otherFixture, author.id);
        await seedDocument(otherFixture, author.id);

        const result = await latexMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id]);

        assert.equal(result.counts.get(author.id), 1);
    });

    it('returns an empty map when no member is requested', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');

        await seedDocument(fixture, author.id);

        const result = await latexMemberContentCounter.countForTeamMembers(fixture.team.id, []);

        assert.equal(result.key, 'latexCount');
        assert.equal(result.counts.size, 0);
    });

    it('returns an empty map when the team has no document', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');

        const result = await latexMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id]);

        assert.equal(result.counts.size, 0);
    });

    it('drops the count of a member whose documents were deleted', async () => {
        const fixture = await createTeamFixture('one');
        const author = await createUser('author@volt.test');
        const document = await seedDocument(fixture, author.id);

        await LatexDocument.delete({ id: document.id });

        const result = await latexMemberContentCounter.countForTeamMembers(fixture.team.id, [author.id]);

        assert.equal(result.counts.size, 0);
    });
});
