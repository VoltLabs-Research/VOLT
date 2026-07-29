import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import SecretKey from '@modules/team/models/SecretKey';
import SecretKeyUsageLog from '@modules/team/models/SecretKeyUsageLog';
import Team from '@modules/team/models/Team';
import TeamAIIntegration from '@modules/team/models/TeamAIIntegration';
import TeamEvents from '@modules/team/events/TeamEvents';
import TeamInvitation from '@modules/team/models/TeamInvitation';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import User from '@modules/auth/models/User';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { AIProvider } from '@shared/contracts/types/AIProviders';
import { TeamInvitationStatus } from '@volt/contracts/modules/team/domain';

interface Fixture{
    owner: User;
    member: User;
    team: Team;
    role: TeamRole;
    secretKey: SecretKey;
    membership: TeamMember;
    invitation: TeamInvitation;
    integration: TeamAIIntegration;
    usageLog: SecretKeyUsageLog;
    folder: CatalogFolder;
}

describe('TeamEvents', () => {
    let dataSource: DataSource;
    const events = new TeamEvents();

    before(async () => {
        dataSource = await createHarness([
            CatalogFolder,
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

    const createFixture = async (suffix: string): Promise<Fixture> => {
        const owner = await User.create({
            email: `owner-${suffix}@volt.test`,
            firstName: 'ada'
        }).save();
        const member = await User.create({
            email: `member-${suffix}@volt.test`,
            firstName: 'grace'
        }).save();
        const team = await Team.create({
            name: `team-${suffix}`,
            owner: owner.id
        }).save();
        const role = await TeamRole.create({
            team: team.id,
            name: 'Owner',
            permissions: ['*'],
            isSystem: true
        }).save();
        const secretKey = await SecretKey.create({
            team: team.id,
            role: role.id,
            name: `key-${suffix}`,
            keyPrefix: `vsk_${suffix}`,
            keyHash: `hash-${suffix}`,
            createdBy: owner.id,
            isActive: true
        }).save();

        return {
            owner,
            member,
            team,
            role,
            secretKey,
            membership: await TeamMember.create({
                team: team.id,
                user: member.id,
                role: role.id,
                joinedAt: new Date()
            }).save(),
            invitation: await TeamInvitation.create({
                team: team.id,
                invitedBy: owner.id,
                invitedUser: null,
                email: `guest-${suffix}@volt.test`,
                token: `token-${suffix}`,
                role: role.id,
                expiresAt: new Date(Date.now() + 60_000),
                acceptedAt: null,
                status: TeamInvitationStatus.Pending
            }).save(),
            integration: await TeamAIIntegration.create({
                team: team.id,
                provider: AIProvider.OpenAI,
                encryptedApiKey: 'cipher',
                isEnabled: true,
                defaultModel: 'gpt-5',
                enabledModels: [],
                metadata: {},
                createdBy: owner.id
            }).save(),
            usageLog: await SecretKeyUsageLog.create({
                team: team.id,
                secretKey: secretKey.id,
                method: 'GET',
                path: '/api/v1/teams',
                statusCode: 200,
                responseTime: 12
            }).save(),
            folder: await CatalogFolder.create({
                team: team.id,
                createdBy: owner.id,
                title: `folder-${suffix}`,
                parent: null,
                kind: CatalogFolderKind.Trajectory
            }).save()
        };
    };

    describe('deleteTeamScopedRecords', () => {
        it('removes every team scoped record of the deleted team', async () => {
            const fixture = await createFixture('one');

            await events.deleteTeamScopedRecords({ teamId: fixture.team.id });

            assert.equal(await SecretKeyUsageLog.countBy({ id: fixture.usageLog.id }), 0);
            assert.equal(await SecretKey.countBy({ id: fixture.secretKey.id }), 0);
            assert.equal(await TeamInvitation.countBy({ id: fixture.invitation.id }), 0);
            assert.equal(await TeamMember.countBy({ id: fixture.membership.id }), 0);
            assert.equal(await TeamAIIntegration.countBy({ id: fixture.integration.id }), 0);
            assert.equal(await TeamRole.countBy({ id: fixture.role.id }), 0);
        });

        it('keeps the records of the other teams', async () => {
            const fixture = await createFixture('one');
            const other = await createFixture('two');

            await events.deleteTeamScopedRecords({ teamId: fixture.team.id });

            assert.equal(await SecretKeyUsageLog.countBy({ id: other.usageLog.id }), 1);
            assert.equal(await SecretKey.countBy({ id: other.secretKey.id }), 1);
            assert.equal(await TeamInvitation.countBy({ id: other.invitation.id }), 1);
            assert.equal(await TeamMember.countBy({ id: other.membership.id }), 1);
            assert.equal(await TeamAIIntegration.countBy({ id: other.integration.id }), 1);
            assert.equal(await TeamRole.countBy({ id: other.role.id }), 1);
        });

        it('leaves the catalog folders to the dedicated handler', async () => {
            const fixture = await createFixture('one');

            await events.deleteTeamScopedRecords({ teamId: fixture.team.id });

            assert.equal(await CatalogFolder.countBy({ id: fixture.folder.id }), 1);
        });

        it('resolves for a team without scoped records', async () => {
            const owner = await User.create({
                email: 'empty@volt.test',
                firstName: 'ada'
            }).save();
            const team = await Team.create({
                name: 'empty',
                owner: owner.id
            }).save();

            await events.deleteTeamScopedRecords({ teamId: team.id });

            assert.equal(await Team.countBy({ id: team.id }), 1);
        });
    });

    describe('deleteCatalogFolders', () => {
        it('removes the catalog folders of the deleted team only', async () => {
            const fixture = await createFixture('one');
            const other = await createFixture('two');

            await events.deleteCatalogFolders({ teamId: fixture.team.id });

            assert.equal(await CatalogFolder.countBy({ id: fixture.folder.id }), 0);
            assert.equal(await CatalogFolder.countBy({ id: other.folder.id }), 1);
        });
    });

    describe('deleteMemberships', () => {
        it('removes every membership of the deleted user', async () => {
            const fixture = await createFixture('one');
            const other = await createFixture('two');
            const shared = await TeamMember.create({
                team: other.team.id,
                user: fixture.member.id,
                role: other.role.id,
                joinedAt: new Date()
            }).save();

            await events.deleteMemberships({ userId: fixture.member.id });

            assert.equal(await TeamMember.countBy({ id: fixture.membership.id }), 0);
            assert.equal(await TeamMember.countBy({ id: shared.id }), 0);
        });

        it('keeps the memberships of the other users', async () => {
            const fixture = await createFixture('one');
            const other = await createFixture('two');

            await events.deleteMemberships({ userId: fixture.member.id });

            assert.equal(await TeamMember.countBy({ id: other.membership.id }), 1);
        });

        it('leaves the team of the deleted user in place', async () => {
            const fixture = await createFixture('one');

            await events.deleteMemberships({ userId: fixture.member.id });

            assert.equal(await Team.countBy({ id: fixture.team.id }), 1);
        });
    });
});
