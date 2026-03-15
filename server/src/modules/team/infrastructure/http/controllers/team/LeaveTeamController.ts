import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import LeaveTeamUseCase from '@modules/team/application/use-cases/team/LeaveTeamUseCase';

const LeaveTeamController = createController(LeaveTeamUseCase, {
    statusCode: HttpStatus.NoContent,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default LeaveTeamController;
