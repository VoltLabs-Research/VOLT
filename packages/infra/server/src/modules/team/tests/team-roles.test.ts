import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase } from '@core/bootstrap/connect-database';
import { ErrorCodes } from '@core/constants/error-codes';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import TeamInvitation from '@modules/team/models/TeamInvitation';
import teamService from '@modules/team/services/TeamService';
import teamMemberService from '@modules/team/services/TeamMemberService';
import teamInvitationService from '@modules/team/services/TeamInvitationService';
import secretKeyService from '@modules/team/services/SecretKeyService';
import ApplicationError from '@shared/errors/ApplicationError';
import { generateEntityId } from '@shared/persistence/entity-id';
import { TeamAccess, TeamArea, TeamRole, canAccessTeamArea } from '@volt/contracts/modules/team/access';

interface Lab {
    teamId: string;
    ownerId: string;
    members: Record<'admin' | 'member' | 'viewer', TeamMember>;
}

const newUser = (name: string) => User.create({
    email: `${name}-${generateEntityId()}@example.test`,
    password: null,
    firstName: name
}).save();

const join = async (teamId: string, role: TeamRole, name: string): Promise<TeamMember> => {
    const user = await newUser(name);
    return TeamMember.create({
 team: teamId, user: user.id, role, joinedAt: new Date() 
}).save();
};

const newLab = async (): Promise<Lab> => {
    const owner = await newUser('owner');
    const team = await teamService.create(owner.id, {
 name: 'Lab', description: '' 
});

    return {
        teamId: team.id,
        ownerId: owner.id,
        members: {
            admin: await join(team.id, TeamRole.Admin, 'admin'),
            member: await join(team.id, TeamRole.Member, 'member'),
            viewer: await join(team.id, TeamRole.Viewer, 'viewer')
        }
    };
};

const refused = (code: string) => (error: unknown): boolean => error instanceof ApplicationError && error.code === code;

