import { createController } from '@shared/infrastructure/http/controllers/createController';
import { AddUsersToGroupUseCase } from '@modules/chat/application/use-cases/chat/AddUsersToGroupUseCase';

const AddUsersToGroupController = createController(AddUsersToGroupUseCase, {
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default AddUsersToGroupController;
