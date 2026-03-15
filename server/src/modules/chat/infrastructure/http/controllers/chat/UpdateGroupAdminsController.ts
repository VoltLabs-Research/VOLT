import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateGroupAdminsUseCase } from '@modules/chat/application/use-cases/chat/UpdateGroupAdminsUseCase';

const UpdateGroupAdminsController = createController(UpdateGroupAdminsUseCase, {
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default UpdateGroupAdminsController;
