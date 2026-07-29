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
import TeamMembershipService from '@modules/team/services/team/TeamMembershipService';
import TeamRole from '@modules/team/models/TeamRole';
import User from '@modules/auth/models/User';
import { SystemRoleNames } from '@core/constants/system-roles';

interface EmittedEvent{
    name: string;
    payload: unknown;
    teamsAtEmit: number;
}

interface Fixture{
    owner: User;
    team: Team;
    ownerRole: TeamRole;
    memberRole: TeamRole;
    ownerMembership: TeamMember;
}

describe('TeamMembershipService', () => {
    let dataSource: DataSource;
    const service = new TeamMembershipService();
    const published: EmittedEvent[] = [];

    before(async () => {
        dataSource = await createHarness([Team, TeamMember, TeamRole, User]);

        eventBus.emit = (async (name: string, payload: unknown) => {
            published.push({
                name,
                payload,
                teamsAtEmit: await Team.count()
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
        firstName: 'ada'
    }).save();

    const createFixture = async (): Promise<Fixture> => {
        const owner = await createUser('owner@volt.test');
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

    const createOtherFixture = async (): Promise<Fixture> => {
        const owner = await createUser('owner-two@volt.test');
        const team = await Team.create({
            name: 'Team Two',
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
            permissions: [],
            isSystem: true
        }).save();
        const ownerMembership = await TeamMember.create({
            team: team.id,
            user: owner.id,
            role: ownerRole.id,
            joinedAt: new Date()
        }).save();

        return {
            owner,
            team,
            ownerRole,
            memberRole,
            ownerMembership
        };
    };

    const enrol = async (fixture: Fixture, email: string, roleId: string): Promise<{ user: User; membership: TeamMember }> => {
        const user = await createUser(email);
        const membership = await TeamMember.create({
            team: fixture.team.id,
            user: user.id,
            role: roleId,
            joinedAt: new Date()
        }).save();
        await User.update({ id: user.id }, { teams: [fixture.team.id] });

        return {
            user,
            membership
        };
    };

    describe('addMemberToTeam', () => {
        it('creates the membership with the requested role and links the team to the user', async () => {
            const fixture = await createFixture();
            const joiner = await createUser('joiner@volt.test');

            await service.addMemberToTeam(joiner.id, fixture.team.id, SystemRoleNames.MEMBER);

            const membership = await TeamMember.findOneByOrFail({
                team: fixture.team.id,
                user: joiner.id
            });
            assert.equal(membership.role, fixture.memberRole.id);
            assert.deepEqual((await User.findOneByOrFail({ id: joiner.id })).teams, [fixture.team.id]);
        });

        it('defaults to the Member role', async () => {
            const fixture = await createFixture();
            const joiner = await createUser('joiner@volt.test');

            await service.addMemberToTeam(joiner.id, fixture.team.id);

            const membership = await TeamMember.findOneByOrFail({
                team: fixture.team.id,
                user: joiner.id
            });
            assert.equal(membership.role, fixture.memberRole.id);
        });

        it('ignores a user that is already a member instead of duplicating the row', async () => {
            const fixture = await createFixture();
            const joiner = await createUser('joiner@volt.test');
            await service.addMemberToTeam(joiner.id, fixture.team.id, SystemRoleNames.MEMBER);

            await service.addMemberToTeam(joiner.id, fixture.team.id, SystemRoleNames.OWNER);

            assert.equal(await TeamMember.countBy({
                team: fixture.team.id,
                user: joiner.id
            }), 1);
            const membership = await TeamMember.findOneByOrFail({
                team: fixture.team.id,
                user: joiner.id
            });
            assert.equal(membership.role, fixture.memberRole.id);
        });

        it('rejects a role name the team does not define', async () => {
            const fixture = await createFixture();
            const joiner = await createUser('joiner@volt.test');

            await assert.rejects(
                () => service.addMemberToTeam(joiner.id, fixture.team.id, 'Auditor'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamRole::NotFound');
                    assert.equal(error.message, 'Role not found');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('resolves the role name within the target team', async () => {
            const fixture = await createFixture();
            const other = await createOtherFixture();
            const joiner = await createUser('joiner@volt.test');

            await service.addMemberToTeam(joiner.id, other.team.id, SystemRoleNames.MEMBER);

            const membership = await TeamMember.findOneByOrFail({
                team: other.team.id,
                user: joiner.id
            });
            assert.equal(membership.role, other.memberRole.id);
            assert.notEqual(membership.role, fixture.memberRole.id);
        });
    });

    describe('removeMemberFromTeam', () => {
        it('removes the membership row and the user link', async () => {
            const fixture = await createFixture();
            const { user, membership } = await enrol(fixture, 'member@volt.test', fixture.memberRole.id);

            await service.removeMemberFromTeam(membership.id, fixture.team.id);

            assert.equal(await TeamMember.countBy({ id: membership.id }), 0);
            assert.deepEqual((await User.findOneByOrFail({ id: user.id })).teams, []);
        });

        it('promotes a remaining member to Owner when the last owner leaves', async () => {
            const fixture = await createFixture();
            const { membership } = await enrol(fixture, 'member@volt.test', fixture.memberRole.id);

            await service.removeMemberFromTeam(fixture.ownerMembership.id, fixture.team.id);

            const survivor = await TeamMember.findOneByOrFail({ id: membership.id });
            assert.equal(survivor.role, fixture.ownerRole.id);
            assert.equal(await TeamMember.countBy({
                team: fixture.team.id,
                role: fixture.ownerRole.id
            }), 1);
        });

        it('never leaves the team without an owner', async () => {
            const fixture = await createFixture();
            await enrol(fixture, 'first@volt.test', fixture.memberRole.id);
            await enrol(fixture, 'second@volt.test', fixture.memberRole.id);

            await service.removeMemberFromTeam(fixture.ownerMembership.id, fixture.team.id);

            assert.equal(await TeamMember.countBy({
                team: fixture.team.id,
                role: fixture.ownerRole.id
            }), 1);
        });

        it('never leaves the team with two owners', async () => {
            const fixture = await createFixture();
            const second = await enrol(fixture, 'second-owner@volt.test', fixture.ownerRole.id);
            await enrol(fixture, 'member@volt.test', fixture.memberRole.id);

            await service.removeMemberFromTeam(second.membership.id, fixture.team.id);

            assert.equal(await TeamMember.countBy({
                team: fixture.team.id,
                role: fixture.ownerRole.id
            }), 1);
        });

        it('keeps the existing owner instead of promoting anybody when a plain member leaves', async () => {
            const fixture = await createFixture();
            const { membership } = await enrol(fixture, 'member@volt.test', fixture.memberRole.id);
            const survivor = await enrol(fixture, 'survivor@volt.test', fixture.memberRole.id);

            await service.removeMemberFromTeam(membership.id, fixture.team.id);

            assert.equal((await TeamMember.findOneByOrFail({ id: survivor.membership.id })).role, fixture.memberRole.id);
            assert.equal((await TeamMember.findOneByOrFail({ id: fixture.ownerMembership.id })).role, fixture.ownerRole.id);
        });

        it('deletes the team once its last member is removed', async () => {
            const fixture = await createFixture();

            await service.removeMemberFromTeam(fixture.ownerMembership.id, fixture.team.id);

            assert.equal(await Team.countBy({ id: fixture.team.id }), 0);
        });

        it('emits team.deleted only after the transaction committed the team removal', async () => {
            const fixture = await createFixture();

            await service.removeMemberFromTeam(fixture.ownerMembership.id, fixture.team.id);

            assert.equal(published.length, 1);
            assert.equal(published[0].name, 'team.deleted');
            assert.deepEqual(published[0].payload, { teamId: fixture.team.id });
            assert.equal(published[0].teamsAtEmit, 0);
        });

        it('does not emit team.deleted when the team survives', async () => {
            const fixture = await createFixture();
            const { membership } = await enrol(fixture, 'member@volt.test', fixture.memberRole.id);

            await service.removeMemberFromTeam(membership.id, fixture.team.id);

            assert.deepEqual(published, []);
        });

        it('keeps the other teams of the leaving user linked', async () => {
            const fixture = await createFixture();
            const other = await createOtherFixture();
            const { user, membership } = await enrol(fixture, 'member@volt.test', fixture.memberRole.id);
            await User.update({ id: user.id }, { teams: [fixture.team.id, other.team.id] });

            await service.removeMemberFromTeam(membership.id, fixture.team.id);

            assert.deepEqual((await User.findOneByOrFail({ id: user.id })).teams, [other.team.id]);
        });

        it('ignores an unknown membership without deleting the team', async () => {
            const fixture = await createFixture();

            await service.removeMemberFromTeam('6a69587bbabeab928d9147ba', fixture.team.id);

            assert.equal(await Team.countBy({ id: fixture.team.id }), 1);
            assert.equal(await TeamMember.countBy({ team: fixture.team.id }), 1);
            assert.deepEqual(published, []);
        });

        it('ignores a removal aimed at a team that no longer exists', async () => {
            const fixture = await createFixture();
            const { membership } = await enrol(fixture, 'member@volt.test', fixture.memberRole.id);
            await Team.delete({ id: fixture.team.id });

            await service.removeMemberFromTeam(membership.id, fixture.team.id);

            assert.deepEqual(published, []);
        });

        it('ignores the promotion when the team has no system Owner role', async () => {
            const fixture = await createFixture();
            const { membership } = await enrol(fixture, 'member@volt.test', fixture.memberRole.id);
            await TeamMember.update({ id: fixture.ownerMembership.id }, { role: fixture.memberRole.id });
            await TeamRole.delete({ id: fixture.ownerRole.id });

            await service.removeMemberFromTeam(membership.id, fixture.team.id);

            assert.equal(await Team.countBy({ id: fixture.team.id }), 1);
            assert.deepEqual(published, []);
        });
    });
});
