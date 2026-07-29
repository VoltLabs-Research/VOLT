import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import AuthSessionService from '@modules/auth/services/AuthSessionService';
import JwtTokenService from '@modules/auth/services/JwtTokenService';
import User from '@modules/auth/models/User';
import Session from '@modules/session/models/Session';
import { SessionActivityType } from '@volt/contracts/modules/session/domain';

describe('AuthSessionService', () => {
    let dataSource: DataSource;
    const service = new AuthSessionService();
    const tokenService = new JwtTokenService();

    before(async () => {
        dataSource = await createHarness([User, Session]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        mock.timers.reset();
        await dataSource.synchronize(true);
    });

    const createUser = (email = 'ada@volt.test'): Promise<User> => User.create({
        email,
        firstName: 'ada'
    }).save();

    it('opens an active session that stores the signed token', async () => {
        const user = await createUser();

        const token = await service.createSessionWithToken({
            userId: user.id,
            ip: '10.0.0.1',
            userAgent: 'volt-tests',
            activityType: SessionActivityType.Login
        });

        const session = await Session.findOneByOrFail({ token });
        assert.equal(session.user, user.id);
        assert.equal(session.isActive, true);
        assert.equal(session.success, true);
        assert.equal(session.action, SessionActivityType.Login);
        assert.equal(session.ip, '10.0.0.1');
        assert.equal(session.userAgent, 'volt-tests');
        assert.ok(session.lastActivity instanceof Date);
    });

    it('returns a token that resolves back to the session owner', async () => {
        const user = await createUser();

        const token = await service.createSessionWithToken({
            userId: user.id,
            ip: '10.0.0.1',
            userAgent: 'volt-tests',
            activityType: SessionActivityType.Login
        });

        assert.equal(tokenService.verify(token)?.id, user.id);
    });

    it('stamps the requested activity type on the session', async () => {
        const user = await createUser();

        const token = await service.createSessionWithToken({
            userId: user.id,
            ip: '10.0.0.1',
            userAgent: 'volt-tests',
            activityType: SessionActivityType.PasswordUpdate
        });

        assert.equal((await Session.findOneByOrFail({ token })).action, SessionActivityType.PasswordUpdate);
    });

    it('opens one independent session per user', async () => {
        const first = await createUser('first@volt.test');
        const second = await createUser('second@volt.test');

        const firstToken = await service.createSessionWithToken({
            userId: first.id,
            ip: '10.0.0.1',
            userAgent: 'volt-tests',
            activityType: SessionActivityType.Login
        });
        const secondToken = await service.createSessionWithToken({
            userId: second.id,
            ip: '10.0.0.2',
            userAgent: 'volt-tests',
            activityType: SessionActivityType.Login
        });

        assert.notEqual(firstToken, secondToken);
        assert.equal(await Session.countBy({ isActive: true }), 2);
    });

    it('rejects a second session for the same user inside the same second because the token repeats', async () => {
        mock.timers.enable({
            apis: ['Date'],
            now: 1_700_000_000_000
        });
        const user = await createUser();
        const input = {
            userId: user.id,
            ip: '10.0.0.1',
            userAgent: 'volt-tests',
            activityType: SessionActivityType.Login
        };

        await service.createSessionWithToken(input);

        await assert.rejects(
            () => service.createSessionWithToken(input),
            /UNIQUE constraint failed/
        );
        assert.equal(await Session.count(), 1);
    });

    it('refuses to open a session for a user that does not exist', async () => {
        await assert.rejects(() => service.createSessionWithToken({
            userId: 'missing-user',
            ip: '10.0.0.1',
            userAgent: 'volt-tests',
            activityType: SessionActivityType.Login
        }), /FOREIGN KEY constraint failed/);
    });
});
