import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import type { NextFunction, Response } from 'express';
import { createHarness, destroyHarness } from '@tests/harness';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import User from '@modules/auth/models/User';
import { checkTeamMembership } from '@modules/team/controllers/middleware/check-team-membership';
import { AuthenticationType } from '@shared/contracts/types/AuthenticatedRequest';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import {
    HttpRequestTeamContextSource,
    type HttpRequestContext
} from '@shared/infrastructure/http/request-context';
import { SystemRoleNames, SystemRoles } from '@core/constants/system-roles';

interface ResponseCapture{
    statusCode?: number;
    body?: Record<string, unknown>;
}

interface Invocation{
    request: AuthenticatedRequest;
    captured: ResponseCapture;
    nextCalls: number;
}

interface Fixture{
    owner: User;
    team: Team;
    ownerRole: TeamRole;
    customRole: TeamRole;
}

const buildResponse = (captured: ResponseCapture): Response => {
    const response = {
        status(statusCode: number){
            captured.statusCode = statusCode;
            return response;
        },
        json(body: Record<string, unknown>){
            captured.body = body;
            return response;
        }
    };

    return response as unknown as Response;
};

const runMiddleware = async (request: Partial<AuthenticatedRequest>): Promise<Invocation> => {
    const captured: ResponseCapture = {};
    let nextCalls = 0;
    const next: NextFunction = () => {
        nextCalls += 1;
    };
    const fullRequest = {
        params: {},
        body: undefined,
        ...request
    } as AuthenticatedRequest;

    await checkTeamMembership(fullRequest, buildResponse(captured), next);

    return {
        request: fullRequest,
        captured,
        nextCalls
    };
};

const buildRequestContext = (): HttpRequestContext => ({
    traceId: 'trace-1',
    startedAt: Date.now(),
    method: 'GET',
    path: '/api/v1/teams'
});

