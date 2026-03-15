import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateGroupInfoUseCase } from '@modules/chat/application/use-cases/chat/UpdateGroupInfoUseCase';

const UpdateGroupInfoController = createController(UpdateGroupInfoUseCase, {
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default UpdateGroupInfoController;
