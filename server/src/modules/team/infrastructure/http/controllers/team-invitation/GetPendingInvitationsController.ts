import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { TeamInvitationStatus } from '@modules/team/domain/entities/team-invitation/TeamInvitation';
import { createListByController } from '@shared/infrastructure/http/controllers/createReadController';
import type { TeamInvitationProps } from '@modules/team/domain/entities/team-invitation/TeamInvitation';

const GetPendingInvitationsController = createListByController({
    repositoryToken: TEAM_TOKENS.TeamInvitationRepository,
    paginated: true,
    populate: {
        path: 'invitedUser'
    },
    filterBuilder: (params) => {
        const filter: Partial<TeamInvitationProps> = {
            team: params.teamId as string,
            status: TeamInvitationStatus.Pending
        };
        return filter;
    }
});

export default GetPendingInvitationsController;
