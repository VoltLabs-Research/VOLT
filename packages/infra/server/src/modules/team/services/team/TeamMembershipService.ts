import eventBus from '@shared/events/PostgresEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import { addTeamToUser, removeTeamFromUser } from '@modules/team/services/team/user-team-links';
import logger from '@shared/logger';
import { TeamRole } from '@volt/contracts/modules/team/access';

interface RemoveMemberOutcome{
    warningCode?: string;
    teamDeleted: boolean;
}

class TeamMembershipService{

    async addMemberToTeam(userId: string, teamId: string, role: TeamRole = TeamRole.Member): Promise<void>{
        const existing = await TeamMember.findOneBy({
            team: teamId,
            user: userId
        });
        if(existing) return;
        await TeamMember.create({
            team: teamId,
            user: userId,
            role,
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

            const ownersCount = await manager.countBy(TeamMember, {
 team: team.id, role: TeamRole.Owner 
});
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

            await manager.save(Object.assign(randomMember, { role: TeamRole.Owner }));

            return { teamDeleted: false };
        });

        if(outcome.warningCode !== undefined){
            logger.warn({
                teamId,
                memberId,
                code: outcome.warningCode
            }, '[TeamMembershipService] Team leave operation ignored');
            return;
        }

        if(outcome.teamDeleted){
            await eventBus.emit('team.deleted', { teamId });
        }
    }
}

export default new TeamMembershipService();
