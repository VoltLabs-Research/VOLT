import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { SendChatMessageUseCase } from '@/src/modules/chat/application/use-cases/chat-message/SendChatMessageUseCase';

@injectable()
export default class SendChatMessageController extends BaseController<SendChatMessageUseCase> {
    constructor(
        @inject(delay(() => SendChatMessageUseCase))
        useCase: SendChatMessageUseCase
    ) {
        super(useCase);
    }
};