import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import DeleteTeamRoleByIdUseCase from '@modules/team/application/use-cases/team-role/DeleteTeamRoleByIdUseCase';

const DeleteTeamRoleByIdController = createController(DeleteTeamRoleByIdUseCase, {
    statusCode: HttpStatus.NoContent,
    extendParams: (request, params) => ({
        teamId: params.teamId,
        roleId: params.roleId,
        userId: request.userId
    })
});

export default DeleteTeamRoleByIdController;
