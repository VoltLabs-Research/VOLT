import { ErrorCodes } from '@core/constants/error-codes';
import TeamInvitationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-invitation/TeamInvitationRepository';
import { createGetByIdController } from '@shared/infrastructure/http/controllers/createReadController';

const GetTeamInvitationByIdController = createGetByIdController({
    repositoryToken: TeamInvitationRepository,
    paramKey: 'invitationId',
    notFoundCode: ErrorCodes.TEAM_INVITATION_NOT_FOUND,
    notFoundMessage: 'TeamInvitation not found',
    populate: {
        path: 'invitedBy team',
        select: ['firstName', 'lastName', 'name', '_id']
    }
});

export default GetTeamInvitationByIdController;