describe('checkTeamMembership', () => {
    let dataSource: DataSource;

    before(async () => {
        dataSource = await createHarness([Team, TeamMember, TeamRole, User]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const ownerRole = await TeamRole.create({
            team: team.id,
            name: SystemRoleNames.OWNER,
            permissions: ['stale:permission'],
            isSystem: true
        }).save();
        const customRole = await TeamRole.create({
            team: team.id,
            name: 'Auditor',
            permissions: ['analysis:read', 'trajectory:read'],
            isSystem: false
        }).save();
        await TeamMember.create({
            team: team.id,
            user: owner.id,
            role: ownerRole.id,
            joinedAt: new Date()
        }).save();

        return {
            owner,
            team,
            ownerRole,
            customRole
        };
    };

    it('rejects a request without a team identifier', async () => {
        const invocation = await runMiddleware({ userId: 'user' });

        assert.equal(invocation.nextCalls, 0);
        assert.equal(invocation.captured.statusCode, 400);
        assert.equal(invocation.captured.body?.code, 'Team::IdRequired');
    });

    it('reads the team identifier from the request body', async () => {
        const fixture = await createFixture();

        const invocation = await runMiddleware({
            userId: fixture.owner.id,
            body: { teamId: fixture.team.id }
        });

        assert.equal(invocation.nextCalls, 1);
    });

    it('rejects an unauthenticated request', async () => {
        const fixture = await createFixture();

        const invocation = await runMiddleware({ params: { teamId: fixture.team.id } });

        assert.equal(invocation.nextCalls, 0);
        assert.equal(invocation.captured.statusCode, 401);
        assert.equal(invocation.captured.body?.code, 'Authentication::Required');
    });

    it('rejects a user that does not belong to the team', async () => {
        const fixture = await createFixture();
        const stranger = await User.create({
            email: 'stranger@volt.test',
            firstName: 'alan'
        }).save();

        const invocation = await runMiddleware({
            userId: stranger.id,
            params: { teamId: fixture.team.id }
        });

        assert.equal(invocation.nextCalls, 0);
        assert.equal(invocation.captured.statusCode, 403);
        assert.equal(invocation.captured.body?.code, 'Team::Membership::Forbidden');
    });

    it('resolves a system role to its canonical permissions instead of the stored ones', async () => {
        const fixture = await createFixture();

        const invocation = await runMiddleware({
            userId: fixture.owner.id,
            params: { teamId: fixture.team.id }
        });

        assert.equal(invocation.nextCalls, 1);
        assert.deepEqual(invocation.request.teamPermissions, SystemRoles[SystemRoleNames.OWNER].permissions);
    });

    it('uses the stored permissions of a custom role', async () => {
        const fixture = await createFixture();
        const auditor = await User.create({
            email: 'auditor@volt.test',
            firstName: 'grace'
        }).save();
        await TeamMember.create({
            team: fixture.team.id,
            user: auditor.id,
            role: fixture.customRole.id,
            joinedAt: new Date()
        }).save();

        const invocation = await runMiddleware({
            userId: auditor.id,
            params: { teamId: fixture.team.id }
        });

        assert.deepEqual(invocation.request.teamPermissions, ['analysis:read', 'trajectory:read']);
    });

    it('falls back to the stored permissions of a system role the deployment does not know', async () => {
        const fixture = await createFixture();
        const legacy = await User.create({
            email: 'legacy@volt.test',
            firstName: 'alan'
        }).save();
        const legacyRole = await TeamRole.create({
            team: fixture.team.id,
            name: 'Archivist',
            permissions: ['analysis:read'],
            isSystem: true
        }).save();
        await TeamMember.create({
            team: fixture.team.id,
            user: legacy.id,
            role: legacyRole.id,
            joinedAt: new Date()
        }).save();

        const invocation = await runMiddleware({
            userId: legacy.id,
            params: { teamId: fixture.team.id }
        });

        assert.deepEqual(invocation.request.teamPermissions, ['analysis:read']);
    });

    it('records the resolved team context on the request', async () => {
        const fixture = await createFixture();

        const invocation = await runMiddleware({
            userId: fixture.owner.id,
            params: { teamId: fixture.team.id },
            requestContext: buildRequestContext()
        });

        const teamContext = invocation.request.requestContext?.team;
        assert.equal(teamContext?.teamId, fixture.team.id);
        assert.equal(teamContext?.userId, fixture.owner.id);
        assert.equal(teamContext?.source, HttpRequestTeamContextSource.Repository);
        assert.equal(teamContext?.cached, false);
    });

    it('reuses the team context already resolved for the same user', async () => {
        const fixture = await createFixture();
        const requestContext = buildRequestContext();
        requestContext.team = {
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            durationMs: 1,
            cached: false,
            source: HttpRequestTeamContextSource.Repository,
            permissions: ['cached:permission']
        };

        const invocation = await runMiddleware({
            userId: fixture.owner.id,
            params: { teamId: fixture.team.id },
            requestContext
        });

        assert.equal(invocation.nextCalls, 1);
        assert.deepEqual(invocation.request.teamPermissions, ['cached:permission']);
    });

    it('ignores a cached team context that belongs to another user', async () => {
        const fixture = await createFixture();
        const requestContext = buildRequestContext();
        requestContext.team = {
            teamId: fixture.team.id,
            userId: 'somebody-else',
            durationMs: 1,
            cached: false,
            source: HttpRequestTeamContextSource.Repository,
            permissions: ['cached:permission']
        };

        const invocation = await runMiddleware({
            userId: fixture.owner.id,
            params: { teamId: fixture.team.id },
            requestContext
        });

        assert.deepEqual(invocation.request.teamPermissions, SystemRoles[SystemRoleNames.OWNER].permissions);
    });

    it('ignores a cached team context that belongs to another team', async () => {
        const fixture = await createFixture();
        const requestContext = buildRequestContext();
        requestContext.team = {
            teamId: 'another-team',
            userId: fixture.owner.id,
            durationMs: 1,
            cached: false,
            source: HttpRequestTeamContextSource.Repository,
            permissions: ['cached:permission']
        };

        const invocation = await runMiddleware({
            userId: fixture.owner.id,
            params: { teamId: fixture.team.id },
            requestContext
        });

        assert.deepEqual(invocation.request.teamPermissions, SystemRoles[SystemRoleNames.OWNER].permissions);
    });

    it('accepts a secret key scoped to the requested team without a membership row', async () => {
        const fixture = await createFixture();

        const invocation = await runMiddleware({
            params: { teamId: fixture.team.id },
            authType: AuthenticationType.SecretKey,
            secretKeyTeamId: fixture.team.id,
            teamPermissions: ['team:read'],
            requestContext: buildRequestContext()
        });

        assert.equal(invocation.nextCalls, 1);
        assert.equal(invocation.request.requestContext?.team?.source, HttpRequestTeamContextSource.SecretKey);
        assert.deepEqual(invocation.request.requestContext?.team?.permissions, ['team:read']);
    });

    it('rejects a secret key scoped to another team', async () => {
        const fixture = await createFixture();

        const invocation = await runMiddleware({
            params: { teamId: fixture.team.id },
            authType: AuthenticationType.SecretKey,
            secretKeyTeamId: 'another-team'
        });

        assert.equal(invocation.nextCalls, 0);
        assert.equal(invocation.captured.statusCode, 403);
        assert.equal(invocation.captured.body?.code, 'Team::AccessDenied');
    });

    it('reuses the cached context of a secret key regardless of the user', async () => {
        const fixture = await createFixture();
        const requestContext = buildRequestContext();
        requestContext.team = {
            teamId: fixture.team.id,
            userId: 'somebody-else',
            durationMs: 1,
            cached: false,
            source: HttpRequestTeamContextSource.SecretKey,
            permissions: ['cached:permission']
        };

        const invocation = await runMiddleware({
            params: { teamId: fixture.team.id },
            authType: AuthenticationType.SecretKey,
            secretKeyTeamId: fixture.team.id,
            requestContext
        });

        assert.equal(invocation.nextCalls, 1);
        assert.deepEqual(invocation.request.teamPermissions, ['cached:permission']);
    });

    it('reports no permission for a member whose role was detached', async () => {
        const fixture = await createFixture();
        const orphan = await User.create({
            email: 'orphan@volt.test',
            firstName: 'grace'
        }).save();
        await TeamMember.insert({
            id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
            team: fixture.team.id,
            user: orphan.id,
            role: fixture.customRole.id,
            joinedAt: new Date()
        });
        await dataSource.query('PRAGMA foreign_keys = OFF');
        await TeamRole.delete({ id: fixture.customRole.id });
        await dataSource.query('PRAGMA foreign_keys = ON');

        const invocation = await runMiddleware({
            userId: orphan.id,
            params: { teamId: fixture.team.id }
        });

        assert.equal(invocation.nextCalls, 1);
        assert.deepEqual(invocation.request.teamPermissions, []);
    });
});
