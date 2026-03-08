import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import RemoveUserFromTeamUseCase from '@modules/team/application/use-cases/team/RemoveUserFromTeamUseCase';

export default createController(RemoveUserFromTeamUseCase, {
    statusCode: HttpStatus.NoContent,
    extendParams: (_request, params) => ({
        ...params,
        toRemoveUserId: params.userId
    })
});
