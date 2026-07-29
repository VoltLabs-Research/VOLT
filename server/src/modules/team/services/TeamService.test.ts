import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import ApplicationError from '@shared/application/errors/ApplicationError';
import DeploymentSettings from '@modules/system/models/DeploymentSettings';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import TeamService from '@modules/team/services/TeamService';
import User from '@modules/auth/models/User';
import { SystemRoleNames, SystemRoles } from '@core/constants/system-roles';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface Fixture{
    owner: User;
    team: Team;
    ownerRole: TeamRole;
    memberRole: TeamRole;
}

const BLOCK_USER_LINK_TRIGGER = 'CREATE TRIGGER block_user_link BEFORE UPDATE ON users BEGIN SELECT RAISE(ABORT, \'user link write blocked\'); END';

describe('TeamService', () => {
    let dataSource: DataSource;
    const service = new TeamService();
    const published: EmittedEvent[] = [];

    before(async () => {
        dataSource = await createHarness([
            DeploymentSettings,
            Team,
            TeamMember,
            TeamRole,
            User
        ]);

        eventBus.emit = (async (name: string, payload: unknown) => {
            published.push({
                name,
                payload
            });
        }) as typeof eventBus.emit;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
    });

    const createUser = (email: string): Promise<User> => User.create({
        email,
        firstName: 'ada',
        lastName: 'lovelace'
    }).save();

    const createFixture = async (): Promise<Fixture> => {
        const owner = await createUser('owner@volt.test');
        const team = await service.create(owner.id, {
            name: 'Team One',
            description: 'first'
        });
        const ownerRole = await TeamRole.findOneByOrFail({
            team: team.id,
            name: SystemRoleNames.OWNER
        });
        const memberRole = await TeamRole.findOneByOrFail({
            team: team.id,
            name: SystemRoleNames.MEMBER
        });
        published.length = 0;

        return {
            owner,
            team,
            ownerRole,
            memberRole
        };
    };

    const withBlockedUserWrites = async (run: () => Promise<void>): Promise<void> => {
        await dataSource.query(BLOCK_USER_LINK_TRIGGER);
        try{
            await run();
        }finally{
            await dataSource.query('DROP TRIGGER block_user_link');
        }
    };

    describe('create', () => {
        it('persists the team, the four system roles, the owner membership and the user link', async () => {
            const owner = await createUser('owner@volt.test');

            const team = await service.create(owner.id, {
                name: 'Team One',
                description: 'first'
            });

            assert.equal(team.name, 'Team One');
            assert.equal(team.owner, owner.id);
            assert.deepEqual(
                (await TeamRole.findBy({ team: team.id })).map((role) => role.name).sort(),
                [SystemRoleNames.ADMIN, SystemRoleNames.MEMBER, SystemRoleNames.OWNER, SystemRoleNames.VIEWER].sort()
            );
            const membership = await TeamMember.findOneByOrFail({
                team: team.id,
                user: owner.id
            });
            const ownerRole = await TeamRole.findOneByOrFail({
                team: team.id,
                name: SystemRoleNames.OWNER
            });
            assert.equal(membership.role, ownerRole.id);
            assert.deepEqual((await User.findOneByOrFail({ id: owner.id })).teams, [team.id]);
        });

        it('grants the owner role the wildcard permission set', async () => {
            const owner = await createUser('owner@volt.test');

            const team = await service.create(owner.id, {
                name: 'Team One',
                description: 'first'
            });

            const ownerRole = await TeamRole.findOneByOrFail({
                team: team.id,
                name: SystemRoleNames.OWNER
            });
            assert.deepEqual(ownerRole.permissions, SystemRoles[SystemRoleNames.OWNER].permissions);
            assert.equal(ownerRole.isSystem, true);
        });

        it('emits team.created after the team is persisted', async () => {
            const owner = await createUser('owner@volt.test');

            const team = await service.create(owner.id, {
                name: 'Team One',
                description: 'first'
            });

            assert.deepEqual(published, [{
                name: 'team.created',
                payload: {
                    ownerId: owner.id,
                    teamId: team.id
                }
            }]);
        });

        it('rolls back the team, the roles, the membership and the user link when a step of the transaction fails', async () => {
            const owner = await createUser('owner@volt.test');

            await withBlockedUserWrites(async () => {
                await assert.rejects(() => service.create(owner.id, {
                    name: 'Team One',
                    description: 'first'
                }));
            });

            assert.equal(await Team.count(), 0);
            assert.equal(await TeamRole.count(), 0);
            assert.equal(await TeamMember.count(), 0);
            assert.equal((await User.findOneByOrFail({ id: owner.id })).teams, null);
        });

        it('does not emit team.created when the transaction fails', async () => {
            const owner = await createUser('owner@volt.test');

            await withBlockedUserWrites(async () => {
                await assert.rejects(() => service.create(owner.id, {
                    name: 'Team One',
                    description: 'first'
                }));
            });

            assert.deepEqual(published, []);
        });

        it('leaves the teams of the other users untouched when the transaction fails', async () => {
            const owner = await createUser('owner@volt.test');
            const bystander = await createUser('bystander@volt.test');
            const existing = await service.create(bystander.id, {
                name: 'Existing',
                description: 'kept'
            });

            await withBlockedUserWrites(async () => {
                await assert.rejects(() => service.create(owner.id, {
                    name: 'Team One',
                    description: 'first'
                }));
            });

            assert.equal(await Team.count(), 1);
            assert.deepEqual((await User.findOneByOrFail({ id: bystander.id })).teams, [existing.id]);
        });
    });

    describe('listUserTeams', () => {
        it('returns the teams the user is a member of', async () => {
            const fixture = await createFixture();

            const teams = await service.listUserTeams(fixture.owner.id);

            assert.deepEqual(teams.map((team) => team.id), [fixture.team.id]);
        });

        it('excludes the teams the user neither owns nor belongs to', async () => {
            const fixture = await createFixture();
            const stranger = await createUser('stranger@volt.test');
            await service.create(stranger.id, {
                name: 'Foreign',
                description: 'other'
            });

            const teams = await service.listUserTeams(fixture.owner.id);

            assert.deepEqual(teams.map((team) => team.id), [fixture.team.id]);
        });

        it('returns an owned team even without a membership row', async () => {
            const owner = await createUser('owner@volt.test');
            const team = await Team.create({
                name: 'Orphan',
                owner: owner.id
            }).save();

            const teams = await service.listUserTeams(owner.id);

            assert.deepEqual(teams.map((candidate) => candidate.id), [team.id]);
        });

        it('exposes a loaded owner reference as an object and an unloaded one as an id', async () => {
            const fixture = await createFixture();

            const [team] = await service.listUserTeams(fixture.owner.id);
            const wire = JSON.parse(JSON.stringify(team)) as Record<string, unknown>;
            const owner = wire.owner as Record<string, unknown>;

            assert.equal(owner._id, fixture.owner.id);
            assert.equal(owner.email, 'owner@volt.test');
            assert.equal('password' in owner, false);
            assert.equal((await Team.findOneByOrFail({ id: fixture.team.id })).toJSON().owner, fixture.owner.id);
        });

        it('returns an empty list for a user without teams', async () => {
            const stranger = await createUser('stranger@volt.test');

            assert.deepEqual(await service.listUserTeams(stranger.id), []);
        });
    });

    describe('getById', () => {
        it('returns the requested team', async () => {
            const fixture = await createFixture();

            assert.equal((await service.getById(fixture.team.id)).id, fixture.team.id);
        });

        it('rejects an unknown team', async () => {
            await assert.rejects(
                () => service.getById('6a69587bbabeab928d9147ba'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Team::NotFound');
                    assert.equal(error.message, 'Team not found');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });
    });

    describe('updateById', () => {
        it('persists the new name and description', async () => {
            const fixture = await createFixture();

            const updated = await service.updateById(fixture.team.id, {
                name: 'Renamed',
                description: 'changed'
            });

            assert.equal(updated.name, 'Renamed');
            assert.equal((await Team.findOneByOrFail({ id: fixture.team.id })).description, 'changed');
        });

        it('rejects an unknown team', async () => {
            await assert.rejects(
                () => service.updateById('6a69587bbabeab928d9147ba', { name: 'Renamed' }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Team::NotFound');
                    return true;
                }
            );
        });
    });

    describe('deleteById', () => {
        it('removes the team and emits team.deleted with the acting user', async () => {
            const fixture = await createFixture();

            await service.deleteById(fixture.team.id, fixture.owner.id);

            assert.equal(await Team.countBy({ id: fixture.team.id }), 0);
            assert.deepEqual(published, [{
                name: 'team.deleted',
                payload: {
                    teamId: fixture.team.id,
                    userId: fixture.owner.id
                }
            }]);
        });

        it('rejects an unknown team', async () => {
            await assert.rejects(
                () => service.deleteById('6a69587bbabeab928d9147ba', 'user'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Team::NotFound');
                    return true;
                }
            );
        });
    });

    describe('setDefaultForNewUsers', () => {
        it('stores the team as the deployment default and enables the auto join', async () => {
            const fixture = await createFixture();

            const result = await service.setDefaultForNewUsers(fixture.team.id, true);

            assert.deepEqual(result, {
                defaultTeam: fixture.team.id,
                autoJoinNewMembers: true
            });
        });

        it('clears the deployment default when disabled', async () => {
            const fixture = await createFixture();
            await service.setDefaultForNewUsers(fixture.team.id, true);

            const result = await service.setDefaultForNewUsers(fixture.team.id, false);

            assert.deepEqual(result, {
                defaultTeam: null,
                autoJoinNewMembers: false
            });
        });
    });

    describe('checkInvitePermission', () => {
        it('allows a member holding the wildcard permission', async () => {
            const fixture = await createFixture();

            assert.deepEqual(await service.checkInvitePermission(fixture.team.id, fixture.owner.id), { canInvite: true });
        });

        it('allows a member holding the explicit invitation create permission', async () => {
            const fixture = await createFixture();
            const invited = await createUser('invited@volt.test');
            const role = await TeamRole.create({
                team: fixture.team.id,
                name: 'Recruiter',
                permissions: ['team-invitation:create'],
                isSystem: false
            }).save();
            await TeamMember.create({
                team: fixture.team.id,
                user: invited.id,
                role: role.id,
                joinedAt: new Date()
            }).save();

            assert.deepEqual(await service.checkInvitePermission(fixture.team.id, invited.id), { canInvite: true });
        });

        it('denies a member without the invitation create permission', async () => {
            const fixture = await createFixture();
            const viewer = await createUser('viewer@volt.test');
            const viewerRole = await TeamRole.findOneByOrFail({
                team: fixture.team.id,
                name: SystemRoleNames.VIEWER
            });
            await TeamMember.create({
                team: fixture.team.id,
                user: viewer.id,
                role: viewerRole.id,
                joinedAt: new Date()
            }).save();

            assert.deepEqual(await service.checkInvitePermission(fixture.team.id, viewer.id), { canInvite: false });
        });

        it('denies a user that is not a member', async () => {
            const fixture = await createFixture();
            const stranger = await createUser('stranger@volt.test');

            assert.deepEqual(await service.checkInvitePermission(fixture.team.id, stranger.id), { canInvite: false });
        });
    });

    describe('generateInviteCode', () => {
        it('stores a five character uppercase code', async () => {
            const fixture = await createFixture();

            const team = await service.generateInviteCode(fixture.team.id, fixture.owner.id);

            assert.match(team.inviteCode ?? '', /^[A-Z0-9]{5}$/);
            assert.equal((await Team.findOneByOrFail({ id: fixture.team.id })).inviteCode, team.inviteCode);
        });

        it('rejects a user that cannot manage invite codes', async () => {
            const fixture = await createFixture();
            const viewer = await createUser('viewer@volt.test');
            const viewerRole = await TeamRole.findOneByOrFail({
                team: fixture.team.id,
                name: SystemRoleNames.VIEWER
            });
            await TeamMember.create({
                team: fixture.team.id,
                user: viewer.id,
                role: viewerRole.id,
                joinedAt: new Date()
            }).save();

            await assert.rejects(
                () => service.generateInviteCode(fixture.team.id, viewer.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'RBAC::InsufficientPermissions');
                    assert.equal(error.message, 'You do not have permission to manage invite codes');
                    assert.equal(error.statusCode, 403);
                    return true;
                }
            );
        });

        it('rejects a user that is not a member of the team', async () => {
            const fixture = await createFixture();
            const stranger = await createUser('stranger@volt.test');

            await assert.rejects(
                () => service.generateInviteCode(fixture.team.id, stranger.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'RBAC::InsufficientPermissions');
                    return true;
                }
            );
        });
    });

    describe('deleteInviteCode', () => {
        it('leaves the invite code as an explicit null instead of dropping the field', async () => {
            const fixture = await createFixture();
            await service.generateInviteCode(fixture.team.id, fixture.owner.id);

            await service.deleteInviteCode(fixture.team.id, fixture.owner.id);

            const reloaded = await Team.findOneByOrFail({ id: fixture.team.id });
            assert.equal(reloaded.inviteCode, null);
            assert.equal('inviteCode' in reloaded.toJSON(), true);
            assert.equal(reloaded.toJSON().inviteCode, null);
        });

        it('reports the deletion even when the team has no code', async () => {
            const fixture = await createFixture();

            assert.deepEqual(
                await service.deleteInviteCode(fixture.team.id, fixture.owner.id),
                { message: 'Invite code deleted successfully' }
            );
        });

        it('rejects a user that cannot manage invite codes', async () => {
            const fixture = await createFixture();
            const stranger = await createUser('stranger@volt.test');

            await assert.rejects(
                () => service.deleteInviteCode(fixture.team.id, stranger.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'RBAC::InsufficientPermissions');
                    return true;
                }
            );
        });
    });

    describe('getMyPermissions', () => {
        it('resolves a system role to its canonical permission list', async () => {
            const fixture = await createFixture();

            assert.deepEqual(
                await service.getMyPermissions(fixture.team.id, fixture.owner.id),
                { permissions: SystemRoles[SystemRoleNames.OWNER].permissions }
            );
        });

        it('returns the stored permissions of a custom role without duplicates', async () => {
            const fixture = await createFixture();
            const member = await createUser('member@volt.test');
            const role = await TeamRole.create({
                team: fixture.team.id,
                name: 'Custom',
                permissions: ['team:read', 'team:read', 'trajectory:read'],
                isSystem: false
            }).save();
            await TeamMember.create({
                team: fixture.team.id,
                user: member.id,
                role: role.id,
                joinedAt: new Date()
            }).save();

            assert.deepEqual(
                await service.getMyPermissions(fixture.team.id, member.id),
                { permissions: ['team:read', 'trajectory:read'] }
            );
        });

        it('returns no permission for a user that is not a member', async () => {
            const fixture = await createFixture();
            const stranger = await createUser('stranger@volt.test');

            assert.deepEqual(await service.getMyPermissions(fixture.team.id, stranger.id), { permissions: [] });
        });
    });

    describe('leave', () => {
        it('removes the membership and the user link', async () => {
            const fixture = await createFixture();
            const member = await createUser('member@volt.test');
            await TeamMember.create({
                team: fixture.team.id,
                user: member.id,
                role: fixture.memberRole.id,
                joinedAt: new Date()
            }).save();
            await User.update({ id: member.id }, { teams: [fixture.team.id] });

            await service.leave(fixture.team.id, member.id);

            assert.equal(await TeamMember.countBy({
                team: fixture.team.id,
                user: member.id
            }), 0);
            assert.deepEqual((await User.findOneByOrFail({ id: member.id })).teams, []);
        });

        it('rejects a user that is not a member of the team', async () => {
            const fixture = await createFixture();
            const stranger = await createUser('stranger@volt.test');

            await assert.rejects(
                () => service.leave(fixture.team.id, stranger.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Team::UserNotAMember');
                    assert.equal(error.message, 'You are not a member of this team');
                    assert.equal(error.statusCode, 400);
                    return true;
                }
            );
        });

        it('rejects an unknown team', async () => {
            const stranger = await createUser('stranger@volt.test');

            await assert.rejects(
                () => service.leave('6a69587bbabeab928d9147ba', stranger.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Team::NotFound');
                    return true;
                }
            );
        });
    });

    describe('joinByCode', () => {
        it('accepts a lowercase code with surrounding whitespace', async () => {
            const fixture = await createFixture();
            const team = await service.generateInviteCode(fixture.team.id, fixture.owner.id);
            const joiner = await createUser('joiner@volt.test');

            const result = await service.joinByCode(joiner.id, `  ${(team.inviteCode ?? '').toLowerCase()}  `);

            assert.equal(result.teamId, fixture.team.id);
            assert.equal(await TeamMember.countBy({
                team: fixture.team.id,
                user: joiner.id
            }), 1);
            assert.deepEqual((await User.findOneByOrFail({ id: joiner.id })).teams, [fixture.team.id]);
        });

        it('grants full Owner permissions to anyone joining by invite code', async () => {
            const fixture = await createFixture();
            const team = await service.generateInviteCode(fixture.team.id, fixture.owner.id);
            const joiner = await createUser('joiner@volt.test');

            await service.joinByCode(joiner.id, team.inviteCode ?? '');

            const membership = await TeamMember.findOneByOrFail({
                team: fixture.team.id,
                user: joiner.id
            });
            assert.equal(membership.role, fixture.ownerRole.id);
        });

        it('rejects an unknown code', async () => {
            await createFixture();

            await assert.rejects(
                () => service.joinByCode('user', 'ZZZZZ'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInviteCode::NotFound');
                    assert.equal(error.message, 'Invalid invite code');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('rejects a user that already belongs to the team', async () => {
            const fixture = await createFixture();
            const team = await service.generateInviteCode(fixture.team.id, fixture.owner.id);

            await assert.rejects(
                () => service.joinByCode(fixture.owner.id, team.inviteCode ?? ''),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInviteCode::AlreadyMember');
                    assert.equal(error.message, 'You are already a member of this team');
                    assert.equal(error.statusCode, 400);
                    return true;
                }
            );
        });

        it('rejects a code that was deleted', async () => {
            const fixture = await createFixture();
            const team = await service.generateInviteCode(fixture.team.id, fixture.owner.id);
            const code = team.inviteCode ?? '';
            await service.deleteInviteCode(fixture.team.id, fixture.owner.id);
            const joiner = await createUser('joiner@volt.test');

            await assert.rejects(
                () => service.joinByCode(joiner.id, code),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInviteCode::NotFound');
                    return true;
                }
            );
        });
    });

    describe('previewJoinByCode', () => {
        it('describes the team and its owner', async () => {
            const fixture = await createFixture();
            const team = await service.generateInviteCode(fixture.team.id, fixture.owner.id);
            const joiner = await createUser('joiner@volt.test');

            const preview = await service.previewJoinByCode(joiner.id, team.inviteCode ?? '');

            assert.deepEqual(preview, {
                message: 'Invite preview loaded',
                teamId: fixture.team.id,
                teamName: 'Team One',
                ownerName: 'ada lovelace',
                isAlreadyMember: false
            });
        });

        it('flags a user that already belongs to the team', async () => {
            const fixture = await createFixture();
            const team = await service.generateInviteCode(fixture.team.id, fixture.owner.id);

            const preview = await service.previewJoinByCode(fixture.owner.id, team.inviteCode ?? '');

            assert.equal(preview.isAlreadyMember, true);
        });

        it('falls back to a generic owner name when the owner has no name', async () => {
            const owner = await User.create({
                email: 'nameless@volt.test',
                firstName: '',
                lastName: ''
            }).save();
            const created = await service.create(owner.id, {
                name: 'Nameless',
                description: 'x'
            });
            const team = await service.generateInviteCode(created.id, owner.id);
            const joiner = await createUser('joiner@volt.test');

            const preview = await service.previewJoinByCode(joiner.id, team.inviteCode ?? '');

            assert.equal(preview.ownerName, 'Team owner');
        });

        it('rejects an unknown code', async () => {
            await assert.rejects(
                () => service.previewJoinByCode('user', 'ZZZZZ'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInviteCode::NotFound');
                    return true;
                }
            );
        });
    });
});
