import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import CreateTeamUseCase from '@modules/team/application/use-cases/team/CreateTeamUseCase';

const CreateTeamController = createController(CreateTeamUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default CreateTeamController;
