import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import UpdateAIConversationUseCase from '@modules/ai/application/use-cases/UpdateAIConversationUseCase';

@injectable()
export default class UpdateAIConversationController extends BaseController<UpdateAIConversationUseCase> {
    constructor(
        @inject(UpdateAIConversationUseCase)
        useCase: UpdateAIConversationUseCase
    ) {
        super(useCase);
    }
}
