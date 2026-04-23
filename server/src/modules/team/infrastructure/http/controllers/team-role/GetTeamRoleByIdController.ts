import { ErrorCodes } from '@core/constants/error-codes';
import TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import { createGetByIdController } from '@shared/infrastructure/http/controllers/createReadController';

const GetTeamRoleByIdController = createGetByIdController({
    repositoryToken: TeamRoleRepository,
    paramKey: 'roleId',
    notFoundCode: ErrorCodes.TEAM_ROLE_NOT_FOUND,
    notFoundMessage: 'TeamRole not found'
});

export default GetTeamRoleByIdController;
