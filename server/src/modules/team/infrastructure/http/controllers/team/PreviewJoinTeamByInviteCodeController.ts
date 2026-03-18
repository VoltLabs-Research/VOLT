import { createController } from '@shared/infrastructure/http/controllers/createController';
import PreviewJoinTeamByInviteCodeUseCase from '@modules/team/application/use-cases/team/PreviewJoinTeamByInviteCodeUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

const PreviewJoinTeamByInviteCodeController = createController(PreviewJoinTeamByInviteCodeUseCase, {
    statusCode: HttpStatus.OK,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default PreviewJoinTeamByInviteCodeController;
