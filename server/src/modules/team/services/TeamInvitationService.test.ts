import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import ApplicationError from '@shared/application/errors/ApplicationError';
import Team from '@modules/team/models/Team';
import TeamInvitation from '@modules/team/models/TeamInvitation';
import TeamInvitationService from '@modules/team/services/TeamInvitationService';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import User from '@modules/auth/models/User';
import { SystemRoleNames } from '@core/constants/system-roles';
import { TeamInvitationStatus } from '@volt/contracts/modules/team/domain';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface Fixture{
    owner: User;
    guest: User;
    team: Team;
    ownerRole: TeamRole;
    memberRole: TeamRole;
}

const PUBLIC_INVITED_BY_FIELDS = ['_id', 'firstName', 'lastName'];
const PUBLIC_TEAM_FIELDS = ['_id', 'name'];

describe('TeamInvitationService', () => {
    let dataSource: DataSource;
    const service = new TeamInvitationService();
    const published: EmittedEvent[] = [];

    before(async () => {
        dataSource = await createHarness([
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
            password: 'hashed-secret',
            firstName: 'ada',
            lastName: 'lovelace'
        }).save();
        const guest = await User.create({
            email: 'guest@volt.test',
            password: 'hashed-secret',
            firstName: 'grace',
            lastName: 'hopper'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            description: 'private',
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
        await TeamMember.create({
            team: team.id,
            user: owner.id,
            role: ownerRole.id,
            joinedAt: new Date()
        }).save();

        return {
            owner,
            guest,
            team,
            ownerRole,
            memberRole
        };
    };

    const seedInvitation = (
        fixture: Fixture,
        overrides: Partial<TeamInvitation> = {}
    ): Promise<TeamInvitation> => TeamInvitation.create({
        team: fixture.team.id,
        invitedBy: fixture.owner.id,
        invitedUser: fixture.guest.id,
        email: fixture.guest.email,
        token: 'token-guest',
        role: fixture.memberRole.id,
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: null,
        status: TeamInvitationStatus.Pending,
        ...overrides
    }).save();

    describe('send', () => {
        it('creates a pending invitation for the target user', async () => {
            const fixture = await createFixture();

            const invitation = await service.send(fixture.team.id, fixture.owner.id, { email: 'guest@volt.test' });

            assert.equal(invitation.team, fixture.team.id);
            assert.equal(invitation.invitedBy, fixture.owner.id);
            assert.equal(invitation.invitedUser, fixture.guest.id);
            assert.equal(invitation.status, TeamInvitationStatus.Pending);
            assert.equal(invitation.role, fixture.memberRole.id);
            assert.match(invitation.token, /^[0-9a-f]{64}$/);
        });

        it('normalizes the invited email before storing it', async () => {
            const fixture = await createFixture();

            const invitation = await service.send(fixture.team.id, fixture.owner.id, { email: '  GUEST@Volt.TEST ' });

            assert.equal(invitation.email, 'guest@volt.test');
        });

        it('expires the invitation twenty four hours later', async () => {
            const fixture = await createFixture();

            const invitation = await service.send(fixture.team.id, fixture.owner.id, { email: 'guest@volt.test' });

            const hoursAhead = (invitation.expiresAt.getTime() - Date.now()) / (60 * 60 * 1000);
            assert.ok(hoursAhead > 23.9 && hoursAhead <= 24);
        });

        it('honours the requested role', async () => {
            const fixture = await createFixture();
            const auditor = await TeamRole.create({
                team: fixture.team.id,
                name: 'Auditor',
                permissions: ['analysis:read'],
                isSystem: false
            }).save();

            const invitation = await service.send(fixture.team.id, fixture.owner.id, {
                email: 'guest@volt.test',
                roleId: auditor.id
            });

            assert.equal(invitation.role, auditor.id);
        });

        it('emits invitation.sent with the team name', async () => {
            const fixture = await createFixture();

            const invitation = await service.send(fixture.team.id, fixture.owner.id, { email: 'guest@volt.test' });

            assert.deepEqual(published, [{
                name: 'invitation.sent',
                payload: {
                    invitationId: invitation.id,
                    teamName: 'Team One',
                    invitedUserId: fixture.guest.id
                }
            }]);
        });

        it('rejects an unknown team', async () => {
            await createFixture();

            await assert.rejects(
                () => service.send('6a69587bbabeab928d9147ba', 'user', { email: 'guest@volt.test' }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Team::NotFound');
                    return true;
                }
            );
        });

        it('rejects an email without a registered user', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.send(fixture.team.id, fixture.owner.id, { email: 'nobody@volt.test' }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'User::NotFound');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('rejects a user that already belongs to the team', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.send(fixture.team.id, fixture.owner.id, { email: 'owner@volt.test' }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInvitation::UserAlreadyMember');
                    assert.equal(error.message, 'User is already a member of this team');
                    assert.equal(error.statusCode, 400);
                    return true;
                }
            );
        });

        it('rejects a second pending invitation for the same email', async () => {
            const fixture = await createFixture();
            await service.send(fixture.team.id, fixture.owner.id, { email: 'guest@volt.test' });

            await assert.rejects(
                () => service.send(fixture.team.id, fixture.owner.id, { email: 'guest@volt.test' }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInvitation::AlreadySent');
                    assert.equal(error.message, 'Invitation already sent to this email');
                    return true;
                }
            );
        });

        it('allows a new invitation once the previous one was rejected', async () => {
            const fixture = await createFixture();
            const first = await service.send(fixture.team.id, fixture.owner.id, { email: 'guest@volt.test' });
            await service.reject(first.id, fixture.guest.id);

            const second = await service.send(fixture.team.id, fixture.owner.id, { email: 'guest@volt.test' });

            assert.equal(second.status, TeamInvitationStatus.Pending);
            assert.equal(await TeamInvitation.countBy({ team: fixture.team.id }), 2);
        });

        it('rejects an unknown role', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.send(fixture.team.id, fixture.owner.id, {
                    email: 'guest@volt.test',
                    roleId: '6a69587bbabeab928d9147ba'
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamRole::NotFound');
                    assert.equal(error.message, 'Team role not found');
                    return true;
                }
            );
        });
    });

    describe('listByTeamId', () => {
        it('returns only the pending invitations of the team', async () => {
            const fixture = await createFixture();
            await seedInvitation(fixture);
            await seedInvitation(fixture, {
                token: 'token-accepted',
                email: 'accepted@volt.test',
                status: TeamInvitationStatus.Accepted
            });

            const result = await service.listByTeamId(fixture.team.id);

            assert.equal(result.total, 1);
            assert.equal(result.data[0].status, TeamInvitationStatus.Pending);
        });

        it('reports the default limit of ten and the page count', async () => {
            const fixture = await createFixture();
            await seedInvitation(fixture);

            const result = await service.listByTeamId(fixture.team.id);

            assert.equal(result.page, 1);
            assert.equal(result.limit, 10);
            assert.equal(result.totalPages, 1);
        });

        it('caps the limit at five hundred rows', async () => {
            const fixture = await createFixture();

            assert.equal((await service.listByTeamId(fixture.team.id, 1, 900)).limit, 500);
        });

        it('excludes the invitations of the other teams', async () => {
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
            await TeamInvitation.create({
                team: otherTeam.id,
                invitedBy: fixture.owner.id,
                invitedUser: fixture.guest.id,
                email: 'guest@volt.test',
                token: 'token-foreign',
                role: otherRole.id,
                expiresAt: new Date(Date.now() + 60_000),
                acceptedAt: null,
                status: TeamInvitationStatus.Pending
            }).save();
            await seedInvitation(fixture);

            const result = await service.listByTeamId(fixture.team.id);

            assert.equal(result.total, 1);
            assert.equal(result.data[0].team, fixture.team.id);
        });

        it('loads the invited user without leaking the password', async () => {
            const fixture = await createFixture();
            await seedInvitation(fixture);

            const result = await service.listByTeamId(fixture.team.id);
            const wire = JSON.parse(JSON.stringify(result.data[0])) as Record<string, unknown>;
            const invitedUser = wire.invitedUser as Record<string, unknown>;

            assert.equal(invitedUser._id, fixture.guest.id);
            assert.equal('password' in invitedUser, false);
        });
    });

    describe('getByIdPublic', () => {
        it('exposes only the identity of the inviter', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            const result = await service.getByIdPublic(invitation.id);
            const invitedBy = result.invitedBy as Record<string, unknown>;

            assert.deepEqual(Object.keys(invitedBy).sort(), [...PUBLIC_INVITED_BY_FIELDS].sort());
            assert.equal(invitedBy._id, fixture.owner.id);
            assert.equal(invitedBy.firstName, 'ada');
            assert.equal(invitedBy.lastName, 'lovelace');
        });

        it('never leaks the email or the password of the inviter', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            const result = await service.getByIdPublic(invitation.id);
            const invitedBy = result.invitedBy as Record<string, unknown>;

            assert.equal('email' in invitedBy, false);
            assert.equal('password' in invitedBy, false);
            assert.equal('teams' in invitedBy, false);
            assert.equal('role' in invitedBy, false);
        });

        it('exposes only the name of the team', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            const result = await service.getByIdPublic(invitation.id);
            const team = result.team as Record<string, unknown>;

            assert.deepEqual(Object.keys(team).sort(), [...PUBLIC_TEAM_FIELDS].sort());
            assert.equal(team._id, fixture.team.id);
            assert.equal(team.name, 'Team One');
            assert.equal('description' in team, false);
            assert.equal('inviteCode' in team, false);
            assert.equal('owner' in team, false);
        });

        it('reports the invitation identifier as _id', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            const result = await service.getByIdPublic(invitation.id);

            assert.equal(result._id, invitation.id);
            assert.equal('id' in result, false);
        });

        it('rejects an unknown invitation', async () => {
            await assert.rejects(
                () => service.getByIdPublic('6a69587bbabeab928d9147ba'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInvitation::NotFound');
                    assert.equal(error.message, 'TeamInvitation not found');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });
    });

    describe('deleteById', () => {
        it('removes the invitation of the team', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            await service.deleteById(fixture.team.id, invitation.id);

            assert.equal(await TeamInvitation.countBy({ id: invitation.id }), 0);
        });

        it('rejects an invitation that belongs to another team', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            await assert.rejects(
                () => service.deleteById('6a69587bbabeab928d9147ba', invitation.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInvitation::NotFound');
                    return true;
                }
            );
            assert.equal(await TeamInvitation.countBy({ id: invitation.id }), 1);
        });
    });

    describe('updateById', () => {
        it('persists the new status of the invitation', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            const updated = await service.updateById(fixture.team.id, invitation.id, { status: 'rejected' });

            assert.equal(updated.status, TeamInvitationStatus.Rejected);
        });

        it('rejects an invitation outside the team scope', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            await assert.rejects(
                () => service.updateById('6a69587bbabeab928d9147ba', invitation.id, { email: 'other@volt.test' }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInvitation::NotFound');
                    return true;
                }
            );
        });
    });

    describe('accept', () => {
        it('enrols the invited user, links the team and stamps the acceptance', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            const result = await service.accept(invitation.id, fixture.guest.id);

            assert.deepEqual(result, { message: 'Invitation accepted successfully' });
            assert.equal(await TeamMember.countBy({
                team: fixture.team.id,
                user: fixture.guest.id
            }), 1);
            assert.deepEqual((await User.findOneByOrFail({ id: fixture.guest.id })).teams, [fixture.team.id]);
            const reloaded = await TeamInvitation.findOneByOrFail({ id: invitation.id });
            assert.equal(reloaded.status, TeamInvitationStatus.Accepted);
            assert.ok(reloaded.acceptedAt instanceof Date);
        });

        it('grants full Owner permissions to the invited user instead of the invited role', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            await service.accept(invitation.id, fixture.guest.id);

            const membership = await TeamMember.findOneByOrFail({
                team: fixture.team.id,
                user: fixture.guest.id
            });
            assert.equal(membership.role, fixture.ownerRole.id);
            assert.notEqual(membership.role, invitation.role);
        });

        it('rejects an invitation that was already processed', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture, { status: TeamInvitationStatus.Accepted });

            await assert.rejects(
                () => service.accept(invitation.id, fixture.guest.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInvitation::AlreadyProcessed');
                    assert.equal(error.message, 'Invitation has already been processed');
                    return true;
                }
            );
        });

        it('rejects an expired invitation', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture, { expiresAt: new Date(Date.now() - 60_000) });

            await assert.rejects(
                () => service.accept(invitation.id, fixture.guest.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInvitation::Expired');
                    assert.equal(error.message, 'Invitation has expired');
                    return true;
                }
            );
            assert.equal(await TeamMember.countBy({ user: fixture.guest.id }), 0);
        });

        it('rejects a user the invitation was not addressed to', async () => {
            const fixture = await createFixture();
            const stranger = await User.create({
                email: 'stranger@volt.test',
                firstName: 'alan'
            }).save();
            const invitation = await seedInvitation(fixture);

            await assert.rejects(
                () => service.accept(invitation.id, stranger.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInvitation::InvalidUser');
                    assert.equal(error.message, 'This invitation was not sent to you');
                    assert.equal(error.statusCode, 403);
                    return true;
                }
            );
        });

        it('rejects an unknown invitation', async () => {
            await assert.rejects(
                () => service.accept('6a69587bbabeab928d9147ba', 'user'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInvitation::NotFound');
                    assert.equal(error.message, 'Invitation not found');
                    return true;
                }
            );
        });

        it('rejects an invitation looked up outside its team scope', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            await assert.rejects(
                () => service.accept(invitation.id, fixture.guest.id, '6a69587bbabeab928d9147ba'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInvitation::NotFound');
                    return true;
                }
            );
        });

        it('rejects the acceptance when the team lost its Owner role', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);
            await TeamMember.delete({ role: fixture.ownerRole.id });
            await TeamRole.delete({ id: fixture.ownerRole.id });

            await assert.rejects(
                () => service.accept(invitation.id, fixture.guest.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamRole::NotFound');
                    assert.equal(error.message, 'Owner role not found');
                    return true;
                }
            );
        });
    });

    describe('reject', () => {
        it('marks the invitation as rejected without enrolling the user', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            const result = await service.reject(invitation.id, fixture.guest.id);

            assert.deepEqual(result, { message: 'Invitation rejected successfully' });
            assert.equal((await TeamInvitation.findOneByOrFail({ id: invitation.id })).status, TeamInvitationStatus.Rejected);
            assert.equal(await TeamMember.countBy({ user: fixture.guest.id }), 0);
        });

        it('accepts the rejection of an expired invitation', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture, { expiresAt: new Date(Date.now() - 60_000) });

            await service.reject(invitation.id, fixture.guest.id);

            assert.equal((await TeamInvitation.findOneByOrFail({ id: invitation.id })).status, TeamInvitationStatus.Rejected);
        });

        it('rejects an invitation that was already processed', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture, { status: TeamInvitationStatus.Rejected });

            await assert.rejects(
                () => service.reject(invitation.id, fixture.guest.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInvitation::AlreadyProcessed');
                    return true;
                }
            );
        });

        it('rejects a user the invitation was not addressed to', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            await assert.rejects(
                () => service.reject(invitation.id, fixture.owner.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamInvitation::InvalidUser');
                    return true;
                }
            );
        });
    });

    describe('updateStatus', () => {
        it('routes an accepted status to the acceptance flow', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            const result = await service.updateStatus(invitation.id, fixture.guest.id, { status: 'accepted' });

            assert.deepEqual(result, { message: 'Invitation accepted successfully' });
            assert.equal(await TeamMember.countBy({ user: fixture.guest.id }), 1);
        });

        it('routes a rejected status to the rejection flow', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            const result = await service.updateStatus(invitation.id, fixture.guest.id, { status: 'rejected' });

            assert.deepEqual(result, { message: 'Invitation rejected successfully' });
            assert.equal((await TeamInvitation.findOneByOrFail({ id: invitation.id })).status, TeamInvitationStatus.Rejected);
        });

        it('rejects any other status', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture);

            await assert.rejects(
                () => service.updateStatus(invitation.id, fixture.guest.id, { status: 'pending' } as never),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Validation::InvalidInput');
                    assert.equal(error.message, 'Invalid status. Must be "accepted" or "rejected".');
                    assert.equal(error.statusCode, 400);
                    return true;
                }
            );
        });
    });
});
