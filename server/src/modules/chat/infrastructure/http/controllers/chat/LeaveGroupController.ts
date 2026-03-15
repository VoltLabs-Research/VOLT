import { createController } from '@shared/infrastructure/http/controllers/createController';
import { LeaveGroupUseCase } from '@modules/chat/application/use-cases/chat/LeaveGroupUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

const LeaveGroupController = createController(LeaveGroupUseCase, {
    statusCode: HttpStatus.NoContent,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default LeaveGroupController;
