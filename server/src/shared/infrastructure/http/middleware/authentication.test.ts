import 'reflect-metadata';

import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import User from '@modules/auth/domain/entities/User';
import {
    authenticateOptional,
    AuthenticationType,
    protect
} from '@shared/infrastructure/http/middleware/authentication';
import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { container } from 'tsyringe';

import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { ITokenService, TokenPayload } from '@modules/auth/domain/port/ITokenService';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { RequestHandler } from 'express';

interface FetchResponse {
    status: number;
    body: unknown;
};

interface ErrorResponseBody {
    code: string;
    status: 'error';
    statusCode: number;
};

interface SuccessResponseBody {
    data: {
        authType?: string;
        guest?: boolean;
        userId?: string;
    };
    status: 'success';
};

const USER_ID = '507f1f77bcf86cd799439023';

const user = new User(USER_ID, {
    email: 'user@example.com',
    lastLoginAt: new Date(),
    teams: [],
    analyses: [],
    firstName: 'User',
    lastName: 'Example',
    createdAt: new Date(),
    updatedAt: new Date()
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const isErrorResponseBody = (value: unknown): value is ErrorResponseBody => {
    if (!isRecord(value)) {
        return false;
    }

    return value.status === 'error' && typeof value.code === 'string' && typeof value.statusCode === 'number';
};

const isSuccessResponseBody = (value: unknown): value is SuccessResponseBody => {
    if (!isRecord(value) || value.status !== 'success') {
        return false;
    }

    return isRecord(value.data);
};

const createTokenService = (payload: TokenPayload | null): ITokenService => {
    return {
        sign: () => 'signed-token',
        verify: () => payload
    };
};

const createUserRepository = (): IUserRepository => {
    return {
        findById: async () => user,
        findOne: async () => null,
        findAll: async () => ({ data: [], total: 0, page: 1, totalPages: 0, limit: 10 }),
        export: async () => [],
        create: async () => {
            throw new Error('Not implemented');
        },
        updateById: async () => null,
        updateMany: async () => 0,
        insertMany: async () => {},
        deleteById: async () => false,
        deleteMany: async () => 0,
        count: async () => 0,
        countGroupedBy: async () => new Map(),
        exists: async () => false,
        findByIdWithPassword: async () => null,
        addTeamToUser: async () => {},
        removeTeamFromUser: async () => {},
        removeUsersFromTeam: async () => {},
        findByEmail: async () => null,
        findByEmailWithPassword: async () => null,
        emailExists: async () => false,
        updatePassword: async () => {},
        updateLastLogin: async () => {},
        updateLastSeen: async () => {},
        updateAvatar: async () => {}
    };
};

const registerAuthenticationDependencies = (payload: TokenPayload | null): void => {
    container.clearInstances();
    container.registerInstance(AUTH_TOKENS.TokenService, createTokenService(payload));
    container.registerInstance(AUTH_TOKENS.UserRepository, createUserRepository());
};

const createApp = (middleware: RequestHandler, beforeMiddleware?: RequestHandler) => {
    const app = express();

    app.get('/probe', beforeMiddleware ?? ((_req, _res, next) => next()), middleware, (req, res) => {
        const authenticatedRequest: AuthenticatedRequest = req;

        res.status(200).json({
            status: 'success',
            data: {
                authType: authenticatedRequest.authType,
                guest: authenticatedRequest.userId === undefined,
                userId: authenticatedRequest.userId
            }
        });
    });

    return app;
};

const requestJson = async (
    app: ReturnType<typeof createApp>,
    authorization?: string
): Promise<FetchResponse> => {
    const server = app.listen(0);

    try {
        const address = server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Server address not available');
        }

        const headers = new Headers();
        if (authorization) {
            headers.set('Authorization', authorization);
        }

        const response = await fetch(`http://127.0.0.1:${address.port}/probe`, { headers });
        const body = await response.json();

        return {
            status: response.status,
            body
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }
};

test('protect: rejects requests without a bearer token', async () => {
    const response = await requestJson(createApp(protect));
    const body = response.body;

    if (!isErrorResponseBody(body)) {
        throw new Error('Expected error response body');
    }

    assert.equal(response.status, 401);
    assert.equal(body.code, 'Authentication::Required');
    assert.equal(body.statusCode, 401);
});

test('protect: preserves previously authenticated requests', async () => {
    const seedAuthenticatedRequest: RequestHandler = (req, _res, next) => {
        const authenticatedRequest: AuthenticatedRequest = req;

        authenticatedRequest.authType = AuthenticationType.User;
        authenticatedRequest.token = 'seeded-token';
        authenticatedRequest.userId = USER_ID;
        authenticatedRequest.user = user;

        next();
    };

    const response = await requestJson(createApp(protect, seedAuthenticatedRequest));
    const body = response.body;

    if (!isSuccessResponseBody(body)) {
        throw new Error('Expected success response body');
    }

    assert.equal(response.status, 200);
    assert.equal(body.data.authType, AuthenticationType.User);
    assert.equal(body.data.userId, USER_ID);
});

test('protect: authenticates valid user tokens and preserves prior behavior', async () => {
    registerAuthenticationDependencies({
        _id: USER_ID,
        userId: USER_ID,
        id: USER_ID,
        iat: 1,
        exp: 2
    });

    const response = await requestJson(
        createApp(protect),
        'Bearer valid-user-token'
    );
    const body = response.body;

    if (!isSuccessResponseBody(body)) {
        throw new Error('Expected success response body');
    }

    assert.equal(response.status, 200);
    assert.equal(body.data.authType, AuthenticationType.User);
    assert.equal(body.data.userId, USER_ID);
});

test('authenticateOptional: keeps guest access when no token is provided', async () => {
    const response = await requestJson(createApp(authenticateOptional));
    const body = response.body;

    if (!isSuccessResponseBody(body)) {
        throw new Error('Expected success response body');
    }

    assert.equal(response.status, 200);
    assert.equal(body.data.guest, true);
    assert.equal(body.data.userId, undefined);
});
