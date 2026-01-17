import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';
import { CHAT_TOKENS } from '../../../di/ChatTokens';
import { SendFileMessageUseCase } from '@/src/modules/chat/application/use-cases/chat-message/SendFileMessageUseCase';

@injectable()
export default class SendFileMessageController extends BaseController<SendFileMessageUseCase> {
    constructor(
        @inject(delay(() => SendFileMessageUseCase))
        useCase: SendFileMessageUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
};