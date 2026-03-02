import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import DeleteAIConversationUseCase from '@modules/ai/application/use-cases/DeleteAIConversationUseCase';

@injectable()
export default class DeleteAIConversationController extends BaseController<DeleteAIConversationUseCase> {
    constructor(
        @inject(DeleteAIConversationUseCase)
        useCase: DeleteAIConversationUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
}
