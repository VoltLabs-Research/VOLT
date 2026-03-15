import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import JoinTeamByInviteCodeUseCase from '@modules/team/application/use-cases/team/JoinTeamByInviteCodeUseCase';

const JoinTeamByInviteCodeController = createController(JoinTeamByInviteCodeUseCase, {
    statusCode: HttpStatus.OK,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default JoinTeamByInviteCodeController;
