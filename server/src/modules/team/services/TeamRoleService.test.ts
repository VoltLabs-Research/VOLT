import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import ApplicationError from '@shared/application/errors/ApplicationError';
import SecretKey from '@modules/team/models/SecretKey';
import Team from '@modules/team/models/Team';
import TeamInvitation from '@modules/team/models/TeamInvitation';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import TeamRoleService from '@modules/team/services/TeamRoleService';
import User from '@modules/auth/models/User';
import { SystemRoleNames } from '@core/constants/system-roles';
import { TeamInvitationStatus } from '@volt/contracts/modules/team/domain';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface Fixture{
    owner: User;
    team: Team;
    ownerRole: TeamRole;
    memberRole: TeamRole;
    customRole: TeamRole;
}

describe('TeamRoleService', () => {
    let dataSource: DataSource;
    const service = new TeamRoleService();
    const published: EmittedEvent[] = [];

    before(async () => {
        dataSource = await createHarness([
            SecretKey,
            Team,
            TeamInvitation,
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
            permissions: ['*'],
            isSystem: true
        }).save();
        const memberRole = await TeamRole.create({
            team: team.id,
            name: SystemRoleNames.MEMBER,
            permissions: ['team:read'],
            isSystem: true
        }).save();
        const customRole = await TeamRole.create({
            team: team.id,
            name: 'Reviewer',
            permissions: ['analysis:read'],
            isSystem: false
        }).save();

        return {
            owner,
            team,
            ownerRole,
            memberRole,
            customRole
        };
    };

    describe('listByTeamId', () => {
        it('returns the roles of the team with the pagination envelope', async () => {
            const fixture = await createFixture();

            const result = await service.listByTeamId(fixture.team.id);

            assert.equal(result.total, 3);
            assert.equal(result.page, 1);
            assert.equal(result.limit, 10);
            assert.equal(result.totalPages, 1);
            assert.deepEqual(result.data.map((role) => role.name).sort(), ['Member', 'Owner', 'Reviewer']);
        });

        it('excludes the roles of the other teams', async () => {
            const fixture = await createFixture();
            const otherTeam = await Team.create({
                name: 'Team Two',
                owner: fixture.owner.id
            }).save();
            await TeamRole.create({
                team: otherTeam.id,
                name: 'Foreign',
                permissions: [],
                isSystem: false
            }).save();

            const result = await service.listByTeamId(fixture.team.id);

            assert.equal(result.total, 3);
        });

        it('slices the requested page and reports the page count', async () => {
            const fixture = await createFixture();

            const result = await service.listByTeamId(fixture.team.id, 2, 2);

            assert.equal(result.data.length, 1);
            assert.equal(result.page, 2);
            assert.equal(result.limit, 2);
            assert.equal(result.totalPages, 2);
        });

        it('falls back to the default limit of ten for an invalid limit', async () => {
            const fixture = await createFixture();

            assert.equal((await service.listByTeamId(fixture.team.id, 1, 0)).limit, 10);
            assert.equal((await service.listByTeamId(fixture.team.id, 1, -5)).limit, 10);
        });

        it('caps the limit at five hundred rows', async () => {
            const fixture = await createFixture();

            assert.equal((await service.listByTeamId(fixture.team.id, 1, 100_000)).limit, 500);
        });

        it('falls back to the first page for an invalid page', async () => {
            const fixture = await createFixture();

            assert.equal((await service.listByTeamId(fixture.team.id, 0, 10)).page, 1);
            assert.equal((await service.listByTeamId(fixture.team.id, -3, 10)).page, 1);
        });
    });

    describe('getById', () => {
        it('returns the requested role', async () => {
            const fixture = await createFixture();

            assert.equal((await service.getById(fixture.customRole.id)).name, 'Reviewer');
        });

        it('rejects an unknown role', async () => {
            await assert.rejects(
                () => service.getById('6a69587bbabeab928d9147ba'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamRole::NotFound');
                    assert.equal(error.message, 'TeamRole not found');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });
    });

    describe('create', () => {
        it('persists the role and emits team-role.created', async () => {
            const fixture = await createFixture();

            const role = await service.create(fixture.team.id, fixture.owner.id, {
                name: 'Auditor',
                permissions: ['analysis:read', 'trajectory:read']
            });

            assert.equal(role.team, fixture.team.id);
            assert.equal(role.isSystem, false);
            assert.deepEqual(role.permissions, ['analysis:read', 'trajectory:read']);
            assert.deepEqual(published, [{
                name: 'team-role.created',
                payload: {
                    teamRoleId: role.id,
                    teamId: fixture.team.id,
                    name: 'Auditor',
                    userId: fixture.owner.id
                }
            }]);
        });

        it('deduplicates the permission list', async () => {
            const fixture = await createFixture();

            const role = await service.create(fixture.team.id, fixture.owner.id, {
                name: 'Auditor',
                permissions: ['analysis:read', 'analysis:read', 'trajectory:read']
            });

            assert.deepEqual(role.permissions, ['analysis:read', 'trajectory:read']);
        });

        it('defaults to an empty permission list', async () => {
            const fixture = await createFixture();

            const role = await service.create(fixture.team.id, fixture.owner.id, { name: 'Auditor' });

            assert.deepEqual((await TeamRole.findOneByOrFail({ id: role.id })).permissions, []);
        });

        it('round trips the permission array through the simple-array column', async () => {
            const fixture = await createFixture();

            const role = await service.create(fixture.team.id, fixture.owner.id, {
                name: 'Auditor',
                permissions: ['analysis:read', 'trajectory:read', 'plugin:create']
            });

            assert.deepEqual(
                (await TeamRole.findOneByOrFail({ id: role.id })).permissions,
                ['analysis:read', 'trajectory:read', 'plugin:create']
            );
        });

        it('rejects a role name already taken inside the team', async () => {
            const fixture = await createFixture();

            await assert.rejects(() => service.create(fixture.team.id, fixture.owner.id, { name: 'Reviewer' }));
        });
    });

    describe('updateById', () => {
        it('renames a custom role and emits team-role.updated', async () => {
            const fixture = await createFixture();

            const role = await service.updateById(fixture.customRole.id, {
                name: 'Auditor',
                permissions: ['analysis:read']
            });

            assert.equal(role.name, 'Auditor');
            assert.deepEqual(published, [{
                name: 'team-role.updated',
                payload: {
                    teamRoleId: fixture.customRole.id,
                    teamId: fixture.team.id,
                    name: 'Auditor',
                    permissions: ['analysis:read']
                }
            }]);
        });

        it('updates the permissions of a system role but keeps its name', async () => {
            const fixture = await createFixture();

            const role = await service.updateById(fixture.memberRole.id, { permissions: ['team:read', 'analysis:read'] });

            assert.equal(role.name, SystemRoleNames.MEMBER);
            assert.deepEqual(role.permissions, ['team:read', 'analysis:read']);
        });

        it('rejects renaming a system role', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.updateById(fixture.memberRole.id, { name: 'Contributor' }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamRole::IsSystem');
                    assert.equal(error.message, 'Cannot rename system roles');
                    assert.equal(error.statusCode, 403);
                    return true;
                }
            );
        });

        it('accepts a no-op rename of a system role to its own name', async () => {
            const fixture = await createFixture();

            const role = await service.updateById(fixture.memberRole.id, { name: SystemRoleNames.MEMBER });

            assert.equal(role.name, SystemRoleNames.MEMBER);
        });

        it('rejects an unknown role', async () => {
            await assert.rejects(
                () => service.updateById('6a69587bbabeab928d9147ba', { name: 'Auditor' }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamRole::NotFound');
                    assert.equal(error.message, 'Team role not found');
                    return true;
                }
            );
        });
    });

    describe('deleteById', () => {
        it('reassigns the members of the deleted role to the Member role', async () => {
            const fixture = await createFixture();
            const member = await User.create({
                email: 'member@volt.test',
                firstName: 'grace'
            }).save();
            const membership = await TeamMember.create({
                team: fixture.team.id,
                user: member.id,
                role: fixture.customRole.id,
                joinedAt: new Date()
            }).save();

            await service.deleteById(fixture.team.id, fixture.customRole.id, fixture.owner.id);

            assert.equal((await TeamMember.findOneByOrFail({ id: membership.id })).role, fixture.memberRole.id);
            assert.equal(await TeamRole.countBy({ id: fixture.customRole.id }), 0);
        });

        it('emits team-role.deleted with the removed role name', async () => {
            const fixture = await createFixture();

            const result = await service.deleteById(fixture.team.id, fixture.customRole.id, fixture.owner.id);

            assert.deepEqual(result, { success: true });
            assert.deepEqual(published, [{
                name: 'team-role.deleted',
                payload: {
                    teamRoleId: fixture.customRole.id,
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    roleName: 'Reviewer'
                }
            }]);
        });

        it('cascades the deletion to the secret keys bound to the role', async () => {
            const fixture = await createFixture();
            const key = await SecretKey.create({
                team: fixture.team.id,
                role: fixture.customRole.id,
                name: 'ci',
                keyPrefix: 'vsk_ci',
                keyHash: 'hash-ci',
                createdBy: fixture.owner.id,
                isActive: true
            }).save();

            await service.deleteById(fixture.team.id, fixture.customRole.id, fixture.owner.id);

            assert.equal(await SecretKey.countBy({ id: key.id }), 0);
        });

        it('cascades the deletion to the invitations bound to the role', async () => {
            const fixture = await createFixture();
            const invitation = await TeamInvitation.create({
                team: fixture.team.id,
                invitedBy: fixture.owner.id,
                invitedUser: null,
                email: 'guest@volt.test',
                token: 'token-guest',
                role: fixture.customRole.id,
                expiresAt: new Date(Date.now() + 60_000),
                acceptedAt: null,
                status: TeamInvitationStatus.Pending
            }).save();

            await service.deleteById(fixture.team.id, fixture.customRole.id, fixture.owner.id);

            assert.equal(await TeamInvitation.countBy({ id: invitation.id }), 0);
        });

        it('rejects deleting a system role', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.deleteById(fixture.team.id, fixture.memberRole.id, fixture.owner.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamRole::IsSystem');
                    assert.equal(error.message, 'Cannot delete system roles');
                    assert.equal(error.statusCode, 403);
                    return true;
                }
            );
        });

        it('rejects an unauthenticated caller', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.deleteById(fixture.team.id, fixture.customRole.id, ''),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Authentication::Required');
                    assert.equal(error.statusCode, 401);
                    return true;
                }
            );
        });

        it('rejects an unknown role', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.deleteById(fixture.team.id, '6a69587bbabeab928d9147ba', fixture.owner.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamRole::NotFound');
                    assert.equal(error.message, 'Team role not found');
                    return true;
                }
            );
        });

        it('rejects the deletion when the team has no Member role to fall back on', async () => {
            const fixture = await createFixture();
            await TeamRole.delete({ id: fixture.memberRole.id });

            await assert.rejects(
                () => service.deleteById(fixture.team.id, fixture.customRole.id, fixture.owner.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamRole::NotFound');
                    assert.equal(error.message, 'Member role not found');
                    return true;
                }
            );
            assert.equal(await TeamRole.countBy({ id: fixture.customRole.id }), 1);
        });
    });
});
