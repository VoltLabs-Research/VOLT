import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import AuthEvents from '@modules/auth/events/AuthEvents';
import User from '@modules/auth/models/User';

describe('AuthEvents', () => {
    let dataSource: DataSource;
    const events = new AuthEvents();

    before(async () => {
        dataSource = await createHarness([User]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const seedUser = (email: string, teams: string[] | null): Promise<User> => User.create({
        email,
        firstName: 'ada',
        teams
    }).save();

    const teamsOf = async (user: User): Promise<string[] | null> => {
        return (await User.findOneByOrFail({ id: user.id })).teams;
    };

    describe('detachDeletedTeamFromUsers', () => {
        it('unlinks the deleted team from every member', async () => {
            const first = await seedUser('first@volt.test', ['team-a']);
            const second = await seedUser('second@volt.test', ['team-a']);

            await events.detachDeletedTeamFromUsers({ teamId: 'team-a' });

            assert.deepEqual(await teamsOf(first), []);
            assert.deepEqual(await teamsOf(second), []);
        });

        it('keeps the other teams of the member', async () => {
            const member = await seedUser('member@volt.test', ['team-a', 'team-b', 'team-c']);

            await events.detachDeletedTeamFromUsers({ teamId: 'team-b' });

            assert.deepEqual(await teamsOf(member), ['team-a', 'team-c']);
        });

        it('keeps a team whose id merely starts with the deleted id', async () => {
            const member = await seedUser('member@volt.test', ['team-alpha']);

            await events.detachDeletedTeamFromUsers({ teamId: 'team-a' });

            assert.deepEqual(await teamsOf(member), ['team-alpha']);
        });

        it('unlinks only the exact team when a longer id shares its prefix', async () => {
            const member = await seedUser('member@volt.test', ['team-a', 'team-alpha']);

            await events.detachDeletedTeamFromUsers({ teamId: 'team-a' });

            assert.deepEqual(await teamsOf(member), ['team-alpha']);
        });

        it('keeps a team whose id differs from the deleted one only in case', async () => {
            const member = await seedUser('member@volt.test', ['TEAM-A']);

            await events.detachDeletedTeamFromUsers({ teamId: 'team-a' });

            assert.deepEqual(await teamsOf(member), ['TEAM-A']);
        });

        it('leaves the members of other teams untouched', async () => {
            const outsider = await seedUser('outsider@volt.test', ['team-b']);

            await events.detachDeletedTeamFromUsers({ teamId: 'team-a' });

            assert.deepEqual(await teamsOf(outsider), ['team-b']);
        });

        it('skips the members that have no team at all', async () => {
            const teamless = await seedUser('teamless@volt.test', null);
            const member = await seedUser('member@volt.test', ['team-a']);

            await events.detachDeletedTeamFromUsers({ teamId: 'team-a' });

            assert.equal(await teamsOf(teamless), null);
            assert.deepEqual(await teamsOf(member), []);
        });

        it('resolves when no member belongs to the deleted team', async () => {
            await seedUser('member@volt.test', ['team-b']);

            await events.detachDeletedTeamFromUsers({ teamId: 'team-a' });

            assert.equal(await User.count(), 1);
        });

        it('does not read the deleted team id as an sql pattern', async () => {
            const member = await seedUser('member@volt.test', ['team-a']);

            await events.detachDeletedTeamFromUsers({ teamId: '%' });

            assert.deepEqual(await teamsOf(member), ['team-a']);
        });
    });
});
