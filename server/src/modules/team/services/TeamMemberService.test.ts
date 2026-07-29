import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import ApplicationError from '@shared/application/errors/ApplicationError';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import TeamRoomPresenceService from '@modules/team/services/team-member/TeamRoomPresenceService';
import TeamMemberService from '@modules/team/services/TeamMemberService';
import User from '@modules/auth/models/User';
import { SystemRoleNames } from '@core/constants/system-roles';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface Fixture{
    owner: User;
    team: Team;
    ownerRole: TeamRole;
    memberRole: TeamRole;
    ownerMembership: TeamMember;
}

const USER_WIRE_FIELDS = [
    '_id',
    'email',
    'avatar',
    'firstName',
    'lastName',
    'createdAt',
    'isOnline',
    'lastSeenAt'
];

const ROLE_WIRE_FIELDS = ['_id', 'name', 'permissions', 'isSystem'];

describe('TeamMemberService', () => {
    let dataSource: DataSource;
    let service: TeamMemberService;
    const published: EmittedEvent[] = [];
    const onlineUserIds: string[] = [];

    before(async () => {
        process.env.VOLT_MODULES = 'team';

        dataSource = await createHarness([Team, TeamMember, TeamRole, User]);

        eventBus.emit = (async (name: string, payload: unknown) => {
            published.push({
                name,
                payload
            });
        }) as typeof eventBus.emit;
        TeamRoomPresenceService.prototype.getOnlineUserIds = async () => [...onlineUserIds];

        service = new TeamMemberService();
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
        onlineUserIds.length = 0;
    });

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            password: 'hashed-secret',
            firstName: 'ada',
            lastName: 'lovelace',
            avatar: 'avatar.png'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const ownerRole = await TeamRole.create({
            team: team.id,
            name: SystemRoleNames.OWNER,
            permissions: ['*'],
            isSystem: true
        }).save();
        const memberRole = await TeamRole.create({
            team: team.id,
            name: SystemRoleNames.MEMBER,
            permissions: ['team:read'],
            isSystem: true
        }).save();
        const ownerMembership = await TeamMember.create({
            team: team.id,
            user: owner.id,
            role: ownerRole.id,
            joinedAt: new Date()
        }).save();
        await User.update({ id: owner.id }, { teams: [team.id] });

        return {
            owner,
            team,
            ownerRole,
            memberRole,
            ownerMembership
        };
    };

    const enrol = async (fixture: Fixture, email: string, roleId: string): Promise<{ user: User; membership: TeamMember }> => {
        const user = await User.create({
            email,
            password: 'hashed-secret',
            firstName: 'grace',
            lastName: 'hopper'
        }).save();
        const membership = await TeamMember.create({
            team: fixture.team.id,
            user: user.id,
            role: roleId,
            joinedAt: new Date()
        }).save();

        return {
            user,
            membership
        };
    };

    describe('listByTeamId', () => {
        it('exposes only the whitelisted user fields', async () => {
            const fixture = await createFixture();

            const result = await service.listByTeamId(fixture.team.id);
            const user = result.data[0].user as Record<string, unknown>;

            assert.deepEqual(Object.keys(user).sort(), [...USER_WIRE_FIELDS].sort());
        });

        it('never leaks the password or the team links of a member', async () => {
            const fixture = await createFixture();

            const result = await service.listByTeamId(fixture.team.id);
            const user = result.data[0].user as Record<string, unknown>;

            assert.equal('password' in user, false);
            assert.equal('teams' in user, false);
            assert.equal('role' in user, false);
            assert.equal('id' in user, false);
        });

        it('reports the user identifier as _id', async () => {
            const fixture = await createFixture();

            const result = await service.listByTeamId(fixture.team.id);
            const user = result.data[0].user as Record<string, unknown>;

            assert.equal(user._id, fixture.owner.id);
            assert.equal(user.email, 'owner@volt.test');
            assert.equal(user.avatar, 'avatar.png');
        });

        it('exposes only the whitelisted role fields', async () => {
            const fixture = await createFixture();

            const result = await service.listByTeamId(fixture.team.id);
            const role = result.data[0].role as Record<string, unknown>;

            assert.deepEqual(Object.keys(role).sort(), [...ROLE_WIRE_FIELDS].sort());
            assert.equal(role._id, fixture.ownerRole.id);
            assert.deepEqual(role.permissions, ['*']);
            assert.equal(role.isSystem, true);
        });

        it('flags the members present in the team room as online', async () => {
            const fixture = await createFixture();
            const other = await enrol(fixture, 'member@volt.test', fixture.memberRole.id);
            onlineUserIds.push(other.user.id);

            const result = await service.listByTeamId(fixture.team.id);
            const byUser = new Map(result.data.map((member) => [
                (member.user as Record<string, unknown>)._id,
                (member.user as Record<string, unknown>).isOnline
            ]));

            assert.equal(byUser.get(other.user.id), true);
            assert.equal(byUser.get(fixture.owner.id), false);
        });

        it('reports the membership identifier as _id and keeps the team as an id', async () => {
            const fixture = await createFixture();

            const result = await service.listByTeamId(fixture.team.id);

            assert.equal(result.data[0]._id, fixture.ownerMembership.id);
            assert.equal(result.data[0].team, fixture.team.id);
            assert.equal('id' in result.data[0], false);
        });

        it('reports zero content counters when the counting modules are disabled', async () => {
            const fixture = await createFixture();

            const result = await service.listByTeamId(fixture.team.id);

            assert.equal(result.data[0].trajectoriesCount, 0);
            assert.equal(result.data[0].analysesCount, 0);
            assert.equal(result.data[0].latexCount, 0);
            assert.equal(result.data[0].whiteboardsCount, 0);
        });

        it('excludes the members of the other teams', async () => {
            const fixture = await createFixture();
            const otherTeam = await Team.create({
                name: 'Team Two',
                owner: fixture.owner.id
            }).save();
            const otherRole = await TeamRole.create({
                team: otherTeam.id,
                name: SystemRoleNames.MEMBER,
                permissions: [],
                isSystem: true
            }).save();
            const stranger = await User.create({
                email: 'stranger@volt.test',
                firstName: 'alan'
            }).save();
            await TeamMember.create({
                team: otherTeam.id,
                user: stranger.id,
                role: otherRole.id,
                joinedAt: new Date()
            }).save();

            const result = await service.listByTeamId(fixture.team.id);

            assert.equal(result.total, 1);
        });

        it('defaults to a limit of one hundred rows', async () => {
            const fixture = await createFixture();

            const result = await service.listByTeamId(fixture.team.id);

            assert.equal(result.limit, 100);
            assert.equal(result.page, 1);
            assert.equal(result.totalPages, 1);
        });

        it('slices the requested page', async () => {
            const fixture = await createFixture();
            await enrol(fixture, 'first@volt.test', fixture.memberRole.id);
            await enrol(fixture, 'second@volt.test', fixture.memberRole.id);

            const result = await service.listByTeamId(fixture.team.id, 2, 2);

            assert.equal(result.data.length, 1);
            assert.equal(result.total, 3);
            assert.equal(result.totalPages, 2);
        });

        it('caps the limit at five hundred rows', async () => {
            const fixture = await createFixture();

            assert.equal((await service.listByTeamId(fixture.team.id, 1, 5_000)).limit, 500);
        });
    });

    describe('getById', () => {
        it('returns the requested membership', async () => {
            const fixture = await createFixture();

            const member = await service.getById(fixture.ownerMembership.id);

            assert.equal(member.id, fixture.ownerMembership.id);
            assert.equal(member.team, fixture.team.id);
        });

        it('rejects an unknown membership', async () => {
            await assert.rejects(
                () => service.getById('6a69587bbabeab928d9147ba'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamMember::NotFound');
                    assert.equal(error.message, 'TeamMember not found');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });
    });

    describe('updateById', () => {
        it('moves the member to the requested role', async () => {
            const fixture = await createFixture();
            const { membership } = await enrol(fixture, 'member@volt.test', fixture.memberRole.id);

            await service.updateById(membership.id, { role: fixture.ownerRole.id });

            assert.equal((await TeamMember.findOneByOrFail({ id: membership.id })).role, fixture.ownerRole.id);
        });

        it('rejects an unknown membership', async () => {
            await assert.rejects(
                () => service.updateById('6a69587bbabeab928d9147ba', { role: 'role' }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamMember::NotFound');
                    return true;
                }
            );
        });
    });

    describe('deleteById', () => {
        it('removes the membership and emits team-member.deleted', async () => {
            const fixture = await createFixture();
            const { membership } = await enrol(fixture, 'member@volt.test', fixture.memberRole.id);

            await service.deleteById(fixture.team.id, membership.id);

            assert.equal(await TeamMember.countBy({ id: membership.id }), 0);
            assert.deepEqual(published, [{
                name: 'team-member.deleted',
                payload: {
                    teamMemberId: membership.id,
                    teamId: fixture.team.id
                }
            }]);
        });

        it('deletes the team and reports both events when the last member is removed', async () => {
            const fixture = await createFixture();

            await service.deleteById(fixture.team.id, fixture.ownerMembership.id);

            assert.equal(await Team.countBy({ id: fixture.team.id }), 0);
            assert.deepEqual(published.map((event) => event.name), ['team.deleted', 'team-member.deleted']);
        });

        it('rejects an unknown membership without emitting anything', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.deleteById(fixture.team.id, '6a69587bbabeab928d9147ba'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamMember::NotFound');
                    assert.equal(error.message, 'Team member not found');
                    return true;
                }
            );
            assert.deepEqual(published, []);
        });
    });
});
