import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource, DeepPartial } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import Session from '@modules/session/models/Session';
import SessionService from '@modules/session/services/SessionService';
import User from '@modules/auth/models/User';
import { SessionActivityType } from '@volt/contracts/modules/session/domain';

const CHROME_ON_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const CHROME_ON_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36';
const SAFARI_ON_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('SessionService', () => {
    let dataSource: DataSource;
    const service = new SessionService();

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
        userAgent: CHROME_ON_WINDOWS,
        ip: '127.0.0.1',
        ...overrides
    }).save();

    const pinCreatedAt = (sessionId: string, value: string): Promise<unknown> => Session.getRepository().query(
        'UPDATE sessions SET "createdAt" = ?, "updatedAt" = ? WHERE id = ?',
        [value, value, sessionId]
    );

    describe('getActiveSessions', () => {
        it('returns only the active sessions of the requested user', async () => {
            const user = await createUser('active@volt.test');
            const other = await createUser('other@volt.test');
            const active = await seedSession({
                user: user.id,
                token: 'active'
            });
            await seedSession({
                user: user.id,
                token: 'revoked',
                isActive: false
            });
            await seedSession({
                user: other.id,
                token: 'foreign'
            });

            const sessions = await service.getActiveSessions(user.id);

            assert.deepEqual(sessions.map((session) => session._id), [active.id]);
        });

        it('orders the sessions by last activity descending', async () => {
            const user = await createUser('ordered@volt.test');
            const stale = await seedSession({
                user: user.id,
                token: 'stale',
                lastActivity: new Date('2024-01-01T00:00:00.000Z')
            });
            const fresh = await seedSession({
                user: user.id,
                token: 'fresh',
                lastActivity: new Date('2024-06-01T00:00:00.000Z')
            });
            const middle = await seedSession({
                user: user.id,
                token: 'middle',
                lastActivity: new Date('2024-03-01T00:00:00.000Z')
            });

            const sessions = await service.getActiveSessions(user.id);

            assert.deepEqual(sessions.map((session) => session._id), [fresh.id, middle.id, stale.id]);
        });

        it('never exposes the session token on the wire', async () => {
            const user = await createUser('tokenless-wire@volt.test');
            await seedSession({
                user: user.id,
                token: 'secret-token'
            });

            const [session] = await service.getActiveSessions(user.id, 'secret-token');

            assert.equal(session.token, null);
        });

        it('flags as current only the session holding the supplied token', async () => {
            const user = await createUser('current@volt.test');
            const current = await seedSession({
                user: user.id,
                token: 'current-token'
            });
            const another = await seedSession({
                user: user.id,
                token: 'another-token'
            });

            const sessions = await service.getActiveSessions(user.id, 'current-token');
            const byId = new Map(sessions.map((session) => [session._id, session.isCurrent]));

            assert.equal(byId.get(current.id), true);
            assert.equal(byId.get(another.id), false);
        });

        it('marks no session as current when no token is supplied', async () => {
            const user = await createUser('no-token@volt.test');
            await seedSession({
                user: user.id,
                token: 'current-token'
            });

            const [session] = await service.getActiveSessions(user.id);

            assert.equal(session.isCurrent, false);
        });

        it('does not flag a tokenless session as current when the token is also empty', async () => {
            const user = await createUser('empty-token@volt.test');
            await seedSession({
                user: user.id,
                token: null
            });

            const [session] = await service.getActiveSessions(user.id, '');

            assert.equal(session.isCurrent, false);
        });

        it('derives browser, os and mobile flag from the user agent', async () => {
            const user = await createUser('parsed@volt.test');
            await seedSession({
                user: user.id,
                token: 'phone',
                userAgent: CHROME_ON_ANDROID
            });

            const [session] = await service.getActiveSessions(user.id);

            assert.equal(session.browser, 'Chrome');
            assert.equal(session.os, 'Android');
            assert.equal(session.isMobile, true);
        });

        it('reports an iphone as macos because the mac os x marker of its user agent is matched first', async () => {
            const user = await createUser('iphone@volt.test');
            await seedSession({
                user: user.id,
                token: 'iphone',
                userAgent: SAFARI_ON_IPHONE
            });

            const [session] = await service.getActiveSessions(user.id);

            assert.equal(session.browser, 'Safari');
            assert.equal(session.os, 'macOS');
            assert.equal(session.isMobile, true);
        });

        it('falls back to unknown browser and os for an unrecognized user agent', async () => {
            const user = await createUser('unknown-agent@volt.test');
            await seedSession({
                user: user.id,
                token: 'robot',
                userAgent: 'curl/8.5.0'
            });

            const [session] = await service.getActiveSessions(user.id);

            assert.equal(session.browser, 'Unknown Browser');
            assert.equal(session.os, 'Unknown OS');
            assert.equal(session.isMobile, false);
        });

        it('exposes the persisted timestamps as dates', async () => {
            const user = await createUser('timestamps@volt.test');
            await seedSession({
                user: user.id,
                token: 'dated'
            });

            const [session] = await service.getActiveSessions(user.id);

            assert.ok(session.createdAt instanceof Date);
            assert.ok(session.updatedAt instanceof Date);
            assert.ok(session.lastActivity instanceof Date);
        });

        it('returns an empty list when the user has no session', async () => {
            const user = await createUser('idle@volt.test');

            assert.deepEqual(await service.getActiveSessions(user.id), []);
        });
    });

    describe('getLoginActivity', () => {
        it('returns the successful and failed attempts of the user newest first', async () => {
            const user = await createUser('activity@volt.test');
            const older = await seedSession({
                user: user.id,
                token: 'older',
                action: SessionActivityType.Login
            });
            await pinCreatedAt(older.id, '2024-01-01 00:00:00.000');
            const failed = await seedSession({
                user: user.id,
                token: null,
                action: SessionActivityType.FailedLogin,
                success: false,
                failureReason: 'bad password'
            });
            await pinCreatedAt(failed.id, '2024-06-01 00:00:00.000');

            const { activities } = await service.getLoginActivity(user.id);

            assert.deepEqual(activities.map((activity) => activity._id), [failed.id, older.id]);
            assert.equal(activities[0].action, SessionActivityType.FailedLogin);
            assert.equal(activities[0].success, false);
        });

        it('includes the revoked sessions the active listing hides', async () => {
            const user = await createUser('revoked-activity@volt.test');
            const revoked = await seedSession({
                user: user.id,
                token: 'revoked',
                isActive: false
            });

            const { activities } = await service.getLoginActivity(user.id);

            assert.deepEqual(activities.map((activity) => activity._id), [revoked.id]);
        });

        it('takes at most twenty entries by default', async () => {
            const user = await createUser('capped@volt.test');
            for(let index = 0; index < 25; index++){
                await seedSession({
                    user: user.id,
                    token: `token-${index}`
                });
            }

            const { activities } = await service.getLoginActivity(user.id);

            assert.equal(activities.length, 20);
        });

        it('honours an explicit limit', async () => {
            const user = await createUser('limited@volt.test');
            for(let index = 0; index < 5; index++){
                await seedSession({
                    user: user.id,
                    token: `token-${index}`
                });
            }

            const { activities } = await service.getLoginActivity(user.id, 2);

            assert.equal(activities.length, 2);
        });

        it('excludes the activity of the other users', async () => {
            const user = await createUser('mine@volt.test');
            const other = await createUser('theirs@volt.test');
            await seedSession({
                user: other.id,
                token: 'theirs'
            });

            const { activities } = await service.getLoginActivity(user.id);

            assert.deepEqual(activities, []);
        });
    });

    describe('revokeSession', () => {
        it('deactivates the session of its owner', async () => {
            const user = await createUser('owner@volt.test');
            const session = await seedSession({
                user: user.id,
                token: 'owned'
            });

            await service.revokeSession(session.id, user.id);

            assert.equal((await Session.findOneByOrFail({ id: session.id })).isActive, false);
        });

        it('keeps the session token so the request can still be recognized as revoked', async () => {
            const user = await createUser('keeps-token@volt.test');
            const session = await seedSession({
                user: user.id,
                token: 'owned'
            });

            await service.revokeSession(session.id, user.id);

            assert.equal((await Session.findOneByOrFail({ id: session.id })).token, 'owned');
        });

        it('rejects an unknown session with a not found error', async () => {
            const user = await createUser('missing-session@volt.test');

            await assert.rejects(
                () => service.revokeSession('f'.repeat(24), user.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.SESSION_NOT_FOUND);
                    assert.equal(error.statusCode, 404);
                    assert.equal(error.message, 'Session not found');
                    return true;
                }
            );
        });

        it('rejects a session owned by another user with a forbidden error', async () => {
            const user = await createUser('intruder@volt.test');
            const victim = await createUser('victim@volt.test');
            const session = await seedSession({
                user: victim.id,
                token: 'victim-token'
            });

            await assert.rejects(
                () => service.revokeSession(session.id, user.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.SESSION_REVOKE_FAILED);
                    assert.equal(error.statusCode, 403);
                    assert.equal(error.message, 'You do not have permission to revoke this session');
                    return true;
                }
            );
            assert.equal((await Session.findOneByOrFail({ id: session.id })).isActive, true);
        });

        it('rejects a session with no owner with a forbidden error', async () => {
            const user = await createUser('orphan-session@volt.test');
            const session = await seedSession({
                user: null,
                token: 'orphan-token'
            });

            await assert.rejects(
                () => service.revokeSession(session.id, user.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.SESSION_REVOKE_FAILED);
                    assert.equal(error.statusCode, 403);
                    return true;
                }
            );
            assert.equal((await Session.findOneByOrFail({ id: session.id })).isActive, true);
        });
    });

    describe('revokeAllSessions', () => {
        it('deactivates every other active session of the user and counts them', async () => {
            const user = await createUser('revoke-all@volt.test');
            const current = await seedSession({
                user: user.id,
                token: 'current'
            });
            const first = await seedSession({
                user: user.id,
                token: 'first'
            });
            const second = await seedSession({
                user: user.id,
                token: 'second'
            });

            const result = await service.revokeAllSessions(user.id, 'current');

            assert.equal(result.revokedCount, 2);
            assert.equal((await Session.findOneByOrFail({ id: current.id })).isActive, true);
            assert.equal((await Session.findOneByOrFail({ id: first.id })).isActive, false);
            assert.equal((await Session.findOneByOrFail({ id: second.id })).isActive, false);
        });

        it('leaves a session with a null token active because sql inequality never matches null', async () => {
            const user = await createUser('null-token@volt.test');
            const tokenless = await seedSession({
                user: user.id,
                token: null
            });
            const revocable = await seedSession({
                user: user.id,
                token: 'revocable'
            });

            const result = await service.revokeAllSessions(user.id, 'current');

            assert.equal(result.revokedCount, 1);
            assert.equal((await Session.findOneByOrFail({ id: revocable.id })).isActive, false);
            assert.equal((await Session.findOneByOrFail({ id: tokenless.id })).isActive, true);
        });

        it('does not touch the sessions of the other users', async () => {
            const user = await createUser('scoped@volt.test');
            const other = await createUser('untouched@volt.test');
            await seedSession({
                user: user.id,
                token: 'mine'
            });
            const foreign = await seedSession({
                user: other.id,
                token: 'theirs'
            });

            const result = await service.revokeAllSessions(user.id, 'current');

            assert.equal(result.revokedCount, 1);
            assert.equal((await Session.findOneByOrFail({ id: foreign.id })).isActive, true);
        });

        it('does not count the sessions that were already revoked', async () => {
            const user = await createUser('already-revoked@volt.test');
            await seedSession({
                user: user.id,
                token: 'already',
                isActive: false
            });

            const result = await service.revokeAllSessions(user.id, 'current');

            assert.equal(result.revokedCount, 0);
        });

        it('reports zero revocations when the user has no other session', async () => {
            const user = await createUser('single@volt.test');
            await seedSession({
                user: user.id,
                token: 'current'
            });

            const result = await service.revokeAllSessions(user.id, 'current');

            assert.equal(result.revokedCount, 0);
        });
    });
});
