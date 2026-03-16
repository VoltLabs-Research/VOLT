import 'reflect-metadata';

import { Resource } from '@core/constants/resources';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import User from '@modules/auth/domain/entities/User';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamMember from '@modules/team/domain/entities/team-member/TeamMember';
import Trajectory, { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import assert from 'node:assert/strict';
import test from 'node:test';
import Module from 'node:module';
import express, { Router } from 'express';
import { container } from 'tsyringe';

import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { ITokenService, TokenPayload } from '@modules/auth/domain/port/ITokenService';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

interface FetchResponse {
    status: number;
    body: unknown;
};

interface ErrorResponseBody {
    code: string;
    status: 'error';
    statusCode: number;
};

interface RepositoryFindByIdOptions {
    populate?: string | string[];
    select?: string[];
};

interface RouteDependencyOptions {
    hasMembership: boolean;
    permissions: string[];
    tokenPayload: TokenPayload | null;
    trajectoryVisibility: boolean | null;
};

interface SuccessResponseBody {
    data: {
        access?: {
            isGuest?: boolean;
        };
        route?: string;
    };
    status: 'success';
};

const CANVAS_ROUTE_REQUEST = '@modules/trajectory/infrastructure/http/routes/canvas';
const TEAM_MEMBER_ROUTE_REQUEST = '@modules/team/infrastructure/http/routes/team-member';
const TRAJECTORY_ID = '507f1f77bcf86cd799439021';
const TEAM_ID = '507f1f77bcf86cd799439022';
const USER_ID = '507f1f77bcf86cd799439023';

let mountHttpRoutesPromise: Promise<() => Router> | null = null;
let restoreRouteModuleLoader: (() => void) | null = null;

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

const createTeamMemberRepository = (
    hasMembership: boolean,
    permissions: string[]
): ITeamMemberRepository => {
    return {
        findById: async () => null,
        findOne: async () => {
            if (!hasMembership) {
                return null;
            }

            return new TeamMember('507f1f77bcf86cd799439027', {
                team: TEAM_ID,
                user: USER_ID,
                role: {
                    _id: '507f1f77bcf86cd799439028',
                    name: 'Reader',
                    permissions,
                    isSystem: false
                },
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

const registerRouteDependencies = (options: RouteDependencyOptions): void => {
    container.clearInstances();
    container.registerInstance(TRAJECTORY_TOKENS.TrajectoryRepository, createTrajectoryRepository(options.trajectoryVisibility));
    container.registerInstance(TEAM_TOKENS.TeamMemberRepository, createTeamMemberRepository(options.hasMembership, options.permissions));
    container.registerInstance(AUTH_TOKENS.TokenService, createTokenService(options.tokenPayload));
    container.registerInstance(AUTH_TOKENS.UserRepository, createUserRepository());
};

const createTeamMemberHttpModule = () => {
    const router = Router({ mergeParams: true });

    router.get('/', (_req, res) => {
        res.status(200).json({
            status: 'success',
            data: {
                route: 'team-members'
            }
        });
    });

    return {
        basePath: '/api/teams/:teamId/members',
        resource: Resource.TEAM_MEMBER,
        router
    };
};

const installRouteModuleLoader = (): (() => void) => {
    const originalLoad = Reflect.get(Module, '_load');
    if (typeof originalLoad !== 'function') {
        throw new Error('Module loader not available');
    }

    let stubIndex = 0;

    Reflect.set(Module, '_load', (request: string, parent: unknown, isMain: boolean) => {
        if (request === TEAM_MEMBER_ROUTE_REQUEST) {
            return {
                __esModule: true,
                default: createTeamMemberHttpModule()
            };
        }

        if (request !== CANVAS_ROUTE_REQUEST && request.startsWith('@modules/') && request.includes('/infrastructure/http/routes/')) {
            stubIndex += 1;

            return {
                __esModule: true,
                default: {
                    basePath: `/__stub__/${stubIndex}`,
                    router: Router({ mergeParams: true })
                }
            };
        }

        return Reflect.apply(originalLoad, Module, [request, parent, isMain]);
    });

    return () => {
        Reflect.set(Module, '_load', originalLoad);
    };
};

const loadMountHttpRoutes = async (): Promise<() => Router> => {
    if (!mountHttpRoutesPromise) {
        restoreRouteModuleLoader = installRouteModuleLoader();
        mountHttpRoutesPromise = import('./mount-http-routes').then((module) => module.default);
    }

    return mountHttpRoutesPromise;
};

const requestJson = async (path: string, authorization?: string): Promise<FetchResponse> => {
    const mountHttpRoutes = await loadMountHttpRoutes();
    const app = express();

    app.use(express.json());
    app.use(mountHttpRoutes());

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

test.after(() => {
    restoreRouteModuleLoader?.();
});

test('mountHttpRoutes: keeps team-scoped routes protected', async () => {
    registerRouteDependencies({
        hasMembership: false,
        permissions: [],
        tokenPayload: null,
        trajectoryVisibility: true
    });

    const response = await requestJson(`/api/teams/${TEAM_ID}/members`);
    const body = response.body;

    if (!isErrorResponseBody(body)) {
        throw new Error('Expected error response body');
    }

    assert.equal(response.status, 401);
    assert.equal(body.code, 'Authentication::Required');
    assert.equal(body.statusCode, 401);
});

test('mountHttpRoutes: preserves protect and team RBAC flow on team-scoped routes', async () => {
    registerRouteDependencies({
        hasMembership: true,
        permissions: ['team-member:read'],
        tokenPayload: {
            _id: USER_ID,
            userId: USER_ID,
            id: USER_ID,
            iat: 1,
            exp: 2
        },
        trajectoryVisibility: true
    });

    const response = await requestJson(
        `/api/teams/${TEAM_ID}/members`,
        'Bearer valid-user-token'
    );
    const body = response.body;

    if (!isSuccessResponseBody(body)) {
        throw new Error('Expected success response body');
    }

    assert.equal(response.status, 200);
    assert.equal(body.data.route, 'team-members');
});

test('mountHttpRoutes: keeps canvas bootstrap public for guests', async () => {
    registerRouteDependencies({
        hasMembership: false,
        permissions: [],
        tokenPayload: null,
        trajectoryVisibility: true
    });

    const response = await requestJson(`/api/canvas/${TRAJECTORY_ID}/bootstrap`);
    const body = response.body;

    if (!isSuccessResponseBody(body)) {
        throw new Error('Expected success response body');
    }

    assert.equal(response.status, 200);
    assert.equal(body.data.access?.isGuest, true);
});

test('mountHttpRoutes: rejects invalid optional auth on public canvas routes', async () => {
    registerRouteDependencies({
        hasMembership: false,
        permissions: [],
        tokenPayload: null,
        trajectoryVisibility: true
    });

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
