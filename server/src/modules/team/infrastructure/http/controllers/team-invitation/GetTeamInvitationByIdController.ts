import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { createGetByIdController } from '@shared/infrastructure/http/controllers/createReadController';

const GetTeamInvitationByIdController = createGetByIdController({
    repositoryToken: TEAM_TOKENS.TeamInvitationRepository,
    paramKey: 'invitationId',
    notFoundCode: ErrorCodes.TEAM_INVITATION_NOT_FOUND,
    notFoundMessage: 'TeamInvitation not found',
    populate: {
        path: 'invitedBy team',
        select: ['firstName', 'lastName', 'name', '_id']
    }
});

export default GetTeamInvitationByIdController;
