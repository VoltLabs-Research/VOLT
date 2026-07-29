import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource, DeepPartial } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import Session from '@modules/session/models/Session';
import SessionEvents from '@modules/session/events/SessionEvents';
import User from '@modules/auth/models/User';

describe('SessionEvents', () => {
    let dataSource: DataSource;
    const events = new SessionEvents();

    before(async () => {
        dataSource = await createHarness([Session, User]);
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

    const seedSession = (overrides: DeepPartial<Session> = {}): Promise<Session> => Session.create({
        user: null,
        token: null,
        userAgent: 'curl/8.5.0',
        ip: '127.0.0.1',
        ...overrides
    }).save();

    it('deletes every session of the deleted user', async () => {
        const user = await createUser('deleted@volt.test');
        await seedSession({
            user: user.id,
            token: 'first'
        });
        await seedSession({
            user: user.id,
            token: 'second',
            isActive: false
        });

        await events.deleteUserSessions({ userId: user.id });

        assert.equal(await Session.countBy({ user: user.id }), 0);
    });

    it('keeps the sessions of the other users', async () => {
        const user = await createUser('deleted@volt.test');
        const survivor = await createUser('survivor@volt.test');
        await seedSession({
            user: user.id,
            token: 'first'
        });
        await seedSession({
            user: survivor.id,
            token: 'second'
        });

        await events.deleteUserSessions({ userId: user.id });

        assert.equal(await Session.countBy({ user: survivor.id }), 1);
    });

    it('keeps the ownerless sessions', async () => {
        const user = await createUser('deleted@volt.test');
        await seedSession({
            user: user.id,
            token: 'owned'
        });
        const orphan = await seedSession({
            user: null,
            token: 'orphan'
        });

        await events.deleteUserSessions({ userId: user.id });

        assert.equal(await Session.countBy({ id: orphan.id }), 1);
    });

    it('resolves when the deleted user had no session', async () => {
        const user = await createUser('sessionless@volt.test');

        await events.deleteUserSessions({ userId: user.id });

        assert.equal(await Session.count(), 0);
    });

    it('lets the foreign key cascade remove the sessions when the user row is deleted', async () => {
        const user = await createUser('cascade@volt.test');
        await seedSession({
            user: user.id,
            token: 'cascaded'
        });

        await User.delete({ id: user.id });

        assert.equal(await Session.count(), 0);
    });
});
