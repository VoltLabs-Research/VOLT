import 'reflect-metadata';

import AuthenticateSocketConnectionUseCase from '@modules/socket/application/use-cases/AuthenticateSocketConnectionUseCase';
import User from '@modules/auth/domain/entities/User';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import assert from 'node:assert/strict';
import test from 'node:test';

import type { ITokenService, TokenPayload } from '@modules/auth/domain/port/ITokenService';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';

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

const createSessionRepository = (isActive: boolean): ISessionRepository => {
    return {
        findByToken: async () => isActive
            ? {
                _id: 'session-id',
                props: {
                    user: USER_ID,
                    token: 'valid-user-token',
                    userAgent: 'test-agent',
                    ip: '127.0.0.1',
                    isActive: true,
                    lastActivity: new Date(),
                    action: SessionActivityType.Login,
                    success: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            }
            : null,
        findActiveByUserId: async () => [],
        findLoginActivity: async () => [],
        deactivateByToken: async () => {},
        deactivateAllExcept: async () => 0,
        deactivateAll: async () => 0,
        createFailedLogin: async () => {
            throw new Error('Not implemented');
        },
        updateActivity: async () => {},
        findById: async () => null,
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
        exists: async () => false
    };
};

test('AuthenticateSocketConnectionUseCase rejects valid JWTs without an active session', async () => {
    const useCase = new AuthenticateSocketConnectionUseCase(
        createUserRepository(),
        createTokenService({
            _id: USER_ID,
            userId: USER_ID,
            id: USER_ID,
            iat: 1,
            exp: 2
        }),
        createSessionRepository(false)
    );

    const result = await useCase.execute('valid-user-token');

    assert.deepEqual(result, {
        state: 'rejected',
        reason: 'invalid_token'
    });
});