describe('fixed team roles', () => {
    before(async () => {
        if (process.env.DATABASE_URL?.startsWith('sqlite:') !== true) {
            throw new Error('Run these tests with DATABASE_URL=sqlite::memory: (pnpm test does).');
        }
        await connectDatabase();
    });

    after(async () => {
        await disconnectDatabase();
    });

    test('each role may do what the roles below it may', () => {
        assert.equal(canAccessTeamArea(TeamRole.Admin, TeamArea.Team, TeamAccess.Read), true);
        assert.equal(canAccessTeamArea(TeamRole.Admin, TeamArea.Team, TeamAccess.Write), false);
        assert.equal(canAccessTeamArea(TeamRole.Member, TeamArea.Plugin, TeamAccess.Write), true);
        assert.equal(canAccessTeamArea(TeamRole.Viewer, TeamArea.Trajectory, TeamAccess.Read), true);
        assert.equal(canAccessTeamArea(TeamRole.Viewer, TeamArea.Trajectory, TeamAccess.Write), false);
        assert.equal(canAccessTeamArea(TeamRole.Viewer, TeamArea.Cluster, TeamAccess.Read), true);
        assert.equal(canAccessTeamArea(TeamRole.Admin, TeamArea.Cluster, TeamAccess.Write), false);
        assert.equal(canAccessTeamArea(null, TeamArea.Trajectory, TeamAccess.Read), false);
    });

    test('the creator of a team is its Owner', async () => {
        const lab = await newLab();
        assert.equal(await teamService.roleOf(lab.teamId, lab.ownerId), TeamRole.Owner);
    });

    test('an Admin changes a Member but cannot make anyone an Owner', async () => {
        const lab = await newLab();

        const promoted = await teamMemberService.updateById(lab.teamId, lab.members.viewer.id, TeamRole.Admin, { role: TeamRole.Member });
        assert.equal(promoted.role, TeamRole.Member);

        await assert.rejects(
            teamMemberService.updateById(lab.teamId, lab.members.member.id, TeamRole.Admin, { role: TeamRole.Owner }),
            refused(ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS)
        );
    });

    test('an Admin cannot change or remove an Owner', async () => {
        const lab = await newLab();
        const owner = await TeamMember.findOneByOrFail({
 team: lab.teamId, user: lab.ownerId 
});

        await assert.rejects(
            teamMemberService.updateById(lab.teamId, owner.id, TeamRole.Admin, { role: TeamRole.Viewer }),
            refused(ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS)
        );
        await assert.rejects(
            teamMemberService.deleteById(lab.teamId, owner.id, TeamRole.Admin),
            refused(ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS)
        );
    });

    test('the last Owner cannot step down', async () => {
        const lab = await newLab();
        const owner = await TeamMember.findOneByOrFail({
 team: lab.teamId, user: lab.ownerId 
});

        await assert.rejects(
            teamMemberService.updateById(lab.teamId, owner.id, TeamRole.Owner, { role: TeamRole.Admin }),
            refused(ErrorCodes.TEAM_LAST_OWNER)
        );

        await teamMemberService.updateById(lab.teamId, lab.members.admin.id, TeamRole.Owner, { role: TeamRole.Owner });
        const steppedDown = await teamMemberService.updateById(lab.teamId, owner.id, TeamRole.Owner, { role: TeamRole.Admin });
        assert.equal(steppedDown.role, TeamRole.Admin);
    });

    test('a member is found only through their own team', async () => {
        const lab = await newLab();
        const other = await newLab();

        await assert.rejects(
            teamMemberService.updateById(other.teamId, lab.members.member.id, TeamRole.Owner, { role: TeamRole.Viewer }),
            refused(ErrorCodes.TEAM_MEMBER_NOT_FOUND)
        );
        await assert.rejects(
            teamMemberService.deleteById(other.teamId, lab.members.member.id, TeamRole.Owner),
            refused(ErrorCodes.TEAM_MEMBER_NOT_FOUND)
        );
        assert.equal((await TeamMember.findOneByOrFail({ id: lab.members.member.id })).role, TeamRole.Member);
    });

    test('an accepted invitation gives the role it was sent with', async () => {
        const lab = await newLab();
        const guest = await newUser('guest');

        await assert.rejects(
            teamInvitationService.send(lab.teamId, lab.ownerId, TeamRole.Admin, {
 email: guest.email, role: TeamRole.Owner 
}),
            refused(ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS)
        );

        const invitation = await teamInvitationService.send(lab.teamId, lab.ownerId, TeamRole.Admin, { email: guest.email });
        assert.equal(invitation.role, TeamRole.Member);

        await teamInvitationService.accept(invitation.id, guest.id);
        assert.equal(await teamService.roleOf(lab.teamId, guest.id), TeamRole.Member);
        assert.equal((await TeamInvitation.findOneByOrFail({ id: invitation.id })).role, TeamRole.Member);
    });

    test('joining with an invite code makes a Member', async () => {
        const lab = await newLab();
        const { inviteCode } = await teamService.generateInviteCode(lab.teamId, lab.ownerId);
        const joiner = await newUser('joiner');

        await teamService.joinByCode(joiner.id, inviteCode ?? '');
        assert.equal(await teamService.roleOf(lab.teamId, joiner.id), TeamRole.Member);
    });

    test('an Admin manages invite codes', async () => {
        const lab = await newLab();
        const adminUser = lab.members.admin.user;

        assert.deepEqual(await teamService.checkInvitePermission(lab.teamId, adminUser), { canInvite: true });
        assert.deepEqual(await teamService.checkInvitePermission(lab.teamId, lab.members.member.user), { canInvite: false });
        const team = await teamService.generateInviteCode(lab.teamId, adminUser);
        assert.ok(team.inviteCode);
        assert.ok(await Team.findOneByOrFail({ id: lab.teamId }));
    });

    test('a secret key gets no role above its creator', async () => {
        const lab = await newLab();

        await assert.rejects(
            secretKeyService.create(lab.teamId, lab.members.admin.user, TeamRole.Admin, {
 role: TeamRole.Owner, name: 'ci' 
}),
            refused(ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS)
        );
        const created = await secretKeyService.create(lab.teamId, lab.ownerId, TeamRole.Owner, {
 role: TeamRole.Viewer, name: 'ci' 
});
        assert.equal(created.role, TeamRole.Viewer);
    });
});
