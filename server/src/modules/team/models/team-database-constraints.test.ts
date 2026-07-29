import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import SecretKey from '@modules/team/models/SecretKey';
import SecretKeyUsageLog from '@modules/team/models/SecretKeyUsageLog';
import Team from '@modules/team/models/Team';
import TeamAIIntegration from '@modules/team/models/TeamAIIntegration';
import TeamInvitation from '@modules/team/models/TeamInvitation';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import User from '@modules/auth/models/User';
import { TeamInvitationStatus } from '@volt/contracts/modules/team/domain';
import { AIProvider } from '@shared/contracts/types/AIProviders';

const FIRST_MEMBER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const SECOND_MEMBER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';

interface Fixture{
    owner: User;
    member: User;
    team: Team;
    ownerRole: TeamRole;
    memberRole: TeamRole;
}

const constraintCodeOf = (error: unknown): string | undefined => (error as { code?: string }).code;

describe('team database constraints', () => {
    let dataSource: DataSource;

    before(async () => {
        dataSource = await createHarness([
            SecretKey,
            SecretKeyUsageLog,
            Team,
            TeamAIIntegration,
            TeamInvitation,
            TeamMember,
            TeamRole,
            User
        ]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createUser = (email: string): Promise<User> => User.create({
        email,
        firstName: 'ada'
    }).save();

    const createFixture = async (): Promise<Fixture> => {
        const owner = await createUser('owner@volt.test');
        const member = await createUser('member@volt.test');
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const ownerRole = await TeamRole.create({
            team: team.id,
            name: 'Owner',
            permissions: ['*'],
            isSystem: true
        }).save();
        const memberRole = await TeamRole.create({
            team: team.id,
            name: 'Member',
            permissions: ['team:read'],
            isSystem: true
        }).save();

        return {
            owner,
            member,
            team,
            ownerRole,
            memberRole
        };
    };

    const seedSecretKey = (fixture: Fixture, roleId: string, name: string): Promise<SecretKey> => SecretKey.create({
        team: fixture.team.id,
        role: roleId,
        name,
        keyPrefix: `vsk_${name}`,
        keyHash: `hash-${name}`,
        createdBy: fixture.owner.id,
        isActive: true
    }).save();

    const seedInvitation = (
        fixture: Fixture,
        roleId: string,
        token: string,
        invitedUser: string | null = null,
        invitedBy: string = fixture.owner.id
    ): Promise<TeamInvitation> => TeamInvitation.create({
        team: fixture.team.id,
        invitedBy,
        invitedUser,
        email: `${token}@volt.test`,
        token,
        role: roleId,
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: null,
        status: TeamInvitationStatus.Pending
    }).save();

    describe('team member uniqueness', () => {
        it('keeps a single membership row when two concurrent enrolments race for the same team and user', async () => {
            const fixture = await createFixture();

            const results = await Promise.allSettled([
                TeamMember.insert({
                    id: FIRST_MEMBER_ID,
                    team: fixture.team.id,
                    user: fixture.member.id,
                    role: fixture.memberRole.id,
                    joinedAt: new Date()
                }),
                TeamMember.insert({
                    id: SECOND_MEMBER_ID,
                    team: fixture.team.id,
                    user: fixture.member.id,
                    role: fixture.memberRole.id,
                    joinedAt: new Date()
                })
            ]);

            assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
            assert.equal(await TeamMember.countBy({
                team: fixture.team.id,
                user: fixture.member.id
            }), 1);
        });

        it('rejects the losing concurrent enrolment with a unique constraint violation', async () => {
            const fixture = await createFixture();

            const results = await Promise.allSettled([
                TeamMember.insert({
                    id: FIRST_MEMBER_ID,
                    team: fixture.team.id,
                    user: fixture.member.id,
                    role: fixture.memberRole.id,
                    joinedAt: new Date()
                }),
                TeamMember.insert({
                    id: SECOND_MEMBER_ID,
                    team: fixture.team.id,
                    user: fixture.member.id,
                    role: fixture.memberRole.id,
                    joinedAt: new Date()
                })
            ]);

            const rejected = results.filter((result) => result.status === 'rejected');
            assert.equal(rejected.length, 1);
            assert.equal(constraintCodeOf((rejected[0] as PromiseRejectedResult).reason), 'SQLITE_CONSTRAINT_UNIQUE');
        });

        it('rejects a second membership for the same team and user even with a different role', async () => {
            const fixture = await createFixture();
            await TeamMember.create({
                team: fixture.team.id,
                user: fixture.member.id,
                role: fixture.memberRole.id,
                joinedAt: new Date()
            }).save();

            await assert.rejects(() => TeamMember.create({
                team: fixture.team.id,
                user: fixture.member.id,
                role: fixture.ownerRole.id,
                joinedAt: new Date()
            }).save());
        });

        it('allows the same user to be a member of two different teams', async () => {
            const fixture = await createFixture();
            const otherTeam = await Team.create({
                name: 'Team Two',
                owner: fixture.owner.id
            }).save();
            const otherRole = await TeamRole.create({
                team: otherTeam.id,
                name: 'Member',
                permissions: [],
                isSystem: true
            }).save();

            await TeamMember.create({
                team: fixture.team.id,
                user: fixture.member.id,
                role: fixture.memberRole.id,
                joinedAt: new Date()
            }).save();
            await TeamMember.create({
                team: otherTeam.id,
                user: fixture.member.id,
                role: otherRole.id,
                joinedAt: new Date()
            }).save();

            assert.equal(await TeamMember.countBy({ user: fixture.member.id }), 2);
        });
    });

    describe('team role foreign key cascades', () => {
        it('deletes the secret keys that referenced the removed role', async () => {
            const fixture = await createFixture();
            const doomed = await seedSecretKey(fixture, fixture.memberRole.id, 'doomed');
            const survivor = await seedSecretKey(fixture, fixture.ownerRole.id, 'survivor');

            await fixture.memberRole.remove();

            assert.equal(await SecretKey.countBy({ id: doomed.id }), 0);
            assert.equal(await SecretKey.countBy({ id: survivor.id }), 1);
        });

        it('deletes the invitations that referenced the removed role', async () => {
            const fixture = await createFixture();
            const doomed = await seedInvitation(fixture, fixture.memberRole.id, 'doomed');
            const survivor = await seedInvitation(fixture, fixture.ownerRole.id, 'survivor');

            await fixture.memberRole.remove();

            assert.equal(await TeamInvitation.countBy({ id: doomed.id }), 0);
            assert.equal(await TeamInvitation.countBy({ id: survivor.id }), 1);
        });

        it('deletes the memberships that referenced the removed role', async () => {
            const fixture = await createFixture();
            const membership = await TeamMember.create({
                team: fixture.team.id,
                user: fixture.member.id,
                role: fixture.memberRole.id,
                joinedAt: new Date()
            }).save();

            await fixture.memberRole.remove();

            assert.equal(await TeamMember.countBy({ id: membership.id }), 0);
        });

        it('deletes the usage logs of the secret keys removed through the role cascade', async () => {
            const fixture = await createFixture();
            const key = await seedSecretKey(fixture, fixture.memberRole.id, 'doomed');
            const log = await SecretKeyUsageLog.create({
                team: fixture.team.id,
                secretKey: key.id,
                method: 'GET',
                path: '/api/v1/trajectories',
                statusCode: 200,
                responseTime: 12
            }).save();

            await fixture.memberRole.remove();

            assert.equal(await SecretKeyUsageLog.countBy({ id: log.id }), 0);
        });
    });

    describe('team foreign key cascades', () => {
        it('removes every team scoped row when the team is deleted', async () => {
            const fixture = await createFixture();
            await TeamMember.create({
                team: fixture.team.id,
                user: fixture.member.id,
                role: fixture.memberRole.id,
                joinedAt: new Date()
            }).save();
            const key = await seedSecretKey(fixture, fixture.memberRole.id, 'key');
            await SecretKeyUsageLog.create({
                team: fixture.team.id,
                secretKey: key.id,
                method: 'GET',
                path: '/api/v1/teams',
                statusCode: 200,
                responseTime: 5
            }).save();
            await seedInvitation(fixture, fixture.memberRole.id, 'invite');
            await TeamAIIntegration.create({
                team: fixture.team.id,
                provider: AIProvider.OpenAI,
                encryptedApiKey: 'cipher',
                isEnabled: true,
                defaultModel: 'gpt-5',
                enabledModels: [],
                metadata: {},
                createdBy: fixture.owner.id
            }).save();

            await fixture.team.remove();

            assert.equal(await TeamRole.count(), 0);
            assert.equal(await TeamMember.count(), 0);
            assert.equal(await TeamInvitation.count(), 0);
            assert.equal(await SecretKey.count(), 0);
            assert.equal(await SecretKeyUsageLog.count(), 0);
            assert.equal(await TeamAIIntegration.count(), 0);
        });
    });

    describe('user foreign key cascades', () => {
        it('clears the invited user of an invitation whose recipient was deleted', async () => {
            const fixture = await createFixture();
            const invitation = await seedInvitation(fixture, fixture.memberRole.id, 'invite', fixture.member.id);

            await fixture.member.remove();

            const reloaded = await TeamInvitation.findOneBy({ id: invitation.id });
            assert.equal(reloaded?.invitedUser, null);
        });

        it('deletes the invitations sent by a user that was deleted', async () => {
            const fixture = await createFixture();
            const inviter = await createUser('inviter@volt.test');
            const invitation = await seedInvitation(fixture, fixture.memberRole.id, 'invite', fixture.member.id, inviter.id);

            await inviter.remove();

            assert.equal(await TeamInvitation.countBy({ id: invitation.id }), 0);
            assert.equal(await Team.countBy({ id: fixture.team.id }), 1);
        });
    });
});
