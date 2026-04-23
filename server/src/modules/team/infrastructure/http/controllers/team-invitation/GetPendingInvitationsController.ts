import type { TeamInvitationProps } from '@modules/team/domain/entities/team-invitation/TeamInvitation';
import { TeamInvitationStatus } from '@modules/team/domain/entities/team-invitation/TeamInvitation';
import TeamInvitationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-invitation/TeamInvitationRepository';
import { createListByController } from '@shared/infrastructure/http/controllers/createReadController';

const GetPendingInvitationsController = createListByController({
    repositoryToken: TeamInvitationRepository,
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
