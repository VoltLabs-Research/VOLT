import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import GenerateTeamInviteCodeUseCase from '@modules/team/application/use-cases/team/GenerateTeamInviteCodeUseCase';

const GenerateTeamInviteCodeController = createController(GenerateTeamInviteCodeUseCase, {
    statusCode: HttpStatus.OK,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default GenerateTeamInviteCodeController;
