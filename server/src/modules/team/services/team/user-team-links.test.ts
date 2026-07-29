import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { addTeamToUser, removeTeamFromUser } from '@modules/team/services/team/user-team-links';

const FIRST_TEAM = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const SECOND_TEAM = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const THIRD_TEAM = 'cccccccccccccccccccccccc';

describe('user team links', () => {
    let dataSource: DataSource;

    before(async () => {
        dataSource = await createHarness([Team, User]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createUser = (teams: string[] | null = null): Promise<User> => User.create({
        email: 'member@volt.test',
        firstName: 'ada',
        teams
    }).save();

    const teamsOf = async (userId: string): Promise<string[] | null> => (
        (await User.findOneByOrFail({ id: userId })).teams
    );

    describe('addTeamToUser', () => {
        it('creates the first link on a user without teams', async () => {
            const user = await createUser();

            await addTeamToUser(user.id, FIRST_TEAM);

            assert.deepEqual(await teamsOf(user.id), [FIRST_TEAM]);
        });

        it('appends the new team after the ones already linked', async () => {
            const user = await createUser([FIRST_TEAM]);

            await addTeamToUser(user.id, SECOND_TEAM);

            assert.deepEqual(await teamsOf(user.id), [FIRST_TEAM, SECOND_TEAM]);
        });

        it('is idempotent when the team is already linked', async () => {
            const user = await createUser([FIRST_TEAM, SECOND_TEAM]);

            await addTeamToUser(user.id, SECOND_TEAM);
            await addTeamToUser(user.id, SECOND_TEAM);

            assert.deepEqual(await teamsOf(user.id), [FIRST_TEAM, SECOND_TEAM]);
        });

        it('round trips the whole array through the simple-array column', async () => {
            const user = await createUser();

            await addTeamToUser(user.id, FIRST_TEAM);
            await addTeamToUser(user.id, SECOND_TEAM);
            await addTeamToUser(user.id, THIRD_TEAM);

            assert.deepEqual(await teamsOf(user.id), [FIRST_TEAM, SECOND_TEAM, THIRD_TEAM]);
        });

        it('ignores an unknown user', async () => {
            await addTeamToUser('6a69587bbabeab928d9147ba', FIRST_TEAM);

            assert.equal(await User.count(), 0);
        });

        it('writes through the entity manager it was handed', async () => {
            const user = await createUser();

            await dataSource.manager.transaction(async (manager) => {
                await addTeamToUser(user.id, FIRST_TEAM, manager);
            });

            assert.deepEqual(await teamsOf(user.id), [FIRST_TEAM]);
        });

        it('discards the link when the surrounding transaction rolls back', async () => {
            const user = await createUser();

            await assert.rejects(() => dataSource.manager.transaction(async (manager) => {
                await addTeamToUser(user.id, FIRST_TEAM, manager);
                throw new Error('rolled back');
            }));

            assert.equal(await teamsOf(user.id), null);
        });
    });

    describe('removeTeamFromUser', () => {
        it('drops only the requested team and keeps the others in order', async () => {
            const user = await createUser([FIRST_TEAM, SECOND_TEAM, THIRD_TEAM]);

            await removeTeamFromUser(user.id, SECOND_TEAM);

            assert.deepEqual(await teamsOf(user.id), [FIRST_TEAM, THIRD_TEAM]);
        });

        it('leaves the links untouched when the team is not linked', async () => {
            const user = await createUser([FIRST_TEAM, SECOND_TEAM]);

            await removeTeamFromUser(user.id, THIRD_TEAM);

            assert.deepEqual(await teamsOf(user.id), [FIRST_TEAM, SECOND_TEAM]);
        });

        it('empties the array when the last team is removed', async () => {
            const user = await createUser([FIRST_TEAM]);

            await removeTeamFromUser(user.id, FIRST_TEAM);

            assert.deepEqual(await teamsOf(user.id), []);
        });

        it('resolves on a user without teams', async () => {
            const user = await createUser();

            await removeTeamFromUser(user.id, FIRST_TEAM);

            assert.deepEqual(await teamsOf(user.id), []);
        });

        it('ignores an unknown user', async () => {
            await removeTeamFromUser('6a69587bbabeab928d9147ba', FIRST_TEAM);

            assert.equal(await User.count(), 0);
        });

        it('does not touch the links of the other users', async () => {
            const user = await createUser([FIRST_TEAM, SECOND_TEAM]);
            const other = await User.create({
                email: 'other@volt.test',
                firstName: 'grace',
                teams: [FIRST_TEAM, SECOND_TEAM]
            }).save();

            await removeTeamFromUser(user.id, FIRST_TEAM);

            assert.deepEqual(await teamsOf(other.id), [FIRST_TEAM, SECOND_TEAM]);
        });
    });
});
