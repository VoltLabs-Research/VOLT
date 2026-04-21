import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { createGetByIdController } from '@shared/infrastructure/http/controllers/createReadController';

const GetTeamRoleByIdController = createGetByIdController({
    repositoryToken: TEAM_TOKENS.TeamRoleRepository,
    paramKey: 'roleId',
    notFoundCode: ErrorCodes.TEAM_ROLE_NOT_FOUND,
    notFoundMessage: 'TeamRole not found'
});

export default GetTeamRoleByIdController;
