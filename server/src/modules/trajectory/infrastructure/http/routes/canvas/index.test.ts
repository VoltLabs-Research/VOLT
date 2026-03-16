import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import User from '@modules/auth/domain/entities/User';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamMember from '@modules/team/domain/entities/team-member/TeamMember';
import Trajectory, { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import CanvasHttpModule from '@modules/trajectory/infrastructure/http/routes/canvas';
import { container } from 'tsyringe';

import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { ITokenService, TokenPayload } from '@modules/auth/domain/port/ITokenService';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

interface FetchResponse {
    status: number;
    body: unknown;
};

interface SuccessResponseBody {
    status: 'success';
    data: {
        access: {
            isGuest?: boolean;
            hasTeamMembership?: boolean;
        };
    };
};

interface ErrorResponseBody {
    code: string;
    statusCode: number;
};

interface RepositoryFindByIdOptions {
    populate?: string | string[];
    select?: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const isSuccessResponseBody = (value: unknown): value is SuccessResponseBody => {
    if (!isRecord(value) || value.status !== 'success') {
        return false;
    }

    const data = value.data;
    if (!isRecord(data)) {
        return false;
    }

    return isRecord(data.access);
};

const isErrorResponseBody = (value: unknown): value is ErrorResponseBody => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.code === 'string' && typeof value.statusCode === 'number';
};

const TRAJECTORY_ID = '507f1f77bcf86cd799439021';
const TEAM_ID = '507f1f77bcf86cd799439022';
const USER_ID = '507f1f77bcf86cd799439023';

const createTrajectoryRepository = (isPublic: boolean | null): ITrajectoryRepository => {
    return {
        findById: async (_id: string, _options?: RepositoryFindByIdOptions) => {
            if (isPublic === null) {
                return null;
            }

            return new Trajectory(TRAJECTORY_ID, {
                name: 'Trajectory',
                team: TEAM_ID,
                folder: null,
                teamCluster: '507f1f77bcf86cd799439024',
                createdBy: USER_ID,
                status: TrajectoryStatus.Completed,
                isPublic,
                frames: [{
                    timestep: 0,
                    natoms: 24,
                    simulationCell: '507f1f77bcf86cd799439025'
                }],
                analysis: ['507f1f77bcf86cd799439026'],
                rasterSceneViews: 0,
                stats: {
                    totalFiles: 1,
                    totalSize: 1
                },
                updatedAt: new Date(),
                createdAt: new Date()
            });
        },
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
        createWithId: async () => {
            throw new Error('Not implemented');
        }
    };
};

const createTeamMemberRepository = (hasMembership: boolean): ITeamMemberRepository => {
    return {
        findById: async () => null,
        findOne: async () => {
            if (!hasMembership) {
                return null;
            }

            return new TeamMember('507f1f77bcf86cd799439027', {
                team: TEAM_ID,
                user: USER_ID,
                role: '507f1f77bcf86cd799439028',
                joinedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            });
        },
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
        findByUserId: async () => [],
        deleteByUserId: async () => {},
        getTeamIdsByUserId: async () => []
    };
};

const createTokenService = (payload: TokenPayload | null): ITokenService => {
    return {
        sign: () => 'signed-token',
        verify: () => payload
    };
};

const createUserRepository = (): IUserRepository => {
    const user = new User(USER_ID, {
        email: 'user@example.com',
        lastLoginAt: new Date(),
        teams: [TEAM_ID],
        analyses: [],
        firstName: 'User',
        lastName: 'Example',
        createdAt: new Date(),
        updatedAt: new Date()
    });

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

const registerRouteDependencies = (
    isPublic: boolean | null,
    hasMembership: boolean,
    tokenPayload: TokenPayload | null
): void => {
    container.clearInstances();
    container.registerInstance(TRAJECTORY_TOKENS.TrajectoryRepository, createTrajectoryRepository(isPublic));
    container.registerInstance(TEAM_TOKENS.TeamMemberRepository, createTeamMemberRepository(hasMembership));
    container.registerInstance(AUTH_TOKENS.TokenService, createTokenService(tokenPayload));
    container.registerInstance(AUTH_TOKENS.UserRepository, createUserRepository());
};

const createApp = () => {
    const app = express();
    app.use(CanvasHttpModule.basePath, CanvasHttpModule.router);
    return app;
};

const requestJson = async (path: string, authorization?: string): Promise<FetchResponse> => {
    const app = createApp();
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

        const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { headers });
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

test('Canvas route: allows guests to bootstrap public trajectories', async () => {
    registerRouteDependencies(true, false, null);

    const response = await requestJson(`/api/canvas/${TRAJECTORY_ID}/bootstrap`);
    const body = response.body;

    if (!isSuccessResponseBody(body)) {
        throw new Error('Expected success response body');
    }

    assert.equal(response.status, 200);
    assert.equal(body.status, 'success');
    assert.equal(body.data.access.isGuest, true);
});

test('Canvas route: allows authenticated members to bootstrap private trajectories', async () => {
    registerRouteDependencies(false, true, {
        _id: USER_ID,
        userId: USER_ID,
        id: USER_ID,
        iat: 1,
        exp: 2
    });

    const response = await requestJson(
        `/api/canvas/${TRAJECTORY_ID}/bootstrap`,
        'Bearer valid-user-token'
    );
    const body = response.body;

    if (!isSuccessResponseBody(body)) {
        throw new Error('Expected success response body');
    }

    assert.equal(response.status, 200);
    assert.equal(body.status, 'success');
    assert.equal(body.data.access.hasTeamMembership, true);
});

test('Canvas route: denies guests from private trajectories', async () => {
    registerRouteDependencies(false, false, null);

    const response = await requestJson(`/api/canvas/${TRAJECTORY_ID}/bootstrap`);
    const body = response.body;

    if (!isErrorResponseBody(body)) {
        throw new Error('Expected error response body');
    }

    assert.equal(response.status, 403);
    assert.equal(body.code, 'Team::Membership::Forbidden');
    assert.equal(body.statusCode, 403);
});

test('Canvas route: returns not found when trajectory does not exist', async () => {
    registerRouteDependencies(null, false, null);

    const response = await requestJson(`/api/canvas/${TRAJECTORY_ID}/bootstrap`);
    const body = response.body;

    if (!isErrorResponseBody(body)) {
        throw new Error('Expected error response body');
    }

    assert.equal(response.status, 404);
    assert.equal(body.code, 'Trajectory::NotFound');
    assert.equal(body.statusCode, 404);
});

test('Canvas route: rejects invalid optional auth token instead of treating it as guest', async () => {
    registerRouteDependencies(true, false, null);

    const response = await requestJson(
        `/api/canvas/${TRAJECTORY_ID}/bootstrap`,
        'Bearer invalid-user-token'
    );
    const body = response.body;

    if (!isErrorResponseBody(body)) {
        throw new Error('Expected error response body');
    }

    assert.equal(response.status, 401);
    assert.equal(body.code, 'Authentication::Unauthorized');
    assert.equal(body.statusCode, 401);
});
