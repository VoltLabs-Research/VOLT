import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import { addTeamToUser, removeTeamFromUser } from '@modules/team/services/team/user-team-links';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';

interface RemoveMemberOutcome{
    warningCode?: string;
    teamDeleted: boolean;
}

const logMembershipWarning = (context: Record<string, string>, message: string) => {
    logger.warn(context, `[TeamMembershipService] ${message}`);
};

export default class TeamMembershipService{
    #eventBus = eventBus;

    async addMemberToTeam(userId: string, teamId: string, roleName: string = SystemRoleNames.MEMBER): Promise<void>{
        const existing = await TeamMember.findOneBy({
            team: teamId,
            user: userId
        });
        if(existing) return;
        const role = await TeamRole.findOneBy({
            name: roleName,
            team: teamId
        });
        if(!role) throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Role not found');
        await TeamMember.create({
            team: teamId,
            user: userId,
            role: role.id,
            joinedAt: new Date()
        }).save();
        await addTeamToUser(userId, teamId);
    }

    async removeMemberFromTeam(memberId: string, teamId: string): Promise<void>{
        const outcome = await TeamMember.getRepository().manager.transaction(async (manager): Promise<RemoveMemberOutcome> => {
            const membership = await manager.findOneBy(TeamMember, { id: memberId });
            const membershipUserId = membership ? membership.user : undefined;

            if(membership) await manager.remove(membership);
            if(membershipUserId){
                await removeTeamFromUser(membershipUserId, teamId, manager);
            }

            const membersCount = await manager.countBy(TeamMember, { team: teamId });
            const team = await manager.findOneBy(Team, { id: teamId });
            if(!team){
                return {
                    warningCode: ErrorCodes.TEAM_NOT_FOUND,
                    teamDeleted: false
                };
            }

            if(membersCount === 0){
                await manager.remove(team);
                return { teamDeleted: true };
            }

            const ownerRole = await manager.findOneBy(TeamRole, {
                team: team.id,
                name: 'Owner',
                isSystem: true
            });

            if(!ownerRole){
                return {
                    warningCode: ErrorCodes.TEAM_ROLE_NOT_FOUND,
                    teamDeleted: false
                };
            }

            const ownersCount = await manager.countBy(TeamMember, { role: ownerRole.id });
            if(ownersCount !== 0){
                return { teamDeleted: false };
            }

            const randomMember = await manager.findOneBy(TeamMember, { team: teamId });
            if(!randomMember){
                return {
                    warningCode: ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                    teamDeleted: false
                };
            }

            await manager.save(Object.assign(randomMember, { role: ownerRole.id }));

            return { teamDeleted: false };
        });

        if(outcome.warningCode !== undefined){
            logMembershipWarning({
                teamId,
                memberId,
                code: outcome.warningCode
            }, 'Team leave operation ignored');
            return;
        }

        if(outcome.teamDeleted){
            await this.#eventBus.emit('team.deleted', { teamId });
        }
    }
}
