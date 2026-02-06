import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetChatMessagesUseCase } from '@modules/chat/application/use-cases/chat-message/GetChatMessagesUseCase';

@injectable()
export default class GetChatMessagesController extends BaseController<GetChatMessagesUseCase> {
    constructor(
        @inject(delay(() => GetChatMessagesUseCase))
        useCase: GetChatMessagesUseCase
    ) {
        super(useCase)
    };
};