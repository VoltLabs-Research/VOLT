import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import SendAIConversationMessageUseCase from '@modules/ai/application/use-cases/SendAIConversationMessageUseCase';

@injectable()
export default class SendAIConversationMessageController extends BaseController<SendAIConversationMessageUseCase> {
    constructor(
        @inject(SendAIConversationMessageUseCase)
        useCase: SendAIConversationMessageUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
}
