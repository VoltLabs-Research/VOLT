import { injectable, inject } from 'tsyringe';
import { PaginatedBaseController } from '@shared/infrastructure/http/PaginatedBaseController';
import ListAIConversationsUseCase from '@modules/ai/application/use-cases/ListAIConversationsUseCase';

@injectable()
export default class ListAIConversationsController extends PaginatedBaseController<ListAIConversationsUseCase> {
    constructor(
        @inject(ListAIConversationsUseCase)
        useCase: ListAIConversationsUseCase
    ) {
        super(useCase);
    }
}
