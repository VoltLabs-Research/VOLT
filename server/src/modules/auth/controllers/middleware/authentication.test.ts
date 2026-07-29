import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import crypto from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { NextFunction, Response } from 'express';
import { createHarness, destroyHarness } from '@tests/harness';
import { ErrorCodes } from '@core/constants/error-codes';
import { authenticateOptional, protect } from '@modules/auth/controllers/middleware/authentication';
import JwtTokenService from '@modules/auth/services/JwtTokenService';
import User from '@modules/auth/models/User';
import Session from '@modules/session/models/Session';
import SecretKey from '@modules/team/models/SecretKey';
import SecretKeyUsageLog from '@modules/team/models/SecretKeyUsageLog';
import Team from '@modules/team/models/Team';
import TeamRole from '@modules/team/models/TeamRole';
import { AuthenticationType, type AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import { HttpRequestAuthType } from '@shared/infrastructure/http/request-context';

interface FakeResponse{
    statusCode: number;
    body: Record<string, unknown> | null;
    listeners: Map<string, () => void>;
    status(code: number): FakeResponse;
    json(payload: Record<string, unknown>): FakeResponse;
    on(event: string, listener: () => void): FakeResponse;
}

interface SecretKeyFixture{
    team: Team;
    role: TeamRole;
    owner: User;
    secretKey: SecretKey;
    token: string;
}

const SECRET_KEY_TOKEN = 'vsk_live_abcdef123456';

const createResponse = (): FakeResponse => {
    const response: FakeResponse = {
        statusCode: 200,
        body: null,
        listeners: new Map(),
        status(code){
            this.statusCode = code;
            return this;
        },
        json(payload){
            this.body = payload;
            return this;
        },
        on(event, listener){
            this.listeners.set(event, listener);
            return this;
        }
    };

    return response;
};

const createRequest = (authorization?: string): AuthenticatedRequest => {
    const request = {
        headers: {
            ...(authorization ? { authorization } : {}),
            'user-agent': 'volt-tests'
        },
        method: 'GET',
        path: '/api/v1/things',
        originalUrl: '/api/v1/things',
        ip: '10.0.0.1',
        socket: { remoteAddress: '10.0.0.1' }
    };

    return request as unknown as AuthenticatedRequest;
};

describe('authentication middleware', () => {
    let dataSource: DataSource;
    const tokenService = new JwtTokenService();

    before(async () => {
        dataSource = await createHarness([User, Session, SecretKey, SecretKeyUsageLog, Team, TeamRole]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createNext = (): { next: NextFunction; calls: () => number } => {
        let calls = 0;
        return {
            next: (() => {
                calls += 1;
            }) as NextFunction,
            calls: () => calls
        };
    };

    const seedUser = (email = 'ada@volt.test'): Promise<User> => User.create({
        email,
        firstName: 'ada'
    }).save();

    const seedSignedInUser = async (email = 'ada@volt.test'): Promise<{ user: User; token: string }> => {
        const user = await seedUser(email);
        const token = tokenService.sign(user.id);
        await Session.create({
            user: user.id,
            token,
            userAgent: 'volt-tests',
            ip: '10.0.0.1'
        }).save();

        return {
            user,
            token
        };
    };

    const seedSecretKey = async (
        overrides: Partial<SecretKey> = {},
        permissions: string[] | null = ['team:read']
    ): Promise<SecretKeyFixture> => {
        const owner = await seedUser('owner@volt.test');
        const team = await Team.create({
            name: 'volt',
            owner: owner.id
        }).save();
        const role = await TeamRole.create({
            team: team.id,
            name: 'reader',
            permissions
        }).save();
        const secretKey = await SecretKey.create({
            team: team.id,
            role: role.id,
            name: 'ci',
            keyPrefix: 'vsk_live',
            keyHash: crypto.createHash('sha256').update(SECRET_KEY_TOKEN).digest('hex'),
            createdBy: owner.id,
            ...overrides
        }).save();

        return {
            team,
            role,
            owner,
            secretKey,
            token: SECRET_KEY_TOKEN
        };
    };

    describe('protect with a user token', () => {
        it('authenticates the owner of an active session', async () => {
            const { user, token } = await seedSignedInUser();
            const request = createRequest(`Bearer ${token}`);
            const response = createResponse();
            const { next, calls } = createNext();

            await protect(request, response as unknown as Response, next);

            assert.equal(calls(), 1);
            assert.equal(response.body, null);
            assert.equal(request.authType, AuthenticationType.User);
            assert.equal(request.userId, user.id);
            assert.equal(request.token, token);
            assert.equal((request.user as User | undefined)?.id, user.id);
        });

        it('loads the whole user entity including the hidden password', async () => {
            const user = await seedUser();
            user.password = 'hashed-password';
            await user.save();
            const token = tokenService.sign(user.id);
            await Session.create({
                user: user.id,
                token,
                userAgent: 'volt-tests',
                ip: '10.0.0.1'
            }).save();
            const request = createRequest(`Bearer ${token}`);
            const { next } = createNext();

            await protect(request, createResponse() as unknown as Response, next);

            const authenticated = request.user as User;
            assert.equal(authenticated.password, 'hashed-password');
            assert.equal('password' in authenticated.toJSON(), false);
        });

        it('records a user auth context on the request', async () => {
            const { user, token } = await seedSignedInUser();
            const request = createRequest(`Bearer ${token}`);
            request.requestContext = {
                traceId: 'trace-1',
                startedAt: Date.now(),
                method: 'GET',
                path: '/api/v1/things'
            };
            const { next } = createNext();

            await protect(request, createResponse() as unknown as Response, next);

            assert.equal(request.requestContext?.auth?.authType, HttpRequestAuthType.User);
            assert.equal(request.requestContext?.auth?.subjectId, user.id);
            assert.equal(request.requestContext?.auth?.cached, false);
        });

        it('rejects a request without an authorization header', async () => {
            const request = createRequest();
            const response = createResponse();
            const { next, calls } = createNext();

            await protect(request, response as unknown as Response, next);

            assert.equal(calls(), 0);
            assert.equal(response.statusCode, 401);
            assert.equal(response.body?.code, ErrorCodes.AUTHENTICATION_REQUIRED);
        });

        it('rejects an authorization header that is not a bearer token', async () => {
            const { token } = await seedSignedInUser();
            const response = createResponse();
            const { next, calls } = createNext();

            await protect(createRequest(`Basic ${token}`), response as unknown as Response, next);

            assert.equal(calls(), 0);
            assert.equal(response.statusCode, 401);
            assert.equal(response.body?.code, ErrorCodes.AUTHENTICATION_REQUIRED);
        });

        it('rejects a token that does not verify', async () => {
            const response = createResponse();
            const { next, calls } = createNext();

            await protect(createRequest('Bearer not-a-token'), response as unknown as Response, next);

            assert.equal(calls(), 0);
            assert.equal(response.statusCode, 401);
            assert.equal(response.body?.code, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        });

        it('rejects a token whose user no longer exists', async () => {
            const response = createResponse();
            const { next, calls } = createNext();

            await protect(
                createRequest(`Bearer ${tokenService.sign('missing-user')}`),
                response as unknown as Response,
                next
            );

            assert.equal(calls(), 0);
            assert.equal(response.statusCode, 401);
            assert.equal(response.body?.code, ErrorCodes.USER_NOT_FOUND);
        });

        it('rejects a token issued before the password changed', async () => {
            const { user, token } = await seedSignedInUser();
            await User.update({ id: user.id }, { passwordChangedAt: new Date(Date.now() + 60 * 60 * 1000) });
            const response = createResponse();
            const { next, calls } = createNext();

            await protect(createRequest(`Bearer ${token}`), response as unknown as Response, next);

            assert.equal(calls(), 0);
            assert.equal(response.statusCode, 401);
            assert.equal(response.body?.code, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        });

        it('accepts a token issued after the password changed', async () => {
            const { user, token } = await seedSignedInUser();
            await User.update({ id: user.id }, { passwordChangedAt: new Date(Date.now() - 60 * 60 * 1000) });
            const { next, calls } = createNext();

            await protect(createRequest(`Bearer ${token}`), createResponse() as unknown as Response, next);

            assert.equal(calls(), 1);
        });

        it('rejects a token that has no session row', async () => {
            const user = await seedUser();
            const response = createResponse();
            const { next, calls } = createNext();

            await protect(
                createRequest(`Bearer ${tokenService.sign(user.id)}`),
                response as unknown as Response,
                next
            );

            assert.equal(calls(), 0);
            assert.equal(response.statusCode, 401);
            assert.equal(response.body?.code, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        });

        it('rejects a token whose session was revoked', async () => {
            const { token } = await seedSignedInUser();
            await Session.update({ token }, { isActive: false });
            const response = createResponse();
            const { next, calls } = createNext();

            await protect(createRequest(`Bearer ${token}`), response as unknown as Response, next);

            assert.equal(calls(), 0);
            assert.equal(response.statusCode, 401);
            assert.equal(response.body?.code, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        });
    });

    describe('protect with a secret key', () => {
        it('authenticates an active secret key and loads its role', async () => {
            const fixture = await seedSecretKey();
            const request = createRequest(`Bearer ${fixture.token}`);
            const response = createResponse();
            const { next, calls } = createNext();

            await protect(request, response as unknown as Response, next);

            assert.equal(calls(), 1);
            assert.equal(response.body, null);
            assert.equal(request.authType, AuthenticationType.SecretKey);
            assert.equal(request.secretKeyId, fixture.secretKey.id);
            assert.equal(request.secretKeyTeamId, fixture.team.id);
            assert.equal(request.secretKeyRoleId, fixture.role.id);
            assert.equal(request.userId, fixture.owner.id);
            assert.equal(request.token, fixture.token);
        });

        it('copies the permissions of the loaded role onto the request', async () => {
            await seedSecretKey({}, ['team:read', 'trajectory:read']);
            const request = createRequest(`Bearer ${SECRET_KEY_TOKEN}`);
            const { next } = createNext();

            await protect(request, createResponse() as unknown as Response, next);

            assert.deepEqual(request.teamPermissions, ['team:read', 'trajectory:read']);
        });

        it('grants no permission when the role has none', async () => {
            await seedSecretKey({}, null);
            const request = createRequest(`Bearer ${SECRET_KEY_TOKEN}`);
            const { next } = createNext();

            await protect(request, createResponse() as unknown as Response, next);

            assert.deepEqual(request.teamPermissions, []);
        });

        it('does not expose the key hash on the request', async () => {
            const fixture = await seedSecretKey();
            const request = createRequest(`Bearer ${fixture.token}`);
            const { next } = createNext();

            await protect(request, createResponse() as unknown as Response, next);

            assert.equal('keyHash' in fixture.secretKey.toJSON(), false);
            assert.equal(request.user, undefined);
        });

        it('stamps lastUsedAt on the authenticated secret key', async () => {
            const fixture = await seedSecretKey();
            assert.equal(fixture.secretKey.lastUsedAt, null);
            const { next } = createNext();

            await protect(createRequest(`Bearer ${fixture.token}`), createResponse() as unknown as Response, next);

            const stored = await SecretKey.findOneByOrFail({ id: fixture.secretKey.id });
            assert.ok(stored.lastUsedAt instanceof Date);
        });

        it('records a secret key auth context on the request', async () => {
            const fixture = await seedSecretKey();
            const request = createRequest(`Bearer ${fixture.token}`);
            request.requestContext = {
                traceId: 'trace-1',
                startedAt: Date.now(),
                method: 'GET',
                path: '/api/v1/things'
            };
            const { next } = createNext();

            await protect(request, createResponse() as unknown as Response, next);

            assert.equal(request.requestContext?.auth?.authType, HttpRequestAuthType.SecretKey);
            assert.equal(request.requestContext?.auth?.subjectId, fixture.secretKey.id);
        });

        it('rejects an unknown secret key', async () => {
            await seedSecretKey();
            const response = createResponse();
            const { next, calls } = createNext();

            await protect(createRequest('Bearer vsk_live_unknown'), response as unknown as Response, next);

            assert.equal(calls(), 0);
            assert.equal(response.statusCode, 401);
            assert.equal(response.body?.code, ErrorCodes.SECRET_KEY_INVALID);
        });

        it('rejects a secret key that was deactivated', async () => {
            const fixture = await seedSecretKey({ isActive: false });
            const response = createResponse();
            const { next, calls } = createNext();

            await protect(createRequest(`Bearer ${fixture.token}`), response as unknown as Response, next);

            assert.equal(calls(), 0);
            assert.equal(response.statusCode, 401);
            assert.equal(response.body?.code, ErrorCodes.SECRET_KEY_INVALID);
            assert.equal((await SecretKey.findOneByOrFail({ id: fixture.secretKey.id })).lastUsedAt, null);
        });

        it('logs the usage of the secret key once the response finishes', async () => {
            const fixture = await seedSecretKey();
            const response = createResponse();
            const { next } = createNext();

            await protect(createRequest(`Bearer ${fixture.token}`), response as unknown as Response, next);
            response.statusCode = 204;
            response.listeners.get('finish')?.();

            const log = await waitForUsageLog();
            assert.equal(log.secretKey, fixture.secretKey.id);
            assert.equal(log.team, fixture.team.id);
            assert.equal(log.method, 'GET');
            assert.equal(log.path, '/api/v1/things');
            assert.equal(log.statusCode, 204);
            assert.equal(log.ip, '10.0.0.1');
            assert.equal(log.userAgent, 'volt-tests');
        });
    });

    describe('protect with an already authenticated request', () => {
        it('trusts a request that a previous guard resolved as a user', async () => {
            const request = createRequest();
            request.authType = AuthenticationType.User;
            request.token = 'already-verified';
            request.userId = 'user-1';
            request.user = { id: 'user-1' } as User;
            request.requestContext = {
                traceId: 'trace-1',
                startedAt: Date.now(),
                method: 'GET',
                path: '/api/v1/things'
            };
            const { next, calls } = createNext();

            await protect(request, createResponse() as unknown as Response, next);

            assert.equal(calls(), 1);
            assert.equal(request.requestContext?.auth?.cached, true);
            assert.equal(request.requestContext?.auth?.subjectId, 'user-1');
        });

        it('trusts a request that a previous guard resolved as a secret key', async () => {
            const request = createRequest();
            request.authType = AuthenticationType.SecretKey;
            request.token = 'already-verified';
            request.secretKeyId = 'key-1';
            request.secretKeyTeamId = 'team-1';
            request.requestContext = {
                traceId: 'trace-1',
                startedAt: Date.now(),
                method: 'GET',
                path: '/api/v1/things'
            };
            const { next, calls } = createNext();

            await protect(request, createResponse() as unknown as Response, next);

            assert.equal(calls(), 1);
            assert.equal(request.requestContext?.auth?.authType, HttpRequestAuthType.SecretKey);
            assert.equal(request.requestContext?.auth?.cached, true);
        });

        it('re-authenticates a request that only carries half of the user identity', async () => {
            const { token } = await seedSignedInUser();
            const request = createRequest(`Bearer ${token}`);
            request.authType = AuthenticationType.User;
            request.userId = 'user-1';
            const { next, calls } = createNext();

            await protect(request, createResponse() as unknown as Response, next);

            assert.equal(calls(), 1);
            assert.equal(request.token, token);
            assert.ok(request.user);
        });
    });

    describe('authenticateOptional', () => {
        it('lets an anonymous request through', async () => {
            const request = createRequest();
            const response = createResponse();
            const { next, calls } = createNext();

            await authenticateOptional(request, response as unknown as Response, next);

            assert.equal(calls(), 1);
            assert.equal(response.body, null);
            assert.equal(request.userId, undefined);
        });

        it('authenticates a request that carries a valid token', async () => {
            const { user, token } = await seedSignedInUser();
            const request = createRequest(`Bearer ${token}`);
            const { next, calls } = createNext();

            await authenticateOptional(request, createResponse() as unknown as Response, next);

            assert.equal(calls(), 1);
            assert.equal(request.userId, user.id);
        });

        it('still rejects a request that carries an invalid token', async () => {
            const response = createResponse();
            const { next, calls } = createNext();

            await authenticateOptional(createRequest('Bearer not-a-token'), response as unknown as Response, next);

            assert.equal(calls(), 0);
            assert.equal(response.statusCode, 401);
            assert.equal(response.body?.code, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        });
    });
});

const waitForUsageLog = async (): Promise<SecretKeyUsageLog> => {
    for(let attempt = 0; attempt < 100; attempt += 1){
        const [log] = await SecretKeyUsageLog.find();
        if(log) return log;
        await new Promise((resolve) => setTimeout(resolve, 10));
    }

    throw new Error('the secret key usage log was never written');
};
