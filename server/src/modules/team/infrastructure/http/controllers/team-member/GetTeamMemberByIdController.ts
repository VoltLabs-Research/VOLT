import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { createGetByIdController } from '@shared/infrastructure/http/controllers/createReadController';

const GetTeamMemberByIdController = createGetByIdController({
    repositoryToken: TEAM_TOKENS.TeamMemberRepository,
    paramKey: 'teamMemberId',
    notFoundCode: ErrorCodes.TEAM_MEMBER_NOT_FOUND,
    notFoundMessage: 'TeamMember not found'
});

export default GetTeamMemberByIdController;
