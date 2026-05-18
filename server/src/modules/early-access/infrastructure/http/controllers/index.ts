import CreateEarlyAccessSubscriptionUseCase from '@modules/early-access/application/use-cases/CreateEarlyAccessSubscriptionUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

const CreateEarlyAccessSubscriptionController = createController(CreateEarlyAccessSubscriptionUseCase, {
    statusCode: HttpStatus.Created
});

export default {
    createSubscription: new CreateEarlyAccessSubscriptionController()
};
