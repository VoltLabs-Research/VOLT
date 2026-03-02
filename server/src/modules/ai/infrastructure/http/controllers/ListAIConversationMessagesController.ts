import { injectable, inject } from 'tsyringe';
import { PaginatedBaseController } from '@shared/infrastructure/http/PaginatedBaseController';
import ListAIConversationMessagesUseCase from '@modules/ai/application/use-cases/ListAIConversationMessagesUseCase';

@injectable()
export default class ListAIConversationMessagesController extends PaginatedBaseController<ListAIConversationMessagesUseCase> {
    constructor(
        @inject(ListAIConversationMessagesUseCase)
        useCase: ListAIConversationMessagesUseCase
    ) {
        super(useCase);
    }
}
