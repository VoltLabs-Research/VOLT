import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import { SendFileMessageUseCase } from '@modules/chat/application/use-cases/chat-message/SendFileMessageUseCase';

@injectable()
export default class SendFileMessageController extends BaseController<SendFileMessageUseCase> {
    constructor(
        @inject(delay(() => SendFileMessageUseCase))
        useCase: SendFileMessageUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
};